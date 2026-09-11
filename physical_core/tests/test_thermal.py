from dataclasses import replace
from math import isfinite

import pytest

from ai_heating_core.constants import WATER
from ai_heating_core.contracts import Weather
from ai_heating_core.parameters import synthetic_parameters
from ai_heating_core.thermal import advance_building, envelope_loss, radiator, required_load
from ai_heating_core.transport import OutletSegment


@pytest.mark.parametrize("mass", [0, 1e-12, 1e-6, .1, 1, 100])
@pytest.mark.parametrize("supply,indoor", [(50, 21), (20, 21), (21, 21)])
def test_R1_R4_water_balance_and_zero_flow(mass, supply, indoor):
    heat, ret = radiator(supply, indoor, mass, 1500)
    assert isfinite(heat) and isfinite(ret)
    assert heat >= 0 and ret <= supply
    if supply > indoor:
        assert ret >= indoor - 1e-12
    assert mass * WATER.cp_water * (supply - ret) == pytest.approx(heat, abs=1e-8)
    if mass < 1e-6:
        assert heat < .001


def test_T1_T2_T5_load_causality():
    p = synthetic_parameters().buildings[0]
    a = advance_building(p, 21, [OutletSegment(300, 50)], 1, Weather(-5, 0))
    b = advance_building(p, 21, [OutletSegment(300, 50)], 1, Weather(-10, 0))
    assert b.envelope_loss_w > a.envelope_loss_w
    assert required_load(p, Weather(-10, 0)) > required_load(p, Weather(-5, 0))
    assert required_load(p, Weather(-5, 400)) < required_load(p, Weather(-5, 0))
    insulated = replace(p, thermal_resistance_k_w=2 * p.thermal_resistance_k_w)
    assert envelope_loss(insulated, 21, -5) < envelope_loss(p, 21, -5)


def test_T3_T4_emitter_monotonicity():
    assert radiator(55, 21, 1, 1500)[0] > radiator(50, 21, 1, 1500)[0]
    heats = [radiator(50, 21, mass, 1500)[0] for mass in (1e-12, .01, .1, 1, 10, 1000)]
    assert all(a < b for a, b in zip(heats, heats[1:]))
    assert heats[-1] <= 1500 * (50 - 21)


def test_T6_window_and_building_energy():
    p = synthetic_parameters().buildings[0]
    a = advance_building(p, 21, [OutletSegment(300, 50)], 1, Weather(-5, 0))
    b = advance_building(p, 21, [OutletSegment(300, 50)], 1, Weather(-5, 0), .5)
    assert b.window_loss_w > a.window_loss_w
    assert b.indoor_temperature_c < a.indoor_temperature_c
    for state in (a, b):
        assert abs(state.energy_residual_w) < 1e-5


@pytest.mark.parametrize("initial,solar", [(45, 0), (30, 10000), (21, 0)])
def test_exact_step_with_heating_on_off_crossing(initial, solar):
    p = replace(synthetic_parameters().buildings[0], thermal_capacitance_j_k=1e6)
    weather = Weather(0, solar)
    one = advance_building(p, initial, [OutletSegment(900, 40)], 1, weather)
    many = initial
    for _ in range(90):
        many = advance_building(p, many, [OutletSegment(10, 40)], 1, weather).indoor_temperature_c
    assert many == pytest.approx(one.indoor_temperature_c, abs=1e-10)
    assert abs(one.energy_residual_w) < 1e-6
