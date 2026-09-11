import json
from pathlib import Path

import pytest

from ai_heating_core.contracts import Controls, Weather
from ai_heating_core.p4.prediction import (LoadPrediction, PersistenceLoadPredictor,
    PhysicsLoadPredictorV0, PredictionInput, assert_causal_feature_names)
from ai_heating_core.p4.preview import clone_engine, policy_controls, policy_space, serialize_engine
from ai_heating_core.control.traditional import config_from_dict
from ai_heating_core.simulation import SimulationEngine

ROOT = Path(__file__).resolve().parents[2]


def payload(name):
    return json.loads((ROOT / name).read_text())


def test_feature_schema_has_only_prediction_time_classes():
    schema = payload('p4_feature_schema.json')
    assert schema['label']['usedByModel'] is False
    assert all(item['availabilityClass'] in schema['allowedModelAvailabilityClasses'] for item in schema['featureFields'])


def test_feature_name_guard_rejects_future_truth_and_split_identity():
    assert_causal_feature_names(['current_outdoor_c', 'forecast_target_outdoor_c'])
    with pytest.raises(ValueError):
        assert_causal_feature_names(['future_truth_required_load'])
    with pytest.raises(ValueError):
        assert_causal_feature_names(['split'])


def test_persistence_predicts_current_required_load_only():
    result = PersistenceLoadPredictor().predict_required_heat(PredictionInput(120, {'current_required_load_mw': .42}))
    assert result == LoadPrediction(.42, None, None, 120, 'persistence-load-v1', 'point-only')


def test_physics_provider_consumes_physics_required_load_feature():
    result = PhysicsLoadPredictorV0().predict_required_heat(PredictionInput(180, {'physics_forecast_load_mw': .37}))
    assert result.point_mw == .37 and result.horizon_minutes == 180


def test_policy_space_is_the_frozen_75_candidates():
    policy = payload('p4_candidate_policy_space_v0.json')
    candidates = policy_space(policy)
    assert len(candidates) == policy['candidateCount'] == 75
    assert len(set(candidates)) == 75


def test_engine_clone_round_trip_is_identical_and_independent():
    engine = SimulationEngine()
    snapshot = serialize_engine(engine)
    cloned = clone_engine(snapshot, engine.parameters)
    assert serialize_engine(cloned) == snapshot
    cloned.step(Weather(-5, 0))
    assert serialize_engine(engine) == snapshot


def test_policy_controls_obey_bounds_and_rate_limits():
    config = config_from_dict(payload('p2_controller_config_v1.2.json'))
    old = Controls(50, 44, (.35, .55, .85))
    changed = policy_controls(old, Weather(-2, 300), config, (-2, -2, (10, 0, -10)))
    changed.validate(old)
    assert 40 <= changed.supply_c <= 60 and 30 <= changed.frequency_hz <= 50


def test_model_selection_is_validation_only_and_skill_passes():
    report = payload('p4_model_comparison.json')
    assert report['selection']['selectionSplit'] == 'validation_select'
    assert report['testSkillVsPersistence'] >= .10


def test_conformal_interval_has_expected_test_coverage():
    uncertainty = payload('p4_model_comparison.json')['uncertainty']
    assert uncertainty['calibrationSplit'] == 'validation_calibration'
    assert uncertainty['nominalCoverage'] == .95
    assert .90 <= uncertainty['testCoverage'] <= 1


def test_preview_canonical_safety_and_directional_gates():
    report = payload('p4_preview_benchmarks.json')
    assert report['rapidWarmingDirectionalGate'] is True
    assert report['coldWaveSafetyGate'] is True
    assert all(item['sameInitialState'] and item['preview']['allControlsLegal'] for item in report['canonicalBenchmarks'])


def test_model_artifact_hashes_match_registry():
    import hashlib
    registry = payload('p4_model_registry.json')
    for name, expected in registry['artifactHashes'].items():
        assert hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == expected
