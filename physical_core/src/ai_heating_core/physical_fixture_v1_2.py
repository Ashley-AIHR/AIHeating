"""Coherent synthetic design-load -> water-flow -> radiator-UA sizing."""
from dataclasses import dataclass, replace
from math import isfinite, log

from .parameters import synthetic_parameters

FIXTURE_VERSION = "physical-fixture-v1.2"
DESIGN_INDOOR_C = 21.0
DESIGN_OUTDOOR_C = -10.0
DESIGN_SUPPLY_C = 55.0
DESIGN_RETURN_C = 45.0


@dataclass(frozen=True)
class BuildingSizing:
    design_heat_load_w: float
    design_mass_flow_kg_s: float
    design_volumetric_flow_m3_h: float
    effectiveness: float
    radiator_ua_w_k: float


def size_profile(profile, water):
    load = max(0.0, (DESIGN_INDOOR_C - DESIGN_OUTDOOR_C) / profile.thermal_resistance_k_w
               - profile.internal_gain_w)
    mass_flow = load / (water.cp_water * (DESIGN_SUPPLY_C - DESIGN_RETURN_C))
    capacity = mass_flow * water.cp_water
    effectiveness = load / (capacity * (DESIGN_SUPPLY_C - DESIGN_INDOOR_C)) if capacity else 0.0
    if load <= 0 or not 0 < effectiveness < 1:
        raise ValueError(f"{profile.building_id}: design point has invalid effectiveness {effectiveness}")
    ua = -capacity * log(1 - effectiveness)
    if not isfinite(ua) or ua <= 0:
        raise ValueError(f"{profile.building_id}: derived radiator UA is not positive and finite")
    return BuildingSizing(load, mass_flow, mass_flow / water.rho_water * 3600,
                          effectiveness, ua)


def coherent_parameters(parameters=None):
    base = synthetic_parameters() if parameters is None else parameters
    buildings = []
    for profile in base.buildings:
        sizing = size_profile(profile, base.water)
        buildings.append(replace(profile, radiator_ua_w_k=sizing.radiator_ua_w_k,
                                 flow_share_weight=sizing.design_mass_flow_kg_s))
    return replace(base, buildings=tuple(buildings))

