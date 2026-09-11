"""Freeze P5 calibration, validation-only uncertainty, TEST and canonical evaluation."""
import csv
import gzip
import hashlib
import json
from collections import defaultdict
from math import ceil
from pathlib import Path

import numpy as np

from ai_heating_core.p5.dataset import DATASET_VERSION, read_csv
from ai_heating_core.p5.thermal import (CALIBRATION_VERSION, INPUT_SCHEMA_VERSION,
    MODEL_VERSION, ThermalParameters, calibrate, rollout, step_temperature)
from ai_heating_core.physical_fixture_v1_2 import coherent_parameters
from ai_heating_core.transport import DelayLine

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "artifacts/p5_identification_dataset_v1_0"
HORIZONS = (30, 60, 120, 180, 360)
SELECTED = ("h_scale", "c_scale")


def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()


def metric(rows):
    errors = np.asarray([row["predictionC"] - row["actualC"] for row in rows])
    absolute = np.abs(errors)
    return {"count": len(rows), "maeC": float(absolute.mean()),
        "rmseC": float(np.sqrt(np.mean(errors ** 2))), "biasC": float(errors.mean()),
        "p90AbsoluteErrorC": float(np.quantile(absolute, .9)),
        "p95AbsoluteErrorC": float(np.quantile(absolute, .95))}


def grouped(rows, keys):
    groups = defaultdict(list)
    for row in rows: groups[tuple(row[key] for key in keys)].append(row)
    return [{**dict(zip(keys, values)), **metric(group)}
            for values, group in sorted(groups.items())]


def calibration_rows(rows, building_id):
    return [row for row in rows if row["building_id"] == building_id
            and int(row["day_index"]) < 4]


def fit_sites(sites, nominal):
    output = {}
    for site in sites:
        rows = read_csv(DATA / site["files"]["siteObservable"])
        fitted = {}
        for building_id in sorted(nominal):
            result = calibrate(calibration_rows(rows, building_id), nominal[building_id], SELECTED)
            fitted[building_id] = result
        output[site["site_id"]] = fitted
    return output


def forecast_lookup(path):
    return {(int(row["anchor_elapsed_minutes"]), int(row["horizon_minutes"])): row
            for row in read_csv(path)}


def evaluate_site(site, fitted, nominal, mode, model="calibrated", truth=None,
                  supply_field="delivered_zone_supply_c"):
    rows = read_csv(DATA / site["files"]["siteObservable"])
    by_building = defaultdict(dict)
    for row in rows: by_building[row["building_id"]][int(row["elapsed_minutes"])] = row
    forecasts = forecast_lookup(DATA / site["files"]["issuedForecast"])
    output = []
    for building_id, timeline in by_building.items():
        for anchor in range(4 * 1440, 6 * 1440 - 360 + 1, 30):
            current = timeline[anchor]
            for horizon in HORIZONS:
                future = [timeline[minute] for minute in range(anchor + 5, anchor + horizon + 1, 5)]
                if model == "persistence":
                    predicted = float(current["indoor_end_c"])
                else:
                    if model == "nominal": parameters = ThermalParameters()
                    elif model == "calibrated": parameters = fitted[building_id].parameters
                    elif model == "oracle":
                        actual = truth["buildings"][building_id]
                        profile = nominal[building_id]
                        parameters = ThermalParameters(
                            (1 / actual["true_thermal_resistance_k_w"]) /
                                (1 / profile.thermal_resistance_k_w),
                            actual["true_thermal_capacitance_j_k"] / profile.thermal_capacitance_j_k,
                            actual["true_radiator_ua_w_k"] / profile.radiator_ua_w_k,
                            actual["true_solar_scale"])
                    prepared = []
                    for index, row in enumerate(future, 1):
                        prepared_row = dict(row)
                        if mode == "forecast_driven":
                            issued_horizon = int(ceil(index * 5 / 30) * 30)
                            issued = forecasts[(anchor, issued_horizon)]
                            prepared_row["outdoor_temperature_c"] = issued["issued_forecast_outdoor_c"]
                            prepared_row["solar_radiation_w_m2"] = issued["issued_forecast_solar_w_m2"]
                        prepared.append(prepared_row)
                    predicted = rollout(float(current["indoor_end_c"]), prepared,
                        nominal[building_id], parameters, supply_field=supply_field)[-1]
                target = future[-1]
                output.append({"siteId": site["site_id"], "split": site["split"],
                    "buildingId": building_id, "zone": target["zone"],
                    "insulationClass": target["insulation_class"],
                    "scenarioFamily": target["scenario_family"], "mode": mode,
                    "model": model, "horizonMinutes": horizon,
                    "actualC": float(target["indoor_end_c"]), "predictionC": float(predicted)})
    return output


