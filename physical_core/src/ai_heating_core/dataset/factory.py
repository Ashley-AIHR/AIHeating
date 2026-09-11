"""Deterministic P3 episode generation using the accepted engine/controller."""
from dataclasses import asdict, dataclass, replace
from datetime import datetime, timezone
import csv
import gzip
import hashlib
import io
import json
from math import fsum, isfinite, sqrt
from pathlib import Path
import random

import numpy as np

from ..benchmark.freeze import file_hash
from ..benchmark.runner import run_baseline
from ..benchmark.state import content_hash
from ..contracts import Weather, ZONES
from ..parameters import Parameters
from ..physical_fixture_v1_2 import FIXTURE_VERSION, coherent_parameters, size_profile
from ..thermal import required_load
from . import DATASET_VERSION, FORECAST_MODEL_VERSION, GENERATOR_VERSION
from .schema import TABLE_FIELDS, columns

SCENARIO_VERSION = "p3-scenario-variant-v1"
ML_SPLITS = ("train", "validation", "test")
FAMILIES = ("normal_winter", "cold_wave", "rapid_warming", "sunny_winter", "hydraulic_imbalance")
OFFICIAL_RANGES = {"r": (.8, 1.2), "c": (.8, 1.2), "internal_gain": (.8, 1.2),
    "solar": (.8, 1.2), "kpipe": (.8, 1.2), "kvalve": (.8, 1.2),
    "pump_head": (.9, 1.1), "pump_curve": (.9, 1.1), "radiator_margin": (.9, 1.1)}


def stable_seed(*parts):
    return int(hashlib.sha256("|".join(map(str, parts)).encode()).hexdigest()[:15], 16)


@dataclass(frozen=True)
class EpisodeDescriptor:
    episode_id: str
    split: str
    scenario_family: str
    episode_index: int
    seed: int
    forecast_seed: int
    parameter_mode: str = "random"
    canonical: bool = False

    @classmethod
    def create(cls, split, family, index, parameter_mode="random", canonical=False):
        seed = stable_seed(DATASET_VERSION, split, family, index)
        forecast_seed = stable_seed(DATASET_VERSION, "forecast", split, family, index)
        tag = "canonical" if canonical else f"{index:03d}"
        return cls(f"{split}-{family}-{tag}", split, family, index, seed,
                   forecast_seed, parameter_mode, canonical)


def official_descriptors():
    counts = {"train": 70, "validation": 15, "test": 15}
    result = [EpisodeDescriptor.create(split, family, index)
              for split, count in counts.items() for family in FAMILIES for index in range(count)]
    result += [EpisodeDescriptor.create("benchmark_holdout", family, 0, "canonical", True)
               for family in FAMILIES]
    return result


def pilot_descriptors():
    return [EpisodeDescriptor.create("pilot", family, index, mode)
            for family in FAMILIES for index, mode in enumerate(("nominal", "low", "high"))]


def _multiplier(rng, name, mode):
    lo, hi = OFFICIAL_RANGES[name]
    return 1.0 if mode in ("nominal", "canonical") else lo if mode == "low" else hi if mode == "high" else rng.uniform(lo, hi)


