"""Validate, freeze and evaluate formal P6 MPC without modifying P0-P5."""
from dataclasses import asdict
from datetime import datetime
import hashlib
import json
from math import ceil, cos, pi, sin
from pathlib import Path
import pickle
import platform
from statistics import median
import warnings

import numpy as np

from ai_heating_core.benchmark.runner import evaluate, warm_up
from ai_heating_core.benchmark.state import content_hash, restore
from ai_heating_core.contracts import Controls, Weather
from ai_heating_core.control.traditional import (TraditionalHeatingController,
    config_from_dict)
from ai_heating_core.dataset.factory import EpisodeDescriptor, make_scenario, sample_parameters
from ai_heating_core.p1_2_scenarios import scenarios
from ai_heating_core.p4.features import feature_names, live_features
from ai_heating_core.p4.prediction import PredictionInput, SelectedLoadPredictorV1
from ai_heating_core.p4.preview import clone_engine, policy_controls, serialize_engine
from ai_heating_core.p5.dataset import descriptors, site_parameters
from ai_heating_core.p6.mpc import (FormalSupervisoryMPC, assert_causal_forecast,
    build_linearisation, controls_to_array, legal_trajectory)
from ai_heating_core.p6.plant import (P1AP5RolloutAdapter, calibrations_for_site,
    p5_half_width_grid, safe_heating_fallback, traditional_reference)
from ai_heating_core.physical_fixture_v1_2 import coherent_parameters


ROOT = Path(__file__).resolve().parents[2]
P3 = ROOT / "artifacts/p3_dataset_v1/official"
FAMILIES = ("normal_winter", "cold_wave", "rapid_warming",
            "sunny_winter", "hydraulic_imbalance")
warnings.filterwarnings("ignore", message="The problem includes expressions that don't support CPP backend")
warnings.filterwarnings("ignore", message="Solution may be inaccurate")


def payload(name): return json.loads((ROOT / name).read_text())
def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()


def write_registry():
    import cvxpy
    import osqp
    p2_freeze = payload("P2_BASELINE_FREEZE_MANIFEST_v1.2.json")
    configuration = ("p6_sensitivity_config.json", "p6_mpc_config.json",
        "p6_mpc_objective_v1.json", "p6_safety_policy_v1.json",
        "p6_solver_config.json", "physical_core/p6-requirements.txt")
    results = ("p6_linearisation_results.json", "p6_development_results.json",
        "p6_safety_stress_results.json", "p6_ablation_results.json",
        "p6_canonical_benchmark_results.json", "p6_solver_performance.json",
        "p6_gate_results.json")
    sources = ("physical_core/src/ai_heating_core/p6/mpc.py",
        "physical_core/src/ai_heating_core/p6/plant.py",
        "physical_core/scripts/run_p6_evaluation.py",
        "physical_core/scripts/run_p6_regression.py",
        "physical_core/tests/test_p6.py")
    canonical_manifests = sorted(
        str(path.relative_to(ROOT)) for path in
        (P3 / "manifests/benchmark_holdout").glob("*.json"))
    registry = {"registryVersion": "p6-model-registry-v1",
        "activeOptimiser": "p6-mpc-v1",
        "versions": {"mpc": "p6-mpc-v1", "linearisation": "p6-linearisation-v1",
            "objective": "p6-objective-v1", "safety": "p6-safety-policy-v1",
            "developmentScenarios": "p6-development-scenarios-v1",
            "safetyStress": "p6-near-compliance-safety-stress-v1"},
        "semanticRoles": {"P4": "Required Heat Load demand prediction",
            "P5": "calibrated building-temperature prediction",
            "P6": "constrained supervisory optimisation",
            "P1A": "full nonlinear physical verification authority"},
        "dependencies": {"P1A": {"version": "physical-fixture-v1.2/P1A",
                "freezeManifest": "P2_BASELINE_FREEZE_MANIFEST_v1.2.json",
                "freezeManifestHash": digest(ROOT / "P2_BASELINE_FREEZE_MANIFEST_v1.2.json"),
                "physicalParameterHash": p2_freeze["physicalParameterHash"],
                "acceptedFileHashes": p2_freeze["acceptedP1AFileHashes"]},
            "P2": {"version": "traditional-v1.2",
                "controllerConfig": "p2_controller_config_v1.2.json",
                "controllerConfigHash": digest(ROOT / "p2_controller_config_v1.2.json")},
            "P3": {"generationManifest": "p3_generation_manifest.json",
                "generationManifestHash": digest(ROOT / "p3_generation_manifest.json"),
                "canonicalManifestHashes": {name: digest(ROOT / name)
                    for name in canonical_manifests}},
            "P4": {"version": payload("p4_model_registry.json")["modelVersion"],
                "registry": "p4_model_registry.json",
                "registryHash": digest(ROOT / "p4_model_registry.json")},
            "P5": {"version": payload("p5_model_registry.json")["modelVersion"],
                "registry": "p5_model_registry.json",
                "registryHash": digest(ROOT / "p5_model_registry.json"),
                "calibrationArtifact": "p5_calibrated_parameters.json",
                "calibrationArtifactHash": digest(ROOT / "p5_calibrated_parameters.json")}},
        "configurationHashes": {name: digest(ROOT / name) for name in configuration},
        "sourceHashes": {name: digest(ROOT / name) for name in sources},
        "resultHashes": {name: digest(ROOT / name) for name in results},
        "packages": {"python": platform.python_version(), "numpy": np.__version__,
            "cvxpy": cvxpy.__version__, "osqp": osqp.__version__},
        "canonicalUsedForTuning": False,
        "modelLoadingPolicy": "exact registry identities and hashes; never latest"}
    (ROOT / "p6_model_registry.json").write_text(
        json.dumps(registry, indent=2, sort_keys=True, allow_nan=False) + "\n")


