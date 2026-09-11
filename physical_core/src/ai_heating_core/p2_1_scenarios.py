"""Same P2 forcing/disturbances, with explicitly versioned building allocation."""
from dataclasses import asdict

from .p2_scenarios import Scenario, scenarios as historical_scenarios
from .physical_fixture_v1_1 import FIXTURE_VERSION, design_load_parameters


class FixtureScenario(Scenario):
    def parameters(self, *, evaluation=True):
        return design_load_parameters(super().parameters(evaluation=evaluation))

    def manifest(self, config):
        return {**super().manifest(config), "physicalFixtureVersion": FIXTURE_VERSION,
                "historicalWeatherVersion": "1.0", "scenarioVersion": "1.1"}


def scenarios():
    return tuple(FixtureScenario(**asdict(s)) for s in historical_scenarios())
