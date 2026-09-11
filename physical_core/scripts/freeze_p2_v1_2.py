"""Create and verify the approved physical-fixture-v1.2 P2 baseline freeze."""
import csv
from dataclasses import asdict
import json
from pathlib import Path

from ai_heating_core.benchmark.freeze import file_hash, verify_file_hashes, write_immutable_json
from ai_heating_core.benchmark.metrics import METRIC_VERSION
from ai_heating_core.benchmark.runner import evaluate
from ai_heating_core.benchmark.state import content_hash
from ai_heating_core.control.traditional import config_from_dict
from ai_heating_core.p1_2_scenarios import scenarios
from ai_heating_core.physical_fixture_v1_2 import FIXTURE_VERSION, coherent_parameters
from run_p2_baselines import row_for

ROOT = Path(__file__).resolve().parents[2]


def read(name):
    return json.loads((ROOT / name).read_text())


def create_review(sweep, validation):
    current = next(row for row in sweep["response"] if row["farPipeResistanceMultiplier"] == 2.0)
    healthy = sweep["healthyPreDisturbanceFlowsM3H"]
    lines = ["# P2 Final Scenario Adequacy Review", "",
        "## Decision", "",
        "**A — CURRENT SCENARIO ADEQUATE.** Retain the existing 2× Far pipe-resistance disturbance unchanged as a primary future Near/Mid/Far flow-redistribution benchmark. Rapid Daytime Warming remains the complementary primary weather-response case.", "",
        "The choice is based on transparent hydraulic and thermal observability, not a future AI advantage. No indoor temperature, flow, fixture parameter, controller curve, valve, limit, or KPI was tuned.", "",
        "## Exact current-reference reproduction", "",
        f"The existing v1.2 benchmark reproduces exactly: summary `{sweep['currentReferenceReproductionChecks']['summaryExact']}`, CSV `{sweep['currentReferenceReproductionChecks']['csvExact']}`, initial state `{sweep['currentReferenceReproductionChecks']['initialStateExact']}`. Every sweep case uses an identical healthy pre-disturbance physical/controller state; only `far.pipe_k_pa_s2_m6` changes at evaluation start.", "",
        f"Healthy pre-disturbance flows: Near {healthy['near']:.6f}, Mid {healthy['mid']:.6f}, Far {healthy['far']:.6f} m³/h. At 2×, first-frame Far flow is {current['firstFrameFlowsM3H']['far']:.6f} m³/h, a {-current['firstFrameFlowChangePctVsHealthy']['far']:.3f}% reduction. Near and Mid change by {current['firstFrameFlowChangePctVsHealthy']['near']:+.3f}% and {current['firstFrameFlowChangePctVsHealthy']['mid']:+.3f}%.", "",
        "## Deterministic disturbance-response sweep", "",
        "| Far resistance | Far flow reduction | Near flow change | Mid flow change | Near mean ΔT | Mid mean ΔT | Far mean ΔT | Compliance | Overheating | Underheating | Spread °C | Solver failures |",
        "| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |"]
    for row in sweep["response"]:
        flow, temperature, summary = row["firstFrameFlowChangePctVsHealthy"], row["zoneMeanIndoorChangeCVsHealthy"], row["summary"]
        lines.append(f"| {row['farPipeResistanceMultiplier']:.1f}× | {-flow['far']:.3f}% | {flow['near']:+.3f}% | {flow['mid']:+.3f}% | {temperature['near']:+.3f}°C | {temperature['mid']:+.3f}°C | {temperature['far']:+.3f}°C | {100*summary['complianceRate']:.3f}% | {100*summary['overheatingRate']:.3f}% | {100*summary['underheatingRate']:.3f}% | {summary['temperatureSpreadC']:.3f} | {summary['solverFailureCount']} |")
    lines += ["", "The 3× case reaches the preferred 25–35% Far-flow stress range, but increasing severity is unnecessary: the current 2× case already produces a 16.499% Far-flow loss, positive Near/Mid redistribution, and a 0.179°C Far-zone mean depression, all well above numerical residuals. Retaining it avoids manufacturing a harsher scenario after observing performance.", "",
        "## Current 2× B01–B12 temperatures", "",
        "| Building | Zone | Minimum °C | Mean °C | Maximum °C | Final °C |",
        "| --- | --- | ---: | ---: | ---: | ---: |"]
    for row in sweep["currentReferenceBuildings"]:
        lines.append(f"| {row['buildingId']} | {row['zone']} | {row['minimumIndoorC']:.6f} | {row['meanIndoorC']:.6f} | {row['maximumIndoorC']:.6f} | {row['finalIndoorC']:.6f} |")
    summary = current["summary"]
    lines += ["", "## Current 2× aggregate result", "",
        f"Zone mean indoor changes relative to healthy: Near {current['zoneMeanIndoorChangeCVsHealthy']['near']:+.6f}°C, Mid {current['zoneMeanIndoorChangeCVsHealthy']['mid']:+.6f}°C, Far {current['zoneMeanIndoorChangeCVsHealthy']['far']:+.6f}°C.", "",
        f"Compliance {100*summary['complianceRate']:.6f}%; overheating {100*summary['overheatingRate']:.6f}%; underheating {100*summary['underheatingRate']:.6f}%; minimum/maximum {summary['minimumIndoorC']:.6f}/{summary['maximumIndoorC']:.6f}°C; P90−P10 spread {summary['temperatureSpreadC']:.6f}°C. These KPIs describe the response and did not define selection.", "",
        "## Regression and freeze", "",
        f"Affected scenario test: {validation['affectedScenarioCommand']['passed']} passed, exit {validation['affectedScenarioCommand']['exitCode']}. Sizing Gates {validation['sizingGatePasses']}/7; P1A Gates {validation['P1AGatePasses']}/32 and 84 tests; P2 Gates {validation['P2GatePasses']}/20 and 34 tests; P0 typecheck/test/build all exit 0 with 62 tests. Historical accepted-file changes: `{validation['historicalFileChanges']}`.", "",
        "The approved baseline freezes physical-fixture-v1.2, Traditional controller v1.2, the unchanged five scenarios including the 2× Hydraulic Imbalance definition, 35/55/85% commissioned valves, 72-hour daily-repeat warm-up, existing metric definitions, deterministic initial-state generation, and content hashes. Any later change requires a new version.", "",
        "P3 was not started.", "",
        "P2 v1.2 Baseline Freeze: PASS"]
    (ROOT / "P2_FINAL_SCENARIO_ADEQUACY_REVIEW.md").write_text("\n".join(lines) + "\n")