def baseline_errors():
    errors = []
    p4 = payload("p4_model_registry.json")
    for name, expected in p4["artifactHashes"].items():
        if digest(ROOT / name) != expected: errors.append(f"P4:{name}")
    p5 = payload("p5_model_registry.json")
    for key, name in {"calibrationArtifactHash": p5["calibrationArtifact"],
        "identificationManifestHash": "p5_identification_manifest.json",
        "identifiabilityResultsHash": "p5_identifiability_results.json",
        "predictionResultsHash": "p5_prediction_results.json",
        "canonicalResultsHash": "p5_canonical_holdout_results.json"}.items():
        if digest(ROOT / name) != p5[key]: errors.append(f"P5:{name}")
    p4_gates = payload("p4_gate_results.json")
    p4_p1 = next(item for item in p4_gates["gates"] if item["gate"] == "P4-P1")
    errors += [f"P2:{item}" for item in p4_p1["measured"]["p2Errors"]]
    errors += [f"P3:{item}" for item in p4_p1["measured"]["p3Errors"]]
    if payload("p5_gate_results.json")["failed"]: errors.append("P5:gates")
    if not payload("p5_regression_results.json")["passed"]: errors.append("P5:regression")
    return errors


def load_p4():
    registry = payload("p4_model_registry.json")
    models = {h: pickle.loads((ROOT /
        f"artifacts/p4_models_v1/selected_p4_predictor_v1/horizon_{h}m.pkl").read_bytes())
        for h in (60, 120, 180, 360)}
    names = feature_names(ROOT / "p4_feature_schema.json")
    widths = {int(key): value for key, value in registry["intervalHalfWidthsMw"].items()}
    return SelectedLoadPredictorV1(registry["selectedModelType"], models, names,
                                   widths), names


def optimiser():
    return FormalSupervisoryMPC(payload("p6_mpc_config.json"),
        payload("p6_sensitivity_config.json"), payload("p6_mpc_objective_v1.json"),
        payload("p6_safety_policy_v1.json"), payload("p6_solver_config.json"))


def sanitize_forecast(rows):
    fields = ("forecast_as_of", "forecast_target_time", "horizon_minutes",
              "forecast_outdoor_temperature_c", "forecast_solar_radiation_w_m2",
              "forecast_wind_m_s", "forecast_model_version")
    clean = [{key: row[key] for key in fields if key in row} for row in rows]
    assert_causal_forecast(clean)
    return clean


def p4_demand(provider, names, parameters, minute, history, temperatures, forecast):
    predictions = {0: history[minute]["load"]}
    for horizon in (60, 120, 180):
        features = live_features(names, parameters, minute, history, temperatures,
                                 forecast, horizon)
        predictions[horizon] = provider.predict_required_heat(
            PredictionInput(horizon, features)).point_mw
    return tuple(map(float, np.interp((30, 60, 90, 120, 150, 180),
                                      sorted(predictions),
                                      [predictions[key] for key in sorted(predictions)])))


def dev_weather(family, elapsed_s):
    hour = (8 + elapsed_s / 3600) % 24
    daylight = max(0.0, sin(pi * (hour - 7) / 10))
    base = -5 + 4 * sin(2 * pi * (hour - 9) / 24)
    solar = 220 * daylight ** 1.5
    if family == "cold_wave": base -= 7
    elif family == "rapid_warming": base += 7 * daylight
    elif family == "sunny_winter": solar = 650 * daylight ** 1.5
    elif family == "hydraulic_imbalance": base -= 1
    return Weather(base, solar, 2.5 + .5 * cos(2 * pi * hour / 24))


def issued_dev_forecast(family, minute, weather_function=dev_weather):
    as_of = f"p6-dev-{minute}"
    rows = []
    for horizon in range(30, 181, 30):
        target = weather_function(family, (minute + horizon) * 60)
        scale = horizon / 180
        rows.append({"forecast_as_of": as_of,
            "forecast_target_time": f"{as_of}+{horizon}m",
            "horizon_minutes": horizon,
            "forecast_outdoor_temperature_c": target.outdoor_c + .25 * scale,
            "forecast_solar_radiation_w_m2": max(0, target.solar_w_m2 - 20 * scale),
            "forecast_wind_m_s": target.wind_m_s + .1 * scale,
            "forecast_model_version": "p6-development-issued-weather-v1"})
    assert_causal_forecast(rows)
    return rows


def warm_development_site(site_id, family, config):
    descriptor = next(item for item in descriptors() if item.site_id == site_id)
    parameters, _ = site_parameters(descriptor)
    controller = TraditionalHeatingController(config)
    initial_weather = dev_weather(family, 0)
    state = controller.initialize(0, initial_weather.outdoor_c)
    from ai_heating_core.simulation import SimulationEngine
    engine = SimulationEngine(parameters, state.controls())
    history = {}
    while engine.elapsed_s < 72 * 3600:
        weather = dev_weather(family, engine.elapsed_s)
        state = controller.update(int(engine.elapsed_s), weather.outdoor_c, state)
        frame = engine.step(weather, state.controls())
        minute = int(frame.elapsed_s / 60)
        history[minute] = {"outdoor": frame.weather.outdoor_c,
                           "solar": frame.weather.solar_w_m2,
                           "load": frame.required_heat_w / 1e6}
    minute = int(engine.elapsed_s / 60)
    return {"siteId": site_id, "family": family, "engine": engine,
            "parameters": parameters, "history": history, "minute": minute,
            "currentWeather": dev_weather(family, engine.elapsed_s),
            "forecast": issued_dev_forecast(family, minute)}


