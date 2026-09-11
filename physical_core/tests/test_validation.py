from dataclasses import replace

import pytest

from ai_heating_core.constants import PhysicalConstants
from ai_heating_core.contracts import Controls, EquipmentLimits, Weather, validate_timestep, validate_window
from ai_heating_core.parameters import synthetic_parameters
from ai_heating_core import units


def test_unit_conversions():
    assert units.m3s_to_m3h(units.m3h_to_m3s(17.8)) == pytest.approx(17.8)
    assert units.seconds_to_minutes(units.minutes_to_seconds(35)) == 35
    assert units.seconds_to_hours(units.hours_to_seconds(24)) == 24
    assert units.pa_to_kpa(units.kpa_to_pa(68)) == 68
    assert units.w_to_kw(1000) == 1
    assert units.w_to_mw(1e6) == 1
    assert units.j_to_kwh(3.6e6) == 1
    assert units.j_to_mwh(3.6e9) == 1
    assert units.fraction_to_percent(units.percent_to_fraction(60)) == 60


@pytest.mark.parametrize("patch", [
    {"supply_c": 70}, {"supply_c": 39}, {"frequency_hz": 60}, {"frequency_hz": 29},
    {"valves": (1.5, .6, .6)}, {"valves": (.1, .6, .6)}, {"valves": (.6,)},
    {"pump_mode": "differential_pressure"}, {"supply_c": float("nan")}, {"frequency_hz": float("inf")},
])
def test_invalid_controls(patch):
    with pytest.raises(ValueError):
        Controls(**patch)


@pytest.mark.parametrize("patch", [{"supply_c": 53}, {"frequency_hz": 48}, {"valves": (.8, .6, .6)}])
def test_control_rate_limits(patch):
    with pytest.raises(ValueError, match="control change"):
        Controls(**patch).validate(Controls())


def test_valid_equipment_endpoints_and_steps():
    Controls(40, 30, (.2, .2, .2))
    Controls(60, 50, (1, 1, 1))
    Controls(52, 47, (.7, .5, .6)).validate(Controls())
    for dt in (300, 600, 900):
        validate_timestep(dt)


@pytest.mark.parametrize("field,value", [
    ("thermal_resistance_k_w", 0), ("thermal_resistance_k_w", -1),
    ("thermal_capacitance_j_k", 0), ("radiator_ua_w_k", -1),
    ("flow_share_weight", 0), ("effective_solar_area_m2", -1),
    ("internal_gain_w", -1), ("window_conductance_w_k", -1),
    ("thermal_capacitance_j_k", float("nan")), ("terminal_type", "floor_heating"),
])
def test_invalid_building_parameters(field, value):
    with pytest.raises(ValueError):
        replace(synthetic_parameters().buildings[0], **{field: value})


@pytest.mark.parametrize("target,field,value", [
    ("pump", "efficiency", 0), ("pump", "efficiency", 1.1),
    ("pump", "curve_a_s2_m5", -1), ("pump", "shutoff_head_m", 0),
    ("branch", "pipe_k_pa_s2_m6", -1), ("branch", "equivalent_volume_m3", 0),
    ("branch", "valve_ref_k_pa_s2_m6", 0), ("branch", "equivalent_volume_m3", float("inf")),
])
def test_invalid_network_parameters(target, field, value):
    p = synthetic_parameters()
    with pytest.raises(ValueError):
        replace(p.pump if target == "pump" else p.branches[0], **{field: value})


@pytest.mark.parametrize("value", [-.1, 1.1, float("nan"), float("inf")])
def test_invalid_window(value):
    with pytest.raises(ValueError):
        validate_window(value)


@pytest.mark.parametrize("dt", [0, -300, 60, 1800, float("nan")])
def test_invalid_timestep(dt):
    with pytest.raises(ValueError):
        validate_timestep(dt)


def test_other_invalid_parameters():
    with pytest.raises(ValueError):
        EquipmentLimits(valve_min=.8, valve_max=.2)
    with pytest.raises(ValueError):
        PhysicalConstants(cp_water=-1)
    with pytest.raises(ValueError):
        Weather(-5, -1)
    with pytest.raises(ValueError):
        replace(synthetic_parameters(), common_k_pa_s2_m6=-1)