def sample_parameters(descriptor, overrides=None):
    base = coherent_parameters()
    if descriptor.canonical:
        return base, {"mode": "canonical", "multipliers": {name: [1.0] for name in OFFICIAL_RANGES}}
    rng = random.Random(descriptor.seed)
    overrides = dict(overrides or {})
    records = {name: [] for name in OFFICIAL_RANGES}
    buildings = []
    for profile in base.buildings:
        values = {name: overrides.get(name, _multiplier(rng, name, descriptor.parameter_mode))
                  for name in ("r", "c", "internal_gain", "solar", "radiator_margin")}
        for name, value in values.items():
            records[name].append(value)
        independent = replace(profile,
            thermal_resistance_k_w=profile.thermal_resistance_k_w * values["r"],
            thermal_capacitance_j_k=profile.thermal_capacitance_j_k * values["c"],
            internal_gain_w=profile.internal_gain_w * values["internal_gain"],
            effective_solar_area_m2=profile.effective_solar_area_m2 * values["solar"])
        sizing = size_profile(independent, base.water)
        buildings.append(replace(independent, flow_share_weight=sizing.design_mass_flow_kg_s,
                                 radiator_ua_w_k=sizing.radiator_ua_w_k * values["radiator_margin"]))
    branches = []
    for branch in base.branches:
        pipe = overrides.get("kpipe", _multiplier(rng, "kpipe", descriptor.parameter_mode))
        valve = overrides.get("kvalve", _multiplier(rng, "kvalve", descriptor.parameter_mode))
        records["kpipe"].append(pipe); records["kvalve"].append(valve)
        branches.append(replace(branch, pipe_k_pa_s2_m6=branch.pipe_k_pa_s2_m6 * pipe,
                                valve_ref_k_pa_s2_m6=branch.valve_ref_k_pa_s2_m6 * valve))
    head = overrides.get("pump_head", _multiplier(rng, "pump_head", descriptor.parameter_mode))
    curve = overrides.get("pump_curve", _multiplier(rng, "pump_curve", descriptor.parameter_mode))
    records["pump_head"].append(head); records["pump_curve"].append(curve)
    pump = replace(base.pump, shutoff_head_m=base.pump.shutoff_head_m * head,
                   curve_a_s2_m5=base.pump.curve_a_s2_m5 * curve)
    parameters = replace(base, buildings=tuple(buildings), branches=tuple(branches), pump=pump)
    return parameters, {"mode": descriptor.parameter_mode, "multipliers": records}


class DatasetScenario:
    def __init__(self, scenario_id, family, scenario_version, knots, warmup_knots, parameters, far_pipe_multiplier, variant_parameters):
        self.scenario_id, self.scenario_family = scenario_id, family
        self.scenario_version = scenario_version
        self.knots, self.warmup_knots = tuple(knots), tuple(warmup_knots)
        self.base_parameters, self.far_pipe_multiplier = parameters, far_pipe_multiplier
        self.variant_parameters = variant_parameters

    def weather(self, relative_s, *, warmup=False):
        hours = relative_s / 3600
        knots = self.warmup_knots if warmup else self.knots
        if warmup:
            hours %= 24
        elif not 0 <= hours <= 24:
            raise ValueError("evaluation weather covers exactly 24 hours")
        return Weather(*(float(np.interp(hours, [k[0] for k in knots], [k[i] for k in knots])) for i in (1, 2, 3)))

    def parameters(self, *, evaluation=True):
        if evaluation and self.far_pipe_multiplier != 1:
            branches = tuple(replace(branch, pipe_k_pa_s2_m6=branch.pipe_k_pa_s2_m6 * self.far_pipe_multiplier)
                             if branch.zone == "far" else branch for branch in self.base_parameters.branches)
            return replace(self.base_parameters, branches=branches)
        return self.base_parameters


def _transform_knots(knots, temperature_offset, amplitude, solar_multiplier, wind_multiplier):
    mean_temperature = fsum(k[1] for k in knots) / len(knots)
    return tuple((h, mean_temperature + (temperature - mean_temperature) * amplitude + temperature_offset,
                  max(0.0, solar * solar_multiplier), max(0.0, wind * wind_multiplier))
                 for h, temperature, solar, wind in knots)


def make_scenario(descriptor, parameters, canonical_scenarios):
    canonical = canonical_scenarios[FAMILIES.index(descriptor.scenario_family)]
    if descriptor.canonical:
        values = {"temperatureOffsetC": 0.0, "temperatureAmplitudeMultiplier": 1.0,
                  "solarMultiplier": 1.0, "windMultiplier": 1.0,
                  "farPipeResistanceMultiplier": canonical.far_pipe_multiplier}
        return DatasetScenario(canonical.scenario_id, descriptor.scenario_family, "1.2", canonical.knots,
                               canonical.warmup_knots, parameters, canonical.far_pipe_multiplier, values)
    rng = random.Random(stable_seed(descriptor.seed, "scenario"))
    if descriptor.parameter_mode == "nominal":
        offset, amplitude, solar, wind = 0.0, 1.0, 1.0, 1.0
    elif descriptor.parameter_mode == "low":
        offset, amplitude, solar, wind = -1.5, .85, .7, .9
    elif descriptor.parameter_mode == "high":
        offset, amplitude, solar, wind = 1.5, 1.15, 1.3, 1.1
    else:
        offset, amplitude, solar, wind = rng.uniform(-2, 2), rng.uniform(.85, 1.15), rng.uniform(.6, 1.4), rng.uniform(.85, 1.15)
    far = (1.5 if descriptor.parameter_mode == "low" else 3.0 if descriptor.parameter_mode == "high"
           else 2.0 if descriptor.parameter_mode == "nominal" else rng.uniform(1.5, 3.0)) if descriptor.scenario_family == "hydraulic_imbalance" else 1.0
    values = {"temperatureOffsetC": offset, "temperatureAmplitudeMultiplier": amplitude,
              "solarMultiplier": solar, "windMultiplier": wind, "farPipeResistanceMultiplier": far}
    variant_id = f"{descriptor.scenario_family}-variant-{descriptor.seed:015x}"
    return DatasetScenario(variant_id, descriptor.scenario_family, SCENARIO_VERSION,
        _transform_knots(canonical.knots, offset, amplitude, solar, wind),
        _transform_knots(canonical.warmup_knots, offset, amplitude, solar, wind),
        parameters, far, values)


