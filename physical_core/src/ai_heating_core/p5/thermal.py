"""Small 1R1C/NTU calibration and provider layer; P1A owns water transport."""
from dataclasses import dataclass
from math import isfinite, log
from typing import Mapping, Sequence

import numpy as np
from scipy.optimize import least_squares

from ..constants import WATER
from ..contracts import BuildingStaticProfile
from ..thermal import linear_update, radiator_conductance

MODEL_VERSION = "p5-thermal-model-v1"
CALIBRATION_VERSION = "p5-calibration-method-v1"
INPUT_SCHEMA_VERSION = "p5-observability-schema-v1"
PARAMETER_NAMES = ("h_scale", "c_scale", "ua_scale", "solar_scale")
FORBIDDEN_INPUT_FIELDS = frozenset({
    "true_thermal_resistance_k_w", "true_thermal_capacitance_j_k",
    "true_radiator_ua_w_k", "true_solar_scale", "true_parameter_multipliers",
    "simulated_building_water_flow_kg_s", "simulated_radiator_heat_w",
    "future_actual_weather", "future_indoor_temperature_c",
})


@dataclass(frozen=True)
class ThermalParameters:
    h_scale: float = 1.0
    c_scale: float = 1.0
    ua_scale: float = 1.0
    solar_scale: float = 1.0

    def __post_init__(self):
        if not all(isfinite(value) and value > 0 for value in vars(self).values()):
            raise ValueError("thermal parameter scales must be positive and finite")


@dataclass(frozen=True)
class ForecastWeatherStep:
    timestamp: str
    outdoor_c: float
    solar_w_m2: float
    issued_as_of: str | None = None


@dataclass(frozen=True)
class WaterInputStep:
    timestamp: str
    delivered_supply_c: float
    building_flow_kg_s: float


@dataclass(frozen=True)
class CalibrationResult:
    parameters: ThermalParameters
    cost: float
    residual_mae_c: float
    nfev: int
    deterministic_starts: int


def _params(values: Sequence[float], names: Sequence[str]) -> ThermalParameters:
    selected = dict(zip(names, np.exp(values)))
    return ThermalParameters(**selected)


def step_temperature(initial_c: float, outdoor_c: float, solar_w_m2: float,
                     delivered_supply_c: float, building_flow_kg_s: float,
                     nominal: BuildingStaticProfile, parameters: ThermalParameters,
                     dt_s: float = 300.0) -> float:
    """Exact constant-forcing 1R1C step using accepted NTU conductance."""
    h = (1 / nominal.thermal_resistance_k_w) * parameters.h_scale
    c = nominal.thermal_capacitance_j_k * parameters.c_scale
    emitter = (radiator_conductance(building_flow_kg_s,
        nominal.radiator_ua_w_k * parameters.ua_scale, WATER)
        if delivered_supply_c > initial_c else 0.0)
    forcing = (h * outdoor_c + solar_w_m2 * nominal.effective_solar_area_m2
               * nominal.orientation_factor * parameters.solar_scale
               + nominal.internal_gain_w + emitter * delivered_supply_c)
    equilibrium = forcing / (h + emitter)
    end, _ = linear_update(initial_c, equilibrium, h + emitter, c, dt_s)
    if not isfinite(end):
        raise ArithmeticError("nonfinite P5 thermal prediction")
    return end


def rollout(initial_c: float, rows: Sequence[Mapping[str, object]],
            nominal: BuildingStaticProfile, parameters: ThermalParameters,
            *, supply_field: str = "delivered_zone_supply_c") -> np.ndarray:
    temperature = initial_c
    result = []
    for row in rows:
        temperature = step_temperature(temperature, float(row["outdoor_temperature_c"]),
            float(row["solar_radiation_w_m2"]), float(row[supply_field]),
            float(row["derived_building_flow_kg_s"]), nominal, parameters)
        result.append(temperature)
    return np.asarray(result)


def _trajectory_predictions(rows: Sequence[Mapping[str, object]], nominal,
                            parameters, supply_field="delivered_zone_supply_c"):
    predictions, targets = [], []
    for day in sorted({int(row["day_index"]) for row in rows}):
        day_rows = [row for row in rows if int(row["day_index"]) == day]
        values = rollout(float(day_rows[0]["indoor_start_c"]), day_rows, nominal,
                         parameters, supply_field=supply_field)
        for index in range(5, len(day_rows), 6):
            predictions.append(values[index])
            targets.append(float(day_rows[index]["indoor_end_c"]))
    return np.asarray(predictions), np.asarray(targets)


def calibrate(rows: Sequence[Mapping[str, object]], nominal: BuildingStaticProfile,
              parameter_names: Sequence[str] = PARAMETER_NAMES, *,
              supply_field: str = "delivered_zone_supply_c") -> CalibrationResult:
    """Fit observable trajectory history only; truth-shaped keys fail closed."""
    if not rows or any(FORBIDDEN_INPUT_FIELDS.intersection(row) for row in rows):
        raise ValueError("calibration input is empty or contains hidden simulation truth")
    names = tuple(parameter_names)
    if not names or any(name not in PARAMETER_NAMES for name in names):
        raise ValueError("unknown calibration parameterisation")
    starts = [np.zeros(len(names)), np.linspace(-.12, .12, len(names)),
              np.linspace(.12, -.12, len(names))]
    lower, upper = np.full(len(names), log(.5)), np.full(len(names), log(1.5))

    def residual(values):
        predicted, target = _trajectory_predictions(rows, nominal, _params(values, names), supply_field)
        regularisation = .02 * values
        return np.r_[(predicted - target) / .1, regularisation]

    fits = [least_squares(residual, start, bounds=(lower, upper), loss="huber",
                         f_scale=1.0, max_nfev=120, xtol=1e-9, ftol=1e-9,
                         gtol=1e-9) for start in starts]
    fit = min(fits, key=lambda item: (item.cost, tuple(item.x)))
    predicted, target = _trajectory_predictions(rows, nominal, _params(fit.x, names), supply_field)
    return CalibrationResult(_params(fit.x, names), float(fit.cost),
                             float(np.mean(np.abs(predicted - target))),
                             int(fit.nfev), len(starts))


