"""Generate and gate the P3 pilot or official deterministic dataset."""
from collections import Counter, defaultdict
from dataclasses import asdict, replace
from datetime import datetime, timezone
import gzip
import json
from pathlib import Path
import shutil
import sys
import tempfile

from ai_heating_core.benchmark.freeze import file_hash, verify_file_hashes
from ai_heating_core.benchmark.runner import convergence, run_baseline
from ai_heating_core.benchmark.state import content_hash
from ai_heating_core.control.traditional import config_from_dict
from ai_heating_core.dataset import DATASET_VERSION, GENERATOR_VERSION
from ai_heating_core.dataset.factory import (FAMILIES, ML_SPLITS, EpisodeDescriptor,
    generate_episode, make_scenario, official_descriptors, pilot_descriptors,
    sample_parameters, validate_parameter_coherence)
from ai_heating_core.dataset.schema import TABLE_FIELDS, columns, schema_document
from ai_heating_core.p1_2_scenarios import scenarios

ROOT = Path(__file__).resolve().parents[2]
ARTIFACTS = ROOT / "artifacts" / "p3_dataset_v1"
PILOT_ROOT = ARTIFACTS / "pilot"
OFFICIAL_ROOT = ARTIFACTS / "official"
GENERATION_TIME = "2026-09-09T00:00:00+00:00"


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, sort_keys=True, allow_nan=False) + "\n")


def load_inputs():
    payload = json.loads((ROOT / "p2_controller_config_v1.2.json").read_text())
    return config_from_dict(payload), scenarios(), content_hash(payload)


def freeze_errors():
    manifest = json.loads((ROOT / "P2_BASELINE_FREEZE_MANIFEST_v1.2.json").read_text())
    errors = verify_file_hashes(ROOT, manifest["acceptedP1AFileHashes"])
    errors += verify_file_hashes(ROOT, manifest["artifactFileHashes"])
    payload = json.loads((ROOT / "p2_controller_config_v1.2.json").read_text())
    if content_hash(payload) != manifest["controllerConfigHash"]:
        errors.append("controllerConfigHash")
    return sorted(set(errors))


def warmup_study(config, canonical):
    cases = [
        ("high_capacitance", "normal_winter", {"c": 1.2}, "nominal"),
        ("low_capacitance", "normal_winter", {"c": .8}, "nominal"),
        ("cold_low_side", "cold_wave", {}, "low"),
        ("rapid_warming_high_side", "rapid_warming", {}, "high"),
        ("hydraulic_high_side", "hydraulic_imbalance", {}, "high"),
    ]
    records = []
    for index, (name, family, overrides, mode) in enumerate(cases):
        descriptor = EpisodeDescriptor.create("warmup_study", family, index, mode)
        parameters, _ = sample_parameters(descriptor, overrides)
        scenario = make_scenario(descriptor, parameters, canonical)
        result = convergence(scenario, config, (72, 96))
        records.append({"case": name, "scenarioFamily": family, **result})
    selected = 72 if all(record["maxIndoorDifferenceC"] < .2 for record in records) else 96
    return {"comparisonHours": [72, 96], "thresholdC": .2,
            "selectedWarmupHours": selected, "cases": records}


def inspect_manifest(root, manifest):
    errors = []
    for table, relative in manifest["outputFiles"].items():
        path = root / relative
        with gzip.open(path, "rt", encoding="utf-8", newline="") as stream:
            header = stream.readline().rstrip("\n\r").split(",")
            rows = sum(1 for _ in stream)
        if header != columns(table):
            errors.append(f"{manifest['episodeId']}:{table}:schema")
        if rows != manifest["rowCounts"][table]:
            errors.append(f"{manifest['episodeId']}:{table}:rowCount")
    return errors


def replay(descriptor, config, canonical, warmup_hours, controller_hash, expected):
    with tempfile.TemporaryDirectory(prefix="p3-replay-") as directory:
        actual = generate_episode(descriptor, config, canonical, directory, warmup_hours,
            controller_config_hash=controller_hash, resume=False,
            generation_timestamp=GENERATION_TIME)
        return actual["outputFileHashes"] == expected["outputFileHashes"]