def identity(descriptor, scenario, parameter_set_id, parameter_hash, controller_version, simulation_time):
    return {"dataset_version": DATASET_VERSION, "episode_id": descriptor.episode_id,
        "split": descriptor.split, "scenario_family": descriptor.scenario_family,
        "scenario_variant_id": scenario.scenario_id, "physical_fixture_base_version": FIXTURE_VERSION,
        "parameter_set_id": parameter_set_id, "parameter_set_hash": parameter_hash,
        "controller_version": controller_version, "scenario_version": scenario.scenario_version,
        "generator_version": GENERATOR_VERSION, "seed": descriptor.seed,
        "simulation_time": simulation_time}


def _rows(descriptor, scenario, parameters, result, config, parameter_set_id, parameter_hash):
    raw, buildings = [], []
    frame_by_minute = {int(frame.elapsed_s / 60): frame for frame in result.frames}
    initial_heat, initial_pump = result.initial_state["heatEnergyJ"], result.initial_state["pumpEnergyJ"]
    profiles = {profile.building_id: profile for profile in parameters.buildings}
    for frame in result.frames:
        common = identity(descriptor, scenario, parameter_set_id, parameter_hash, config.version, frame.simulation_time)
        flows = [q * 3600 for q in frame.hydraulics.flows_m3_s]
        raw.append({**common, "elapsed_minutes": frame.elapsed_s / 60,
            "local_hour": (8 + frame.elapsed_s / 3600) % 24, "day_fraction": frame.elapsed_s / 86400,
            "outdoor_temperature_c": frame.weather.outdoor_c, "solar_radiation_w_m2": frame.weather.solar_w_m2,
            "wind_m_s": frame.weather.wind_m_s, "supply_setpoint_c": frame.controls.supply_c,
            "pump_frequency_hz": frame.controls.frequency_hz,
            **{f"{z}_valve_pct": 100 * v for z, v in zip(ZONES, frame.controls.valves)},
            "total_flow_m3_h": frame.hydraulics.total_flow_m3_s * 3600,
            **{f"{z}_flow_m3_h": q for z, q in zip(ZONES, flows)},
            "pump_pressure_kpa": frame.hydraulics.pump_pressure_pa / 1000,
            **{f"transport_delay_{z}_min": frame.delay_s[z] / 60 for z in ZONES},
            **{f"delivered_supply_{z}_c": frame.delivered_supply_c[z] for z in ZONES},
            **{f"return_{z}_c": frame.zone_return_c[z] for z in ZONES},
            "station_return_c": frame.station_return_c, "required_heat_load_mw": frame.required_heat_w / 1e6,
            "actual_heat_supply_mw": frame.actual_heat_w / 1e6,
            "pump_power_kw": frame.hydraulics.pump_power_w / 1000,
            "cumulative_heat_mwh": (frame.heat_energy_j - initial_heat) / 3.6e9,
            "cumulative_pump_kwh": (frame.pump_energy_j - initial_pump) / 3.6e6,
            "hydraulic_converged": frame.hydraulics.solver.status == "converged",
            "hydraulic_residual": frame.hydraulics.solver.normalized_residual,
            "mass_residual": frame.mass_residual, "heat_balance_residual": frame.heat_balance_residual})
        for building_id, state in frame.buildings.items():
            profile = profiles[building_id]
            buildings.append({**common, "building_id": building_id, "zone": profile.zone,
                "area_m2": profile.heated_area_m2, "thermal_resistance_k_w": profile.thermal_resistance_k_w,
                "envelope_conductance_w_k": 1 / profile.thermal_resistance_k_w,
                "thermal_capacitance_j_k": profile.thermal_capacitance_j_k,
                "radiator_ua_w_k": profile.radiator_ua_w_k, "design_flow_kg_s": profile.flow_share_weight,
                "indoor_temperature_c": state.indoor_temperature_c,
                "delivered_supply_temperature_c": frame.delivered_supply_c[profile.zone],
                "allocated_flow_m3_h": state.building_water_flow_kg_s / parameters.water.rho_water * 3600,
                "radiator_heat_kw": state.heating_power_w / 1000,
                "required_heat_kw": required_load(profile, frame.weather, target_c=parameters.target_indoor_c) / 1000,
                "solar_gain_kw": state.solar_gain_w / 1000, "internal_gain_kw": state.internal_gain_w / 1000,
                "envelope_loss_kw": state.envelope_loss_w / 1000,
                "underheat": state.indoor_temperature_c < 18,
                "comfort": 20 <= state.indoor_temperature_c <= 22,
                "overheat": state.indoor_temperature_c > 23})
    forecast, load_targets, temperature_targets, forecast_errors = [], [], [], {}
    forecast_horizons = tuple(range(30, 361, 30))
    load_horizons, temperature_horizons = (60, 120, 180, 360), (30, 60, 120, 180, 360)
    for anchor in range(30, 1081, 30):
        anchor_frame = frame_by_minute[anchor]
        common = identity(descriptor, scenario, parameter_set_id, parameter_hash, config.version, anchor_frame.simulation_time)
        for horizon in forecast_horizons:
            target_frame = frame_by_minute[anchor + horizon]
            truth = target_frame.weather
            rng = random.Random(stable_seed(descriptor.forecast_seed, anchor, horizon))
            scale = sqrt(horizon / 360)
            errors = (rng.gauss(0, .25 + scale), rng.gauss(0, 15 + 80 * scale), rng.gauss(0, .1 + .5 * scale))
            forecast_errors.setdefault(horizon, []).append(errors)
            forecast.append({**common, "forecast_as_of": anchor_frame.simulation_time,
                "forecast_target_time": target_frame.simulation_time, "horizon_minutes": horizon,
                "forecast_outdoor_temperature_c": truth.outdoor_c + errors[0],
                "forecast_solar_radiation_w_m2": max(0.0, truth.solar_w_m2 + errors[1]),
                "forecast_wind_m_s": max(0.0, truth.wind_m_s + errors[2]),
                "forecast_model_version": FORECAST_MODEL_VERSION, "forecast_seed": descriptor.forecast_seed})
        for horizon in load_horizons:
            target = frame_by_minute[anchor + horizon]
            load_targets.append({**common, "as_of_time": anchor_frame.simulation_time,
                "target_time": target.simulation_time, "horizon_minutes": horizon,
                "required_heat_load_mw": target.required_heat_w / 1e6})
        for horizon in temperature_horizons:
            target = frame_by_minute[anchor + horizon]
            for building_id, state in target.buildings.items():
                temperature_targets.append({**common, "building_id": building_id,
                    "as_of_time": anchor_frame.simulation_time, "target_time": target.simulation_time,
                    "horizon_minutes": horizon, "indoor_temperature_c": state.indoor_temperature_c})
    return {"raw_state": raw, "building_state": buildings, "weather_forecast": forecast,
            "load_target": load_targets, "building_temperature_target": temperature_targets}, forecast_errors


