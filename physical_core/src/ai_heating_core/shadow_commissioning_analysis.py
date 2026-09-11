"""Offline target-source adapter; never changes the physical parameter provider."""
from dataclasses import replace
from math import fsum

from .contracts import Controls, ZONES
from .control.commissioning import commission
from .hydraulics import solve_hydraulics


def compare_commissioning(parameters):
    area=commission(parameters)
    loads={z:fsum(max(0,31/b.thermal_resistance_k_w-b.internal_gain_w) for b in parameters.buildings if b.zone==z) for z in ZONES}
    # commission() has an internal area-share input instead of a shares argument.
    # Only this temporary target-weight view substitutes design loads for that input.
    # It is NEVER passed to SimulationEngine; no R/C/UA/flow weight/branch field changes.
    target_view=replace(parameters,buildings=tuple(replace(b,heated_area_m2=max(0,31/b.thermal_resistance_k_w-b.internal_gain_w)) for b in parameters.buildings))
    shadow=commission(target_view)
    def record(result):
        hydraulic=solve_hydraulics(parameters,Controls(frequency_hz=result["designFrequencyHz"],valves=result["fixedValveFractions"]))
        if hydraulic.flows_m3_s!=tuple(result["finalFlowM3s"]):
            raise ValueError("Target-only adapter unexpectedly changed physical hydraulics")
        return {**result,"actualResultingShares":dict(zip(ZONES,[q/hydraulic.total_flow_m3_s for q in hydraulic.flows_m3_s]))}
    shadow_record=record(shadow)
    shadow_record["zoneDesignLoadTargetWeightsW"]=shadow_record.pop("zoneHeatedAreaM2")
    shadow_record["targetSource"]="design-maintenance-load-share"
    shadow_record["rationale"]="Same accepted design pump, limiting-branch anchor and practical rounding; only zone target shares use design maintenance loads."
    return {"zoneDesignLoadsW":loads,"designLoadTargetShares":{z:q/fsum(loads.values()) for z,q in loads.items()},
        "area":record(area),"shadowDesignLoad":shadow_record,
        "adapter":"Exact existing commission() called twice. A disposable target-weight metadata view changes only its internally computed shares; original physical parameters always enter simulation. Legacy area target-weight output is relabelled W in the shadow result, not exported as physical area.",
        "physicalFixtureChanged":False,"baselinePromotion":False}
