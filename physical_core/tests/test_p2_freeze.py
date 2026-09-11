import json

import pytest

from ai_heating_core.benchmark.freeze import file_hash, verify_file_hashes, write_immutable_json
from ai_heating_core.benchmark.state import content_hash
from ai_heating_core.control.traditional import ControllerConfig, config_from_dict, config_to_dict
from ai_heating_core.p2_scenarios import scenarios


def test_scenario_manifest_identity_survives_json_array_conversion():
    value=[s.manifest(ControllerConfig(warmup_hours=96)) for s in scenarios()]
    restored=json.loads(json.dumps(value))
    assert content_hash(restored)==content_hash(value)


def test_immutable_config_roundtrip_and_hash(tmp_path):
    payload=config_to_dict(ControllerConfig(warmup_hours=96))
    path=tmp_path/"config.json"
    write_immutable_json(path,payload)
    decoded=json.loads(path.read_text())
    assert config_from_dict(decoded)==ControllerConfig(warmup_hours=96)
    assert content_hash(decoded)==content_hash(payload)
    write_immutable_json(path,payload)
    with pytest.raises(ValueError,match="Refusing"):
        write_immutable_json(path,{**payload,"warmupHours":72})


def test_tampered_file_and_outside_path_detected(tmp_path):
    target=tmp_path/"artifact.json"
    target.write_text("original")
    hashes={"artifact.json":file_hash(target)}
    assert verify_file_hashes(tmp_path,hashes)==[]
    target.write_text("tampered")
    assert verify_file_hashes(tmp_path,hashes)==["artifact.json"]
    assert verify_file_hashes(tmp_path,{"../outside":"fake"})==["../outside"]
