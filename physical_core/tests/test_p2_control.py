from dataclasses import asdict, replace
import inspect
import json

import pytest

from ai_heating_core.control.commissioning import commission
from ai_heating_core.control.traditional import (ControllerConfig, ControllerState, TraditionalHeatingController,
    config_from_dict, config_to_dict, interpolate)
from ai_heating_core.parameters import synthetic_parameters
from ai_heating_core.p2_scenarios import scenarios


@pytest.mark.parametrize("attribute,bounds", [("supply_curve",(40,60)),("pump_curve",(30,50))])
def test_curves_monotonic_and_bounded(attribute,bounds):
    curve = getattr(ControllerConfig(), attribute)
    values = [interpolate(curve,t/10) for t in range(-200,151)]
    assert all(a>=b for a,b in zip(values,values[1:]))
    assert min(values)>=bounds[0] and max(values)<=bounds[1]
    assert interpolate(curve,-100)==curve[0][1]
    assert interpolate(curve,100)==curve[-1][1]


def test_commissioning_improves_static_shares_with_rounding():
    result = commission(synthetic_parameters())
    assert result["finalNormalizedShareMismatch"] < result["preNormalizedShareMismatch"]
    assert result["finalNormalizedShareMismatch"] > 0
    assert all(.2<=v<=1 for v in result["fixedValveFractions"])
    assert result["fixedValveFractions"] == ControllerConfig().valves
    assert result == commission(synthetic_parameters())


def test_boundaries_slew_and_no_extra_lag():
    c = TraditionalHeatingController(ControllerConfig())
    state = c.initialize(0,-15)
    for timestamp in range(300,1800,300):
        assert c.update(timestamp,10,state)==state
    changed = c.update(1800,10,state)
    assert changed.applied_supply_c==state.applied_supply_c-2
    assert changed.applied_pump_hz==state.applied_pump_hz-2
    assert changed.fixed_valves==state.fixed_valves
    assert changed.raw_supply_target_c==40
    assert changed.next_boundary_s==3600
    near = c.initialize(0,-5)
    small = c.update(1800,-4,near)
    assert small.applied_supply_c==small.raw_supply_target_c


def test_future_and_indoor_solar_data_are_not_controller_inputs():
    c = TraditionalHeatingController(ControllerConfig())
    scenario = scenarios()[0]
    alternative = replace(scenario, knots=((0,-8,20,3),(1,15,900,10),(24,15,900,10)))
    state = c.initialize(-1800,-8)
    assert scenario.weather(0)==alternative.weather(0)
    assert scenario.weather(3600)!=alternative.weather(3600)
    assert c.update(0,scenario.weather(0).outdoor_c,state)==c.update(0,alternative.weather(0).outdoor_c,state)
    assert set(inspect.signature(c.update).parameters)=={"timestamp_s","outdoor_c","state"}
    # Unknown indoor/solar/prediction inputs cannot be supplied accidentally.
    for field in ("indoor_c","solar_w_m2","forecast","prediction","optimisation_result"):
        with pytest.raises(TypeError):
            c.update(0,-8,state,**{field:99})


def test_serialized_controller_and_config_roundtrip():
    config = ControllerConfig()
    assert config_from_dict(json.loads(json.dumps(config_to_dict(config)))) == config
    c = TraditionalHeatingController(config)
    s = c.update(1800,5,c.initialize(0,-10))
    restored = ControllerState.from_dict(json.loads(json.dumps(asdict(s))))
    assert restored == s
    assert c.update(3600,0,restored)==c.update(3600,0,s)


@pytest.mark.parametrize("patch", [{"interval_s":300}, {"warmup_hours":24}, {"supply_slew_c":5},
    {"supply_curve":((-10,40),(0,60))}, {"pump_curve":((-10,60),(0,40))}, {"valves":(.1,.6,.6)}])
def test_invalid_configs(patch):
    with pytest.raises(ValueError):
        ControllerConfig(**patch)


def test_invalid_clock_and_state():
    c = TraditionalHeatingController(ControllerConfig())
    s = c.initialize(0,-5)
    for timestamp in (-1,3600):
        with pytest.raises(ValueError):
            c.update(timestamp,-5,s)
    with pytest.raises(ValueError):
        c.update(0,float("nan"),s)
