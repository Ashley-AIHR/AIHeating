"""Frozen P2 forcing with the physical-fixture-v1.2 parameter factory."""
from dataclasses import asdict

from .p2_scenarios import Scenario, scenarios as historical_scenarios
from .physical_fixture_v1_2 import FIXTURE_VERSION, coherent_parameters


class FixtureScenario(Scenario):
    def parameters(self, *, evaluation=True):
        return coherent_parameters(super().parameters(evaluation=evaluation))

    def manifest(self, config):
        return {**super().manifest(config), "physicalFixtureVersion": FIXTURE_VERSION,
                "historicalWeatherVersion": "1.0", "scenarioVersion": "1.2"}


def scenarios():
    return tuple(FixtureScenario(**asdict(s)) for s in historical_scenarios())

