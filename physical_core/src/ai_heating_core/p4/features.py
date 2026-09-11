"""Causal P4 feature rows built from immutable P3 episode shards."""
from dataclasses import asdict, dataclass
import csv
import gzip
import json
from math import cos, pi, sin
from pathlib import Path

from ..benchmark.freeze import file_hash
from ..contracts import Weather
from ..dataset.factory import EpisodeDescriptor, sample_parameters
from ..thermal import required_load
from .prediction import assert_causal_feature_names


@dataclass(frozen=True)
class FeatureRow:
    episode_id: str
    split: str
    scenario_family: str
    forecast_as_of: str
    target_time: str
    horizon_minutes: int
    features: tuple[float, ...]
    target_mw: float
    persistence_mw: float
    physics_mw: float


def read_csv(path):
    with gzip.open(path, "rt", encoding="utf-8", newline="") as stream:
        return list(csv.DictReader(stream))


def feature_names(schema_path):
    schema = json.loads(Path(schema_path).read_text())
    names = tuple(item["field"] for item in schema["featureFields"] if item["usedByModel"])
    assert_causal_feature_names(names)
    allowed = set(schema["allowedModelAvailabilityClasses"])
    invalid = [item["field"] for item in schema["featureFields"]
               if item["usedByModel"] and item["availabilityClass"] not in allowed]
    if invalid:
        raise ValueError(f"Noncausal availability classes: {invalid}")
    return names


def validation_partition(manifest_paths):
    by_family = {}
    for path in manifest_paths:
        manifest = json.loads(path.read_text())
        if manifest["split"] == "validation":
            by_family.setdefault(manifest["scenarioFamily"], []).append((file_hash(path), manifest["episodeId"]))
    select, calibration = set(), set()
    for values in by_family.values():
        ordered = [episode for _, episode in sorted(values)]
        select.update(ordered[:10]); calibration.update(ordered[10:15])
    if len(select) != 50 or len(calibration) != 25 or select & calibration:
        raise ValueError("Invalid deterministic validation partition")
    return select, calibration


def _percentile(values, fraction):
    ordered = sorted(values)
    return ordered[int((len(ordered) - 1) * fraction)]