def physical_ok(result):
    frames = result.frames
    return (all(frame.hydraulics.solver.status == "converged" for frame in frames)
        and max(frame.hydraulics.solver.normalized_residual for frame in frames) < 1e-5
        and max(frame.mass_residual for frame in frames) < 1e-6
        and max(max(frame.heat_balance_residual, frame.pipe_heat_balance_residual,
                    frame.building_heat_balance_residual) for frame in frames) < 1e-5
        and max(frame.pipe_volume_residual for frame in frames) < 1e-10
        and all(frame.station_return_c <= frame.controls.supply_c + 1e-9
                and all(frame.zone_return_c[z] <= frame.delivered_supply_c[z] + 1e-9
                        for z in frame.zone_return_c) for frame in frames))


def stress_sweep(config, canonical, warmup_hours):
    factors = {"r": (.7, 1.3), "c": (.7, 1.3), "internal_gain": (.7, 1.3),
        "solar": (.7, 1.3), "radiator_margin": (.7, 1.3), "kpipe": (.7, 1.3),
        "kvalve": (.7, 1.3), "pump": (.8, 1.2)}
    records = []
    for factor, bounds in factors.items():
        for side, value in zip(("low", "high"), bounds):
            descriptor = EpisodeDescriptor.create("stress", "normal_winter", len(records), "nominal")
            overrides = {"pump_head": value, "pump_curve": value} if factor == "pump" else {factor: value}
            parameters, metadata = sample_parameters(descriptor, overrides)
            scenario = make_scenario(descriptor, parameters, canonical)
            run = run_baseline(scenario, replace(config, warmup_hours=warmup_hours))
            records.append({"factor": factor, "side": side, "multiplier": value,
                "parameterCoherence": validate_parameter_coherence(parameters, metadata, official=False),
                "physicalQA": physical_ok(run), "frames": len(run.frames),
                "controlSignature": content_hash([asdict(state) for state in run.controller_states]),
                "maxHydraulicResidual": max(f.hydraulics.solver.normalized_residual for f in run.frames),
                "maxMassResidual": max(f.mass_residual for f in run.frames),
                "maxHeatResidual": max(max(f.heat_balance_residual, f.pipe_heat_balance_residual,
                    f.building_heat_balance_residual) for f in run.frames)})
    signatures = {record["controlSignature"] for record in records}
    for record in records:
        record["causalControlInvariant"] = len(signatures) == 1
    return records


def gate(gate_id, description, passed, measured):
    return {"gate": gate_id, "description": description,
            "status": "PASS" if passed else "FAIL", "measured": measured}