def identifiability(rows: Sequence[Mapping[str, object]], nominal: BuildingStaticProfile,
                    parameters: ThermalParameters,
                    parameter_names: Sequence[str] = PARAMETER_NAMES):
    """Normalized numerical sensitivity/Jacobian and local covariance diagnostics."""
    names, epsilon = tuple(parameter_names), 1e-4
    center = np.log([getattr(parameters, name) for name in names])
    base, _ = _trajectory_predictions(rows, nominal, parameters)
    columns = []
    for index in range(len(names)):
        shifted = center.copy(); shifted[index] += epsilon
        prediction, _ = _trajectory_predictions(rows, nominal, _params(shifted, names))
        columns.append((prediction - base) / epsilon / .1)
    jacobian = np.column_stack(columns)
    singular = np.linalg.svd(jacobian, compute_uv=False)
    tolerance = singular[0] * 1e-6 if len(singular) else 0.0
    rank = int(np.sum(singular > tolerance))
    condition = float(singular[0] / singular[-1]) if singular[-1] > 0 else float("inf")
    covariance = np.linalg.pinv(jacobian.T @ jacobian)
    scale = np.sqrt(np.maximum(np.diag(covariance), 1e-30))
    correlation = covariance / np.outer(scale, scale)
    max_correlation = max((abs(correlation[i, j]) for i in range(len(names))
                           for j in range(i + 1, len(names))), default=0.0)
    return {"parameterNames": list(names), "scaledJacobianRows": len(jacobian),
            "singularValues": singular.tolist(), "numericalRank": rank,
            "rankTolerance": tolerance, "conditionNumber": condition,
            "correlationMatrix": correlation.tolist(),
            "maximumAbsoluteOffDiagonalCorrelation": float(max_correlation)}


def thermal_state(temperature_c: float) -> str:
    if temperature_c < 18: return "underheat"
    if temperature_c < 20: return "cool"
    if temperature_c <= 22: return "comfort"
    if temperature_c <= 23: return "warm"
    if temperature_c <= 25: return "overheating"
    return "severe_overheating"


class ThermalPredictionProvider:
    """Stable P6/P7 seam; P1A supplies transported water trajectories."""
    def __init__(self, nominals: Mapping[str, BuildingStaticProfile],
                 calibrations: Mapping[str, ThermalParameters],
                 interval_half_widths_c: Mapping[int, float], calibration_id: str):
        self.nominals, self.calibrations = dict(nominals), dict(calibrations)
        self.interval_half_widths_c = dict(interval_half_widths_c)
        self.calibration_id = calibration_id

    def predict(self, current_state: Mapping[str, float],
                issued_weather_forecast: Sequence[ForecastWeatherStep],
                planned_water_trajectory: Mapping[str, Sequence[WaterInputStep]],
                horizon_minutes: int):
        if horizon_minutes not in (30, 60, 120, 180, 360):
            raise ValueError("P5 horizon must be 30/60/120/180/360 minutes")
        steps = horizon_minutes // 5
        if len(issued_weather_forecast) < steps:
            raise ValueError("issued forecast does not cover requested horizon")
        output = {}
        for building_id in sorted(current_state):
            water = planned_water_trajectory[building_id]
            if len(water) < steps:
                raise ValueError("planned P1A water trajectory does not cover horizon")
            temperature, trajectory = float(current_state[building_id]), []
            for weather, building_water in zip(issued_weather_forecast[:steps], water[:steps]):
                if weather.timestamp != building_water.timestamp:
                    raise ValueError("weather/water trajectory timestamps do not align")
                temperature = step_temperature(temperature, weather.outdoor_c,
                    weather.solar_w_m2, building_water.delivered_supply_c,
                    building_water.building_flow_kg_s, self.nominals[building_id],
                    self.calibrations[building_id])
                trajectory.append({"targetTimestamp": weather.timestamp,
                    "pointC": temperature})
            half = self.interval_half_widths_c[horizon_minutes]
            output[building_id] = {"pointC": temperature,
                "lowerC": temperature - half, "upperC": temperature + half,
                "thermalState": thermal_state(temperature),
                "underheatingRisk": temperature - half < 18,
                "overheatingRisk": temperature + half > 23,
                "severeOverheatingRisk": temperature + half > 25,
                "trajectory": trajectory}
        return {"forecastAsOf": (issued_weather_forecast[0].issued_as_of
                    or issued_weather_forecast[0].timestamp),
                "horizonMinutes": horizon_minutes, "buildings": output,
                "modelVersion": MODEL_VERSION,
                "calibrationVersion": CALIBRATION_VERSION,
                "calibrationId": self.calibration_id,
                "inputSchemaVersion": INPUT_SCHEMA_VERSION,
                "sourceMetadata": {
                    "weather": "issued external forecast",
                    "waterTrajectory": "accepted P1A hydraulics/FIFO transport adapter",
                    "buildingFlow": "zone flow times configured design-flow share"},
                "intervalLabel": "95% simulation-calibrated; validation-only split conformal"}