def build_episode_rows(data_root, manifest_path, names, validation_select, validation_calibration):
    manifest = json.loads(Path(manifest_path).read_text())
    split = manifest["split"]
    if split == "validation":
        split = "validation_select" if manifest["episodeId"] in validation_select else "validation_calibration"
    files = manifest["outputFiles"]
    raw_rows = read_csv(Path(data_root) / files["raw_state"])
    building_rows = read_csv(Path(data_root) / files["building_state"])
    forecast_rows = read_csv(Path(data_root) / files["weather_forecast"])
    target_rows = read_csv(Path(data_root) / files["load_target"])
    raw = {int(float(row["elapsed_minutes"])): row for row in raw_rows}
    elapsed_by_time = {row["simulation_time"]: minute for minute, row in raw.items()}
    buildings = {}
    for row in building_rows:
        buildings.setdefault(row["simulation_time"], []).append(row)
    forecasts = {}
    for row in forecast_rows:
        forecasts.setdefault(row["forecast_as_of"], []).append(row)
    descriptor = EpisodeDescriptor(**manifest["descriptor"])
    parameters, _ = sample_parameters(descriptor)
    static = {
        "total_envelope_conductance_w_k": sum(1 / p.thermal_resistance_k_w for p in parameters.buildings),
        "total_internal_gain_kw": sum(p.internal_gain_w for p in parameters.buildings) / 1000,
        "total_solar_aperture_m2": sum(p.effective_solar_area_m2 * p.orientation_factor for p in parameters.buildings),
        "total_thermal_capacitance_mj_k": sum(p.thermal_capacitance_j_k for p in parameters.buildings) / 1e6,
        "total_radiator_ua_kw_k": sum(p.radiator_ua_w_k for p in parameters.buildings) / 1000,
    }
    rows = []
    for target in target_rows:
        anchor = elapsed_by_time[target["as_of_time"]]
        horizon = int(target["horizon_minutes"])
        if anchor < 150:
            continue
        current = raw[anchor]
        issued = sorted(forecasts[target["as_of_time"]], key=lambda row: int(row["horizon_minutes"]))
        path = [row for row in issued if int(row["horizon_minutes"]) <= horizon]
        target_forecast = next(row for row in issued if int(row["horizon_minutes"]) == horizon)
        outdoor_path = [float(row["forecast_outdoor_temperature_c"]) for row in path]
        solar_path = [float(row["forecast_solar_radiation_w_m2"]) for row in path]
        current_buildings = buildings[target["as_of_time"]]
        indoor = [float(row["indoor_temperature_c"]) for row in current_buildings]
        zone_mean = {zone: sum(float(row["indoor_temperature_c"]) for row in current_buildings if row["zone"] == zone) / 4
                     for zone in ("near", "mid", "far")}
        local_hour = float(current["local_hour"])
        forecast_weather = Weather(float(target_forecast["forecast_outdoor_temperature_c"]),
            float(target_forecast["forecast_solar_radiation_w_m2"]), float(target_forecast["forecast_wind_m_s"]))
        physics = sum(required_load(profile, forecast_weather, target_c=parameters.target_indoor_c)
                      for profile in parameters.buildings) / 1e6
        values = {
            "horizon_hours": horizon / 60,
            "current_outdoor_c": float(current["outdoor_temperature_c"]),
            "current_solar_w_m2": float(current["solar_radiation_w_m2"]),
            "current_required_load_mw": float(current["required_heat_load_mw"]),
            "lag30_required_load_mw": float(raw[anchor - 30]["required_heat_load_mw"]),
            "lag60_required_load_mw": float(raw[anchor - 60]["required_heat_load_mw"]),
            "lag120_required_load_mw": float(raw[anchor - 120]["required_heat_load_mw"]),
            "forecast_target_outdoor_c": forecast_weather.outdoor_c,
            "forecast_target_solar_w_m2": forecast_weather.solar_w_m2,
            "forecast_target_wind_m_s": forecast_weather.wind_m_s,
            "forecast_outdoor_mean_c": sum(outdoor_path) / len(outdoor_path),
            "forecast_outdoor_min_c": min(outdoor_path),
            "forecast_outdoor_max_c": max(outdoor_path),
            "forecast_outdoor_slope_c_h": (outdoor_path[-1] - outdoor_path[0]) / max((horizon - 30) / 60, .5),
            "forecast_solar_mean_w_m2": sum(solar_path) / len(solar_path),
            "forecast_solar_max_w_m2": max(solar_path),
            "hour_sin": sin(2 * pi * local_hour / 24), "hour_cos": cos(2 * pi * local_hour / 24),
            "indoor_mean_c": sum(indoor) / len(indoor), "indoor_p10_c": _percentile(indoor, .1),
            "indoor_p50_c": _percentile(indoor, .5), "indoor_p90_c": _percentile(indoor, .9),
            "near_indoor_mean_c": zone_mean["near"], "mid_indoor_mean_c": zone_mean["mid"],
            "far_indoor_mean_c": zone_mean["far"], **static, "physics_forecast_load_mw": physics,
        }
        if set(values) != set(names):
            raise ValueError(f"Feature/schema mismatch: {set(values) ^ set(names)}")
        rows.append(FeatureRow(manifest["episodeId"], split, manifest["scenarioFamily"],
            target["as_of_time"], target["target_time"], horizon, tuple(values[name] for name in names),
            float(target["required_heat_load_mw"]), values["current_required_load_mw"], physics))
    return rows


def build_rows(root, schema_path):
    data_root = Path(root) / "artifacts/p3_dataset_v1/official"
    manifests = sorted((data_root / "manifests").rglob("*.json"))
    select, calibration = validation_partition(manifests)
    names = feature_names(schema_path)
    rows = []
    for number, path in enumerate(manifests, 1):
        if number % 50 == 0:
            print(f"features {number}/{len(manifests)}", flush=True)
        rows.extend(build_episode_rows(data_root, path, names, select, calibration))
    return names, rows, {"validationSelectEpisodes": sorted(select),
                         "validationCalibrationEpisodes": sorted(calibration)}


