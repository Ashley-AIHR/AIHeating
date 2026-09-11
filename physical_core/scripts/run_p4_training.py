"""Build causal P4 features, train four predictors, select, freeze and evaluate."""
from collections import defaultdict
from datetime import datetime, timezone
import json
from math import ceil, sqrt
from pathlib import Path
import pickle
import platform

import lightgbm
import numpy as np
import sklearn
from lightgbm import LGBMRegressor
from sklearn.linear_model import LinearRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from ai_heating_core.benchmark.freeze import file_hash
from ai_heating_core.benchmark.state import content_hash
from ai_heating_core.p4 import FEATURE_SCHEMA_VERSION, P4_VERSION
from ai_heating_core.p4.features import build_rows

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "artifacts" / "p4_models_v1"
HORIZONS = (60, 120, 180, 360)
SEED = 20260910


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, sort_keys=True, allow_nan=False) + "\n")


def arrays(rows, names, include=None):
    indices = list(range(len(names))) if include is None else [names.index(name) for name in include]
    return np.asarray([[row.features[i] for i in indices] for row in rows], dtype=float), np.asarray([row.target_mw for row in rows])


def fit_linear(rows, names, include=None):
    models = {}
    used = names if include is None else include
    for horizon in HORIZONS:
        selected = [row for row in rows if row.horizon_minutes == horizon]
        x, y = arrays(selected, names, used)
        models[horizon] = make_pipeline(StandardScaler(), LinearRegression()).fit(x, y)
    return models


def fit_lightgbm(rows, names, config, include=None):
    models = {}
    used = names if include is None else include
    for horizon in HORIZONS:
        selected = [row for row in rows if row.horizon_minutes == horizon]
        x, y = arrays(selected, names, used)
        models[horizon] = LGBMRegressor(**config, random_state=SEED, deterministic=True,
            force_col_wise=True, n_jobs=1, verbosity=-1).fit(x, y)
    return models


def predict(rows, names, model_name, models=None, include=None):
    used = names if include is None else include
    indices = [names.index(name) for name in used]
    values = []
    for row in rows:
        if model_name == "Persistence":
            value = row.persistence_mw
        elif model_name == "Physics Predictor v0":
            value = row.physics_mw
        else:
            value = float(models[row.horizon_minutes].predict(np.asarray([[row.features[i] for i in indices]]))[0])
        values.append(max(0.0, value))
    return np.asarray(values)


def simple_metrics(actual, predicted):
    error = predicted - actual
    mae = float(np.mean(np.abs(error)))
    rmse = float(sqrt(np.mean(error ** 2)))
    denominator = float(np.sum((actual - np.mean(actual)) ** 2))
    r2 = 1 - float(np.sum(error ** 2)) / denominator if denominator else 0.0
    return {"count": len(actual), "maeMw": mae, "rmseMw": rmse, "r2": r2,
            "normalizedMae": mae / max(float(np.mean(np.abs(actual))), 1e-12)}


def evaluate(rows, predictions):
    result = {"overall": simple_metrics(np.asarray([r.target_mw for r in rows]), predictions),
              "byHorizon": {}, "byScenarioFamily": {}}
    for horizon in HORIZONS:
        indices = [i for i, row in enumerate(rows) if row.horizon_minutes == horizon]
        result["byHorizon"][str(horizon)] = simple_metrics(
            np.asarray([rows[i].target_mw for i in indices]), predictions[indices])
    for family in sorted({row.scenario_family for row in rows}):
        result["byScenarioFamily"][family] = {}
        for horizon in HORIZONS:
            indices = [i for i, row in enumerate(rows) if row.scenario_family == family and row.horizon_minutes == horizon]
            result["byScenarioFamily"][family][str(horizon)] = simple_metrics(
                np.asarray([rows[i].target_mw for i in indices]), predictions[indices])
    result["weightedMaeMw"] = sum(result["byHorizon"][str(h)]["maeMw"] for h in HORIZONS) / len(HORIZONS)
    return result


def persist_models(directory, models):
    hashes = {}
    directory.mkdir(parents=True, exist_ok=True)
    for horizon, model in models.items():
        path = directory / f"horizon_{horizon}m.pkl"
        path.write_bytes(pickle.dumps(model, protocol=5))
        hashes[str(path.relative_to(ROOT))] = file_hash(path)
    return hashes


