from dataclasses import asdict, replace
import ast
import inspect
from math import fsum

import pytest

from ai_heating_core import physical_fixture_v1_1 as fixture
from ai_heating_core.benchmark.state import content_hash
from ai_heating_core.contracts import Controls, Weather, ZONES
from ai_heating_core.control.commissioning import commission
from ai_heating_core.parameters import synthetic_parameters
from ai_heating_core.p2_scenarios import scenarios as old_scenarios
from ai_heating_core.p2_1_scenarios import scenarios
from ai_heating_core.simulation import SimulationEngine


def test_only_building_flow_weights_change():
    a,b=synthetic_parameters(),fixture.design_load_parameters()
    expected=replace(b,buildings=tuple(replace(x,flow_share_weight=y.flow_share_weight) for x,y in zip(b.buildings,a.buildings)))
    assert expected==a
    assert content_hash(asdict(a))!=content_hash(asdict(b))
    assert all(x.flow_share_weight==y.heated_area_m2 for x,y in zip(a.buildings,b.buildings))


def test_design_formula_and_determinism():
    p=fixture.design_load_parameters()
    assert p==fixture.design_load_parameters()
    for b in p.buildings:
        assert b.flow_share_weight==max(1,31/b.thermal_resistance_k_w-b.internal_gain_w)
        assert b.flow_share_weight>fixture.MINIMUM_WEIGHT_W


def test_same_area_insulation_pair_gfa3():
    high,low=fixture.design_load_parameters().buildings[1:3]
    assert high.heated_area_m2==low.heated_area_m2==980
    assert high.internal_gain_w==low.internal_gain_w
    assert low.flow_share_weight>high.flow_share_weight
    assert low.flow_share_weight/high.flow_share_weight==pytest.approx(51744/24402)


@pytest.mark.parametrize("frequency,valves",[(30,(.2,.2,.2)),(45,(.5,.6,.85)),(50,(1,1,1))])
def test_gfa1_gfa2_mass_and_proportionality(frequency,valves):
    p=fixture.design_load_parameters()
    frame=SimulationEngine(p,Controls(frequency_hz=frequency,valves=valves)).step(Weather(-5,0))
    for z,q in zip(ZONES,frame.hydraulics.flows_m3_s):
        profiles=[b for b in p.buildings if b.zone==z]
        mass=p.water.rho_water*q
        actual=fsum(frame.buildings[b.building_id].building_water_flow_kg_s for b in profiles)
        assert abs(actual-mass)/mass<1e-6
        total=fsum(b.flow_share_weight for b in profiles)
        for b in profiles:
            assert frame.buildings[b.building_id].building_water_flow_kg_s/mass==pytest.approx(b.flow_share_weight/total,abs=1e-14)


def test_no_benchmark_or_io_inputs_gfa4():
    tree=ast.parse(inspect.getsource(fixture))
    imports=[n.module for n in ast.walk(tree) if isinstance(n,ast.ImportFrom)]
    assert imports==["dataclasses","parameters"]
    assert not any(isinstance(n,ast.Import) for n in ast.walk(tree))
    assert list(inspect.signature(fixture.design_weight).parameters)==["profile"]
    assert not ({n.id for n in ast.walk(tree) if isinstance(n,ast.Name)} & {"open","Path","read_csv","json","scenario","comfortRate","overheatingRate","forecast","mpc"})


def test_minimum_weight_for_zero_design_load():
    b=synthetic_parameters().buildings[0]
    assert fixture.design_weight(replace(b,internal_gain_w=1e9))==1


def test_unchanged_weather_disturbances_and_commissioning():
    assert commission(fixture.design_load_parameters())==commission(synthetic_parameters())
    for a,b in zip(old_scenarios(),scenarios(),strict=True):
        assert a.knots==b.knots and a.warmup_knots==b.warmup_knots
        assert a.far_pipe_multiplier==b.far_pipe_multiplier
        for hour in (-72,0,6,24):
            assert a.weather(hour*3600,warmup=hour<0)==b.weather(hour*3600,warmup=hour<0)
        assert b.parameters()==fixture.design_load_parameters(a.parameters())
