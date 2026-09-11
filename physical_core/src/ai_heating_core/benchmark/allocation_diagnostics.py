"""Measured building exposure and static emitter authority; never controller input."""
from math import fsum

from ..contracts import Controls, ZONES
from ..control.traditional import interpolate
from ..hydraulics import solve_hydraulics
from ..thermal import radiator_conductance, required_load
from .metrics import thermal_metrics


def design_required(profile):
    return max(0.0, (21 - (-10)) / profile.thermal_resistance_k_w - profile.internal_gain_w)


def building_diagnostic(parameters, run):
    rows=[]
    for p in parameters.buildings:
        states=[f.buildings[p.building_id] for f in run.frames]
        mean=lambda values: fsum(values)/len(states)
        peers=[b for b in parameters.buildings if b.zone==p.zone]
        rows.append({"buildingId":p.building_id,"zone":p.zone,"heatedAreaM2":p.heated_area_m2,
            "insulationLevel":p.insulation_level,"envelopeHWK":1/p.thermal_resistance_k_w,
            "thermalRKW":p.thermal_resistance_k_w,"thermalCJK":p.thermal_capacitance_j_k,
            "radiatorUAWK":p.radiator_ua_w_k,"flowShareWeight":p.flow_share_weight,
            "designEnvelopeLossW":31/p.thermal_resistance_k_w,"designInternalGainW":p.internal_gain_w,
            "designRequiredHeatW":design_required(p),
            "actualFlowShare":p.flow_share_weight/fsum(b.flow_share_weight for b in peers),
            "areaFlowShare":p.heated_area_m2/fsum(b.heated_area_m2 for b in peers),
            "designLoadShare":design_required(p)/fsum(design_required(b) for b in peers),
            "averageAllocatedFlowM3h":mean(s.building_water_flow_kg_s/parameters.water.rho_water*3600 for s in states),
            "averageIndoorC":mean(s.indoor_temperature_c for s in states),
            **thermal_metrics([s.indoor_temperature_c for s in states]),
            "severeOverheatingFrames":sum(s.indoor_temperature_c>25 for s in states),
            "underheatingFrames":sum(s.indoor_temperature_c<18 for s in states),
            "averageRadiatorPowerW":mean(s.heating_power_w for s in states),
            "averageInstantaneousRequiredLoadW":mean(required_load(p,f.weather,target_c=parameters.target_indoor_c) for f in run.frames)})
    return {"sampleCountPerBuilding":len(run.frames),"designIndoorC":21,"designOutdoorC":-10,"solarAtDesignWm2":0,
            "buildings":rows,"normalizedShareMismatch":{z:fsum(abs(r["actualFlowShare"]-r["designLoadShare"]) for r in rows if r["zone"]==z) for z in ZONES},
            "summary":run.summary}


def authority(parameters,config,outdoor_c=-5):
    controls=Controls(interpolate(config.supply_curve,outdoor_c),interpolate(config.pump_curve,outdoor_c),config.valves)
    hydraulic=solve_hydraulics(parameters,controls)
    zones={}
    for z,q in zip(ZONES,hydraulic.flows_m3_s):
        profiles=[b for b in parameters.buildings if b.zone==z]
        weights=fsum(b.flow_share_weight for b in profiles)
        rows=[]
        for b in profiles:
            mass=parameters.water.rho_water*q*b.flow_share_weight/weights
            g=radiator_conductance(mass,b.radiator_ua_w_k,parameters.water)
            h=1/b.thermal_resistance_k_w
            supply=lambda target: target+max(0,h*(target-outdoor_c)-b.internal_gain_w)/g
            rows.append({"buildingId":b.building_id,"massFlowKgS":mass,"emitterConductanceWK":g,
                "designEnvelopeLossW":h*31,"designInternalGainW":b.internal_gain_w,"designRequiredHeatW":design_required(b),
                "minSupplyFor18C":supply(18),"maxSupplyFor25C":supply(25),
                "supplyForDesign21C":21+design_required(b)/g,
                "powerAt21CBySupplyW":{str(t):g*(t-21) for t in (47,51,55)},
                "equilibriumIndoorAtPolicySupplyC":(g*controls.supply_c+h*outdoor_c+b.internal_gain_w)/(g+h),
                "infiniteFlowSupplyFor21C":21+design_required(b)/b.radiator_ua_w_k})
        lower=max(rows,key=lambda r:r["minSupplyFor18C"])
        upper=min(rows,key=lambda r:r["maxSupplyFor25C"])
        lo,hi=lower["minSupplyFor18C"],upper["maxSupplyFor25C"]
        zones[z]={"buildings":rows,"unclippedFeasibleSupplyIntervalC":[lo,hi],
            "equipmentFeasibleSupplyIntervalC":[max(40,lo),min(60,hi)],
            "lowerBoundBuilding":lower["buildingId"],"upperBoundBuilding":upper["buildingId"],
            "status":"ZONE-LEVEL CONTROL AUTHORITY CONFLICT" if max(40,lo)>min(60,hi) else "NONEMPTY"}
    return {"outdoorC":outdoor_c,"solarWm2":0,"windows":0,"pumpHz":controls.frequency_hz,
            "policySupplyC":controls.supply_c,"fixedValves":controls.valves,"zones":zones,
            "interpretation":"Steady, adiabatic delivered common supply, accepted NTU conductance at fixed flow; not transient feasibility or a new control law."}


def markdown_table(headers,rows):
    def fmt(v):
        return f"{v:.6g}" if isinstance(v,float) else str(v)
    return "\n".join("| "+" | ".join(map(fmt,row))+" |" for row in [headers,["---"]*len(headers),*rows])


def diagnostic_markdown(data,title):
    rows=data["buildings"]
    text=[f"# {title}","","Actual Normal Winter simulation: 288 five-minute evaluation endpoints per building; warm-up excluded. Original CSV indoor values are checked against the rerun. Power/flow means use interval-mean physical output, not inferred summary KPIs.",""]
    tables=[("Static profiles",["buildingId","zone","heatedAreaM2","insulationLevel","envelopeHWK","thermalRKW","thermalCJK","radiatorUAWK","flowShareWeight"]),
        ("Design and allocation (21°C indoors, −10°C outdoors, no solar)",["buildingId","designEnvelopeLossW","designInternalGainW","designRequiredHeatW","actualFlowShare","areaFlowShare","designLoadShare","averageAllocatedFlowM3h"]),
        ("Measured temperatures and building-time fractions",["buildingId","averageIndoorC","minimumIndoorC","maximumIndoorC","comfortRate","overheatingRate","severeOverheatingRate","underheatingRate"]),
        ("Measured heating and persistence",["buildingId","severeOverheatingFrames","underheatingFrames","averageRadiatorPowerW","averageInstantaneousRequiredLoadW"])]
    for heading,keys in tables:
        text += [f"## {heading}","",markdown_table(keys,[[r[k] for k in keys] for r in rows]),""]
    text += ["## Allocation mismatch","","Normalized L1 mismatch = Σ_building |actual share − design-load share| within each zone. Zero is exact share agreement; range 0–2. No area weighting of exposure rates.","",str(data["normalizedShareMismatch"]),"",
             "Severe-overheat contributors: "+", ".join(f"{r['buildingId']} ({r['severeOverheatingFrames']}/288 frames)" for r in rows if r["severeOverheatingFrames"]),
             "Underheating contributors: "+", ".join(f"{r['buildingId']} ({r['underheatingFrames']}/288 frames)" for r in rows if r["underheatingFrames"]),""]
    return "\n".join(text)
