"""Deterministic persistent-site identification histories kept separate from P3."""
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
import csv
import gzip
import hashlib
import io
import json
from math import cos, isfinite, pi, sin
from pathlib import Path
import random

from ..benchmark.state import content_hash
from ..contracts import Controls, Weather, ZONES
from ..dataset.factory import EpisodeDescriptor, sample_parameters
from ..physical_fixture_v1_2 import coherent_parameters
from ..simulation import SimulationEngine

DATASET_VERSION = "p5-identification-dataset-v1.0"
GENERATOR_VERSION = "p5-identification-generator-v1"
SITE_SPLITS = {"development": 20, "validation": 5, "test": 5}
DAY_FAMILIES = ("identification_supply", "identification_flow",
                "identification_solar", "identification_inertia",
                "evaluation_mixed_a", "evaluation_mixed_b")
OBSERVABLE_FIELDS = ("dataset_version", "site_id", "split", "day_index",
    "history_role", "scenario_family", "timestamp", "elapsed_minutes",
    "building_id", "zone", "area_m2", "insulation_class", "orientation_factor",
    "nominal_solar_aperture_m2", "nominal_internal_gain_w", "nominal_h_w_k",
    "nominal_c_j_k", "nominal_radiator_ua_w_k", "design_flow_share",
    "indoor_start_c", "indoor_end_c", "outdoor_temperature_c",
    "solar_radiation_w_m2", "wind_m_s", "station_supply_setpoint_c",
    "pump_frequency_hz", "zone_valve_fraction", "total_flow_m3_s",
    "zone_flow_m3_s", "delivered_zone_supply_c", "transport_delay_s",
    "derived_building_flow_kg_s")
FORECAST_FIELDS = ("dataset_version", "site_id", "split", "forecast_as_of",
    "anchor_elapsed_minutes", "target_timestamp", "horizon_minutes",
    "issued_forecast_outdoor_c", "issued_forecast_solar_w_m2",
    "issued_forecast_wind_m_s", "forecast_model_version")


def stable_seed(*parts):
    return int(hashlib.sha256("|".join(map(str, parts)).encode()).hexdigest()[:15], 16)


@dataclass(frozen=True)
class SiteDescriptor:
    site_id: str
    split: str
    site_index: int
    seed: int
    base_fixture: bool = False


def descriptors():
    result, index = [], 0
    for split, count in SITE_SPLITS.items():
        for _ in range(count):
            result.append(SiteDescriptor(f"P5-S{index + 1:02d}", split, index,
                                         stable_seed(DATASET_VERSION, split, index)))
            index += 1
    result.append(SiteDescriptor("P5-BASE-FIXTURE", "base_fixture", index,
                                 stable_seed(DATASET_VERSION, "base"), True))
    return result


def site_parameters(descriptor):
    if descriptor.base_fixture:
        return coherent_parameters(), {"mode": "physical-fixture-v1.2", "multipliers": {}}
    episode = EpisodeDescriptor(descriptor.site_id, descriptor.split,
        "p5_identification", descriptor.site_index, descriptor.seed,
        stable_seed(descriptor.seed, "forecast"))
    return sample_parameters(episode, {"internal_gain": 1.0})