def row_to_dict(row, names):
    return {**asdict(row), "features": dict(zip(names, row.features))}


def live_features(names, parameters, minute, history, indoor_temperatures, issued_forecast, horizon):
    """Build the same causal feature vector from live Preview state and an issued forecast."""
    if minute < 150 or any(minute - lag not in history for lag in (0, 30, 60, 120)):
        raise ValueError("Insufficient causal history for Selected P4 Predictor v1")
    path = sorted((row for row in issued_forecast if int(row["horizon_minutes"]) <= horizon),
                  key=lambda row: int(row["horizon_minutes"]))
    target = next(row for row in path if int(row["horizon_minutes"]) == horizon)
    outdoors = [float(row["forecast_outdoor_temperature_c"]) for row in path]
    solar = [float(row["forecast_solar_radiation_w_m2"]) for row in path]
    weather = Weather(float(target["forecast_outdoor_temperature_c"]),
                      float(target["forecast_solar_radiation_w_m2"]),
                      float(target["forecast_wind_m_s"]))
    indoor = list(indoor_temperatures.values())
    profiles = {profile.building_id: profile for profile in parameters.buildings}
    zone_mean = {zone: sum(indoor_temperatures[key] for key, profile in profiles.items() if profile.zone == zone) / 4
                 for zone in ("near", "mid", "far")}
    current = history[minute]
    hour = (8 + minute / 60) % 24
    values = {
        "horizon_hours": horizon / 60, "current_outdoor_c": current["outdoor"],
        "current_solar_w_m2": current["solar"], "current_required_load_mw": current["load"],
        "lag30_required_load_mw": history[minute - 30]["load"],
        "lag60_required_load_mw": history[minute - 60]["load"],
        "lag120_required_load_mw": history[minute - 120]["load"],
        "forecast_target_outdoor_c": weather.outdoor_c, "forecast_target_solar_w_m2": weather.solar_w_m2,
        "forecast_target_wind_m_s": weather.wind_m_s, "forecast_outdoor_mean_c": sum(outdoors) / len(outdoors),
        "forecast_outdoor_min_c": min(outdoors), "forecast_outdoor_max_c": max(outdoors),
        "forecast_outdoor_slope_c_h": (outdoors[-1] - outdoors[0]) / max((horizon - 30) / 60, .5),
        "forecast_solar_mean_w_m2": sum(solar) / len(solar), "forecast_solar_max_w_m2": max(solar),
        "hour_sin": sin(2 * pi * hour / 24), "hour_cos": cos(2 * pi * hour / 24),
        "indoor_mean_c": sum(indoor) / 12, "indoor_p10_c": _percentile(indoor, .1),
        "indoor_p50_c": _percentile(indoor, .5), "indoor_p90_c": _percentile(indoor, .9),
        "near_indoor_mean_c": zone_mean["near"], "mid_indoor_mean_c": zone_mean["mid"],
        "far_indoor_mean_c": zone_mean["far"],
        "total_envelope_conductance_w_k": sum(1 / p.thermal_resistance_k_w for p in parameters.buildings),
        "total_internal_gain_kw": sum(p.internal_gain_w for p in parameters.buildings) / 1000,
        "total_solar_aperture_m2": sum(p.effective_solar_area_m2 * p.orientation_factor for p in parameters.buildings),
        "total_thermal_capacitance_mj_k": sum(p.thermal_capacitance_j_k for p in parameters.buildings) / 1e6,
        "total_radiator_ua_kw_k": sum(p.radiator_ua_w_k for p in parameters.buildings) / 1000,
        "physics_forecast_load_mw": sum(required_load(p, weather, target_c=parameters.target_indoor_c)
                                        for p in parameters.buildings) / 1e6,
    }
    if set(values) != set(names):
        raise ValueError(f"Live feature/schema mismatch: {set(values) ^ set(names)}")
    return values
