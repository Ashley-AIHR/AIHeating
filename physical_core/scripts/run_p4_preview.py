"""Validate and evaluate frozen Preview v0 with forecast-only P1A rollouts."""
from dataclasses import asdict
from datetime import datetime
import csv
import gzip
import json
from pathlib import Path
import pickle

from ai_heating_core.benchmark.runner import evaluate, warm_up
from ai_heating_core.benchmark.state import restore
from ai_heating_core.benchmark.metrics import summary
from ai_heating_core.control.traditional import TraditionalHeatingController, config_from_dict
from ai_heating_core.dataset.factory import EpisodeDescriptor, make_scenario, sample_parameters
from ai_heating_core.p1_2_scenarios import scenarios
from ai_heating_core.p4.features import feature_names, live_features, validation_partition
from ai_heating_core.p4.prediction import SelectedLoadPredictorV1
from ai_heating_core.p4.preview import PreviewLookaheadOptimiserV0, policy_controls, policy_space, serialize_engine

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "artifacts/p3_dataset_v1/official"


def load_csv(path):
    with gzip.open(path, "rt", encoding="utf-8", newline="") as stream:
        return list(csv.DictReader(stream))


def provider():
    registry = json.loads((ROOT / "p4_model_registry.json").read_text())
    models = {h: pickle.loads((ROOT / f"artifacts/p4_models_v1/selected_p4_predictor_v1/horizon_{h}m.pkl").read_bytes())
              for h in (60, 120, 180, 360)}
    names = feature_names(ROOT / "p4_feature_schema.json")
    widths = {int(k): v for k, v in registry["intervalHalfWidthsMw"].items()}
    return SelectedLoadPredictorV1(registry["selectedModelType"], models, names, widths), names


def forecast_map(manifest):
    rows = load_csv(DATA / manifest["outputFiles"]["weather_forecast"])
    start = datetime.fromisoformat("2025-01-15T08:00:00+08:00")
    return {minute: [row for row in rows if row["forecast_as_of"] == time]
            for time, minute in {row["forecast_as_of"]: int((datetime.fromisoformat(row["forecast_as_of"]) - start).total_seconds() / 60)
                                 for row in rows}.items()}


def target_shares(parameters):
    areas = [sum(p.heated_area_m2 for p in parameters.buildings if p.zone == zone) for zone in ("near", "mid", "far")]
    return tuple(area / sum(areas) for area in areas)


def run_closed_loop(manifest, config, canonical, optimiser, names, full_day=True):
    descriptor = EpisodeDescriptor(**manifest["descriptor"])
    parameters, _ = sample_parameters(descriptor)
    scenario = make_scenario(descriptor, parameters, canonical)
    evaluation_parameters = scenario.parameters()
    initial = warm_up(scenario, config, 96)
    engine, controller_state = restore(initial, evaluation_parameters, config)
    controller = TraditionalHeatingController(config)
    forecasts = forecast_map(manifest)
    history, decisions, frames = {}, [], []
    decision_limit = 1080 if full_day else 300
    while engine.elapsed_s < (86400 if full_day else 6 * 3600):
        minute = int(engine.elapsed_s / 60)
        actual_weather = scenario.weather(engine.elapsed_s)
        controller_state = controller.update(int(engine.elapsed_s), actual_weather.outdoor_c, controller_state)
        controls = engine.controls
        if engine.elapsed_s % 1800 == 0:
            controls = policy_controls(engine.controls, actual_weather, config, (0, 0, (0, 0, 0)))
            if minute >= 150 and minute <= decision_limit and minute in forecasts:
                features = {h: live_features(names, evaluation_parameters, minute, history, engine.temperatures, forecasts[minute], h)
                            for h in (60, 120, 180)}
                decision = optimiser.decide(engine, evaluation_parameters, actual_weather, forecasts[minute], features)
                controls = decision.controls
                decisions.append({"minute": minute, **asdict(decision)})
        frame = engine.step(actual_weather, controls); frames.append(frame)
        end_minute = int(frame.elapsed_s / 60)
        history[end_minute] = {"outdoor": frame.weather.outdoor_c, "solar": frame.weather.solar_w_m2,
                               "load": frame.required_heat_w / 1e6}
    return scenario, frames, decisions, initial


def metrics(frames, scenario, config):
    result = summary(frames, scenario.scenario_id, config, target_shares(scenario.parameters(evaluation=False)))
    result["requiredHeatEnergyMWh"] = sum(f.required_heat_w * f.dt_s for f in frames) / 3.6e9
    result["actualHeatSupplyMeanMW"] = sum(f.actual_heat_w for f in frames) / len(frames) / 1e6
    result["requiredHeatLoadMeanMW"] = sum(f.required_heat_w for f in frames) / len(frames) / 1e6
    result["zoneMeanIndoorC"] = {zone: sum(s.indoor_temperature_c for f in frames for key, s in f.buildings.items()
        if next(p.zone for p in scenario.parameters(evaluation=False).buildings if p.building_id == key) == zone) / (len(frames) * 4)
        for zone in ("near", "mid", "far")}
    result["allControlsLegal"] = all(not f.controls.validate(frames[i - 1].controls if i else None) for i, f in enumerate(frames))
    return result