def run_pilot():
    config, canonical, controller_hash = load_inputs()
    errors = freeze_errors()
    if errors:
        raise RuntimeError(f"P2 freeze verification failed: {errors}")
    schema = schema_document()
    write_json(ROOT / "dataset_schema.json", schema)
    schema_hash = file_hash(ROOT / "dataset_schema.json")
    warmup = warmup_study(config, canonical)
    manifests = []
    for descriptor in pilot_descriptors():
        print(f"pilot {descriptor.episode_id}", flush=True)
        manifests.append(generate_episode(descriptor, config, canonical, PILOT_ROOT,
            warmup["selectedWarmupHours"], controller_config_hash=controller_hash,
            generation_timestamp=GENERATION_TIME))
    stress = stress_sweep(config, canonical, warmup["selectedWarmupHours"])
    schema_errors = [error for manifest in manifests for error in inspect_manifest(PILOT_ROOT, manifest)]
    replays = {manifest["episodeId"]: replay(EpisodeDescriptor(**manifest["descriptor"]),
        config, canonical, warmup["selectedWarmupHours"], controller_hash, manifest)
        for manifest in manifests}
    identities = [(m["physicalParameterHash"], m["scenarioVariantId"], m["seed"], m["forecastSeed"])
                  for m in manifests]
    regression = json.loads((ROOT / "p3_regression_results.json").read_text()) \
        if (ROOT / "p3_regression_results.json").exists() else {"passed": False, "reason": "not yet run"}
    family_counts = Counter(m["scenarioFamily"] for m in manifests)
    gates = [
        gate("A1", "P2 freeze integrity", not errors, {"errors": errors}),
        gate("A2", "Deterministic episode replay", all(replays.values()), replays),
        gate("A3", "Schema validation", not schema_errors, {"errors": schema_errors}),
        gate("A4", "Unit validation", all(f["unit"] and f["unit"] != "unknown" for f in schema["fields"]), {"fields": len(schema["fields"])}),
        gate("A5", "Time continuity", not schema_errors and all(m["rowCounts"]["raw_state"] == 288 for m in manifests), {"episodes": len(manifests), "stepMinutes": 5}),
        gate("A6", "No NaN / Inf", all(m["physicalQA"]["allFinite"] for m in manifests), {"episodes": 15}),
        gate("A7", "Physical validity", all(m["physicalQA"]["passed"] for m in manifests) and all(r["physicalQA"] and r["causalControlInvariant"] for r in stress), {"failed": [m["episodeId"] for m in manifests if not m["physicalQA"]["passed"]], "stressRuns": len(stress)}),
        gate("A8", "Parameter envelope", all(validate_parameter_coherence(*sample_parameters(d)) for d in pilot_descriptors()), {"episodes": 15}),
        gate("A9", "Derived-fixture coherence", all(r["parameterCoherence"] for r in stress), {"stressRuns": len(stress)}),
        gate("A10", "Split isolation", len(set(identities)) == 15 and family_counts == Counter({f: 3 for f in FAMILIES}), {"uniqueIdentities": len(set(identities)), "families": dict(family_counts)}),
        gate("A11", "Forecast causality and truth separation", not any("truth" in c or "actual" in c or "indoor" in c or "required" in c for c in columns("weather_forecast")), {"forecastColumns": columns("weather_forecast")}),
        gate("A12", "Target alignment", all(m["schemaQA"]["errors"] == [] for m in manifests), {"loadHorizonsMinutes": [60, 120, 180, 360], "temperatureHorizonsMinutes": [30, 60, 120, 180, 360]}),
        gate("A13", "Warm-up policy", warmup["selectedWarmupHours"] in (72, 96), warmup),
        gate("A14", "Canonical isolation", all(not d.canonical for d in pilot_descriptors()) and all(m["scenarioVersion"] != "1.2" for m in manifests), {"pilotEpisodes": 15, "canonicalEpisodes": 0}),
        gate("A15", "P0/P1A/P2/P3 regression", bool(regression.get("passed")), regression),
    ]
    result = {"datasetVersion": DATASET_VERSION, "phase": "P3A", "warmupStudy": warmup,
        "stressSweep": stress, "episodeCount": len(manifests), "schemaHash": schema_hash,
        "gates": gates, "passed": all(g["status"] == "PASS" for g in gates),
        "freezeErrors": errors}
    write_json(ROOT / "p3a_gate_results.json", result)
    write_json(PILOT_ROOT / "pilot_manifest.json", {"datasetVersion": DATASET_VERSION,
        "episodeManifestHashes": {str((Path("manifests") / m["split"] / (m["episodeId"] + ".json"))):
            file_hash(PILOT_ROOT / "manifests" / m["split"] / (m["episodeId"] + ".json")) for m in manifests},
        "warmupPolicy": warmup, "schemaHash": schema_hash})
    print(f"P3A: {'PASS' if result['passed'] else 'FAIL'}", flush=True)
    return not result["passed"]