def _write_gzip_csv(path, table, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    with temporary.open("wb") as raw:
        with gzip.GzipFile(filename="", mode="wb", fileobj=raw, mtime=0) as compressed:
            with io.TextIOWrapper(compressed, encoding="utf-8", newline="") as text:
                writer = csv.DictWriter(text, fieldnames=columns(table), lineterminator="\n")
                writer.writeheader(); writer.writerows(rows)
    temporary.replace(path)


def _stats(rows, key):
    values = [float(row[key]) for row in rows]
    return {"count": len(values), "min": min(values), "mean": fsum(values) / len(values), "max": max(values)}


def validate_tables(tables):
    expected_counts = {"raw_state": 288, "building_state": 3456,
        "weather_forecast": 432, "load_target": 144,
        "building_temperature_target": 2160}
    errors = []
    for table, expected in expected_counts.items():
        rows = tables.get(table, [])
        if len(rows) != expected:
            errors.append(f"{table}: expected {expected} rows, got {len(rows)}")
        for index, row in enumerate(rows):
            if list(row) != columns(table):
                errors.append(f"{table}[{index}]: columns differ from schema")
                break
            if any(value is None or value == "" for value in row.values()):
                errors.append(f"{table}[{index}]: null/empty value")
                break
    raw = {row["simulation_time"]: row for row in tables["raw_state"]}
    building = {(row["simulation_time"], row["building_id"]): row
                for row in tables["building_state"]}
    if sorted(row["elapsed_minutes"] for row in tables["raw_state"]) != list(range(5, 1441, 5)):
        errors.append("raw_state: 5-minute time grid is incomplete")
    for row in tables["load_target"]:
        target = raw.get(row["target_time"])
        if target is None or abs(row["required_heat_load_mw"] - target["required_heat_load_mw"]) > 1e-12:
            errors.append("load_target: target alignment/value mismatch")
            break
    for row in tables["building_temperature_target"]:
        target = building.get((row["target_time"], row["building_id"]))
        if target is None or abs(row["indoor_temperature_c"] - target["indoor_temperature_c"]) > 1e-12:
            errors.append("building_temperature_target: target alignment/value mismatch")
            break
    return errors


def validate_parameter_coherence(parameters, metadata, official=True):
    for name, values in metadata["multipliers"].items():
        if metadata["mode"] == "canonical":
            if values != [1.0]: return False
        elif official:
            lo, hi = OFFICIAL_RANGES[name]
            if any(not lo <= value <= hi for value in values): return False
    for profile in parameters.buildings:
        sizing = size_profile(profile, parameters.water)
        if abs(profile.flow_share_weight - sizing.design_mass_flow_kg_s) > 1e-14:
            return False
        ratio = profile.radiator_ua_w_k / sizing.radiator_ua_w_k
        if official and not OFFICIAL_RANGES["radiator_margin"][0] - 1e-12 <= ratio <= OFFICIAL_RANGES["radiator_margin"][1] + 1e-12:
            return False
    return True


def generate_episode(descriptor, config, canonical_scenarios, root, warmup_hours, *,
        controller_config_hash, resume=True, generation_timestamp=None):
    root = Path(root)
    manifest_path = root / "manifests" / descriptor.split / f"{descriptor.episode_id}.json"
    if resume and manifest_path.exists():
        manifest = json.loads(manifest_path.read_text())
        if manifest["descriptor"] != asdict(descriptor) or manifest["generatorVersion"] != GENERATOR_VERSION:
            raise ValueError(f"Existing episode manifest conflicts: {descriptor.episode_id}")
        if manifest["controllerConfigHash"] != controller_config_hash:
            raise ValueError(f"Existing episode controller hash conflicts: {descriptor.episode_id}")
        if manifest["warmupPolicy"]["hours"] != warmup_hours:
            raise ValueError(f"Existing episode warm-up conflicts: {descriptor.episode_id}")
        errors = [path for path, expected in manifest["outputFileHashes"].items()
                  if not (root / path).is_file() or file_hash(root / path) != expected]
        if errors: raise ValueError(f"Existing episode shards fail hashes: {errors}")
        return manifest
    parameters, parameter_metadata = sample_parameters(descriptor)
    scenario = make_scenario(descriptor, parameters, canonical_scenarios)
    parameter_hash = content_hash(asdict(parameters))
    parameter_set_id = FIXTURE_VERSION if descriptor.canonical else f"p3-parameters-{descriptor.seed:015x}"
    run_config = replace(config, warmup_hours=warmup_hours)
    result = run_baseline(scenario, run_config)
    tables, forecast_errors = _rows(descriptor, scenario, parameters, result, run_config, parameter_set_id, parameter_hash)
    schema_errors = validate_tables(tables)
    if schema_errors:
        raise ValueError(f"Episode schema QA failed: {descriptor.episode_id}: {schema_errors}")
    relative_files, hashes = {}, {}
    for table, rows in tables.items():
        relative = Path(descriptor.split) / descriptor.scenario_family / f"{descriptor.episode_id}.{table}.csv.gz"
        _write_gzip_csv(root / relative, table, rows)
        relative_files[table], hashes[str(relative)] = str(relative), file_hash(root / relative)
    frames = result.frames
    all_finite = all(isfinite(float(value)) for rows in tables.values() for row in rows for value in row.values()
                     if isinstance(value, (int, float)) and not isinstance(value, bool))
    for frame in frames:
        frame.controls.validate()
    physical_qa = {"allFinite": all_finite,
        "allHydraulicConverged": all(frame.hydraulics.solver.status == "converged" for frame in frames),
        "maxHydraulicResidual": max(frame.hydraulics.solver.normalized_residual for frame in frames),
        "maxMassResidual": max(frame.mass_residual for frame in frames),
        "maxHeatBalanceResidual": max(frame.heat_balance_residual for frame in frames),
        "maxPipeHeatBalanceResidual": max(frame.pipe_heat_balance_residual for frame in frames),
        "maxBuildingHeatBalanceResidual": max(frame.building_heat_balance_residual for frame in frames),
        "maxPipeVolumeResidual": max(frame.pipe_volume_residual for frame in frames),
        "equipmentValid": True,
        "passed": False}
    physical_qa["passed"] = (physical_qa["allFinite"] and physical_qa["allHydraulicConverged"]
        and physical_qa["maxHydraulicResidual"] < 1e-5 and physical_qa["maxMassResidual"] < 1e-6
        and max(physical_qa[k] for k in ("maxHeatBalanceResidual", "maxPipeHeatBalanceResidual", "maxBuildingHeatBalanceResidual")) < 1e-5
        and physical_qa["maxPipeVolumeResidual"] < 1e-10 and physical_qa["equipmentValid"])
    manifest = {"datasetVersion": DATASET_VERSION, "episodeId": descriptor.episode_id,
        "descriptor": asdict(descriptor), "split": descriptor.split, "scenarioFamily": descriptor.scenario_family,
        "scenarioVariantId": scenario.scenario_id, "scenarioParameters": scenario.variant_parameters,
        "physicalParameterSetId": parameter_set_id, "physicalParameterHash": parameter_hash,
        "parameterSampling": parameter_metadata, "controllerVersion": config.version,
        "controllerConfigHash": controller_config_hash, "baseFixtureVersion": FIXTURE_VERSION,
        "warmupPolicy": {"hours": warmup_hours, "method": "daily-repeat-controller-consistent-v1"},
        "seed": descriptor.seed, "forecastSeed": descriptor.forecast_seed,
        "generationTimestamp": generation_timestamp or datetime.now(timezone.utc).isoformat(),
        "generatorVersion": GENERATOR_VERSION, "scenarioVersion": scenario.scenario_version,
        "rowCounts": {table: len(rows) for table, rows in tables.items()},
        "outputFiles": relative_files, "outputFileHashes": hashes, "physicalQA": physical_qa,
        "schemaQA": {"passed": True, "errors": [], "schemaTables": sorted(TABLE_FIELDS)},
        "statistics": {"outdoor_temperature_c": _stats(tables["raw_state"], "outdoor_temperature_c"),
            "solar_radiation_w_m2": _stats(tables["raw_state"], "solar_radiation_w_m2"),
            "required_heat_load_mw": _stats(tables["raw_state"], "required_heat_load_mw"),
            "actual_heat_supply_mw": _stats(tables["raw_state"], "actual_heat_supply_mw"),
            "supply_setpoint_c": _stats(tables["raw_state"], "supply_setpoint_c"),
            "pump_frequency_hz": _stats(tables["raw_state"], "pump_frequency_hz"),
            **{f"{z}_flow_m3_h": _stats(tables["raw_state"], f"{z}_flow_m3_h") for z in ZONES},
            "indoor_temperature_c": _stats(tables["building_state"], "indoor_temperature_c"),
            "underheatCount": sum(row["underheat"] for row in tables["building_state"]),
            "comfortCount": sum(row["comfort"] for row in tables["building_state"]),
            "overheatCount": sum(row["overheat"] for row in tables["building_state"]),
            "forecastErrors": {str(h): {name: _stats([{"v": e[i]} for e in errors], "v")
                for i, name in enumerate(("outdoorC", "solarWm2", "windMs"))}
                for h, errors in forecast_errors.items()}}}
    if not validate_parameter_coherence(parameters, parameter_metadata) or not physical_qa["passed"]:
        raise ArithmeticError(f"Episode physical/parameter QA failed: {descriptor.episode_id}")
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True, allow_nan=False) + "\n")
    return manifest
