"""Current-outdoor-only conventional control. No scenario or building input."""
from bisect import bisect_right
from dataclasses import asdict, dataclass

from ..constants import finite
from ..contracts import Controls, LIMITS

INITIAL_SUPPLY_CURVE = ((-15., 58.), (-10., 55.), (-5., 51.), (0., 47.), (5., 43.), (10., 40.))
INITIAL_PUMP_CURVE = ((-15., 48.), (-10., 46.), (-5., 44.), (0., 42.), (5., 38.), (10., 34.))


def interpolate(curve, outdoor_c):
    finite("current outdoor temperature", outdoor_c)
    if outdoor_c <= curve[0][0]:
        return curve[0][1]
    if outdoor_c >= curve[-1][0]:
        return curve[-1][1]
    i = bisect_right([x for x, _ in curve], outdoor_c) - 1
    x0, y0 = curve[i]
    x1, y1 = curve[i + 1]
    return y0 + (y1 - y0) * (outdoor_c - x0) / (x1 - x0)


@dataclass(frozen=True)
class ControllerConfig:
    version: str = "traditional-v1.0"
    supply_curve: tuple = INITIAL_SUPPLY_CURVE
    pump_curve: tuple = INITIAL_PUMP_CURVE
    valves: tuple = (.5, .6, .85)
    interval_s: int = 1800
    supply_slew_c: float = LIMITS.supply_change_c
    pump_slew_hz: float = LIMITS.frequency_change_hz
    warmup_hours: int = 72
    parameter_set_id: str = "p1a-synthetic-v1.0"

    def __post_init__(self):
        if self.interval_s != 1800 or self.warmup_hours not in (72, 96):
            raise ValueError("P2 requires 1800 s control interval and 72/96 h official warmup")
        if self.supply_slew_c != LIMITS.supply_change_c or self.pump_slew_hz != LIMITS.frequency_change_hz:
            raise ValueError("P2 preserves frozen control slew limits")
        for curve, lo, hi in ((self.supply_curve, 40, 60), (self.pump_curve, 30, 50)):
            if len(curve) < 2:
                raise ValueError("at least two curve breakpoints required")
            for x, y in curve:
                finite("curve outdoor", x)
                finite("curve output", y)
                if not lo <= y <= hi:
                    raise ValueError("curve output outside frozen equipment bounds")
            if not all(b[0] > a[0] and b[1] <= a[1] for a, b in zip(curve, curve[1:])):
                raise ValueError("curve must have increasing outdoor and nonincreasing output")
        Controls(valves=self.valves)


@dataclass(frozen=True)
class ControllerState:
    controller_version: str
    raw_supply_target_c: float
    applied_supply_c: float
    raw_pump_target_hz: float
    applied_pump_hz: float
    fixed_valves: tuple
    last_boundary_s: int
    next_boundary_s: int

    def controls(self):
        return Controls(self.applied_supply_c, self.applied_pump_hz, self.fixed_valves)

    @classmethod
    def from_dict(cls, value):
        return cls(**{**value, "fixed_valves": tuple(value["fixed_valves"])})


class TraditionalHeatingController:
    def __init__(self, config: ControllerConfig):
        self.config = config

    def initialize(self, timestamp_s: int, outdoor_c: float) -> ControllerState:
        if timestamp_s % self.config.interval_s:
            raise ValueError("controller initialization requires a control boundary")
        supply = interpolate(self.config.supply_curve, outdoor_c)
        pump = interpolate(self.config.pump_curve, outdoor_c)
        return ControllerState(self.config.version, supply, supply, pump, pump,
                               self.config.valves, timestamp_s, timestamp_s + self.config.interval_s)

    def update(self, timestamp_s: int, outdoor_c: float, state: ControllerState) -> ControllerState:
        finite("timestamp", timestamp_s)
        finite("current outdoor temperature", outdoor_c)
        if state.controller_version != self.config.version or state.fixed_valves != self.config.valves:
            raise ValueError("controller state/config mismatch")
        state.controls().validate()
        if state.next_boundary_s != state.last_boundary_s + self.config.interval_s:
            raise ValueError("invalid controller boundary state")
        if timestamp_s < state.last_boundary_s or timestamp_s > state.next_boundary_s:
            raise ValueError("nonmonotone clock or skipped controller boundary")
        if timestamp_s < state.next_boundary_s:
            return state
        supply = interpolate(self.config.supply_curve, outdoor_c)
        pump = interpolate(self.config.pump_curve, outdoor_c)
        slew = lambda target, old, limit: old + max(-limit, min(limit, target - old))
        result = ControllerState(self.config.version, supply,
            slew(supply, state.applied_supply_c, self.config.supply_slew_c), pump,
            slew(pump, state.applied_pump_hz, self.config.pump_slew_hz), state.fixed_valves,
            timestamp_s, timestamp_s + self.config.interval_s)
        result.controls().validate(state.controls())
        return result


def config_to_dict(config):
    return {"controllerVersion": config.version,
            "weatherCompensationBreakpoints": config.supply_curve,
            "pumpFrequencyBreakpoints": config.pump_curve,
            "fixedZoneValves": dict(zip(("near", "mid", "far"), [v * 100 for v in config.valves])),
            "controlIntervalMinutes": config.interval_s / 60,
            "rateLimits": {"supplyCPerInterval": config.supply_slew_c, "pumpHzPerInterval": config.pump_slew_hz, "runtimeValveChangePct": 0},
            "commissioningMethod": "static-area-shares-anchor85-round5pp-v1",
            "warmupHours": config.warmup_hours, "physicalParameterSetId": config.parameter_set_id,
            "label": "Synthetic PoC Controller Parameters"}


def config_from_dict(value):
    if value["rateLimits"]["runtimeValveChangePct"] != 0:
        raise ValueError("Traditional runtime valves must be fixed")
    return ControllerConfig(value["controllerVersion"],
        tuple(tuple(p) for p in value["weatherCompensationBreakpoints"]),
        tuple(tuple(p) for p in value["pumpFrequencyBreakpoints"]),
        tuple(value["fixedZoneValves"][z] / 100 for z in ("near", "mid", "far")),
        int(value["controlIntervalMinutes"] * 60), value["rateLimits"]["supplyCPerInterval"],
        value["rateLimits"]["pumpHzPerInterval"], value["warmupHours"], value["physicalParameterSetId"])
