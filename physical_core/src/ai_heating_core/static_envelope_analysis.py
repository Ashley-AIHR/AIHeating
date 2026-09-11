"""Offline actuator-envelope analysis, never a runtime controller."""
from functools import lru_cache
from math import fsum, sqrt

from .contracts import Controls, ZONES
from .hydraulics import solve_hydraulics
from .thermal import envelope_loss, radiator, radiator_conductance

BOUNDS=((40.,60.),(30.,50.),(.2,1.),(.2,1.),(.2,1.))
BANDS={"hard":(18.,25.),"comfort":(20.,22.)}
FEASIBILITY_TOLERANCE_C=1e-7


def violations(temperatures,band,indices=None):
    lo,hi=BANDS[band]
    indices=range(len(temperatures)) if indices is None else indices
    return [max(lo-temperatures[i],temperatures[i]-hi,0.) for i in indices]


class StaticEvaluator:
    def __init__(self,parameters):
        self.parameters=parameters
        self.indices={"all":list(range(12)),**{z:[i for i,b in enumerate(parameters.buildings) if b.zone==z] for z in ZONES}}
        self.evaluations=0
        self.hydraulic_solves=0
        self.max_hydraulic_residual=0.
        self.max_thermal_residual_w=0.
        self.max_mass_residual=0.
        # Bound cache size for long continuous searches; values always originate in accepted solver.
        self.hydraulic_point=lru_cache(maxsize=32768)(self._hydraulic_point)

    def _hydraulic_point(self,pump,near,mid,far):
        p=self.parameters
        h=solve_hydraulics(p,Controls(50.,pump,(near,mid,far)))
        self.hydraulic_solves+=1
        self.max_hydraulic_residual=max(self.max_hydraulic_residual,h.solver.normalized_residual)
        masses=[];conductances=[]
        for b in p.buildings:
            zone_index=ZONES.index(b.zone)
            total=fsum(x.flow_share_weight for x in p.buildings if x.zone==b.zone)
            mass=p.water.rho_water*h.flows_m3_s[zone_index]*b.flow_share_weight/total
            masses.append(mass)
            conductances.append(radiator_conductance(mass,b.radiator_ua_w_k,p.water))
        for z,q in zip(ZONES,h.flows_m3_s):
            self.max_mass_residual=max(self.max_mass_residual,abs(fsum(masses[i] for i in self.indices[z])-p.water.rho_water*q)/(p.water.rho_water*q))
        return h,masses,conductances

    def evaluate(self,actuators,outdoor):
        supply,pump,near,mid,far=map(float,actuators)
        Controls(supply,pump,(near,mid,far))  # validate legal static equipment inputs; no slew restriction
        h,masses,conductances=self.hydraulic_point(pump,near,mid,far)
        temperatures=[];residuals=[];powers=[]
        for b,m,g in zip(self.parameters.buildings,masses,conductances):
            loss=1/b.thermal_resistance_k_w
            unheated=outdoor+b.internal_gain_w/loss
            t=unheated if unheated>=supply else (g*supply+loss*outdoor+b.internal_gain_w)/(g+loss)
            power,returned=radiator(supply,t,m,b.radiator_ua_w_k,self.parameters.water)
            residual=power+b.internal_gain_w-envelope_loss(b,t,outdoor)
            temperatures.append(t);residuals.append(residual);powers.append(power)
        residual=max(map(abs,residuals))
        if residual>=1e-6:
            raise ArithmeticError("Static equilibrium failed substitution into accepted heat balance")
        self.evaluations+=1
        self.max_thermal_residual_w=max(self.max_thermal_residual_w,residual)
        return {"outdoorC":float(outdoor),"actuators":{"supplyC":supply,"pumpHz":pump,"nearValve":near,"midValve":mid,"farValve":far},
            "actuatorVector":[supply,pump,near,mid,far],"buildingIndoorC":dict(zip((b.building_id for b in self.parameters.buildings),temperatures)),
            "hardViolationsC":violations(temperatures,"hard"),"comfortViolationsC":violations(temperatures,"comfort"),
            "hardMaxViolationC":max(violations(temperatures,"hard")),"comfortMaxViolationC":max(violations(temperatures,"comfort")),
            "minimumIndoorC":min(temperatures),"maximumIndoorC":max(temperatures),"rangeSpreadC":max(temperatures)-min(temperatures),
            "zoneFlowsM3s":dict(zip(ZONES,h.flows_m3_s)),"totalFlowM3s":h.total_flow_m3_s,
            "hydraulicResidual":h.solver.normalized_residual,"thermalResidualW":residual,
            "buildingHeatBalanceResidualW":dict(zip((b.building_id for b in self.parameters.buildings),residuals)),
            "radiatorPowerW":dict(zip((b.building_id for b in self.parameters.buildings),powers))}

    def score(self,record,band,scope):
        return max(record[band+"ViolationsC"][i] for i in self.indices[scope])

    def annotate(self,record,band,scope):
        value=self.score(record,band,scope)
        ids=list(record["buildingIndoorC"])
        violations=record[band+"ViolationsC"]
        lo,hi=BANDS[band]
        temperatures=list(record["buildingIndoorC"].values())
        slack={i:min(temperatures[i]-lo,hi-temperatures[i]) for i in self.indices[scope]}
        binding=[ids[i] for i in self.indices[scope] if abs(slack[i]-min(slack.values()))<1e-5]
        return {**record,"band":band,"scope":scope,"objectiveMaxViolationC":value,"feasible":value<=FEASIBILITY_TOLERANCE_C,
            "violatingBuildingIds":[ids[i] for i in self.indices[scope] if violations[i]>FEASIBILITY_TOLERANCE_C],
            "bindingBuildings":binding,"scopedMinIndoorC":min(temperatures[i] for i in self.indices[scope]),
            "scopedMaxIndoorC":max(temperatures[i] for i in self.indices[scope])}


