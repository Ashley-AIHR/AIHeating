"""Recommission and run the unchanged Traditional policy on fixture v1.2."""
import csv
from dataclasses import asdict, replace
import json
from math import fsum
from pathlib import Path

from ai_heating_core.benchmark.allocation_diagnostics import building_diagnostic
from ai_heating_core.benchmark.runner import convergence, run_baseline
from ai_heating_core.contracts import ZONES
from ai_heating_core.control.commissioning import commission
from ai_heating_core.control.traditional import config_from_dict, config_to_dict
from ai_heating_core.p1_2_scenarios import scenarios
from ai_heating_core.physical_fixture_v1_2 import FIXTURE_VERSION, coherent_parameters
from run_p2_baselines import row_for

ROOT = Path(__file__).resolve().parents[2]
DEST = ROOT / "p1_2_candidate_results"


def commissioned_fixture():
    parameters = coherent_parameters()
    target_view = replace(parameters, buildings=tuple(replace(b, heated_area_m2=b.flow_share_weight)
                                                      for b in parameters.buildings))
    result = commission(target_view)
    zone_flows = {z: fsum(b.flow_share_weight for b in parameters.buildings if b.zone == z) for z in ZONES}
    total = fsum(zone_flows.values())
    return {**{k: v for k, v in result.items() if k != "zoneHeatedAreaM2"},
        "method": "static-design-flow-shares-anchor85-round5pp-v1",
        "zoneDesignMassFlowKgS": zone_flows,
        "targetShares": {z: zone_flows[z] / total for z in ZONES},
        "zoneTargetMetadataNote": "commission() target-view heated_area_m2 values are design mass-flow weights only; physical heated areas remain unchanged.",
        "rationale": "Same hydraulic solver, 45 Hz design point, 85% limiting-branch anchor, valve bounds and 5pp rounding; targets are summed building design flows."}


def base_config(commissioning, warmup_hours):
    historical = json.loads((ROOT / "p2_1_candidate_review.json").read_text())["config"]
    value = {**historical, "controllerVersion": "traditional-v1.2",
        "fixedZoneValves": dict(zip(ZONES, [100 * x for x in commissioning["fixedValveFractions"]])),
        "commissioningMethod": commissioning["method"], "warmupHours": warmup_hours,
        "physicalParameterSetId": FIXTURE_VERSION}
    return config_from_dict(value)


def main():
    search = json.loads((ROOT / "p1_2_static_feasible_envelope.json").read_text())
    hard_minus10 = next(o for c in search["cases"] if c["outdoorC"] == -10
                        for o in c["objectives"] if o["band"] == "hard" and o["scope"] == "all")
    if not hard_minus10["best"]["feasible"]:
        raise RuntimeError("Benchmark is ineligible: −10°C hard feasibility was not restored")
    commissioning = commissioned_fixture()
    initial_convergence = convergence(scenarios()[0], base_config(commissioning, 72), (72, 96))
    if initial_convergence["maxIndoorDifferenceC"] < .2:
        warmup_hours, fallback = 72, None
    else:
        warmup_hours = 96
        fallback = convergence(scenarios()[0], base_config(commissioning, 96), (96, 120))
        if fallback["maxIndoorDifferenceC"] >= .2:
            raise RuntimeError("Neither permitted warm-up convergence comparison passed")
    config = base_config(commissioning, warmup_hours)
    DEST.mkdir(exist_ok=True)
    summaries, diagnostics = [], {}
    for scenario in scenarios():
        result = run_baseline(scenario, config)
        rows = [row_for(frame, state) for frame, state in zip(result.frames, result.controller_states, strict=True)]
        with (DEST / f"p2_{scenario.scenario_id}_v1.2.csv").open("w", newline="") as output:
            writer = csv.DictWriter(output, fieldnames=rows[0]); writer.writeheader(); writer.writerows(rows)
        (DEST / f"initial_state_{scenario.scenario_id}_v1.2.json").write_text(
            json.dumps(result.initial_state, indent=2, allow_nan=False) + "\n")
        summaries.append(result.summary)
        diagnostics[scenario.scenario_id] = building_diagnostic(scenario.parameters(), result)
        print(f"{scenario.scenario_id}: compliance={result.summary['complianceRate']:.6%}; severe={result.summary['severeOverheatingRate']:.6%}", flush=True)
    config_record = {**config_to_dict(config), "commissioningMethod": commissioning["method"]}
    payload = {"physicalFixtureVersion": FIXTURE_VERSION, "controllerConfig": config_record,
        "commissioning": commissioning, "warmupComparison72v96": initial_convergence,
        "fallbackComparison96v120": fallback, "summaries": summaries,
        "buildingDiagnostics": diagnostics, "scenarioManifests": [s.manifest(config) for s in scenarios()]}
    (DEST / "benchmark_v1.2.json").write_text(json.dumps(payload, indent=2, allow_nan=False) + "\n")
    (ROOT / "p1_2_controller_config.json").write_text(json.dumps(config_record, indent=2, allow_nan=False) + "\n")
    (ROOT / "p1_2_commissioning_results.json").write_text(json.dumps(commissioning, indent=2, allow_nan=False) + "\n")


if __name__ == "__main__":
    main()
