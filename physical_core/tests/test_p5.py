import gzip
import hashlib
import json
from pathlib import Path

import pytest

from ai_heating_core.p5.dataset import read_csv
from ai_heating_core.p5.thermal import (
    ForecastWeatherStep,
    ThermalParameters,
    ThermalPredictionProvider,
    WaterInputStep,
    calibrate,
)
from ai_heating_core.physical_fixture_v1_2 import coherent_parameters


ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "artifacts/p5_identification_dataset_v1_0"


def payload(name):
    return json.loads((ROOT / name).read_text())


def test_observability_schema_excludes_truth_from_selected_model():
    schema = payload("p5_observability_schema.json")
    assert schema["selectedModelAllowedClasses"] == ["A", "B", "C", "D", "E"]
    forbidden = {item["name"] for item in schema["fields"] if item["class"] == "F"}
    manifest = payload("p5_identification_manifest.json")
    with gzip.open(DATA / manifest["sites"][0]["files"]["siteObservable"], "rt") as stream:
        header = set(stream.readline().strip().split(","))
    assert forbidden.isdisjoint(header)


def test_calibration_fails_closed_on_hidden_truth():
    nominal = coherent_parameters().buildings[0]
    with pytest.raises(ValueError, match="hidden simulation truth"):
        calibrate([{"true_thermal_resistance_k_w": 1.0}], nominal, ("h_scale",))


def test_identification_sites_and_windows_are_disjoint_and_persistent():
    manifest = payload("p5_identification_manifest.json")
    assert manifest["siteCounts"] == {
        "development": 20, "validation": 5, "test": 5, "base_fixture": 1}
    split_ids = [{site["site_id"] for site in manifest["sites"] if site["split"] == split}
                 for split in ("development", "validation", "test")]
    assert not (split_ids[0] & split_ids[1] or split_ids[0] & split_ids[2]
                or split_ids[1] & split_ids[2])
    assert all(site["calibrationDays"] == [1, 2, 3, 4]
               and site["evaluationDays"] == [5, 6] for site in manifest["sites"])
    assert len({site["physicalParameterHash"] for site in manifest["sites"]}) == 31


def test_identification_manifest_hashes_reproduce_every_shard():
    manifest = payload("p5_identification_manifest.json")
    assert json.loads((DATA / "p5_identification_manifest.json").read_text()) == manifest
    assert len(manifest["fileHashes"]) == 93
    for name, expected in manifest["fileHashes"].items():
        assert hashlib.sha256((DATA / name).read_bytes()).hexdigest() == expected


def test_selected_parameterisation_is_reduced_and_identifiable():
    result = payload("p5_identifiability_results.json")
    assert result["p3Decision"] == "C"
    assert result["aggregate"]["maximumAbsoluteCorrelation"] > .98
    assert result["selectedParameterisation"] == ["h_scale", "c_scale"]
    assert result["selectedAggregate"]["minimumRank"] == 2
    assert result["selectedAggregate"]["maximumConditionNumber"] <= 10_000


def test_calibration_repeats_deterministically_on_observable_history():
    manifest = payload("p5_identification_manifest.json")
    site = next(site for site in manifest["sites"] if site["site_id"] == "P5-S01")
    rows = [row for row in read_csv(DATA / site["files"]["siteObservable"])
            if row["building_id"] == "B01" and int(row["day_index"]) == 0]
    nominal = coherent_parameters().buildings[0]
    first = calibrate(rows, nominal, ("h_scale", "c_scale"))
    second = calibrate(rows, nominal, ("h_scale", "c_scale"))
    assert first.parameters == second.parameters
    assert first.cost == second.cost


def test_every_calibrated_record_is_auditable():
    artifact = payload("p5_calibrated_parameters.json")
    records = [record for buildings in artifact["sites"].values()
               for record in buildings.values()]
    assert len(records) == 31 * 12
    assert len({record["calibrationId"] for record in records}) == len(records)
    assert all(record["validationMetrics"]["window"] == "held-out days 5-6"
               and set(record["validationMetrics"]["byHorizon"]) ==
               {"30", "60", "120", "180", "360"} for record in records)
    assert artifact["truthUsedDuringFit"] is False


def test_provider_contract_returns_versioned_intervals_and_risk_state():
    nominal = coherent_parameters().buildings[0]
    provider = ThermalPredictionProvider(
        {nominal.building_id: nominal}, {nominal.building_id: ThermalParameters()},
        {30: .1}, "calibration-test")
    weather = [ForecastWeatherStep(f"t{i}", -5, 100) for i in range(6)]
    water = {nominal.building_id: [WaterInputStep(f"t{i}", 50, .08)
                                   for i in range(6)]}
    result = provider.predict({nominal.building_id: 21}, weather, water, 30)
    building = result["buildings"][nominal.building_id]
    assert building["lowerC"] < building["pointC"] < building["upperC"]
    assert len(building["trajectory"]) == 6 and building["thermalState"]
    assert result["modelVersion"] == "p5-thermal-model-v1"
    assert result["calibrationId"] == "calibration-test"
    assert result["sourceMetadata"]["waterTrajectory"].startswith("accepted P1A")


def test_test_gates_and_physical_directionality_pass():
    gates = payload("p5_gate_results.json")
    assert gates["passed"] == 32 and gates["failed"] == gates["skipped"] == 0
    assert all(gate["status"] == "PASS" for gate in gates["gates"])
    causality = payload("p5_prediction_results.json")["physicalCausality"]
    assert causality["passed"] and all(causality["tests"].values())


def test_canonical_holdout_is_evaluation_only_after_freeze():
    result = payload("p5_canonical_holdout_results.json")
    assert result["calibrationFrozenBeforeHoldout"] is True
    assert result["holdoutUsedForCalibration"] is False
    assert len(result["scenarios"]) == 5