def relaxed_zone_certificate(parameters,outdoor,zone,band):
    """Monotone interval exclusion over a SUPERSET of legal zone flows.

    This is a mathematical necessary-condition bound, not an operating candidate.
    No flows from it are presented as hydraulic-solver solutions.
    """
    branch=next(b for b in parameters.branches if b.zone==zone)
    profiles=[b for b in parameters.buildings if b.zone==zone]
    shares=[b.flow_share_weight/fsum(x.flow_share_weight for x in profiles) for b in profiles]
    shutoff=parameters.water.rho_water*parameters.water.g*parameters.pump.shutoff_head_m*(50/parameters.pump.reference_frequency_hz)**2
    # Drop positive common loss and use valve fully open: conservative upper flow bound.
    maximum=sqrt(shutoff/(branch.pipe_k_pa_s2_m6+branch.valve_ref_k_pa_s2_m6))
    lo_t,hi_t=BANDS[band]
    def supply_bounds(q):
        if q==0:
            return float("inf"),float("inf")
        lower=[];upper=[]
        for b,share in zip(profiles,shares):
            g=radiator_conductance(parameters.water.rho_water*q*share,b.radiator_ua_w_k,parameters.water)
            low=(lo_t-outdoor)/b.thermal_resistance_k_w-b.internal_gain_w
            high=(hi_t-outdoor)/b.thermal_resistance_k_w-b.internal_gain_w
            if low<=0 or high<=0:
                raise ValueError("Certificate monotonic heating proof requires positive maintenance loads")
            lower.append(lo_t+low/g);upper.append(hi_t+high/g)
        return max(lower),min(upper)
    pending=[(0.,maximum)];excluded=[];unresolved=[]
    while pending:
        low,high=pending.pop()
        required=max(40.,supply_bounds(high)[0])
        allowed=min(60.,supply_bounds(low)[1])
        if required>allowed+1e-7:
            excluded.append({"flowIntervalM3s":[low,high],"requiredSupplyLowerBoundC":required,"allowedSupplyUpperBoundC":allowed})
        elif high-low<1e-9 or len(excluded)+len(pending)>20000:
            unresolved.append([low,high])
            break
        else:
            middle=(low+high)/2
            pending.extend(((low,middle),(middle,high)))
    return {"zone":zone,"band":band,"outdoorC":outdoor,"relaxedFlowBoundsM3s":[0.,maximum],
        "certifiedInfeasible":not unresolved and not pending,"excludedIntervals":excluded,
        "unresolvedInterval":unresolved,"remainingIntervals":len(pending),
        "logic":"L(q) and U(q) strictly decrease for positive maintenance loads. On [a,b], feasible Ts requires max(40,L(b)) <= min(60,U(a)). Excluding every interval in a hydraulic superset proves no legal zone solution. Not a numerical optimum certificate."}