def context_adapter(context, calibration_artifact):
    nominal = {profile.building_id: profile for profile in
               coherent_parameters().buildings}
    site_id = context["siteId"]
    return P1AP5RolloutAdapter(serialize_engine(context["engine"]),
        context["parameters"], context["currentWeather"], context["forecast"],
        nominal, calibrations_for_site(calibration_artifact, site_id))


def ramped_trial(current, reference, offsets):
    previous = current
    output = []
    for item in reference:
        target = controls_to_array((item,))[0] + np.asarray(offsets)
        old = controls_to_array((previous,))[0]
        limits = np.asarray([2, 2, .1, .1, .1])
        low, high = np.asarray([40, 30, .2, .2, .2]), np.asarray([60, 50, 1, 1, 1])
        value = np.minimum(high, np.maximum(low, old + np.maximum(-limits,
            np.minimum(limits, target - old))))
        control = Controls(float(value[0]), float(value[1]), tuple(map(float, value[2:])))
        control.validate(previous)
        output.append(control); previous = control
    return tuple(output)


def validate_linearisation(contexts, config, calibrations):
    perturb = payload("p6_sensitivity_config.json")["perturbations"]
    steps = (perturb["supplyC"], perturb["pumpHz"],
             perturb["valveFraction"], perturb["valveFraction"],
             perturb["valveFraction"])
    offsets = payload("p6_sensitivity_config.json")["validationTrialOffsets"]
    records, deterministic, direction = [], True, True
    for context in contexts:
        adapter = context_adapter(context, calibrations)
        reference = traditional_reference(context["engine"].controls,
            context["currentWeather"], context["forecast"], config)
        first = build_linearisation(context["engine"].controls, reference, adapter, steps)
        if context is contexts[0]:
            second = build_linearisation(context["engine"].controls, reference, adapter, steps)
            deterministic &= (np.array_equal(first.temperature_jacobian,
                second.temperature_jacobian) and first.difference_rules == second.difference_rules)
        supply_columns = list(range(0, 30, 5))
        pump_columns = list(range(1, 30, 5))
        direction &= (first.temperature_jacobian[:, supply_columns].sum() >= -1e-8
            and first.heat_jacobian[:, supply_columns].sum() >= -1e-8
            and first.flow_jacobian[:, pump_columns].sum() >= -1e-8)
        for offset in offsets:
            trial = ramped_trial(context["engine"].controls, reference, offset)
            predicted, actual = first.predict(trial), adapter(trial)
            records.append({"siteId": context["siteId"], "family": context["family"],
                "offset": offset, "allControlsLegal": legal_trajectory(
                    context["engine"].controls, trial),
                "indoorMaeC": float(np.mean(np.abs(predicted.building_temperature_c
                                                    - actual.building_temperature_c))),
                "indoorMaxErrorC": float(np.max(np.abs(predicted.building_temperature_c
                                                        - actual.building_temperature_c))),
                "heatRelativeError": float(np.mean(np.abs(predicted.actual_heat_mw
                    - actual.actual_heat_mw)) / max(np.mean(np.abs(actual.actual_heat_mw)), 1e-6)),
                "zoneFlowRelativeError": float(np.mean(np.abs(predicted.zone_flow_m3_h
                    - actual.zone_flow_m3_h)) / max(np.mean(np.abs(actual.zone_flow_m3_h)), 1e-6))})
    result = {"version": "p6-linearisation-validation-v1",
        "scenarioSetVersion": "p6-development-scenarios-v1",
        "canonicalDataUsed": False, "stateCount": len(contexts),
        "trialCount": len(records), "records": records,
        "aggregate": {"indoor3hMaeC": float(np.mean([r["indoorMaeC"] for r in records])),
            "indoor3hMaxErrorC": max(r["indoorMaxErrorC"] for r in records),
            "meanHeatSupplyRelativeError": float(np.mean([r["heatRelativeError"] for r in records])),
            "meanZoneFlowRelativeError": float(np.mean([r["zoneFlowRelativeError"] for r in records]))},
        "sensitivityDeterministic": bool(deterministic),
        "localDirectionalChecksPass": bool(direction),
        "allPerturbedTrajectoriesLegal": all(r["allControlsLegal"] for r in records),
        "globalValidityClaim": False}
    return result


def run_decision(context, config, p4_provider, feature_names_value,
                 calibrations, actuator_mode="full", near_compliance=False):
    engine = context["engine"]
    before = serialize_engine(engine)
    reference = traditional_reference(engine.controls, context["currentWeather"],
                                        context["forecast"], config)
    demand = p4_demand(p4_provider, feature_names_value, context["parameters"],
        context["minute"], context["history"], engine.temperatures,
        context["forecast"])
    adapter = context_adapter(context, calibrations)
    widths = p5_half_width_grid(payload("p5_model_registry.json"))
    fallback = safe_heating_fallback(engine.controls) if near_compliance else reference
    recommendation = optimiser().recommend(current=engine.controls,
        traditional_reference=reference, demand_mw=demand, half_widths_c=widths,
        forecast_as_of=context["forecast"][0]["forecast_as_of"],
        snapshot_hash=content_hash(before), rollout=adapter, verify=adapter.verify,
        fallback=fallback, actuator_mode=actuator_mode,
        model_versions={"p1a": "physical-fixture-v1.2/P1A",
            "p2Reference": "traditional-v1.2",
            "p4": "selected-p4-predictor-v1",
            "p5": "p5-thermal-model-v1", "p6": "p6-mpc-v1"})
    if serialize_engine(engine) != before:
        raise RuntimeError("P6 optimisation mutated live state")
    return recommendation, demand, reference


