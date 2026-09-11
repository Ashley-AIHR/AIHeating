"""Export one compact provider payload for the guided Rapid Warming preview."""
import csv
import gzip
import json
from pathlib import Path
import pickle

from ai_heating_core.p4.features import build_episode_rows, feature_names
from ai_heating_core.p4.prediction import PredictionInput, SelectedLoadPredictorV1

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "artifacts/p3_dataset_v1/official"


def read(path):
    with gzip.open(path, "rt", encoding="utf-8", newline="") as stream:
        return list(csv.DictReader(stream))


def main():
    manifest_path = next(path for path in (DATA / "manifests/benchmark_holdout").glob("*.json")
        if json.loads(path.read_text())["scenarioFamily"] == "rapid_warming")
    manifest = json.loads(manifest_path.read_text())
    names = feature_names(ROOT / "p4_feature_schema.json")
    rows = build_episode_rows(DATA, manifest_path, names, set(), set())
    registry = json.loads((ROOT / "p4_model_registry.json").read_text())
    models = {h: pickle.loads((ROOT / f"artifacts/p4_models_v1/selected_p4_predictor_v1/horizon_{h}m.pkl").read_bytes())
              for h in (60, 120, 180, 360)}
    predictor = SelectedLoadPredictorV1(registry["selectedModelType"], models, names,
        {int(k): v for k, v in registry["intervalHalfWidthsMw"].items()})
    anchor_rows = {row.horizon_minutes: row for row in rows if row.forecast_as_of == "2025-01-15T10:30:00+08:00"}
    predictions = []
    for horizon, row in anchor_rows.items():
        result = predictor.predict_required_heat(PredictionInput(horizon, dict(zip(names, row.features))))
        predictions.append({"horizonHours": horizon / 60, "targetTime": row.target_time,
            "pointMw": result.point_mw, "lowerMw": result.lower_mw, "upperMw": result.upper_mw})
    raw = read(DATA / manifest["outputFiles"]["raw_state"])
    current = next(row for row in raw if row["simulation_time"] == "2025-01-15T10:30:00+08:00")
    buildings = read(DATA / manifest["outputFiles"]["building_state"])
    current_buildings = [row for row in buildings if row["simulation_time"] == current["simulation_time"]]
    forecast = read(DATA / manifest["outputFiles"]["weather_forecast"])
    issued = [row for row in forecast if row["forecast_as_of"] == current["simulation_time"] and int(row["horizon_minutes"]) <= 360]
    preview = json.loads((ROOT / "p4_preview_benchmarks.json").read_text())
    objective = json.loads((ROOT / "p4_preview_objective_v0.json").read_text())
    policy = json.loads((ROOT / "p4_candidate_policy_space_v0.json").read_text())
    rapid = next(item for item in preview["canonicalBenchmarks"] if item["scenarioFamily"] == "rapid_warming")
    decision = next(item for item in rapid["decisions"] if item["minute"] == 150)
    comparison = json.loads((ROOT / "p4_model_comparison.json").read_text())
    models_ui = [{"name": name, "maeMw": values["weightedMaeMw"],
                  "rmseMw": values["overall"]["rmseMw"], "r2": values["overall"]["r2"]}
                 for name, values in comparison["evaluations"]["test"].items()]
    temperatures = [float(row["indoor_temperature_c"]) for row in current_buildings]
    distribution = [
        ("under18", sum(value < 18 for value in temperatures)),
        ("cool18To20", sum(18 <= value < 20 for value in temperatures)),
        ("comfort20To22", sum(20 <= value <= 22 for value in temperatures)),
        ("warm22To23", sum(22 < value <= 23 for value in temperatures)),
        ("over23", sum(value > 23 for value in temperatures)),
    ]
    payload = {"version": "p4-guided-preview-provider-v1", "scenario": "Rapid Daytime Warming",
        "simulationTime": current["simulation_time"], "forecastAsOf": current["simulation_time"],
        "model": {"displayName": "Selected P4 Predictor v1", "type": registry["selectedModelType"],
                  "version": registry["modelVersion"], "interval": "95% simulation-calibrated"},
        "now": {"outdoorC": float(current["outdoor_temperature_c"]),
                "solarWm2": float(current["solar_radiation_w_m2"]),
                "windMs": float(current["wind_m_s"]),
                "requiredLoadMw": float(current["required_heat_load_mw"]),
                "heatSupplyMw": float(current["actual_heat_supply_mw"]),
                "returnC": float(current["station_return_c"]),
                "totalFlowM3h": float(current["total_flow_m3_h"]),
                "pressureKpa": float(current["pump_pressure_kpa"]),
                "pumpPowerKw": float(current["pump_power_kw"]),
                "traditionalControls": {"supplyC": float(current["supply_setpoint_c"]),
                    "pumpHz": float(current["pump_frequency_hz"]),
                    "valvesPct": [float(current["near_valve_pct"]), float(current["mid_valve_pct"]),
                                  float(current["far_valve_pct"])]},
                "indoorP10C": sorted(float(row["indoor_temperature_c"]) for row in current_buildings)[1],
                "indoorP50C": sorted(float(row["indoor_temperature_c"]) for row in current_buildings)[5],
                "indoorP90C": sorted(float(row["indoor_temperature_c"]) for row in current_buildings)[9]},
        "zones": [{"key": zone, "flowM3h": float(current[f"{zone}_flow_m3_h"]),
            "transportDelayMin": float(current[f"transport_delay_{zone}_min"]),
            "deliveredSupplyC": float(current[f"delivered_supply_{zone}_c"])}
            for zone in ("near", "mid", "far")],
        "buildings": [{"id": row["building_id"], "zone": row["zone"],
            "indoorC": float(row["indoor_temperature_c"]),
            "requiredHeatKw": float(row["required_heat_kw"]),
            "radiatorHeatKw": float(row["radiator_heat_kw"])} for row in current_buildings],
        "temperatureDistribution": [{"key": key, "count": count,
            "fraction": count / len(temperatures)} for key, count in distribution],
        "forecast": [{"horizonMinutes": int(row["horizon_minutes"]),
            "targetTime": row["forecast_target_time"], "outdoorC": float(row["forecast_outdoor_temperature_c"]),
            "solarWm2": float(row["forecast_solar_radiation_w_m2"])} for row in issued],
        "predictions": sorted(predictions, key=lambda item: item["horizonHours"]),
        "recommendation": {"supplyC": decision["controls"]["supply_c"],
            "pumpHz": decision["controls"]["frequency_hz"],
            "valvesPct": [100 * value for value in decision["controls"]["valves"]],
            "reason": "Forecast warming and solar gain reduce predicted Required Heat Load."},
        "projection": decision["projection"],
        "comparison": {"traditional": rapid["traditional"], "preview": rapid["preview"]},
        "modelComparison": models_ui,
        "configuration": {"physicalFixtureVersion": manifest["baseFixtureVersion"],
            "controllerVersion": manifest["controllerVersion"],
            "predictionHorizonsHours": [1, 2, 3, 6],
            "forecastDisplayWindowsHours": [6, 24, 48],
            "objectiveVersion": objective["version"], "objective": objective,
            "optimiserVersion": policy["version"], "decisionIntervalMinutes": policy["decisionIntervalMinutes"],
            "previewHorizonMinutes": policy["previewHorizonMinutes"]},
        "labels": {"preview": "Predictive Optimisation Preview", "optimiser": "Preview Optimiser v0 — not final MPC",
                   "projection": "Digital Twin Projection", "environment": "Simulation Environment",
                   "traditional": "Traditional Weather Compensation", "outcome": "Projected Outcome",
                   "source": "Simulation Engine", "equipmentBoundary": "No real equipment control"}}
    (ROOT / "src/p4-preview-data.json").write_text(json.dumps(payload, indent=2, sort_keys=True, allow_nan=False) + "\n")
    print(json.dumps({"forecastAsOf": payload["forecastAsOf"], "predictions": payload["predictions"],
                      "recommended": payload["recommendation"]}, indent=2))


if __name__ == "__main__":
    main()