def leakage_audit(manifests):
    fields = {"physicalParameterSetId": "parameter-set ID", "physicalParameterHash": "parameter-set hash",
        "scenarioVariantId": "scenario variant",
        "seed": "generation seed", "forecastSeed": "forecast seed"}
    collisions = []
    for field, label in fields.items():
        seen = defaultdict(set)
        for manifest in manifests:
            if manifest["split"] in ML_SPLITS:
                seen[manifest[field]].add(manifest["split"])
        collisions += [{"field": label, "value": value, "splits": sorted(splits)}
                       for value, splits in seen.items() if len(splits) > 1]
    canonical_leaks = [m["episodeId"] for m in manifests if m["descriptor"]["canonical"]
                       and m["split"] != "benchmark_holdout"]
    holdout_errors = [m["episodeId"] for m in manifests if m["split"] == "benchmark_holdout"
                      and (not m["descriptor"]["canonical"] or m["scenarioVersion"] != "1.2")]
    return {"collisions": collisions, "canonicalLeaks": canonical_leaks,
            "holdoutErrors": holdout_errors,
            "passed": not collisions and not canonical_leaks and not holdout_errors}


def coverage(manifests):
    dimensions = defaultdict(list)
    for manifest in manifests:
        if manifest["split"] in ML_SPLITS:
            for name, values in manifest["parameterSampling"]["multipliers"].items():
                dimensions[name].extend(values)
    return {name: {"min": min(values), "max": max(values), "count": len(values)}
            for name, values in sorted(dimensions.items())}