def main():
    config = config_from_dict(json.loads((ROOT / "p2_controller_config_v1.2.json").read_text()))
    canonical = scenarios()
    prediction_provider, names = provider()
    policy_payload = json.loads((ROOT / "p4_candidate_policy_space_v0.json").read_text())
    objective = json.loads((ROOT / "p4_preview_objective_v0.json").read_text())
    policies = policy_space(policy_payload)
    if len(policies) != 75:
        raise ValueError("Frozen Preview policy space must contain 75 policies")
    optimiser = PreviewLookaheadOptimiserV0(config, prediction_provider, policies, objective)
    manifest_paths = sorted((DATA / "manifests").rglob("*.json"))
    select, _ = validation_partition(manifest_paths)
    validation = []
    for family in ("normal_winter", "cold_wave", "rapid_warming", "sunny_winter", "hydraulic_imbalance"):
        path = next(path for path in manifest_paths if json.loads(path.read_text())["episodeId"] in select
                    and json.loads(path.read_text())["scenarioFamily"] == family)
        manifest = json.loads(path.read_text())
        scenario, frames, decisions, _ = run_closed_loop(manifest, config, canonical, optimiser, names, False)
        validation.append({"episodeId": manifest["episodeId"], "scenarioFamily": family,
            "decisionCount": len(decisions), "allFeasible": all(d["feasible"] for d in decisions),
            "fallbackCount": sum(d["fallback"] for d in decisions),
            "deterministicFirstDecision": decisions[0] == run_closed_loop(manifest, config, canonical, optimiser, names, False)[2][0]})
        print(f"preview validation {family}", flush=True)
    benchmarks = []
    for family in ("normal_winter", "cold_wave", "rapid_warming", "sunny_winter", "hydraulic_imbalance"):
        path = next(path for path in manifest_paths if json.loads(path.read_text())["split"] == "benchmark_holdout"
                    and json.loads(path.read_text())["scenarioFamily"] == family)
        manifest = json.loads(path.read_text())
        scenario, frames, decisions, initial = run_closed_loop(manifest, config, canonical, optimiser, names, True)
        traditional = evaluate(scenario, config, initial)
        preview_metrics, traditional_metrics = metrics(frames, scenario, config), metrics(traditional.frames, scenario, config)
        benchmarks.append({"scenarioFamily": family, "episodeId": manifest["episodeId"],
            "sameInitialState": initial == traditional.initial_state, "traditional": traditional_metrics,
            "preview": preview_metrics, "decisionCount": len(decisions),
            "fallbackCount": sum(d["fallback"] for d in decisions),
            "allProjectedCandidatesSafe": all(d["feasible"] for d in decisions),
            "controls": [{"simulationTime": f.simulation_time, **asdict(f.controls)} for f in frames],
            "decisions": decisions})
        print(f"preview canonical {family}", flush=True)
    rapid = next(item for item in benchmarks if item["scenarioFamily"] == "rapid_warming")
    cold = next(item for item in benchmarks if item["scenarioFamily"] == "cold_wave")
    rapid_gate = (rapid["preview"]["underheatingRate"] <= rapid["traditional"]["underheatingRate"]
        and rapid["preview"]["complianceRate"] >= rapid["traditional"]["complianceRate"] - .01
        and rapid["preview"]["severeOverheatingRate"] <= rapid["traditional"]["severeOverheatingRate"] + 1e-12
        and rapid["preview"]["allControlsLegal"]
        and (rapid["preview"]["excessDeliveredHeatMWh"] < rapid["traditional"]["excessDeliveredHeatMWh"] - 1e-6
             or rapid["preview"]["overheatingRate"] < rapid["traditional"]["overheatingRate"] - 1e-6)
        and rapid["preview"]["heatEnergyMWh"] <= rapid["traditional"]["heatEnergyMWh"] * 1.01)
    cold_gate = cold["preview"]["underheatingRate"] <= cold["traditional"]["underheatingRate"] + 1e-12
    output = {"previewVersion": optimiser.version, "predictionProvider": prediction_provider.metadata(),
        "policySpaceVersion": policy_payload["version"], "objectiveVersion": objective["version"],
        "validationBeforeCanonical": validation, "canonicalBenchmarks": benchmarks,
        "rapidWarmingDirectionalGate": rapid_gate, "coldWaveSafetyGate": cold_gate}
    (ROOT / "p4_preview_benchmarks.json").write_text(json.dumps(output, indent=2, sort_keys=True, allow_nan=False) + "\n")
    print(json.dumps({"rapidGate": rapid_gate, "coldGate": cold_gate,
        "validation": validation}, indent=2))


if __name__ == "__main__":
    main()