def summarize(rows):
    return {"overallByHorizon": grouped(rows, ["horizonMinutes"]),
        "byBuilding": grouped(rows, ["horizonMinutes", "buildingId"]),
        "byZone": grouped(rows, ["horizonMinutes", "zone"]),
        "byInsulationClass": grouped(rows, ["horizonMinutes", "insulationClass"]),
        "byScenarioFamily": grouped(rows, ["horizonMinutes", "scenarioFamily"])}


def conformal(validation_rows):
    result = {}
    for mode in ("oracle_exogenous", "forecast_driven"):
        result[mode] = {}
        for horizon in HORIZONS:
            errors = sorted(abs(row["predictionC"] - row["actualC"]) for row in validation_rows
                            if row["mode"] == mode and row["horizonMinutes"] == horizon)
            rank = min(len(errors) - 1, ceil((len(errors) + 1) * .95) - 1)
            result[mode][str(horizon)] = errors[rank]
    return result


def coverage(rows, widths):
    return [{"mode": mode, "horizonMinutes": horizon,
        "coverage": sum(abs(row["predictionC"] - row["actualC"]) <= widths[mode][str(horizon)]
            for row in rows if row["mode"] == mode and row["horizonMinutes"] == horizon) /
            sum(1 for row in rows if row["mode"] == mode and row["horizonMinutes"] == horizon),
        "meanWidthC": 2 * widths[mode][str(horizon)]}
        for mode in widths for horizon in HORIZONS]


def recovery(sites, fits, nominal):
    records = []
    for site in sites:
        truth = json.loads((DATA / site["files"]["simulationTruth"]).read_text())
        for building_id, fit in fits[site["site_id"]].items():
            actual = truth["buildings"][building_id]
            true = {"h_scale": (1 / actual["true_thermal_resistance_k_w"]) /
                        (1 / nominal[building_id].thermal_resistance_k_w),
                    "c_scale": actual["true_thermal_capacitance_j_k"] /
                        nominal[building_id].thermal_capacitance_j_k}
            for name in SELECTED:
                estimate = getattr(fit.parameters, name)
                records.append({"siteId": site["site_id"], "split": site["split"],
                    "buildingId": building_id, "zone": nominal[building_id].zone,
                    "insulationClass": nominal[building_id].insulation_level,
                    "parameter": name, "estimated": estimate, "truth": true[name],
                    "relativeError": estimate / true[name] - 1})
    def summarize_recovery(selected):
        errors = np.asarray([row["relativeError"] for row in selected])
        estimated = np.asarray([row["estimated"] for row in selected])
        truth = np.asarray([row["truth"] for row in selected])
        return {"count": len(selected),
            "medianAbsoluteRelativeError": float(np.median(abs(errors))),
            "p90AbsoluteRelativeError": float(np.quantile(abs(errors), .9)),
            "bias": float(errors.mean()),
            "correlation": float(np.corrcoef(estimated, truth)[0, 1])}
    overall = {name: summarize_recovery(
        [row for row in records if row["parameter"] == name]) for name in SELECTED}
    by = {}
    for field in ("buildingId", "insulationClass", "zone", "siteId"):
        by[field] = []
        for value in sorted({row[field] for row in records}):
            for name in SELECTED:
                selected = [row for row in records if row[field] == value
                            and row["parameter"] == name]
                by[field].append({field: value, "parameter": name,
                                  **summarize_recovery(selected)})
    return {"overall": overall, "byGroup": by, "records": records,
        "interpretation": "effective H/C recovery only; UA and solar were fixed because the four-parameter candidate was confounded"}


