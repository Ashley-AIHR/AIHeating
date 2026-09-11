"""Deterministic Far-resistance adequacy sweep; no controller or fixture changes."""
import csv
from dataclasses import replace
import json
from math import fsum
from pathlib import Path

from ai_heating_core.benchmark.runner import run_baseline
from ai_heating_core.control.traditional import config_from_dict
from ai_heating_core.contracts import ZONES
from ai_heating_core.p1_2_scenarios import scenarios
from run_p2_baselines import row_for

ROOT = Path(__file__).resolve().parents[2]
MULTIPLIERS = (1.0, 1.5, 2.0, 2.5, 3.0)


def mean(values):
    values = list(values)
    return fsum(values) / len(values)


def main():
    config = config_from_dict(json.loads((ROOT / "p2_controller_config_v1.2.json").read_text()
                                         if (ROOT / "p2_controller_config_v1.2.json").exists()
                                         else (ROOT / "p1_2_controller_config.json").read_text()))
    reference = scenarios()[4]
    runs = {multiplier: run_baseline(replace(reference, far_pipe_multiplier=multiplier), config)
            for multiplier in MULTIPLIERS}
    healthy = runs[1.0]
    healthy_flows = healthy.frames[0].hydraulics.flows_m3_s
    healthy_average = tuple(mean(frame.hydraulics.flows_m3_s[i] for frame in healthy.frames) for i in range(3))
    healthy_zone_temperature = {zone: mean(frame.buildings[b.building_id].indoor_temperature_c
        for frame in healthy.frames for b in replace(reference, far_pipe_multiplier=1.0).parameters().buildings if b.zone == zone)
        for zone in ZONES}
    common_state_keys = ("buildingIndoorC", "previousHydraulicFlowsM3s", "controls", "transport",
                         "heatEnergyJ", "pumpEnergyJ", "controllerState")
    same_warmup = all(all(run.initial_state[key] == healthy.initial_state[key] for key in common_state_keys)
                      for run in runs.values())
    records = []
    for multiplier, run in runs.items():
        first = run.frames[0].hydraulics.flows_m3_s
        average = tuple(mean(frame.hydraulics.flows_m3_s[i] for frame in run.frames) for i in range(3))
        zone_temperature = {zone: mean(frame.buildings[b.building_id].indoor_temperature_c
            for frame in run.frames for b in replace(reference, far_pipe_multiplier=multiplier).parameters().buildings if b.zone == zone)
            for zone in ZONES}
        records.append({"farPipeResistanceMultiplier": multiplier,
            "firstFrameFlowsM3H": dict(zip(ZONES, [q * 3600 for q in first])),
            "firstFrameFlowChangePctVsHealthy": dict(zip(ZONES, [100 * (q / h - 1) for q, h in zip(first, healthy_flows)])),
            "averageFlowsM3H": dict(zip(ZONES, [q * 3600 for q in average])),
            "averageFlowChangePctVsHealthy": dict(zip(ZONES, [100 * (q / h - 1) for q, h in zip(average, healthy_average)])),
            "zoneMeanIndoorC": zone_temperature,
            "zoneMeanIndoorChangeCVsHealthy": {z: zone_temperature[z] - healthy_zone_temperature[z] for z in ZONES},
            "summary": run.summary,
            "maxHydraulicResidual": max(frame.hydraulics.solver.normalized_residual for frame in run.frames)})
    current = next(record for record in records if record["farPipeResistanceMultiplier"] == 2.0)
    current_adequate = (15 <= -current["firstFrameFlowChangePctVsHealthy"]["far"]
                        and current["zoneMeanIndoorChangeCVsHealthy"]["far"] <= -.1
                        and current["firstFrameFlowChangePctVsHealthy"]["near"] > 0
                        and current["firstFrameFlowChangePctVsHealthy"]["mid"] > 0
                        and current["summary"]["solverFailureCount"] == 0)
    preferred = [record for record in records if 25 <= -record["firstFrameFlowChangePctVsHealthy"]["far"] <= 35]
    if current_adequate:
        decision, selected, role = "A — CURRENT SCENARIO ADEQUATE", current, "primary"
    elif preferred and any(record["zoneMeanIndoorChangeCVsHealthy"]["far"] <= -.1 for record in preferred):
        decision = "B — REVISE DISTURBANCE ONLY"
        selected = min(preferred, key=lambda record: abs(-record["firstFrameFlowChangePctVsHealthy"]["far"] - 30))
        role = "primary"
    else:
        decision, selected, role = "C — HYDRAULIC SCENARIO NOT USEFUL", current, "secondary"
    current_run = runs[2.0]
    existing = json.loads((ROOT / "p1_2_candidate_results/benchmark_v1.2.json").read_text())
    expected_summary = next(s for s in existing["summaries"] if s["scenarioId"] == "hydraulic_imbalance")
    with (ROOT / "p1_2_candidate_results/p2_hydraulic_imbalance_v1.2.csv").open(newline="") as source:
        exported = list(csv.DictReader(source))
    actual = [{key: str(value) for key, value in row_for(frame, state).items()}
              for frame, state in zip(current_run.frames, current_run.controller_states, strict=True)]
    reproduction_checks = {"summaryExact": current_run.summary == expected_summary,
        "csvExact": exported == actual,
        "initialStateExact": json.loads(json.dumps(current_run.initial_state)) == json.loads((ROOT / "p1_2_candidate_results/initial_state_hydraulic_imbalance_v1.2.json").read_text())}
    exact_reproduction = all(reproduction_checks.values())
    buildings = []
    for building in reference.parameters().buildings:
        temperatures = [frame.buildings[building.building_id].indoor_temperature_c for frame in current_run.frames]
        buildings.append({"buildingId": building.building_id, "zone": building.zone,
                          "minimumIndoorC": min(temperatures), "meanIndoorC": mean(temperatures),
                          "maximumIndoorC": max(temperatures), "finalIndoorC": temperatures[-1]})
    output = {"analysisVersion": "p2-v1.2-final-scenario-adequacy-v1",
        "variedFieldOnly": "far.pipe_k_pa_s2_m6 multiplier at evaluation start",
        "multipliers": list(MULTIPLIERS), "identicalWarmupPhysicalState": same_warmup,
        "healthyPreDisturbanceFlowsM3H": dict(zip(ZONES, [q * 3600 for q in healthy.initial_state["previousHydraulicFlowsM3s"]])),
        "response": records, "currentReferenceExactReproduction": exact_reproduction,
        "currentReferenceReproductionChecks": reproduction_checks,
        "currentReferenceBuildings": buildings, "decision": decision,
        "selectedMultiplier": selected["farPipeResistanceMultiplier"], "selectedFutureBenchmarkRole": role,
        "predeclaredAdequacyRule": "Retain current 2x when Far first-frame flow falls at least 15%, Near and Mid both gain flow, Far mean indoor response is at least 0.1°C downward, and all solves remain stable. Otherwise prefer the closest tested 25–35% Far-flow reduction with observable thermal response; downgrade if that range remains thermally weak.",
        "selectionNotBasedOnAI": True}
    (ROOT / "p2_final_scenario_adequacy_sweep_v1.2.json").write_text(json.dumps(output, indent=2, allow_nan=False) + "\n")
    if not same_warmup or not exact_reproduction:
        raise AssertionError(f"Sweep failed: same warm-up={same_warmup}, exact reproduction={exact_reproduction}")
    print(f"{decision}; selected {output['selectedMultiplier']}x as {role}; exact reproduction={exact_reproduction}")
    for record in records:
        print(f"{record['farPipeResistanceMultiplier']:.1f}x: Far flow {record['firstFrameFlowChangePctVsHealthy']['far']:.3f}%; Far mean Ti {record['zoneMeanIndoorChangeCVsHealthy']['far']:+.3f}°C")


if __name__ == "__main__":
    main()