def run_official():
    p3a = json.loads((ROOT / "p3a_gate_results.json").read_text())
    if not p3a.get("passed"):
        raise RuntimeError("P3A gates must PASS before official generation")
    config, canonical, controller_hash = load_inputs()
    errors = freeze_errors()
    if errors:
        raise RuntimeError(f"P2 freeze verification failed: {errors}")
    descriptors = official_descriptors()
    manifests, failures = [], []
    for number, descriptor in enumerate(descriptors, 1):
        print(f"official {number}/505 {descriptor.episode_id}", flush=True)
        try:
            manifests.append(generate_episode(descriptor, config, canonical, OFFICIAL_ROOT,
                p3a["warmupStudy"]["selectedWarmupHours"], controller_config_hash=controller_hash,
                generation_timestamp=GENERATION_TIME))
        except Exception as error:
            failures.append({"episodeId": descriptor.episode_id, "error": repr(error)})
            write_json(ROOT / "p3_generation_failures.json", failures)
            raise
    leakage = leakage_audit(manifests)
    schema_errors = [error for manifest in manifests for error in inspect_manifest(OFFICIAL_ROOT, manifest)]
    split_counts = Counter(m["split"] for m in manifests)
    family_split_counts = Counter((m["split"], m["scenarioFamily"]) for m in manifests)
    reproduction_sample = [m for m in manifests if m["split"] in ML_SPLITS and m["descriptor"]["episode_index"] < 2]
    replays = {m["episodeId"]: replay(EpisodeDescriptor(**m["descriptor"]), config, canonical,
        p3a["warmupStudy"]["selectedWarmupHours"], controller_hash, m) for m in reproduction_sample}
    regression = json.loads((ROOT / "p3_regression_results.json").read_text())
    coverage_data = coverage(manifests)
    required_counts = Counter({"train": 350, "validation": 75, "test": 75, "benchmark_holdout": 5})
    family_ok = all(family_split_counts[(split, family)] == count for split, count in
        (("train", 70), ("validation", 15), ("test", 15), ("benchmark_holdout", 1)) for family in FAMILIES)
    hash_errors = [path for m in manifests for path, expected in m["outputFileHashes"].items()
                   if file_hash(OFFICIAL_ROOT / path) != expected]
    manifest_hashes = [file_hash(OFFICIAL_ROOT / "manifests" / m["split"] / (m["episodeId"] + ".json"))
                       for m in manifests]
    gates = [
        gate("B1", "Required episode counts", split_counts == required_counts and not failures, {"splits": dict(split_counts), "failures": failures}),
        gate("B2", "Scenario balance", family_ok, {"familySplit": {f"{k[0]}:{k[1]}": v for k, v in family_split_counts.items()}}),
        gate("B3", "No split leakage", leakage["passed"], leakage),
        gate("B4", "Canonical holdout isolation", not leakage["canonicalLeaks"] and not leakage["holdoutErrors"], leakage),
        gate("B5", "No duplicate episodes", len({m["episodeId"] for m in manifests}) == 505 and len({(m["physicalParameterHash"], m["scenarioVariantId"], m["seed"], m["forecastSeed"]) for m in manifests}) == 505 and len(set(manifest_hashes)) == 505, {"episodeIds": len({m["episodeId"] for m in manifests}), "manifestIdentities": len({(m["physicalParameterHash"], m["scenarioVariantId"], m["seed"], m["forecastSeed"]) for m in manifests}), "uniqueManifestHashes": len(set(manifest_hashes))}),
        gate("B6", "Physical QA", all(m["physicalQA"]["passed"] for m in manifests), {"failed": [m["episodeId"] for m in manifests if not m["physicalQA"]["passed"]]}),
        gate("B7", "Numeric QA", all(m["physicalQA"]["allFinite"] for m in manifests), {"episodes": len(manifests)}),
        gate("B8", "Timestamp QA", not schema_errors and all(m["rowCounts"]["raw_state"] == 288 for m in manifests), {"schemaErrors": schema_errors, "stepMinutes": 5}),
        gate("B9", "Label alignment", all(m["schemaQA"]["errors"] == [] for m in manifests), {"episodes": len(manifests)}),
        gate("B10", "Forecast separation", not any("truth" in c or "actual" in c or "required" in c or "indoor" in c for c in columns("weather_forecast")), {"columns": columns("weather_forecast")}),
        gate("B11", "Distribution report data", len(coverage_data) == 9, coverage_data),
        gate("B12", "Scenario coverage", all(len({m["scenarioVariantId"] for m in manifests if m["split"] in ML_SPLITS and m["scenarioFamily"] == family}) == 100 for family in FAMILIES) and all(v["min"] < .95 and v["max"] > 1.05 for v in coverage_data.values()), coverage_data),
        gate("B13", "Stratified deterministic replay", len(replays) == 30 and all(replays.values()), replays),
        gate("B14", "Dataset hashes", not hash_errors and len(manifest_hashes) == 505, {"hashErrors": hash_errors, "shardHashesVerified": sum(len(m["outputFileHashes"]) for m in manifests), "episodeManifestHashesVerified": len(manifest_hashes), "schemaHash": file_hash(ROOT / "dataset_schema.json")}),
    ]
    result = {"datasetVersion": DATASET_VERSION, "phase": "P3B", "episodeCount": len(manifests),
        "splitCounts": dict(split_counts), "familySplitCounts": {f"{k[0]}:{k[1]}": v for k, v in family_split_counts.items()},
        "coverage": coverage_data, "leakageAudit": leakage, "replaySample": replays,
        "gates": gates, "regression": regression,
        "passed": all(g["status"] == "PASS" for g in gates) and regression.get("passed", False),
        "freezeErrors": errors}
    write_json(ROOT / "p3_gate_results.json", result)
    write_json(ROOT / "p3_generation_manifest.json", {"datasetVersion": DATASET_VERSION,
        "generatorVersion": GENERATOR_VERSION, "storageRoot": str(OFFICIAL_ROOT.relative_to(ROOT)),
        "episodeCount": len(manifests), "splitCounts": dict(split_counts),
        "warmupPolicy": p3a["warmupStudy"], "schemaHash": file_hash(ROOT / "dataset_schema.json"),
        "controllerConfigHash": controller_hash, "baseFixtureVersion": "physical-fixture-v1.2",
        "generationTimestamp": GENERATION_TIME,
        "episodeManifestHashes": {str((Path("manifests") / m["split"] / (m["episodeId"] + ".json"))):
            file_hash(OFFICIAL_ROOT / "manifests" / m["split"] / (m["episodeId"] + ".json")) for m in manifests}})
    print(f"P3B: {'PASS' if result['passed'] else 'FAIL'}", flush=True)
    return not result["passed"]


if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] not in ("pilot", "official"):
        raise SystemExit("usage: run_p3_dataset.py pilot|official")
    raise SystemExit(run_pilot() if sys.argv[1] == "pilot" else run_official())