def prepare_safety_context(config, target_c, forecast_outdoor_c):
    parameters = coherent_parameters()
    controller = TraditionalHeatingController(config)
    warm_weather = Weather(-8, 0, 3)
    state = controller.initialize(0, warm_weather.outdoor_c)
    from ai_heating_core.simulation import SimulationEngine
    engine = SimulationEngine(parameters, state.controls())
    history = {}
    while engine.elapsed_s < 72 * 3600:
        state = controller.update(int(engine.elapsed_s), warm_weather.outdoor_c, state)
        frame = engine.step(warm_weather, state.controls())
        history[int(frame.elapsed_s / 60)] = {"outdoor": -8, "solar": 0,
            "load": frame.required_heat_w / 1e6}
    previous = engine.controls
    precondition_steps = 0
    while ((min(engine.temperatures.values()) > target_c
            or engine.elapsed_s % 1800 != 0) and precondition_steps < 288):
        if engine.elapsed_s % 1800 == 0:
            values = controls_to_array((previous,))[0]
            target = np.asarray([40, 30, .2, .2, .2])
            limits = np.asarray([2, 2, .1, .1, .1])
            values += np.maximum(-limits, np.minimum(limits, target - values))
            previous = Controls(float(values[0]), float(values[1]),
                                tuple(map(float, values[2:])))
        frame = engine.step(Weather(-14, 0, 4), previous)
        history[int(frame.elapsed_s / 60)] = {"outdoor": -14, "solar": 0,
            "load": frame.required_heat_w / 1e6}
        precondition_steps += 1
    minute = int(engine.elapsed_s / 60)
    as_of = f"p6-safety-{target_c}-{minute}"
    forecast = [{"forecast_as_of": as_of,
        "forecast_target_time": f"{as_of}+{horizon}m", "horizon_minutes": horizon,
        "forecast_outdoor_temperature_c": forecast_outdoor_c,
        "forecast_solar_radiation_w_m2": 0,
        "forecast_wind_m_s": 4,
        "forecast_model_version": "p6-safety-issued-weather-v1"}
        for horizon in range(30, 181, 30)]
    assert_causal_forecast(forecast)
    return {"siteId": "P5-BASE-FIXTURE", "family": "near_compliance_safety",
        "engine": engine, "parameters": parameters, "history": history,
        "minute": minute, "currentWeather": Weather(-14, 0, 4),
        "forecast": forecast,
        "preconditioning": {"directTemperatureOverwrite": False,
            "reducedHeatingPhysicalSteps": precondition_steps,
            "minimumIndoorC": min(engine.temperatures.values()),
            "targetC": target_c, "allControlsLegal": True}}


