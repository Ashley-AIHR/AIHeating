from dataclasses import dataclass
from typing import Literal

from .constants import finite, positive

ZONES = ("near", "mid", "far")
Zone = Literal["near", "mid", "far"]


@dataclass(frozen=True)
class EquipmentLimits:
    supply_min_c: float = 40
    supply_max_c: float = 60
    frequency_min_hz: float = 30
    frequency_max_hz: float = 50
    valve_min: float = 0.2
    valve_max: float = 1.0
    supply_change_c: float = 2
    frequency_change_hz: float = 2
    valve_change: float = 0.1

    def __post_init__(self):
        for name, value in vars(self).items():
            positive(name, value)
        if not (self.supply_min_c < self.supply_max_c
                and self.frequency_min_hz < self.frequency_max_hz
                and self.valve_min < self.valve_max <= 1):
            raise ValueError("invalid equipment bounds")


LIMITS = EquipmentLimits()


@dataclass(frozen=True)
class Controls:
    supply_c: float = 50
    frequency_hz: float = 45
    valves: tuple[float, float, float] = (0.6, 0.6, 0.6)
    pump_mode: str = "frequency"

    def __post_init__(self):
        self.validate()

    def validate(self, previous=None, limits: EquipmentLimits = LIMITS):
        if self.pump_mode != "frequency":
            raise ValueError("Phase 1A supports frequency pump control only")
        if len(self.valves) != 3:
            raise ValueError("exactly three zone valve openings required")
        checks = [("supply temperature", self.supply_c, limits.supply_min_c, limits.supply_max_c),
                  ("pump frequency", self.frequency_hz, limits.frequency_min_hz, limits.frequency_max_hz)]
        checks += [(f"{z} valve", u, limits.valve_min, limits.valve_max) for z, u in zip(ZONES, self.valves)]
        for name, value, lo, hi in checks:
            finite(name, value)
            if not lo <= value <= hi:
                raise ValueError(f"{name} must be in [{lo}, {hi}], got {value}")
        if previous is not None:
            deltas = [("supply", self.supply_c - previous.supply_c, limits.supply_change_c),
                      ("pump", self.frequency_hz - previous.frequency_hz, limits.frequency_change_hz)]
            deltas += [(z, a - b, limits.valve_change) for z, a, b in zip(ZONES, self.valves, previous.valves)]
            for name, delta, bound in deltas:
                if abs(delta) > bound + 1e-12:
                    raise ValueError(f"{name} control change exceeds {bound}")


@dataclass(frozen=True)
class Weather:
    outdoor_c: float
    solar_w_m2: float
    wind_m_s: float = 3.0

    def __post_init__(self):
        finite("outdoor temperature", self.outdoor_c)
        positive("solar radiation", self.solar_w_m2, allow_zero=True)
        positive("wind speed", self.wind_m_s, allow_zero=True)


def validate_window(fraction: float):
    finite("window fraction", fraction)
    if not 0 <= fraction <= 1:
        raise ValueError("window fraction must be in [0, 1]")


def validate_timestep(dt_s: float):
    if dt_s not in (300, 600, 900):
        raise ValueError("physical timestep must be 300, 600 or 900 seconds")


@dataclass(frozen=True)
class BuildingStaticProfile:
    building_id: str
    heated_area_m2: float
    construction_year: int
    insulation_level: str
    zone: Zone
    terminal_type: str
    orientation_factor: float
    effective_solar_area_m2: float
    internal_gain_w: float
    thermal_resistance_k_w: float
    thermal_capacitance_j_k: float
    radiator_ua_w_k: float
    flow_share_weight: float
    window_conductance_w_k: float
    floors: int = 6

    def __post_init__(self):
        if not self.building_id or self.zone not in ZONES or self.terminal_type != "radiator":
            raise ValueError("building requires ID, valid zone and radiator terminal")
        if self.insulation_level not in ("Low", "Medium", "High"):
            raise ValueError("invalid insulation level")
        if self.floors <= 0 or not 1800 <= self.construction_year <= 2100:
            raise ValueError("invalid building floors/year")
        for name in ("heated_area_m2", "thermal_resistance_k_w", "thermal_capacitance_j_k", "flow_share_weight"):
            positive(name, getattr(self, name))
        for name in ("orientation_factor", "effective_solar_area_m2", "internal_gain_w", "radiator_ua_w_k", "window_conductance_w_k"):
            positive(name, getattr(self, name), allow_zero=True)


@dataclass(frozen=True)
class BuildingThermalState:
    indoor_temperature_c: float
    heating_power_w: float
    solar_gain_w: float
    internal_gain_w: float
    envelope_loss_w: float
    window_loss_w: float
    building_water_flow_kg_s: float
    radiator_return_temperature_c: float
    mean_indoor_temperature_c: float
    storage_power_w: float
    energy_residual_w: float


@dataclass(frozen=True)
class SolverDiagnostics:
    status: Literal["converged", "infeasible", "failed"]
    normalized_residual: float | None  # None if the solver raised before evaluating a residual
    iterations: int  # scipy nfev (function evaluations), not nonlinear iterations
    message: str