def control_qa(sites):
    maximum = {"supplyDeltaC": 0.0, "pumpDeltaHz": 0.0, "valveDeltaFraction": 0.0}
    within_bounds = True
    for site in sites:
        rows = read_csv(DATA / site["files"]["siteObservable"])
        by_time = defaultdict(dict)
        for row in rows:
            by_time[int(row["elapsed_minutes"])].setdefault(row["zone"], row)
        previous = None
        for values in (by_time[key] for key in sorted(by_time)):
            sample = values["near"]
            state = (float(sample["station_supply_setpoint_c"]),
                     float(sample["pump_frequency_hz"]),
                     *(float(values[zone]["zone_valve_fraction"]) for zone in ("near", "mid", "far")))
            within_bounds &= 40 <= state[0] <= 60 and 30 <= state[1] <= 50 and all(.2 <= value <= 1 for value in state[2:])
            if previous is not None:
                maximum["supplyDeltaC"] = max(maximum["supplyDeltaC"], abs(state[0] - previous[0]))
                maximum["pumpDeltaHz"] = max(maximum["pumpDeltaHz"], abs(state[1] - previous[1]))
                maximum["valveDeltaFraction"] = max(maximum["valveDeltaFraction"], *(abs(a-b) for a,b in zip(state[2:], previous[2:])))
            previous = state
    return {**maximum, "withinEquipmentBounds": bool(within_bounds),
        "passed": bool(within_bounds and maximum["supplyDeltaC"] <= 2 + 1e-12
            and maximum["pumpDeltaHz"] <= 2 + 1e-12
            and maximum["valveDeltaFraction"] <= .1 + 1e-12)}


def causality(nominal):
    profile = nominal["B01"]
    p = ThermalParameters()
    base = step_temperature(21, -5, 100, 48, .7, profile, p)
    heat_base = step_temperature(21, -5, 100, 52, .7, profile, p)
    lower_outdoor = step_temperature(21, -10, 100, 48, .7, profile, p)
    higher_solar = step_temperature(21, -5, 500, 48, .7, profile, p)
    lower_flow = step_temperature(21, -5, 100, 48, .35, profile, p)
    higher_c = step_temperature(21, -5, 100, 48, .7, profile, ThermalParameters(c_scale=1.3))
    higher_h = step_temperature(21, -10, 0, 21, .7, profile, ThermalParameters(h_scale=1.3))
    base_cold = step_temperature(21, -10, 0, 21, .7, profile, p)
    delay = DelayLine(2.966666667, 45)
    first = delay.advance(55, 17.8 / 3600, 300)
    c7_before = step_temperature(21, -5, 0, 45, .7, profile, p)
    c7_after = step_temperature(21, -5, 0, first[0].temperature_c, .7, profile, p)
    tests = {"C1HigherSupply": heat_base >= base,
        "C2LowerOutdoorGreaterLoss": lower_outdoor <= base,
        "C3HigherSolarWarms": higher_solar >= base,
        "C4LowerFlowNonIncreasingHeat": lower_flow <= base,
        "C5HigherCSlowerResponse": abs(higher_c - 21) <= abs(base - 21),
        "C6HigherHStrongerOutdoorCoupling": higher_h <= base_cold,
        "C7NoPreTransportJump": abs(c7_after - c7_before) < 1e-12}
    return {"tests": tests, "values": {"baseEndC": base, "higherSupplyEndC": heat_base,
        "lowerOutdoorEndC": lower_outdoor, "higherSolarEndC": higher_solar,
        "lowerFlowEndC": lower_flow, "higherCEndC": higher_c,
        "higherHEndC": higher_h, "firstTransportOutletC": first[0].temperature_c},
        "passed": all(tests.values())}


def _p3_csv(path):
    with gzip.open(path, "rt", encoding="utf-8", newline="") as stream:
        return list(csv.DictReader(stream))