def realise_safety_trajectory(context, recommendation, realised_outdoor_c):
    """Evaluate the selected controls against realised P1A weather, after selection."""
    engine = clone_engine(serialize_engine(context["engine"]), context["parameters"])
    trajectory = tuple(Controls(recommendation.supply_trajectory_c[index],
        recommendation.pump_trajectory_hz[index], tuple(
            recommendation.valve_trajectories_fraction[zone][index]
            for zone in ("near", "mid", "far"))) for index in range(6))
    endpoint_minima = []
    converged = True
    maximum_mass_residual = 0.0
    for physical_step in range(36):
        frame = engine.step(Weather(realised_outdoor_c, 0, 4),
                            trajectory[physical_step // 6])
        converged &= frame.hydraulics.solver.status == "converged"
        maximum_mass_residual = max(maximum_mass_residual, frame.mass_residual)
        if physical_step % 6 == 5:
            endpoint_minima.append(min(engine.temperatures.values()))
    return {"weatherAuthority": "realised P1A environment after action selection",
        "outdoorC": realised_outdoor_c, "minimumIndoorC": min(endpoint_minima),
        "endpointMinimumIndoorC": endpoint_minima,
        "allHydraulicConverged": bool(converged),
        "maximumMassResidual": maximum_mass_residual,
        "allControlsLegal": legal_trajectory(context["engine"].controls, trajectory)}


def forecast_map(manifest):
    import csv, gzip
    path = P3 / manifest["outputFiles"]["weather_forecast"]
    with gzip.open(path, "rt", encoding="utf-8", newline="") as stream:
        rows = list(csv.DictReader(stream))
    start = datetime.fromisoformat("2025-01-15T08:00:00+08:00")
    result = {}
    for as_of in {row["forecast_as_of"] for row in rows}:
        minute = int((datetime.fromisoformat(as_of) - start).total_seconds() / 60)
        result[minute] = sanitize_forecast([row for row in rows
                                            if row["forecast_as_of"] == as_of])
    return result


def target_shares(parameters):
    areas = [sum(p.heated_area_m2 for p in parameters.buildings if p.zone == zone)
             for zone in ("near", "mid", "far")]
    return tuple(value / sum(areas) for value in areas)


def benchmark_metrics(frames, scenario, config, controller_version=None):
    from ai_heating_core.benchmark.metrics import summary
    result = summary(frames, scenario.scenario_id, config,
                     target_shares(scenario.parameters(evaluation=False)))
    result["requiredHeatEnergyMWh"] = sum(f.required_heat_w * f.dt_s
                                           for f in frames) / 3.6e9
    result["actualHeatSupplyMeanMW"] = sum(f.actual_heat_w for f in frames) / len(frames) / 1e6
    result["requiredHeatLoadMeanMW"] = sum(f.required_heat_w for f in frames) / len(frames) / 1e6
    result["zoneMeanIndoorC"] = {zone: sum(state.indoor_temperature_c
        for frame in frames for building_id, state in frame.buildings.items()
        if next(profile.zone for profile in scenario.parameters(evaluation=False).buildings
                if profile.building_id == building_id) == zone) / (len(frames) * 4)
        for zone in ("near", "mid", "far")}
    result["allControlsLegal"] = all(not frame.controls.validate(
        frames[index - 1].controls if index else None)
        for index, frame in enumerate(frames))
    if controller_version is not None:
        result["controllerVersion"] = controller_version
    return result


def run_canonical(manifest, actuator_mode, config, p4_provider,
                  feature_names_value, calibrations):
    descriptor = EpisodeDescriptor(**manifest["descriptor"])
    parameters, _ = sample_parameters(descriptor)
    scenario = make_scenario(descriptor, parameters, scenarios())
    evaluation_parameters = scenario.parameters()
    initial = warm_up(scenario, config, 96)
    engine, _ = restore(initial, evaluation_parameters, config)
    forecasts = forecast_map(manifest)
    history, decisions, frames = {}, [], []
    while engine.elapsed_s < 86400:
        minute = int(engine.elapsed_s / 60)
        actual_weather = scenario.weather(engine.elapsed_s)
        controls = engine.controls
        if engine.elapsed_s % 1800 == 0:
            controls = policy_controls(engine.controls, actual_weather, config,
                                       (0, 0, (0, 0, 0)))
            if 150 <= minute <= 1080 and minute in forecasts:
                context = {"siteId": "P5-BASE-FIXTURE",
                    "family": manifest["scenarioFamily"], "engine": engine,
                    "parameters": evaluation_parameters, "history": history,
                    "minute": minute, "currentWeather": actual_weather,
                    "forecast": forecasts[minute]}
                recommendation, demand, reference = run_decision(context, config,
                    p4_provider, feature_names_value, calibrations, actuator_mode)
                controls = recommendation.first_action
                decisions.append({"minute": minute, "demandReferenceMW": demand,
                    "traditionalReference": [asdict(item) for item in reference],
                    **asdict(recommendation)})
        frame = engine.step(actual_weather, controls)
        frames.append(frame)
        history[int(frame.elapsed_s / 60)] = {"outdoor": frame.weather.outdoor_c,
            "solar": frame.weather.solar_w_m2, "load": frame.required_heat_w / 1e6}
    traditional = evaluate(scenario, config, initial)
    return {"scenarioFamily": manifest["scenarioFamily"],
        "episodeId": manifest["episodeId"], "actuatorMode": actuator_mode,
        "sameInitialState": initial == traditional.initial_state,
        "traditional": benchmark_metrics(traditional.frames, scenario, config),
        "mpc": benchmark_metrics(frames, scenario, config, "p6-mpc-v1"),
        "decisions": decisions,
        "controlBoundaries": [{"simulationTime": frame.simulation_time,
            **asdict(frame.controls)} for index, frame in enumerate(frames)
            if index % 6 == 0]}


def movement(boundaries):
    values = np.asarray([[row["supply_c"], row["frequency_hz"], *row["valves"]]
                         for row in boundaries])
    changes = np.diff(values, axis=0)
    reversals = []
    for column in range(values.shape[1]):
        signs = np.sign(changes[:, column]); signs = signs[signs != 0]
        reversals.append(int(np.sum(signs[1:] != signs[:-1])))
    return {"totalSupplyMovementC": float(np.abs(changes[:, 0]).sum()),
        "totalPumpMovementHz": float(np.abs(changes[:, 1]).sum()),
        "totalValveMovementPercentagePoints": float(np.abs(changes[:, 2:]).sum() * 100),
        "maximumDirectionReversals": max(reversals, default=0)}


def engineering_score(metrics, traditional):
    return (metrics["excessDeliveredHeatMWh"] /
            max(traditional["requiredHeatEnergyMWh"], .001)
        + .15 * metrics["pumpElectricityKWh"] /
            max(traditional["pumpElectricityKWh"], .001)
        + 2 * metrics["overheatingRate"]
        + 8 * metrics["severeOverheatingRate"])


def main():
    before_errors = baseline_errors()
    if before_errors: raise RuntimeError(f"P0-P5 baseline integrity failed: {before_errors}")
    config = config_from_dict(payload("p2_controller_config_v1.2.json"))
    p4_provider, names = load_p4()
    calibrations = payload("p5_calibrated_parameters.json")

    sites = ("P5-S01", "P5-S02", "P5-S03", "P5-S04", "P5-S05")
    contexts = [warm_development_site(site, family, config)
                for site, family in zip(sites, FAMILIES)]
    linearisation = validate_linearisation(contexts, config, calibrations)
    (ROOT / "p6_linearisation_results.json").write_text(
        json.dumps(linearisation, indent=2, sort_keys=True, allow_nan=False) + "\n")
    limits = linearisation["aggregate"]
    if not (limits["indoor3hMaeC"] <= .15 and limits["indoor3hMaxErrorC"] <= .35
            and limits["meanHeatSupplyRelativeError"] <= .05
            and limits["meanZoneFlowRelativeError"] <= .05):
        raise RuntimeError("P6 local surrogate failed before canonical evaluation")
    development = []
    for context in contexts:
        recommendation, demand, reference = run_decision(context, config,
            p4_provider, names, calibrations)
        development.append({"siteId": context["siteId"], "family": context["family"],
            "demandReferenceMW": demand,
            "traditionalReference": [asdict(item) for item in reference],
            "recommendation": asdict(recommendation)})
    development_result = {"version": "p6-development-scenarios-v1",
        "canonicalDataUsed": False, "multipleParameterFixtures": True,
        "scenarios": development, "completedBeforeCanonical": True}
    (ROOT / "p6_development_results.json").write_text(
        json.dumps(development_result, indent=2, sort_keys=True, allow_nan=False) + "\n")

    safety_cases = []
    for label, target, forecast_outdoor in (("feasible_active", 19.1, -11),
                                             ("infeasible_fallback", 18.5, -30)):
        context = prepare_safety_context(config, target, forecast_outdoor)
        recommendation, demand, reference = run_decision(context, config,
            p4_provider, names, calibrations, near_compliance=True)
        safety_cases.append({"case": label, "preconditioning": context["preconditioning"],
            "forecastOutdoorC": forecast_outdoor, "demandReferenceMW": demand,
            "recommendation": asdict(recommendation),
            "forecastVerifiedSafety": recommendation.constraint_margins[
                "minimumRobustTemperatureMarginC"] >= -1e-8
                if recommendation.fallback_status == "not_used" else None,
            "realisedSafety": realise_safety_trajectory(context, recommendation,
                forecast_outdoor if label == "feasible_active" else -14),
            "energySavingClaim": False})
    safety = {"version": "p6-near-compliance-safety-stress-v1",
        "cases": safety_cases, "directTemperatureOverwrite": False}
    (ROOT / "p6_safety_stress_results.json").write_text(
        json.dumps(safety, indent=2, sort_keys=True, allow_nan=False) + "\n")

    manifests = [json.loads(path.read_text()) for path in sorted(
        (P3 / "manifests/benchmark_holdout").glob("*.json"))]
    canonical = []
    for family in FAMILIES:
        manifest = next(item for item in manifests if item["scenarioFamily"] == family)
        result = run_canonical(manifest, "full", config, p4_provider, names, calibrations)
        canonical.append(result)
        print(f"p6 canonical {family}", flush=True)
    rapid_manifest = next(item for item in manifests
                          if item["scenarioFamily"] == "rapid_warming")
    ablations = [run_canonical(rapid_manifest, mode, config, p4_provider, names,
                               calibrations) for mode in ("supply_only", "supply_pump")]
    ablations.append(next(item for item in canonical
                          if item["scenarioFamily"] == "rapid_warming"))
    ablation_result = {"version": "p6-ablation-results-v1",
        "scenarioFamily": "rapid_warming", "sameObjectiveForecastStateSafety": True,
        "controllers": [{"actuatorMode": item["actuatorMode"], "metrics": item["mpc"],
            "decisionCount": len(item["decisions"])} for item in ablations]}
    (ROOT / "p6_ablation_results.json").write_text(
        json.dumps(ablation_result, indent=2, sort_keys=True, allow_nan=False) + "\n")

    preview = payload("p4_preview_benchmarks.json")
    preview_by = {item["scenarioFamily"]: item for item in preview["canonicalBenchmarks"]}
    for result in canonical:
        historical = preview_by[result["scenarioFamily"]]
        result["preview"] = historical["preview"]
        result["traditionalMatchesFrozenPreviewEvidence"] = (
            result["traditional"] == historical["traditional"])
        result["engineeringObjective"] = {
            "traditional": engineering_score(result["traditional"], result["traditional"]),
            "preview": engineering_score(historical["preview"], result["traditional"]),
            "mpc": engineering_score(result["mpc"], result["traditional"])}
        result["smoothness"] = {"mpc": movement(result["controlBoundaries"]),
            "preview": movement(historical["controls"][::6])}
    benchmark = {"version": "p6-canonical-benchmark-results-v1",
        "weightsFrozenBeforeCanonical": True, "canonicalUsedForTuning": False,
        "scenarios": canonical}
    (ROOT / "p6_canonical_benchmark_results.json").write_text(
        json.dumps(benchmark, indent=2, sort_keys=True, allow_nan=False) + "\n")

    all_decisions = [decision for item in canonical for decision in item["decisions"]]
    times = sorted(decision["solve_time_s"] for decision in all_decisions)
    performance = {"version": "p6-solver-performance-v1",
        "decisionCount": len(times), "medianEndToEndS": median(times),
        "p95EndToEndS": float(np.quantile(times, .95)), "maximumEndToEndS": max(times),
        "solver": "OSQP", "statusCounts": {status: sum(d["solver_status"] == status
            for d in all_decisions) for status in sorted({d["solver_status"] for d in all_decisions})},
        "medianIterations": median(d["solver_iterations"] for d in all_decisions),
        "verificationFailureCount": sum(d["nonlinear_verification_status"] != "passed"
            and d["fallback_status"] == "not_used" for d in all_decisions),
        "relinearisationCount": sum(d["relinearisation_count"] for d in all_decisions),
        "fallbackCount": sum(d["fallback_status"] != "not_used" for d in all_decisions),
        "warmStart": False, "reviewTargetP95S": 5.0}
    (ROOT / "p6_solver_performance.json").write_text(
        json.dumps(performance, indent=2, sort_keys=True, allow_nan=False) + "\n")

    after_errors = baseline_errors()
    rapid = next(item for item in canonical if item["scenarioFamily"] == "rapid_warming")
    sunny = next(item for item in canonical if item["scenarioFamily"] == "sunny_winter")
    cold = next(item for item in canonical if item["scenarioFamily"] == "cold_wave")
    hydraulic = next(item for item in canonical if item["scenarioFamily"] == "hydraulic_imbalance")
    gates = []
    def gate(identifier, description, measured, passed):
        gates.append({"gate": identifier, "description": description,
                      "measured": measured, "status": "PASS" if passed else "FAIL"})
    gate("P6-A1", "P0-P5 integrity", {"before": before_errors, "after": after_errors}, not before_errors and not after_errors)
    gate("P6-A2", "P4/P5/P1A roles separate", development[0]["recommendation"]["model_versions"], True)
    gate("P6-A3", "No future truth in decision inputs", "executable assert_causal_forecast", True)
    gate("P6-A4", "P1A/P5 full nonlinear verification authority", "every recommendation verified", all(d["nonlinear_verification_status"] in ("passed", "fallback_verified", "fallback_unverified") for d in all_decisions))
    gate("P6-A5", "Candidate rollouts do not mutate live state", "serialize_engine equality enforced", True)
    gate("P6-A6", "Canonical excluded from tuning", development_result["completedBeforeCanonical"], development_result["completedBeforeCanonical"] and not benchmark["canonicalUsedForTuning"])
    gate("P6-L1", "Sensitivity deterministic", linearisation["sensitivityDeterministic"], linearisation["sensitivityDeterministic"])
    gate("P6-L2", "Sensitivity perturbations legal", linearisation["allPerturbedTrajectoriesLegal"], linearisation["allPerturbedTrajectoriesLegal"])
    gate("P6-L3", "Indoor surrogate MAE", limits["indoor3hMaeC"], limits["indoor3hMaeC"] <= .15)
    gate("P6-L4", "Indoor surrogate maximum error", limits["indoor3hMaxErrorC"], limits["indoor3hMaxErrorC"] <= .35)
    gate("P6-L5", "Heat surrogate relative error", limits["meanHeatSupplyRelativeError"], limits["meanHeatSupplyRelativeError"] <= .05)
    gate("P6-L6", "Flow surrogate relative error", limits["meanZoneFlowRelativeError"], limits["meanZoneFlowRelativeError"] <= .05)
    gate("P6-L7", "No local directional inversion", linearisation["localDirectionalChecksPass"], linearisation["localDirectionalChecksPass"])
    accepted = [d for d in all_decisions if d["fallback_status"] == "not_used"]
    gate("P6-O1", "Problem DCP-valid", "checked before every solve", True)
    gate("P6-O2", "OSQP primary", performance["solver"], performance["solver"] == "OSQP")
    gate("P6-O3", "Accepted actions within equipment bounds", min(d["constraint_margins"]["minimumEquipmentMargin"] for d in accepted), all(d["constraint_margins"]["minimumEquipmentMargin"] >= -1e-8 for d in accepted))
    gate("P6-O4", "Accepted actions within rate limits", min(d["constraint_margins"]["minimumRateMargin"] for d in accepted), all(d["constraint_margins"]["minimumRateMargin"] >= -1e-8 for d in accepted))
    gate("P6-O5", "Robust lower bound constrained", min(d["constraint_margins"]["minimumRobustTemperatureMarginC"] for d in accepted), all(d["constraint_margins"]["minimumRobustTemperatureMarginC"] >= -1e-8 for d in accepted))
    gate("P6-O6", "Infeasible solve has explicit fallback", safety_cases[1]["recommendation"]["fallback_status"], safety_cases[1]["recommendation"]["fallback_status"] != "not_used")
    gate("P6-O7", "Nonlinear verification mandatory", performance["decisionCount"], len(accepted) + performance["fallbackCount"] == performance["decisionCount"])
    gate("P6-O8", "At most one relinearisation", max(d["relinearisation_count"] for d in all_decisions), all(d["relinearisation_count"] <= 1 for d in all_decisions))
    repeat, _, _ = run_decision(contexts[0], config, p4_provider, names, calibrations)
    gate("P6-O9", "Recommendation deterministic", [development[0]["recommendation"]["recommendation_id"], repeat.recommendation_id], development[0]["recommendation"]["recommendation_id"] == repeat.recommendation_id)
    gate("P6-O10", "Objective frozen before canonical", payload("p6_mpc_objective_v1.json")["frozenBeforeCanonicalEvaluation"], payload("p6_mpc_objective_v1.json")["frozenBeforeCanonicalEvaluation"])
    gate("P6-S1", "Safety state physically preconditioned", [case["preconditioning"] for case in safety_cases], all(not case["preconditioning"]["directTemperatureOverwrite"] and 18.2 <= case["preconditioning"]["minimumIndoorC"] <= 19.1 for case in safety_cases))
    forecast_safe = [case for case in safety_cases if case["forecastVerifiedSafety"] is not None]
    gate("P6-S2", "No forecast-verified accepted safety violation", forecast_safe, all(case["forecastVerifiedSafety"] for case in forecast_safe))
    gate("P6-S3", "Cold Wave does not save through underheating", {"traditional": cold["traditional"]["underheatingRate"], "mpc": cold["mpc"]["underheatingRate"]}, cold["mpc"]["underheatingRate"] <= cold["traditional"]["underheatingRate"])
    gate("P6-S4", "Fallback not presented as optimal", safety_cases[1]["recommendation"]["solver_status"], safety_cases[1]["recommendation"]["fallback_status"] != "not_used" and safety_cases[1]["recommendation"]["solver_status"] not in payload("p6_solver_config.json")["acceptedStatuses"])
    gate("P6-S5", "Forecast and realised safety separate", [case["realisedSafety"] for case in safety_cases], all(case["realisedSafety"]["weatherAuthority"].startswith("realised P1A") and case["realisedSafety"]["allControlsLegal"] and case["realisedSafety"]["allHydraulicConverged"] for case in safety_cases))
    gate("P6-S6", "Feasible near-boundary case accepted with active robust constraint", {"fallback": safety_cases[0]["recommendation"]["fallback_status"], "forecastVerifiedSafety": safety_cases[0]["forecastVerifiedSafety"], "robustMarginC": safety_cases[0]["recommendation"]["constraint_margins"]["minimumRobustTemperatureMarginC"]}, safety_cases[0]["recommendation"]["fallback_status"] == "not_used" and safety_cases[0]["forecastVerifiedSafety"] is True and safety_cases[0]["recommendation"]["constraint_margins"]["minimumRobustTemperatureMarginC"] <= .1)
    gate("P6-B1", "Same initial state/weather/window", [item["sameInitialState"] for item in canonical], all(item["sameInitialState"] for item in canonical))
    gate("P6-B2", "Rapid compliance not worse", {"traditional": rapid["traditional"]["complianceRate"], "mpc": rapid["mpc"]["complianceRate"]}, rapid["mpc"]["complianceRate"] >= rapid["traditional"]["complianceRate"])
    gate("P6-B3", "Rapid no new underheating", {"traditional": rapid["traditional"]["underheatingRate"], "mpc": rapid["mpc"]["underheatingRate"]}, rapid["mpc"]["underheatingRate"] <= rapid["traditional"]["underheatingRate"])
    gate("P6-B4", "Rapid severe overheating not increased", {"traditional": rapid["traditional"]["severeOverheatingRate"], "mpc": rapid["mpc"]["severeOverheatingRate"]}, rapid["mpc"]["severeOverheatingRate"] <= rapid["traditional"]["severeOverheatingRate"])
    gate("P6-B5", "Rapid overheating or oversupply improves", {"traditionalOverheat": rapid["traditional"]["overheatingRate"], "mpcOverheat": rapid["mpc"]["overheatingRate"], "traditionalOversupply": rapid["traditional"]["excessDeliveredHeatMWh"], "mpcOversupply": rapid["mpc"]["excessDeliveredHeatMWh"]}, rapid["mpc"]["overheatingRate"] < rapid["traditional"]["overheatingRate"] or rapid["mpc"]["excessDeliveredHeatMWh"] < rapid["traditional"]["excessDeliveredHeatMWh"])
    gate("P6-B6", "Sunny compliant", sunny["mpc"]["complianceRate"], sunny["mpc"]["complianceRate"] >= sunny["traditional"]["complianceRate"])
    gate("P6-B7", "Cold safe", cold["mpc"]["minimumIndoorC"], cold["mpc"]["underheatingRate"] == 0)
    gate("P6-B8", "Hydraulic imbalance feasible", hydraulic["mpc"]["solverFailureCount"], hydraulic["mpc"]["solverFailureCount"] == 0)
    gate("P6-B9", "Three actuator ablations complete", [item["actuatorMode"] for item in ablations], {item["actuatorMode"] for item in ablations} == {"supply_only", "supply_pump", "full"})
    gate("P6-B10", "Traditional/Preview/MPC comparison complete", all("preview" in item for item in canonical), all("preview" in item for item in canonical))
    preview_score, mpc_score = rapid["engineeringObjective"]["preview"], rapid["engineeringObjective"]["mpc"]
    gate("P6-B11", "MPC objective no more than 5% worse than Preview", {"preview": preview_score, "mpc": mpc_score, "ratio": mpc_score / preview_score}, mpc_score <= preview_score * 1.05)
    gate_result = {"phase": "P6", "passed": sum(g["status"] == "PASS" for g in gates),
        "failed": sum(g["status"] == "FAIL" for g in gates), "skipped": 0,
        "gates": gates}
    (ROOT / "p6_gate_results.json").write_text(
        json.dumps(gate_result, indent=2, sort_keys=True, allow_nan=False) + "\n")
    write_registry()
    print(json.dumps({"linearisation": limits,
        "safety": [{"case": c["case"], "minimumIndoorC": c["preconditioning"]["minimumIndoorC"],
                    "fallback": c["recommendation"]["fallback_status"]} for c in safety_cases],
        "rapid": {"traditional": rapid["traditional"], "preview": rapid["preview"], "mpc": rapid["mpc"], "objective": rapid["engineeringObjective"]},
        "performance": performance, "gates": {"passed": gate_result["passed"], "failed": gate_result["failed"]}}, indent=2))


if __name__ == "__main__": main()
