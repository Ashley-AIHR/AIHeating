import gzip
import json
from dataclasses import asdict
from pathlib import Path

from ai_heating_core.benchmark.state import content_hash
from ai_heating_core.control.traditional import config_from_dict
from ai_heating_core.dataset import DATASET_VERSION
from ai_heating_core.dataset.factory import (FAMILIES, EpisodeDescriptor, generate_episode,
    official_descriptors, pilot_descriptors, sample_parameters, validate_parameter_coherence)
from ai_heating_core.dataset.schema import TABLE_FIELDS, columns, schema_document
from ai_heating_core.p1_2_scenarios import scenarios

ROOT = Path(__file__).resolve().parents[2]


def test_official_population_is_exact_and_balanced():
    descriptors = official_descriptors()
    assert len(descriptors) == 505
    assert sum(d.split == "train" for d in descriptors) == 350
    assert sum(d.split == "validation" for d in descriptors) == 75
    assert sum(d.split == "test" for d in descriptors) == 75
    assert sum(d.split == "benchmark_holdout" for d in descriptors) == 5


def test_pilot_has_three_variants_per_family():
    descriptors = pilot_descriptors()
    assert len(descriptors) == 15
    assert all(sum(d.scenario_family == family for d in descriptors) == 3 for family in FAMILIES)


def test_split_identities_are_disjoint():
    descriptors = [d for d in official_descriptors() if not d.canonical]
    assert len({d.seed for d in descriptors}) == 500
    assert len({d.forecast_seed for d in descriptors}) == 500


def test_parameter_sampling_is_deterministic_and_coherent():
    descriptor = EpisodeDescriptor.create("test", "normal_winter", 7)
    left, left_meta = sample_parameters(descriptor)
    right, right_meta = sample_parameters(descriptor)
    assert content_hash(asdict(left)) == content_hash(asdict(right))
    assert left_meta == right_meta
    assert validate_parameter_coherence(left, left_meta)


def test_canonical_descriptor_uses_unmodified_fixture():
    descriptor = EpisodeDescriptor.create("benchmark_holdout", "normal_winter", 0, "canonical", True)
    _, metadata = sample_parameters(descriptor)
    assert all(values == [1.0] for values in metadata["multipliers"].values())


def test_schema_declares_every_table_and_field_contract():
    schema = schema_document()
    assert set(schema["tables"]) == set(TABLE_FIELDS)
    assert all(schema["tables"][table]["columns"] == columns(table) for table in TABLE_FIELDS)
    assert all(field["nullable"] is False for field in schema["fields"])


def test_episode_shards_are_byte_deterministic(tmp_path):
    payload = json.loads((ROOT / "p2_controller_config_v1.2.json").read_text())
    config = config_from_dict(payload)
    descriptor = EpisodeDescriptor.create("test", "normal_winter", 1, "nominal")
    first = generate_episode(descriptor, config, scenarios(), tmp_path / "a", 72,
        controller_config_hash=content_hash(payload), resume=False,
        generation_timestamp="2026-09-09T00:00:00+00:00")
    second = generate_episode(descriptor, config, scenarios(), tmp_path / "b", 72,
        controller_config_hash=content_hash(payload), resume=False,
        generation_timestamp="2026-09-09T00:00:00+00:00")
    assert first["outputFileHashes"] == second["outputFileHashes"]
    for table, relative in first["outputFiles"].items():
        with gzip.open(tmp_path / "a" / relative, "rt") as stream:
            assert stream.readline().strip().split(",") == columns(table)