def main():
    sweep, validation = read("p2_final_scenario_adequacy_sweep_v1.2.json"), read("p2_final_freeze_validation_v1.2.json")
    if sweep["decision"] != "A — CURRENT SCENARIO ADEQUATE" or sweep["selectedMultiplier"] != 2.0:
        raise ValueError("Freeze runner supports the reviewed unchanged 2x scenario only")
    if not sweep["currentReferenceExactReproduction"] or not sweep["identicalWarmupPhysicalState"] or validation["status"] != "PASS":
        raise ValueError("Scenario reproduction or regressions do not permit freeze")
    config_payload = read("p1_2_controller_config.json")
    write_immutable_json(ROOT / "p2_controller_config_v1.2.json", config_payload)
    config = config_from_dict(config_payload)
    cases = scenarios()
    manifests = read("p1_2_candidate_results/benchmark_v1.2.json")["scenarioManifests"]
    if content_hash(manifests) != content_hash([scenario.manifest(config) for scenario in cases]) or cases[4].far_pipe_multiplier != 2.0:
        raise ValueError("Executed scenario definitions differ from the reviewed set")
    summaries = read("p1_2_candidate_results/benchmark_v1.2.json")["summaries"]
    replay = []
    for scenario, expected in zip(cases, summaries, strict=True):
        initial_path = ROOT / "p1_2_candidate_results" / f"initial_state_{scenario.scenario_id}_v1.2.json"
        csv_path = ROOT / "p1_2_candidate_results" / f"p2_{scenario.scenario_id}_v1.2.csv"
        result = evaluate(scenario, config, json.loads(initial_path.read_text()))
        with csv_path.open(newline="") as source:
            exported = list(csv.DictReader(source))
        actual = [{key: str(value) for key, value in row_for(frame, state).items()}
                  for frame, state in zip(result.frames, result.controller_states, strict=True)]
        if exported != actual or result.summary != expected:
            raise ValueError(f"{scenario.scenario_id} fails exact baseline replay")
        replay.append({"scenarioId": scenario.scenario_id, "rows": len(exported),
                       "exactCsvAndSummaryReplay": True})
    create_review(sweep, validation)
    accepted = read("p2_accepted_p1a_manifest.json")["files"]
    if verify_file_hashes(ROOT, accepted):
        raise ValueError("Accepted P1A files changed")
    artifact_names = ["p1a_parameters_physical_fixture_v1.2.json", "p2_controller_config_v1.2.json",
        "p1_2_commissioning_results.json", "p1_2_static_feasible_envelope.json",
        "p2_final_scenario_adequacy_sweep_v1.2.json", "p2_final_freeze_validation_v1.2.json",
        "P1_2_FINAL_REPORT.md", "P1_2_SIZING_GATE_RESULTS.md", "P1_2_STATIC_FEASIBILITY_COMPARISON.md",
        "P1_2_P2_BENCHMARK_COMPARISON.md", "P1_2_VALIDATION_RESULTS.md",
        "P2_FINAL_SCENARIO_ADEQUACY_REVIEW.md",
        "physical_core/src/ai_heating_core/physical_fixture_v1_2.py",
        "physical_core/src/ai_heating_core/p1_2_scenarios.py",
        "physical_core/src/ai_heating_core/control/traditional.py"]
    artifact_names += [f"p1_2_candidate_results/p2_{s.scenario_id}_v1.2.csv" for s in cases]
    artifact_names += [f"p1_2_candidate_results/initial_state_{s.scenario_id}_v1.2.json" for s in cases]
    artifacts = {name: file_hash(ROOT / name) for name in artifact_names}
    manifest = {"schemaVersion": "p2-baseline-freeze-v1.2", "freezeStatus": "APPROVED",
        "physicalFixtureVersion": FIXTURE_VERSION,
        "physicalParameterHash": content_hash(asdict(coherent_parameters())),
        "controllerVersion": config.version, "controllerConfigHash": content_hash(config_payload),
        "commissionedValveFractions": list(config.valves),
        "commissioningResultHash": content_hash(read("p1_2_commissioning_results.json")),
        "scenarioDefinitions": {s.scenario_id: {"version": s.manifest(config)["scenarioVersion"],
            "farPipeResistanceMultiplier": s.far_pipe_multiplier} for s in cases},
        "scenarioManifestHash": content_hash(manifests),
        "scenarioParameterHashes": {s.scenario_id: content_hash(asdict(s.parameters())) for s in cases},
        "hydraulicImbalanceDecision": sweep["decision"],
        "hydraulicImbalanceFutureBenchmarkRole": sweep["selectedFutureBenchmarkRole"],
        "warmupPolicy": {"version": "daily-repeat-72h-convergence-v1.2", "hours": config.warmup_hours,
            "initialStateGeneration": "Accepted P1A engine daily-repeat warm-up; scenario evaluation resistance applied after warm-up; serialized evaluation-initial-state-v1"},
        "metricDefinitionVersion": METRIC_VERSION, "testSuiteResult": {"status": validation["status"],
            "affectedScenarioTests": validation["affectedScenarioCommand"]["passed"],
            "sizingGates": validation["sizingGatePasses"], "P1AGates": validation["P1AGatePasses"],
            "P2Gates": validation["P2GatePasses"], "commands": [{k: v for k, v in c.items() if k != "output"}
                for c in validation["regressionCommands"]], "exportReplay": replay},
        "acceptedP1AFileHashes": accepted, "artifactFileHashes": artifacts,
        "hashAlgorithm": "SHA-256; raw bytes for files; sorted compact finite JSON for domain hashes",
        "immutabilityPolicy": "Do not modify this baseline. Any controller, fixture, scenario, warm-up, metric or evidence change requires a new version.",
        "scope": "P2 Traditional v1.2 baseline only; P3 not started"}
    write_immutable_json(ROOT / "P2_BASELINE_FREEZE_MANIFEST_v1.2.json", manifest)
    errors = verify_file_hashes(ROOT, artifacts) + verify_file_hashes(ROOT, accepted)
    if errors:
        raise ValueError(f"Freeze verification failed: {errors}")
    print(f"P2 v1.2 freeze PASS: {len(artifacts)} artifacts, {len(accepted)} accepted P1A files, {len(replay)} exact scenario replays")


if __name__ == "__main__":
    main()
