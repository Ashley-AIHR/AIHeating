"""One static allocation correction; review Normal before further stress runs."""
from dataclasses import asdict, replace
import json
from pathlib import Path

from ai_heating_core.benchmark.allocation_diagnostics import authority, building_diagnostic, diagnostic_markdown
from ai_heating_core.benchmark.freeze import verify_file_hashes, write_immutable_json
from ai_heating_core.benchmark.runner import convergence, run_baseline
from ai_heating_core.benchmark.state import content_hash
from ai_heating_core.control.commissioning import commission
from ai_heating_core.control.traditional import config_from_dict, config_to_dict
from ai_heating_core.p2_1_scenarios import scenarios
from ai_heating_core.parameters import synthetic_parameters
from ai_heating_core.physical_fixture_v1_1 import FIXTURE_VERSION, MINIMUM_WEIGHT_W, design_load_parameters

ROOT=Path(__file__).resolve().parents[2]


def main():
    old=json.loads((ROOT/"p2_1_diagnostic_v1_0.json").read_text())
    if verify_file_hashes(ROOT,json.loads((ROOT/"p2_1_historical_v1_0_hashes.json").read_text())):
        raise ValueError("Historical evidence changed")
    p=design_load_parameters()
    commissioned=commission(p)
    config=replace(config_from_dict(json.loads((ROOT/"p2_controller_config.json").read_text())),
                   version="traditional-v1.1",parameter_set_id=FIXTURE_VERSION,
                   valves=tuple(commissioned["fixedValveFractions"]),warmup_hours=72)
    normal=scenarios()[0]
    initial=convergence(normal,config,(72,96))
    config=replace(config,warmup_hours=initial["recommendedWarmupHours"])
    fallback=convergence(normal,config,(96,120)) if config.warmup_hours==96 else None
    chosen=initial if config.warmup_hours==72 else fallback
    if chosen["maxIndoorDifferenceC"]>=.2:
        raise ValueError("Warm-up not converged; no threshold relaxation permitted")
    result=run_baseline(normal,config)
    diagnostic=building_diagnostic(p,result)
    diagnostic["staticAuthority"]=[authority(p,config,t) for t in (-10,-5)]
    parameter_export={"fixtureVersion":FIXTURE_VERSION,"flowAllocationMethod":"design-maintenance-load-share",
        "designIndoorC":21,"designOutdoorC":-10,"solarAtDesignWm2":0,"minimumWeightW":MINIMUM_WEIGHT_W,
        "physicalParameterHash":content_hash(asdict(p)),"parameters":asdict(p),
        "buildingDesignLoads":[{"buildingId":b.building_id,"designRequiredHeatW":row["designRequiredHeatW"],
            "flowShareWeight":b.flow_share_weight,"previousAreaWeight":before.flow_share_weight}
            for b,before,row in zip(p.buildings,synthetic_parameters().buildings,diagnostic["buildings"],strict=True)]}
    write_immutable_json(ROOT/"p1a_parameters_physical_fixture_v1.1.json",parameter_export)
    write_immutable_json(ROOT/"p2_1_diagnostic_v1_1.json",diagnostic)
    (ROOT/"P2_1_BUILDING_DIAGNOSTIC_V1_1.md").write_text(diagnostic_markdown(diagnostic,"P2.1 Building Diagnostic — v1.1 Candidate").replace("Original CSV indoor values are checked against the rerun.","Candidate is a fresh warm-up/run; no v1.0 initial state is reused."))
    review={"config":config_to_dict(config),"commissioning":commissioned,"warmupComparison":initial,
        "fallbackConvergence":fallback,"normalV1_0":old["summary"],"normalV1_1":result.summary,
        "noCurveChanges":True,"noSecondaryParameterChanges":True,"status":"AWAITING_MEASURED_REVIEW"}
    write_immutable_json(ROOT/"p2_1_candidate_review.json",review)
    print(json.dumps({"warmupHours":config.warmup_hours,"acceptedWarmupDifferenceC":chosen["maxIndoorDifferenceC"],
        "normalV1_1":result.summary,"authority":[{"outdoorC":a["outdoorC"],"zones":{z:{k:v for k,v in data.items() if k!="buildings"} for z,data in a["zones"].items()}} for a in diagnostic["staticAuthority"]]},indent=2))


if __name__=="__main__":main()