def conformal_widths(rows, predictions):
    widths = {}
    for horizon in HORIZONS:
        residuals = sorted(abs(predictions[i] - row.target_mw) for i, row in enumerate(rows) if row.horizon_minutes == horizon)
        rank = min(len(residuals), ceil((len(residuals) + 1) * .95))
        widths[horizon] = residuals[rank - 1]
    return widths


def main():
    schema_path = ROOT / "p4_feature_schema.json"
    names, rows, partition = build_rows(ROOT, schema_path)
    by_split = {split: [row for row in rows if row.split == split] for split in
                ("train", "validation_select", "validation_calibration", "test", "benchmark_holdout")}
    train, select = by_split["train"], by_split["validation_select"]
    linear = fit_linear(train, names)
    configs = json.loads((ROOT / "p4_training_config.json").read_text())["lightgbmGrid"]
    grid = []
    grid_models = []
    for index, config in enumerate(configs):
        models = fit_lightgbm(train, names, config)
        metrics = evaluate(select, predict(select, names, "LightGBM", models))
        grid.append({"candidate": index, "config": config, "validationSelect": metrics})
        grid_models.append(models)
    best_by_horizon = {}
    lightgbm_models = {}
    for horizon in HORIZONS:
        best = min(range(len(grid)), key=lambda i: grid[i]["validationSelect"]["byHorizon"][str(horizon)]["maeMw"])
        best_by_horizon[str(horizon)] = best
        lightgbm_models[horizon] = grid_models[best][horizon]
    candidates = {"Persistence": None, "Physics Predictor v0": None,
                  "Linear Regression": linear, "LightGBM": lightgbm_models}
    validation = {name: evaluate(select, predict(select, names, name, models))
                  for name, models in candidates.items()}
    eligible = ("Physics Predictor v0", "Linear Regression", "LightGBM")
    ranked = sorted(eligible, key=lambda name: validation[name]["weightedMaeMw"])
    best = ranked[0]
    simpler = {"Physics Predictor v0": 0, "Linear Regression": 1, "LightGBM": 2}
    selected_name = min((name for name in eligible
        if validation[name]["weightedMaeMw"] <= validation[best]["weightedMaeMw"] * 1.01), key=lambda name: simpler[name])
    selection = {"selectedModel": selected_name, "selectionSplit": "validation_select",
        "criterion": "minimum equal-horizon weighted MAE; simpler model within 1%",
        "validationWeightedMaeMw": {name: value["weightedMaeMw"] for name, value in validation.items()},
        "lightgbmBestCandidateByHorizon": best_by_horizon,
        "frozenAt": "2026-09-10T00:00:00+00:00"}
    write_json(OUT / "selection_freeze.json", selection)

    selected_models = candidates[selected_name]
    calibration_predictions = predict(by_split["validation_calibration"], names, selected_name, selected_models)
    widths = conformal_widths(by_split["validation_calibration"], calibration_predictions)
    evaluations = {"validationSelect": validation, "test": {}, "benchmarkHoldout": {}}
    for model_name, models in candidates.items():
        evaluations["test"][model_name] = evaluate(by_split["test"], predict(by_split["test"], names, model_name, models))
        evaluations["benchmarkHoldout"][model_name] = evaluate(by_split["benchmark_holdout"], predict(by_split["benchmark_holdout"], names, model_name, models))
    selected_test_predictions = predict(by_split["test"], names, selected_name, selected_models)
    interval_hits = []
    interval_widths = []
    per_horizon_coverage = {}
    for horizon in HORIZONS:
        indices = [i for i, row in enumerate(by_split["test"]) if row.horizon_minutes == horizon]
        hits = [abs(selected_test_predictions[i] - by_split["test"][i].target_mw) <= widths[horizon] for i in indices]
        interval_hits += hits; interval_widths += [2 * widths[horizon]] * len(indices)
        per_horizon_coverage[str(horizon)] = {"coverage": sum(hits) / len(hits), "count": len(hits),
            "halfWidthMw": widths[horizon], "meanWidthMw": 2 * widths[horizon]}
    uncertainty = {"method": "split-conformal absolute residual", "nominalCoverage": .95,
        "calibrationSplit": "validation_calibration", "testCoverage": sum(interval_hits) / len(interval_hits),
        "testMeanWidthMw": sum(interval_widths) / len(interval_widths), "byHorizon": per_horizon_coverage,
        "label": "95% simulation-calibrated prediction interval"}

    ablation = {"selectedModel": selected_name, "evaluationSplit": "validation_select", "variants": {}}
    if selected_models is not None:
        groups = {
            "full": list(names),
            "minus_forecast": [n for n in names if not n.startswith("forecast_") and n != "physics_forecast_load_mw"],
            "minus_solar": [n for n in names if "solar" not in n],
            "minus_indoor": [n for n in names if "indoor" not in n],
            "minus_lagged_load": [n for n in names if not n.startswith("lag")],
        }
        selected_config = configs[best_by_horizon["60"]] if selected_name == "LightGBM" else None
        for label, used in groups.items():
            if selected_name == "Linear Regression":
                models = fit_linear(train, names, used)
            else:
                models = {}
                for horizon in HORIZONS:
                    config = configs[best_by_horizon[str(horizon)]]
                    horizon_rows = [row for row in train if row.horizon_minutes == horizon]
                    x, y = arrays(horizon_rows, names, used)
                    models[horizon] = LGBMRegressor(**config, random_state=SEED, deterministic=True,
                        force_col_wise=True, n_jobs=1, verbosity=-1).fit(x, y)
            ablation["variants"][label] = evaluate(select, predict(select, names, selected_name, models, used))
    else:
        ablation["notApplicableReason"] = "Selected Physics Predictor v0 has no learned feature coefficients."

    hashes = {}
    hashes.update(persist_models(OUT / "linear_regression_v1", linear))
    hashes.update(persist_models(OUT / "lightgbm_v1", lightgbm_models))
    if selected_models is not None:
        hashes.update(persist_models(OUT / "selected_p4_predictor_v1", selected_models))
    test_persistence = evaluations["test"]["Persistence"]["weightedMaeMw"]
    test_selected = evaluations["test"][selected_name]["weightedMaeMw"]
    comparison = {"p4Version": P4_VERSION, "featureSchemaVersion": FEATURE_SCHEMA_VERSION,
        "featureNames": list(names), "rowCounts": {key: len(value) for key, value in by_split.items()},
        "validationPartition": partition, "lightgbmGrid": grid, "selection": selection,
        "evaluations": evaluations, "uncertainty": uncertainty, "ablation": ablation,
        "testSkillVsPersistence": 1 - test_selected / test_persistence,
        "testHorizonSkillVsPersistence": {str(h): 1 - evaluations["test"][selected_name]["byHorizon"][str(h)]["maeMw"] / evaluations["test"]["Persistence"]["byHorizon"][str(h)]["maeMw"] for h in HORIZONS}}
    write_json(ROOT / "p4_model_comparison.json", comparison)
    registry = {"registryVersion": "p4-model-registry-v1", "activeModel": "selected-p4-predictor-v1",
        "selectedModelType": selected_name, "modelVersion": "selected-p4-predictor-v1",
        "horizonsMinutes": list(HORIZONS), "featureSchemaVersion": FEATURE_SCHEMA_VERSION,
        "trainingDatasetVersion": "p3-dataset-v1.0", "trainingConfigHash": file_hash(ROOT / "p4_training_config.json"),
        "trainingTimestamp": "2026-09-10T00:00:00+00:00", "seed": SEED,
        "validationMetrics": validation[selected_name], "testMetrics": evaluations["test"][selected_name],
        "intervalHalfWidthsMw": {str(k): v for k, v in widths.items()}, "artifactHashes": hashes,
        "packages": {"python": platform.python_version(), "numpy": np.__version__, "scikitLearn": sklearn.__version__, "lightgbm": lightgbm.__version__},
        "selectionFreezeHash": file_hash(OUT / "selection_freeze.json"),
        "p3GenerationManifestHash": file_hash(ROOT / "p3_generation_manifest.json")}
    write_json(ROOT / "p4_model_registry.json", registry)
    print(json.dumps({"selected": selected_name, "testSkill": comparison["testSkillVsPersistence"],
        "testCoverage": uncertainty["testCoverage"], "rows": comparison["rowCounts"]}, indent=2))


if __name__ == "__main__":
    main()
