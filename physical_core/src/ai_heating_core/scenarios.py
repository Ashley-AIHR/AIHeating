"""Explicit synthetic forcing; no baseline controller or optimisation."""
from dataclasses import dataclass

import numpy as np

from .contracts import Controls, Weather
from .parameters import Parameters, synthetic_parameters
from .simulation import SimulationEngine
from .units import hours_to_seconds, seconds_to_hours

# Hours from Jan 15 08:00, outdoor °C, solar W/m², wind m/s.
WEATHER_KNOTS = (
    (0, -8, 50, 3), (2, -4, 220, 3.4), (6, 5, 480, 2.8),
    (10, 2, 60, 2.5), (12, -1, 0, 3), (18, -7, 0, 3.5), (24, -8, 50, 3),
)
CONTROL_SCHEDULE = (
    (0, Controls()),
    (4, Controls(48, 44, (.6, .6, .7))),
    (8, Controls()),
    (16, Controls(52, 46, (.6, .6, .6))),
    (20, Controls()),
)


@dataclass(frozen=True)
class HydraulicImbalanceGateFixture:
    parameters: Parameters
    controls: Controls = Controls()

    @classmethod
    def create(cls):
        return cls(synthetic_parameters())


def canonical_weather(elapsed_s: float) -> Weather:
    if not 0 <= elapsed_s <= hours_to_seconds(24):
        raise ValueError("canonical weather covers only 24 hours")
    hour = seconds_to_hours(elapsed_s)
    times = [k[0] for k in WEATHER_KNOTS]
    return Weather(*(float(np.interp(hour, times, [k[i] for k in WEATHER_KNOTS])) for i in (1, 2, 3)))


def canonical_controls(elapsed_s):
    return next(c for hour, c in reversed(CONTROL_SCHEDULE) if elapsed_s >= hours_to_seconds(hour))


def run_canonical(dt_s=300, *, scheduled=True):
    engine = SimulationEngine(dt_s=dt_s)
    frames = []
    for _ in range(int(hours_to_seconds(24) / dt_s)):
        # Midpoint sample of linear weather forcing, then hold over this physical step.
        weather = canonical_weather(engine.elapsed_s + dt_s / 2)
        frames.append(engine.step(weather, canonical_controls(engine.elapsed_s) if scheduled else None))
    return frames