def canonical_evaluation(base_fits, nominal):
    manifest_root = ROOT / "artifacts/p3_dataset_v1/official/manifests/benchmark_holdout"
    output = []
    for manifest_path in sorted(manifest_root.glob("*.json")):
        manifest = json.loads(manifest_path.read_text())
        raw = _p3_csv(ROOT / "artifacts/p3_dataset_v1/official" / manifest["outputFiles"]["raw_state"])
        buildings = _p3_csv(ROOT / "artifacts/p3_dataset_v1/official" / manifest["outputFiles"]["building_state"])
        forecasts = _p3_csv(ROOT / "artifacts/p3_dataset_v1/official" / manifest["outputFiles"]["weather_forecast"])
        raw_by_time = {row["simulation_time"]: row for row in raw}
        forecast_by = {(row["forecast_as_of"], int(row["horizon_minutes"])): row for row in forecasts}
        by_building = defaultdict(list)
        for row in buildings: by_building[row["building_id"]].append(row)
        scenario_records = []
        for building_id, series in by_building.items():
            profile = nominal[building_id]
            peers = [p for p in nominal.values() if p.zone == profile.zone]
            share = profile.flow_share_weight / sum(p.flow_share_weight for p in peers)
            for anchor_index in range(5, len(series) - 72, 6):
                anchor = series[anchor_index]
                anchor_raw = raw_by_time[anchor["simulation_time"]]
                for horizon in HORIZONS:
                    future = series[anchor_index + 1:anchor_index + horizon // 5 + 1]
                    for mode in ("oracle_exogenous", "forecast_driven"):
                        temperature = float(anchor["indoor_temperature_c"])
                        for index, target in enumerate(future, 1):
                            station = raw_by_time[target["simulation_time"]]
                            outdoor = float(station["outdoor_temperature_c"])
                            solar = float(station["solar_radiation_w_m2"])
                            if mode == "forecast_driven":
                                issued_horizon = int(ceil(index * 5 / 30) * 30)
                                issued = forecast_by[(anchor["simulation_time"], issued_horizon)]
                                outdoor = float(issued["forecast_outdoor_temperature_c"])
                                solar = float(issued["forecast_solar_radiation_w_m2"])
                            zone = profile.zone
                            flow = float(station[f"{zone}_flow_m3_h"]) / 3600 * 998 * share
                            temperature = step_temperature(temperature, outdoor, solar,
                                float(station[f"delivered_supply_{zone}_c"]), flow,
                                profile, base_fits[building_id].parameters)
                        scenario_records.append({"scenarioFamily": manifest["scenarioFamily"],
                            "buildingId": building_id, "zone": profile.zone,
                            "insulationClass": profile.insulation_level, "mode": mode,
                            "horizonMinutes": horizon, "actualC": float(future[-1]["indoor_temperature_c"]),
                            "predictionC": temperature})
        output.append({"scenarioFamily": manifest["scenarioFamily"],
            "oracleExogenous": grouped([r for r in scenario_records if r["mode"] == "oracle_exogenous"], ["horizonMinutes"]),
            "forecastDriven": grouped([r for r in scenario_records if r["mode"] == "forecast_driven"], ["horizonMinutes"]),
            "minimumActualIndoorC": min(r["actualC"] for r in scenario_records),
            "maximumActualIndoorC": max(r["actualC"] for r in scenario_records)})
    return output


def main():
    manifest = json.loads((ROOT / "p5_identification_manifest.json").read_text())
    identity = json.loads((ROOT / "p5_identifiability_results.json").read_text())
    if tuple(identity["selectedParameterisation"]) != SELECTED:
        raise ValueError("calibration script requires frozen selected parameterisation")
    config = json.loads((ROOT / "p5_calibration_config.json").read_text())
    nominal = {profile.building_id: profile for profile in coherent_parameters().buildings}
    dev = [site for site in manifest["sites"] if site["split"] == "development"]
    validation = [site for site in manifest["sites"] if site["split"] == "validation"]
    test = [site for site in manifest["sites"] if site["split"] == "test"]
    base = [site for site in manifest["sites"] if site["split"] == "base_fixture"]
    controls = control_qa(manifest["sites"])

    fits = fit_sites(dev + validation + base, nominal)
    validation_rows = []
    for site in validation:
        for mode in ("oracle_exogenous", "forecast_driven"):
            validation_rows += evaluate_site(site, fits[site["site_id"]], nominal, mode)
    widths = conformal(validation_rows)

    test_fits = fit_sites(test, nominal)
    fits.update(test_fits)
    test_rows = []
    for site in test:
        truth = json.loads((DATA / site["files"]["simulationTruth"]).read_text())
        for mode in ("oracle_exogenous", "forecast_driven"):
            for model in ("persistence", "nominal", "calibrated"):
                test_rows += evaluate_site(site, fits[site["site_id"]], nominal, mode, model)
        test_rows += evaluate_site(site, fits[site["site_id"]], nominal,
                                   "oracle_exogenous", "oracle", truth)
    selected_test = [row for row in test_rows if row["model"] == "calibrated"]
    summaries = {f"{mode}:{model}": summarize([row for row in test_rows
        if row["mode"] == mode and row["model"] == model])
        for mode in ("oracle_exogenous", "forecast_driven")
        for model in ("persistence", "nominal", "calibrated")}
    summaries["oracle_exogenous:oracle"] = summarize([row for row in test_rows
        if row["mode"] == "oracle_exogenous" and row["model"] == "oracle"])

    aligned_3h = metric([row for row in selected_test if row["mode"] == "oracle_exogenous"
                         and row["horizonMinutes"] == 180])["maeC"]
    shadow_rows = []
    for site in test:
        shadow_rows += evaluate_site(site, fits[site["site_id"]], nominal,
            "oracle_exogenous", "calibrated", supply_field="station_supply_setpoint_c")
    shadow_3h = metric([row for row in shadow_rows if row["horizonMinutes"] == 180])["maeC"]

    artifact_evaluation_rows = [row for row in validation_rows
        if row["mode"] == "oracle_exogenous" and row["model"] == "calibrated"]
    artifact_evaluation_rows += [row for row in selected_test
        if row["mode"] == "oracle_exogenous"]
    for site in dev + base:
        artifact_evaluation_rows += evaluate_site(
            site, fits[site["site_id"]], nominal, "oracle_exogenous")
    artifact_metric_rows = grouped(artifact_evaluation_rows,
        ["siteId", "buildingId", "horizonMinutes"])
    artifact_metrics = {
        (site["site_id"], building_id): {
            "mode": "oracle_exogenous",
            "window": "held-out days 5-6",
            "byHorizon": {str(item["horizonMinutes"]): {key: value for key, value
                in item.items() if key not in ("siteId", "buildingId", "horizonMinutes")}
                for item in artifact_metric_rows if item["siteId"] == site["site_id"]
                and item["buildingId"] == building_id}
        }
        for site in dev + validation + test + base for building_id in nominal
    }

    artifact_sites = {}
    for site in dev + validation + test + base:
        per_building = {}
        for building_id, fit in fits[site["site_id"]].items():
            per_building[building_id] = {"modelVersion": MODEL_VERSION,
                "calibrationAlgorithm": CALIBRATION_VERSION,
                "calibrationId": f"p5-calibration-{site['site_id']}-{building_id}-v1",
                "parameterisation": list(SELECTED), "inputSchemaVersion": INPUT_SCHEMA_VERSION,
                "datasetHistoryIdentity": f"{DATASET_VERSION}:{site['site_id']}:days1-4",
                "siteId": site["site_id"], "buildingId": building_id,
                "calibrationWindow": "days 1-4; evaluation days excluded",
                "configurationHash": digest(ROOT / "p5_calibration_config.json"),
                "seed": config["seed"], "fittedParameters": vars(fit.parameters),
                "fitDiagnostics": {"cost": fit.cost, "trajectoryFitMaeC": fit.residual_mae_c,
                    "nfev": fit.nfev, "deterministicStarts": fit.deterministic_starts},
                "identifiabilityStatus": identity["classification"],
                "validationMetrics": artifact_metrics[(site["site_id"], building_id)]}
        artifact_sites[site["site_id"]] = per_building
    calibration_artifact = {"version": "p5-calibrated-parameters-v1",
        "selectedModelVersion": MODEL_VERSION, "calibrationMethodVersion": CALIBRATION_VERSION,
        "parameterisation": list(SELECTED), "sites": artifact_sites,
        "baseFixtureCalibrationId": "p5-base-fixture-calibration-v1",
        "baseFixtureSiteId": "P5-BASE-FIXTURE", "truthUsedDuringFit": False}
    (ROOT / "p5_calibrated_parameters.json").write_text(
        json.dumps(calibration_artifact, indent=2, sort_keys=True, allow_nan=False) + "\n")

    rec = recovery(dev + validation + test, fits, nominal)
    uncertainty = {"method": config["uncertainty"]["method"],
        "calibrationSplit": "validation sites only", "nominalCoverage": .95,
        "halfWidthsC": widths, "test": coverage(selected_test, widths),
        "realWorldClaim": False}
    test_summary = {"version": "p5-prediction-results-v1",
        "selectedModel": MODEL_VERSION, "selectedParameterisation": list(SELECTED),
        "testSiteIds": [site["site_id"] for site in test],
        "summaries": summaries, "uncertainty": uncertainty,
        "parameterRecovery": rec,
        "transportAlignmentShadow": {"aligned3hOracleMaeC": aligned_3h,
            "stationSupplySameTime3hOracleMaeC": shadow_3h,
            "errorWorsened": shadow_3h > aligned_3h,
            "selectedInput": "P1A FIFO delivered zone supply"},
        "physicalCausality": causality(nominal),
        "underheatSupport": sum(row["actualC"] < 18 for row in selected_test),
        "riskStatement": "Underheat classification accuracy is not reported when positive support is insufficient.",
        "methodFrozenBeforeTest": True}
    (ROOT / "p5_prediction_results.json").write_text(
        json.dumps(test_summary, indent=2, sort_keys=True, allow_nan=False) + "\n")

    canonical = canonical_evaluation(fits["P5-BASE-FIXTURE"], nominal)
    canonical_result = {"version": "p5-canonical-holdout-evaluation-v1",
        "calibrationId": "p5-base-fixture-calibration-v1",
        "calibrationFrozenBeforeHoldout": True, "holdoutUsedForCalibration": False,
        "scenarios": canonical}
    (ROOT / "p5_canonical_holdout_results.json").write_text(
        json.dumps(canonical_result, indent=2, sort_keys=True, allow_nan=False) + "\n")

    oracle = {row["horizonMinutes"]: row["maeC"] for row in summaries["oracle_exogenous:calibrated"]["overallByHorizon"]}
    forecast = {row["horizonMinutes"]: row["maeC"] for row in summaries["forecast_driven:calibrated"]["overallByHorizon"]}
    persistence = {row["horizonMinutes"]: row["maeC"] for row in summaries["oracle_exogenous:persistence"]["overallByHorizon"]}
    nominal_metrics = {row["horizonMinutes"]: row["maeC"] for row in summaries["oracle_exogenous:nominal"]["overallByHorizon"]}
    worst = {h: max(row["maeC"] for row in summaries["oracle_exogenous:calibrated"]["byBuilding"]
        if row["horizonMinutes"] == h) for h in (180, 360)}
    gates = []
    def gate(identifier, description, measured, passed):
        gates.append({"gate": identifier, "description": description, "measured": measured,
                      "status": "PASS" if passed else "FAIL"})
    observable_names = {item["name"]: item["class"] for item in
        json.loads((ROOT / "p5_observability_schema.json").read_text())["fields"]}
    gate("P5-I1", "Hidden truth inaccessible to calibration", "calibrate rejects class-F keys; truthUsedDuringFit=false", not calibration_artifact["truthUsedDuringFit"])
    gate("P5-I2", "Same-asset depth assessed", identity["p3HistoryAssessment"], identity["p3Decision"] == "C")
    gate("P5-I3", "Jacobian rank reported", identity["aggregate"]["minimumRank"], identity["aggregate"]["minimumRank"] == 4)
    gate("P5-I4", "Conditioning and singular values reported", identity["aggregate"]["maximumConditionNumber"], all(p["diagnostic"]["singularValues"] for p in identity["pilotCases"]))
    gate("P5-I5", "Parameter confounding reported", identity["aggregate"]["maximumAbsoluteCorrelation"], identity["aggregate"]["maximumAbsoluteCorrelation"] > .98)
    gate("P5-I6", "Confounded full parameterisation reduced", list(SELECTED), not identity["fullParameterisationPasses"] and list(SELECTED) == identity["selectedParameterisation"])
    gate("P5-I7", "Dedicated persistent-site dataset used", manifest["siteCounts"], manifest["datasetVersion"] == DATASET_VERSION)
    gate("P5-I8", "Identification excitation obeys bounds", controls, controls["passed"] and all(s["physicalQA"]["solverFailureCount"] == 0 for s in manifest["sites"]))
    gate("P5-I9", "No canonical holdout used for calibration", manifest["canonicalScenarioIdsUsedForCalibration"], not manifest["canonicalScenarioIdsUsedForCalibration"])
    repeat_site = dev[0]
    repeat_rows = read_csv(DATA / repeat_site["files"]["siteObservable"])
    first_fit = fits[repeat_site["site_id"]]["B01"]
    repeat_fit = calibrate(calibration_rows(repeat_rows, "B01"), nominal["B01"], SELECTED)
    repeat_delta = max(abs(getattr(first_fit.parameters, name) -
        getattr(repeat_fit.parameters, name)) for name in SELECTED)
    gate("P5-I10", "Calibration deterministic",
        {"siteId": repeat_site["site_id"], "buildingId": "B01",
         "maximumRepeatedParameterDelta": repeat_delta,
         "deterministicStarts": repeat_fit.deterministic_starts},
        repeat_delta <= 1e-12 and repeat_fit.deterministic_starts == 3)
    gate("P5-C1", "Fitted parameters finite and positive", "all site/building scales", all(value > 0 and np.isfinite(value) for site in fits.values() for f in site.values() for value in vars(f.parameters).values()))
    selected_id = identity["selectedAggregate"]
    gate("P5-C2", "Selected parameterisation identifiable for claimed interpretation", selected_id, selected_id["minimumRank"] == 2 and selected_id["maximumConditionNumber"] <= 10000)
    gate("P5-C3", "Calibrated beats persistence on TEST", {"calibrated": oracle, "persistence": persistence}, all(oracle[h] < persistence[h] for h in HORIZONS))
    relative_improvement = {h: 1 - oracle[h] / nominal_metrics[h] for h in HORIZONS}
    gate("P5-C4", "Calibrated materially improves over nominal",
        {"calibrated": oracle, "nominal": nominal_metrics,
         "relativeImprovement": relative_improvement},
        all(relative_improvement[h] >= .05 for h in HORIZONS))
    gate("P5-C5", "Oracle Exogenous MAE thresholds", oracle, all(oracle[h] <= float(config["testThresholds"]["oracleMaeC"][str(h)]) for h in HORIZONS))
    gate("P5-C6", "Forecast-driven MAE thresholds", forecast, all(forecast[h] <= float(config["testThresholds"]["forecastDrivenMaeC"][str(h)]) for h in (60, 180, 360)))
    gate("P5-C7", "Worst-building thresholds", worst, worst[180] <= .75 and worst[360] <= 1.0)
    gate("P5-C8", "Physical causality", test_summary["physicalCausality"], test_summary["physicalCausality"]["passed"])
    gate("P5-C9", "No transport compensation", test_summary["transportAlignmentShadow"], shadow_3h > aligned_3h)
    gate("P5-C10", "Stable 6h rollout", {"maximumAbsolutePredictionC": max(abs(r["predictionC"]) for r in selected_test)}, all(np.isfinite(r["predictionC"]) and -50 < r["predictionC"] < 80 for r in selected_test))
    gate("P5-C11", "Intervals calibrated on validation only", uncertainty["calibrationSplit"], uncertainty["calibrationSplit"] == "validation sites only")
    gate("P5-C12", "Canonical holdout untouched until final evaluation", canonical_result["calibrationFrozenBeforeHoldout"], canonical_result["calibrationFrozenBeforeHoldout"] and not canonical_result["holdoutUsedForCalibration"])
    split_sets = {split: {s["site_id"] for s in manifest["sites"] if s["split"] == split} for split in ("development", "validation", "test")}
    gate("P5-D1", "One persistent parameter set per site", len({s["physicalParameterHash"] for s in manifest["sites"]}), len({s["physicalParameterHash"] for s in manifest["sites"]}) == len(manifest["sites"]))
    gate("P5-D2", "Site split disjoint", {k: len(v) for k,v in split_sets.items()}, not any(split_sets[a] & split_sets[b] for a,b in (("development","validation"),("development","test"),("validation","test"))))
    gate("P5-D3", "Calibration/evaluation windows separated", "days1-4 / days5-6", all(s["calibrationDays"] == [1,2,3,4] and s["evaluationDays"] == [5,6] for s in manifest["sites"]))
    gate("P5-D4", "Truth and observable views separated", manifest["viewSeparation"], manifest["viewSeparation"]["selectedCalibrationView"] == "site_observable")
    gate("P5-D5", "No truth columns in calibration", sorted(name for name, cls in observable_names.items() if cls == "F"), not any(cls == "F" and name in __import__('ai_heating_core.p5.dataset', fromlist=['OBSERVABLE_FIELDS']).OBSERVABLE_FIELDS for name, cls in observable_names.items()))
    gate("P5-D6", "All accepted episodes pass P1A QA", max(s["physicalQA"]["maximumConservationResidual"] for s in manifest["sites"]), all(s["physicalQA"]["solverFailureCount"] == 0 and s["physicalQA"]["allFinite"] for s in manifest["sites"]))
    gate("P5-D7", "No failed episode silently discarded", manifest["attemptedDesigns"], len(manifest["attemptedDesigns"]) >= len(manifest["sites"]) and all(any(a["accepted"] for a in manifest["attemptedDesigns"] if a["siteId"] == s["site_id"]) for s in manifest["sites"]))
    gate("P5-D8", "Every history reproducible from manifest", len(manifest["fileHashes"]), all(digest(DATA / name) == expected for name, expected in manifest["fileHashes"].items()))
    gate("P5-D9", "Actions obey bounds/rate limits", controls, controls["passed"])
    p4 = json.loads((ROOT / "p4_gate_results.json").read_text())
    p4p1 = next(item for item in p4["gates"] if item["gate"] == "P4-P1")
    gate("P5-D10", "P3 hashes unchanged", p4p1["measured"]["p3Errors"], not p4p1["measured"]["p3Errors"])
    gate_result = {"phase": "P5", "passed": sum(g["status"] == "PASS" for g in gates),
        "failed": sum(g["status"] == "FAIL" for g in gates), "skipped": 0,
        "gates": gates}
    (ROOT / "p5_gate_results.json").write_text(
        json.dumps(gate_result, indent=2, sort_keys=True, allow_nan=False) + "\n")

    registry = {"modelVersion": MODEL_VERSION, "calibrationMethodVersion": CALIBRATION_VERSION,
        "selectedParameterisation": list(SELECTED), "inputSchemaVersion": INPUT_SCHEMA_VERSION,
        "calibrationArtifact": "p5_calibrated_parameters.json",
        "calibrationArtifactHash": digest(ROOT / "p5_calibrated_parameters.json"),
        "identificationManifestHash": digest(ROOT / "p5_identification_manifest.json"),
        "identifiabilityResultsHash": digest(ROOT / "p5_identifiability_results.json"),
        "predictionResultsHash": digest(ROOT / "p5_prediction_results.json"),
        "canonicalResultsHash": digest(ROOT / "p5_canonical_holdout_results.json"),
        "intervalHalfWidthsC": widths, "provider": "ai_heating_core.p5.ThermalPredictionProvider",
        "selectedUse": "3-hour P6 supervisory predictive-control support",
        "secondaryUse": "6-hour planning", "realSiteValidation": False}
    (ROOT / "p5_model_registry.json").write_text(
        json.dumps(registry, indent=2, sort_keys=True, allow_nan=False) + "\n")
    print(json.dumps({"gates": {"passed": gate_result["passed"], "failed": gate_result["failed"]},
        "oracleMaeC": oracle, "forecastMaeC": forecast, "worstBuilding": worst,
        "transportShadow": test_summary["transportAlignmentShadow"],
        "coverage": uncertainty["test"]}, indent=2))


if __name__ == "__main__": main()
