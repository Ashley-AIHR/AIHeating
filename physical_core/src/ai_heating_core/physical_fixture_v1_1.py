"""Static design-maintenance-load allocation; no benchmark/controller inputs."""
from dataclasses import replace

from .parameters import synthetic_parameters as area_parameters

FIXTURE_VERSION = "physical-fixture-v1.1"
DESIGN_INDOOR_C = 21
DESIGN_OUTDOOR_C = -10
MINIMUM_WEIGHT_W = 1.0  # Positive share for a zero-maintenance-load profile; inactive in B01–B12.


def design_weight(profile):
    return max(MINIMUM_WEIGHT_W,
               (DESIGN_INDOOR_C - DESIGN_OUTDOOR_C) / profile.thermal_resistance_k_w - profile.internal_gain_w)


def design_load_parameters(parameters=None):
    base = area_parameters() if parameters is None else parameters
    return replace(base, buildings=tuple(replace(b, flow_share_weight=design_weight(b)) for b in base.buildings))