def weather_at(elapsed_s):
    day = int(elapsed_s // 86400)
    local_hour = (8 + elapsed_s / 3600) % 24
    means = (-7.0, -4.5, -1.0, -8.0, -3.0, 0.5)
    amplitudes = (4.0, 5.0, 6.5, 7.0, 5.5, 6.0)
    peaks = (180.0, 260.0, 620.0, 120.0, 430.0, 520.0)
    outdoor = means[day] + amplitudes[day] * sin(2 * pi * (local_hour - 9) / 24)
    daylight = max(0.0, sin(pi * (local_hour - 7) / 10))
    solar = peaks[day] * daylight ** 1.5
    wind = 2.2 + .7 * cos(2 * pi * local_hour / 24 + day * .4)
    return Weather(outdoor, solar, max(.2, wind))


def _triangle(index, period=8):
    return (0, 1, 2, 1, 0, -1, -2, -1)[index % period]


def desired_controls(day, boundary, weather, amplitude, previous=None):
    base_supply = max(42.0, min(56.0, 47.0 - .65 * weather.outdoor_c))
    base_pump = max(36.0, min(47.0, 42.0 - .32 * weather.outdoor_c))
    supply_delta = amplitude * (_triangle(boundary) if day == 0 else
        0 if day == 1 else .5 * _triangle(boundary, 8) if day == 2 else
        (-2 if (boundary // 8) % 2 == 0 else 2) if day == 3 else
        _triangle(boundary + 2))
    pump_delta = amplitude * (_triangle(boundary + 3) if day in (1, 4, 5) else 0)
    valve_pattern = _triangle(boundary + 1)
    valves = [0.45, 0.60, 0.75]
    if day in (1, 4, 5):
        valves = [value + amplitude * .05 * valve_pattern * sign
                  for value, sign in zip(valves, (1, -1, 1))]
    targets = [base_supply + supply_delta, base_pump + pump_delta, *valves]
    bounds = ((40, 60), (30, 50), (.2, 1), (.2, 1), (.2, 1))
    limits = (2, 2, .1, .1, .1)
    if previous is not None:
        old = [previous.supply_c, previous.frequency_hz, *previous.valves]
        targets = [a + max(-limit, min(limit, target - a))
                   for target, a, limit in zip(targets, old, limits)]
    targets = [max(lo, min(hi, value)) for value, (lo, hi) in zip(targets, bounds)]
    return Controls(targets[0], targets[1], tuple(targets[2:]))


def _simulate(descriptor, amplitude):
    parameters, sampling = site_parameters(descriptor)
    nominal = coherent_parameters()
    profiles, nominal_profiles = ({p.building_id: p for p in parameters.buildings},
                                  {p.building_id: p for p in nominal.buildings})
    first_weather = weather_at(0)
    controls = desired_controls(0, 0, first_weather, amplitude)
    initial = {p.building_id: 21 + .15 * ((i % 4) - 1.5)
               for i, p in enumerate(parameters.buildings)}
    engine = SimulationEngine(parameters, controls, initial)
    rows, max_residual, max_mass, min_indoor = [], 0.0, 0.0, min(initial.values())
    for step in range(6 * 288):
        elapsed = step * 300
        day, within = divmod(elapsed, 86400)
        weather = weather_at(elapsed + 150)
        if within % 1800 == 0:
            controls = desired_controls(day, within // 1800, weather, amplitude,
                                        None if step == 0 else controls)
        before = dict(engine.temperatures)
        frame = engine.step(weather, controls)
        max_residual = max(max_residual, frame.heat_balance_residual,
                           frame.pipe_heat_balance_residual,
                           frame.building_heat_balance_residual)
        max_mass = max(max_mass, frame.mass_residual)
        for profile in parameters.buildings:
            zone_index = ZONES.index(profile.zone)
            peers = [item for item in parameters.buildings if item.zone == profile.zone]
            share = profile.flow_share_weight / sum(item.flow_share_weight for item in peers)
            nominal_profile = nominal_profiles[profile.building_id]
            end = frame.buildings[profile.building_id].indoor_temperature_c
            min_indoor = min(min_indoor, end)
            rows.append(dict(zip(OBSERVABLE_FIELDS, (
                DATASET_VERSION, descriptor.site_id, descriptor.split, day,
                "calibration" if day < 4 else "evaluation", DAY_FAMILIES[day],
                frame.simulation_time, (step + 1) * 5, profile.building_id,
                profile.zone, profile.heated_area_m2, profile.insulation_level,
                profile.orientation_factor, nominal_profile.effective_solar_area_m2,
                nominal_profile.internal_gain_w, 1 / nominal_profile.thermal_resistance_k_w,
                nominal_profile.thermal_capacitance_j_k, nominal_profile.radiator_ua_w_k,
                profile.flow_share_weight, before[profile.building_id], end,
                weather.outdoor_c, weather.solar_w_m2, weather.wind_m_s,
                controls.supply_c, controls.frequency_hz, controls.valves[zone_index],
                frame.hydraulics.total_flow_m3_s, frame.hydraulics.flows_m3_s[zone_index],
                frame.delivered_supply_c[profile.zone], frame.delay_s[profile.zone],
                parameters.water.rho_water * frame.hydraulics.flows_m3_s[zone_index] * share))))
    truth = {"datasetVersion": DATASET_VERSION, "siteId": descriptor.site_id,
        "physicalParameterHash": content_hash(asdict(parameters)),
        "parameterSampling": sampling,
        "buildings": {profile.building_id: {
            "true_thermal_resistance_k_w": profile.thermal_resistance_k_w,
            "true_thermal_capacitance_j_k": profile.thermal_capacitance_j_k,
            "true_radiator_ua_w_k": profile.radiator_ua_w_k,
            "true_solar_scale": profile.effective_solar_area_m2 /
                nominal_profiles[profile.building_id].effective_solar_area_m2}
            for profile in parameters.buildings}}
    qa = {"minimumIndoorC": min_indoor, "maximumConservationResidual": max_residual,
          "maximumMassResidual": max_mass, "allFinite": all(isfinite(float(value))
          for row in rows for value in row.values() if isinstance(value, (int, float))),
          "solverFailureCount": 0}
    return rows, truth, qa


def _forecasts(descriptor, rows):
    station = {}
    for row in rows:
        station.setdefault(int(row["elapsed_minutes"]), row)
    output = []
    for anchor in range(4 * 1440, 6 * 1440 - 30, 30):
        as_of = station[anchor]["timestamp"]
        for horizon in range(30, 361, 30):
            target_minute = anchor + horizon
            if target_minute > 6 * 1440: break
            target = station[target_minute]
            rng = random.Random(stable_seed(descriptor.seed, "issued", anchor, horizon))
            scale = (horizon / 360) ** .5
            output.append(dict(zip(FORECAST_FIELDS, (DATASET_VERSION,
                descriptor.site_id, descriptor.split, as_of, anchor,
                target["timestamp"], horizon,
                float(target["outdoor_temperature_c"]) + rng.gauss(0, .2 + .7 * scale),
                max(0.0, float(target["solar_radiation_w_m2"]) + rng.gauss(0, 12 + 65 * scale)),
                max(0.0, float(target["wind_m_s"]) + rng.gauss(0, .08 + .4 * scale)),
                "p5-issued-weather-v1"))))
    return output


def _gzip_csv(path, fields, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("wb") as raw:
        with gzip.GzipFile(filename="", fileobj=raw, mode="wb", mtime=0) as compressed:
            with io.TextIOWrapper(compressed, encoding="utf-8", newline="") as text:
                writer = csv.DictWriter(text, fieldnames=fields, lineterminator="\n")
                writer.writeheader(); writer.writerows(rows)


def file_hash(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def generate(root: Path, schema_hash: str, config_hash: str):
    root.mkdir(parents=True, exist_ok=True)
    sites, hashes, attempts = [], {}, []
    for descriptor in descriptors():
        rows, truth, qa = _simulate(descriptor, 1.0)
        attempts.append({"siteId": descriptor.site_id, "amplitude": 1.0,
                         "minimumIndoorC": qa["minimumIndoorC"],
                         "accepted": qa["minimumIndoorC"] >= 18})
        if qa["minimumIndoorC"] < 18:
            rows, truth, qa = _simulate(descriptor, .5)
            attempts.append({"siteId": descriptor.site_id, "amplitude": .5,
                             "minimumIndoorC": qa["minimumIndoorC"],
                             "accepted": qa["minimumIndoorC"] >= 18})
        if qa["minimumIndoorC"] < 18 or not qa["allFinite"]:
            raise ArithmeticError(f"{descriptor.site_id}: deterministic backoff failed")
        forecasts = _forecasts(descriptor, rows)
        observable_path = root / "site_observable" / f"{descriptor.site_id}.csv.gz"
        forecast_path = root / "issued_forecast" / f"{descriptor.site_id}.csv.gz"
        truth_path = root / "simulation_truth" / f"{descriptor.site_id}.json"
        _gzip_csv(observable_path, OBSERVABLE_FIELDS, rows)
        _gzip_csv(forecast_path, FORECAST_FIELDS, forecasts)
        truth_path.parent.mkdir(parents=True, exist_ok=True)
        truth_path.write_text(json.dumps(truth, indent=2, sort_keys=True, allow_nan=False) + "\n")
        relative = [observable_path.relative_to(root), forecast_path.relative_to(root),
                    truth_path.relative_to(root)]
        hashes.update({str(path): file_hash(root / path) for path in relative})
        sites.append({**asdict(descriptor), "physicalParameterHash": truth["physicalParameterHash"],
            "days": 6, "calibrationDays": [1, 2, 3, 4], "evaluationDays": [5, 6],
            "rowCounts": {"siteObservable": len(rows), "issuedForecast": len(forecasts)},
            "files": {"siteObservable": str(relative[0]), "issuedForecast": str(relative[1]),
                      "simulationTruth": str(relative[2])}, "physicalQA": qa})
    manifest = {"datasetVersion": DATASET_VERSION, "generatorVersion": GENERATOR_VERSION,
        "generatedAt": "2026-09-10T00:00:00+00:00", "seedPolicy": "sha256-derived-v1",
        "siteCounts": {**SITE_SPLITS, "base_fixture": 1}, "sites": sites,
        "attemptedDesigns": attempts, "observableSchemaHash": schema_hash,
        "calibrationConfigHash": config_hash, "fileHashes": hashes,
        "viewSeparation": {"selectedCalibrationView": "site_observable",
                           "truthView": "simulation_truth; post-fit recovery only"},
        "canonicalScenarioIdsUsedForCalibration": [],
        "equipmentBounds": {"supplyC": [40, 60], "pumpHz": [30, 50],
                            "valves": [.2, 1]},
        "movementLimitsPer30Min": {"supplyC": 2, "pumpHz": 2, "valveFraction": .1}}
    return manifest


def read_csv(path):
    with gzip.open(path, "rt", encoding="utf-8", newline="") as stream:
        return list(csv.DictReader(stream))
