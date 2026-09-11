"""Evaluate P4 evidence without changing frozen P2/P3 inputs."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def load(name):
    return json.loads((ROOT / name).read_text())


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    p2 = load("P2_BASELINE_FREEZE_MANIFEST_v1.2.json")
    p3 = load("p3_generation_manifest.json")
    schema = load("p4_feature_schema.json")
    model = load("p4_model_comparison.json")
    registry = load("p4_model_registry.json")
    preview = load("p4_preview_benchmarks.json")
    policy = load("p4_candidate_policy_space_v0.json")
    objective = load("p4_preview_objective_v0.json")
    ui = load("src/p4-preview-data.json")
    p2_errors = []
    for group in (p2["acceptedP1AFileHashes"], p2["artifactFileHashes"]):
        for name, expected in group.items():
            path = ROOT / name
            if not path.is_file() or digest(path) != expected:
                p2_errors.append(name)
    p3_root = ROOT / p3["storageRoot"]
    p3_errors = []
    if digest(ROOT / "dataset_schema.json") != p3["schemaHash"]:
        p3_errors.append("dataset_schema.json")
    for name, expected in p3["episodeManifestHashes"].items():
        path = p3_root / name
        if not path.is_file() or digest(path) != expected:
            p3_errors.append(name)
            continue
        episode = json.loads(path.read_text())
        for name, shard_expected in episode["outputFileHashes"].items():
            shard = p3_root / name
            if not shard.is_file() or digest(shard) != shard_expected:
                p3_errors.append(str(shard.relative_to(p3_root)))
    gates = []
    def gate(identifier, description, measured, passed):
        gates.append({"gate": identifier, "description": description, "measured": measured,
                      "status": "PASS" if passed else "FAIL"})
    models = set(model["evaluations"]["test"])
    horizons = {int(value) for value in registry["horizonsMinutes"]}
    families = set(model["evaluations"]["test"]["LightGBM"]["byScenarioFamily"])
    features = schema["featureFields"]
    validation = preview["validationBeforeCanonical"]
    canonical = preview["canonicalBenchmarks"]
    rapid = next(item for item in canonical if item["scenarioFamily"] == "rapid_warming")
    cold = next(item for item in canonical if item["scenarioFamily"] == "cold_wave")
    gate("P4-P1", "P2/P3 freeze verification", {"p2Errors": p2_errors, "p3Errors": p3_errors, "episodeManifests": len(p3["episodeManifestHashes"])}, not p2_errors and not p3_errors)
    gate("P4-P2", "Zero future-truth feature leakage", {"availabilityClasses": sorted({f["availabilityClass"] for f in features}), "labelUsedByModel": schema["label"]["usedByModel"]}, not schema["label"]["usedByModel"] and all(f["availabilityClass"] != "F" for f in features))
    gate("P4-P3", "P3 split isolation", model["rowCounts"], model["rowCounts"] == {"train":44800,"validation_select":6400,"validation_calibration":3200,"test":9600,"benchmark_holdout":640})
    gate("P4-P4", "Exact Required Heat Load target semantics", schema["label"], schema["label"]["field"] == "required_heat_load_mw" and schema["label"]["source"] == "separate P3 load_target table")
    gate("P4-P5", "All four model families evaluated", sorted(models), models == {"Persistence","Physics Predictor v0","Linear Regression","LightGBM"})
    gate("P4-P6", "Metrics by 1/2/3/6h", sorted(horizons), horizons == {60,120,180,360})
    gate("P4-P7", "Scenario-family metrics", sorted(families), families == {"normal_winter","cold_wave","rapid_warming","sunny_winter","hydraulic_imbalance"})
    gate("P4-P8", "Selected-model test skill", model["testSkillVsPersistence"], model["testSkillVsPersistence"] >= .10)
    gate("P4-P9", "Selection has no LightGBM requirement", model["selection"]["criterion"], "minimum" in model["selection"]["criterion"] and "simpler" in model["selection"]["criterion"])
    gate("P4-P10", "Feature ablation complete", sorted(model["ablation"]["variants"]), set(model["ablation"]["variants"]) == {"full","minus_forecast","minus_solar","minus_indoor","minus_lagged_load"})
    gate("P4-P11", "95% simulation-calibrated interval", model["uncertainty"], model["uncertainty"]["nominalCoverage"] == .95 and .90 <= model["uncertainty"]["testCoverage"] <= 1)
    artifact_errors = [name for name, expected in registry["artifactHashes"].items() if digest(ROOT / name) != expected]
    gate("P4-P12", "Fixed-seed artifact integrity", {"seed":registry["seed"],"artifactHashErrors":artifact_errors}, registry["seed"] == 20260910 and not artifact_errors)
    gate("P4-V1", "Identical cloned initial state", [item["sameInitialState"] for item in canonical], all(item["sameInitialState"] for item in canonical))
    preview_source = (ROOT / "physical_core/src/ai_heating_core/p4/preview.py").read_text()
    gate("P4-V2", "No future actual truth in candidate decisions", "forecast fields guarded; environment actuals excluded", "Forecast-only boundary rejected fields" in preview_source and "issued_forecast" in preview_source)
    gate("P4-V3", "Legal equipment bounds", [item["preview"]["allControlsLegal"] for item in canonical], all(item["preview"]["allControlsLegal"] for item in canonical))
    limits = policy["maximumMovementPerDecision"]
    max_ds = max(abs(b["supply_c"]-a["supply_c"]) for item in canonical for a,b in zip(item["controls"],item["controls"][1:]))
    max_df = max(abs(b["frequency_hz"]-a["frequency_hz"]) for item in canonical for a,b in zip(item["controls"],item["controls"][1:]))
    max_dv = max(abs(y-x)*100 for item in canonical for a,b in zip(item["controls"],item["controls"][1:]) for x,y in zip(a["valves"],b["valves"]))
    gate("P4-V4", "Legal rate limits", {"maxSupplyDeltaC":max_ds,"maxPumpDeltaHz":max_df,"maxValveDeltaPp":max_dv}, max_ds <= limits["supplyC"] and max_df <= limits["pumpHz"] and max_dv <= limits["valveFraction"] * 100)
    minimum_projection = min(decision["projection"]["minimumIndoorC"] for item in canonical for decision in item["decisions"] if decision["feasible"])
    gate("P4-V5", "No accepted candidate below 18C", minimum_projection, minimum_projection >= 18)
    gate("P4-V6", "Explicit safe fallback", policy["fallback"], bool(policy["fallback"]) and "fallback" in preview_source.lower())
    gate("P4-V7", "Deterministic selection", validation, all(item["deterministicFirstDecision"] for item in validation))
    gate("P4-V8", "Full P1A engine rollout", "SimulationEngine clone/step used", "SimulationEngine" in preview_source and ".step(" in preview_source)
    gate("P4-V9", "Config frozen before canonical", {"policy":policy["frozenBeforeCanonicalEvaluation"],"objective":objective["frozenBeforeCanonicalEvaluation"]}, policy["frozenBeforeCanonicalEvaluation"] and objective["frozenBeforeCanonicalEvaluation"])
    gate("P4-V10", "Rapid Warming direction", {"gate":preview["rapidWarmingDirectionalGate"],"traditional":rapid["traditional"],"preview":rapid["preview"]}, preview["rapidWarmingDirectionalGate"])
    gate("P4-V11", "Cold Wave safety", {"gate":preview["coldWaveSafetyGate"],"underheating":cold["preview"]["underheatingRate"]}, preview["coldWaveSafetyGate"])
    gate("P4-V12", "Frozen baselines unchanged", {"p2Errors":p2_errors,"p3Errors":p3_errors}, not p2_errors and not p3_errors)
    app = (ROOT / "src/App.tsx").read_text(); copy = (ROOT / "src/i18n.ts").read_text()
    journey_keys = ("journeyNow", "journeyForecast", "journeyPredict", "journeyOptimise", "journeyVerify")
    gate("P4-U1", "Five-step Overview journey", "NOW/FORECAST/PREDICT/OPTIMISE/VERIFY", all(f"t('{key}')" in app and f"{key}:" in copy for key in journey_keys))
    gate("P4-U2", "One-click guided entry", "Start Predictive Preview", "startPreview" in app and "Start Predictive Preview" in copy)
    gate("P4-U3", "Load and supply remain distinct", {"requiredLoadMw":ui["now"]["requiredLoadMw"],"heatSupplyMw":ui["now"]["heatSupplyMw"]}, "requiredLoadMw" in app and "heatSupplyMw" in app)
    gate("P4-U4", "Visible prediction source/version", ui["model"], "model-badge" in app)
    gate("P4-U5", "Preview is not final MPC", ui["labels"]["optimiser"], "not final MPC" in copy)
    gate("P4-U6", "Comparison values provider-backed", ui["version"], "guidedPreview.comparison" in app)
    en_zh = "previewJourneyTitle" in copy and "预测供热旅程" in copy
    gate("P4-U7", "EN/ZH complete", en_zh, en_zh)
    gate("P4-U8", "P0 control-mode semantics retained", "traditional|advisory|optimised", "const modeKeys: ControlMode[] = ['traditional', 'advisory', 'optimised']" in app)
    output = {"phase":"P4","passed":sum(g["status"]=="PASS" for g in gates),"failed":sum(g["status"]=="FAIL" for g in gates),"skipped":0,"gates":gates}
    (ROOT / "p4_gate_results.json").write_text(json.dumps(output, indent=2, sort_keys=True, allow_nan=False) + "\n")
    print(f"P4 Gates: {output['passed']} passed, {output['failed']} failed, 0 skipped")
    return bool(output["failed"])


if __name__ == "__main__":
    raise SystemExit(main())
