"""Five versioned evaluation families. Only the runner can access their forcing."""
from dataclasses import dataclass, replace

import numpy as np

from .contracts import Weather
from .parameters import synthetic_parameters

# Hours relative to evaluation 08:00; outdoor °C, solar W/m², wind m/s.
NORMAL = ((0,-8,20,3),(4,-4,140,2.8),(6,-2,180,2.5),(10,-4,20,3),(14,-6,0,3.2),(20,-8,0,3),(24,-8,20,3))
PRE_COLD = ((0,-5,20,3),(4,-3,100,3),(6,-2,140,3),(10,-3,20,3),(14,-4,0,3),(20,-5,0,3),(24,-5,20,3))
PRE_SUNNY = ((0,-6,20,3),(4,-3,140,2.8),(6,-2,180,2.5),(10,-4,20,3),(14,-5,0,3),(20,-6,0,3),(24,-6,20,3))


@dataclass(frozen=True)
class Scenario:
    scenario_id: str
    description: str
    knots: tuple
    warmup_knots: tuple
    far_pipe_multiplier: float = 1.0
    version: str = "1.0"

    def weather(self, relative_s, *, warmup=False):
        hours = relative_s / 3600
        knots = self.warmup_knots if warmup else self.knots
        if warmup:
            hours %= 24
        elif not 0 <= hours <= 24:
            raise ValueError("P2 evaluation weather covers exactly 24 hours")
        return Weather(*(float(np.interp(hours, [k[0] for k in knots], [k[i] for k in knots])) for i in (1,2,3)))

    def parameters(self, *, evaluation=True):
        p = synthetic_parameters()
        if evaluation and self.far_pipe_multiplier != 1:
            branches = tuple(replace(b, pipe_k_pa_s2_m6=b.pipe_k_pa_s2_m6 * self.far_pipe_multiplier)
                             if b.zone == "far" else b for b in p.branches)
            return replace(p, branches=branches)
        return p

    def manifest(self, config):
        return {"scenarioId": self.scenario_id, "scenarioVersion": self.version, "description": self.description,
                "evaluationStart": "2025-01-15T08:00:00+08:00", "evaluationHours": 24,
                "warmupHours": config.warmup_hours, "warmupConfiguration": {"policy": "daily-repeat-v1", "knots": self.warmup_knots, "columns": ["hour","outdoorC","solarWm2","windMs"], "initialIndoorC": 20},
                "weatherDefinition": {"method": "linear interpolation, current-time sample held per physical step", "points": [[k[0],k[1]] for k in self.knots]},
                "solarDefinition": {"method": "linear interpolation", "points": [[k[0],k[2]] for k in self.knots]},
                "windDefinition": {"method": "linear interpolation; context only in P1A", "points": [[k[0],k[3]] for k in self.knots]},
                "physicalParameterSetId": config.parameter_set_id,
                "physicalParameterOverrides": {"far.pipeResistanceMultiplier": self.far_pipe_multiplier},
                "networkDisturbance": {"atEvaluationSecond": 0, "field": "far.pipe_k_pa_s2_m6", "multiplier": self.far_pipe_multiplier, "warmupUsesBaseNetwork": True},
                "controllerConfigVersion": config.version, "randomSeed": None, "physicalTimestepSeconds": 300, "windowFractions": "all zero"}


def scenarios():
    return (
        Scenario("normal_winter", "Moderate daily winter cycle, commissioning adequacy case", NORMAL, NORMAL),
        Scenario("cold_wave", "Current outdoor falls from -5 to -14°C", ((0,-5,20,3),(3,-5,100,3.2),(6,-8,130,4),(12,-14,0,4.5),(18,-14,0,4),(24,-12,20,3.5)), PRE_COLD),
        Scenario("rapid_warming", "Cold morning to +5°C with stronger solar; held-out stress case", ((0,-8,20,3),(2,-4,220,3.4),(6,5,480,2.8),(10,3,60,2.5),(12,0,0,3),(18,-6,0,3.5),(24,-8,20,3)), NORMAL),
        Scenario("sunny_winter", "Cold winter outdoor conditions and strong solar; held-out stress case", ((0,-6,20,3),(4,-2,420,2.5),(6,0,500,2.5),(10,-2,50,3),(14,-4,0,3),(20,-6,0,3),(24,-6,20,3)), PRE_SUNNY),
        Scenario("hydraulic_imbalance", "Far pipe resistance doubles at evaluation start; healthy-network warmup", NORMAL, NORMAL, 2.),
    )
