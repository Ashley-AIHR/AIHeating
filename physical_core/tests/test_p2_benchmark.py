from copy import deepcopy
from dataclasses import asdict, replace
import json

import pytest

from ai_heating_core.benchmark.metrics import thermal_metrics
from ai_heating_core.benchmark.runner import convergence, evaluate, run_baseline, serialized_output, warm_up
from ai_heating_core.benchmark.state import restore, stable_json
from ai_heating_core.control.traditional import ControllerConfig, TraditionalHeatingController
from ai_heating_core.p2_scenarios import scenarios


@pytest.fixture(scope="module")
def config():
    return ControllerConfig(warmup_hours=96)


@pytest.fixture(scope="module")
def results(config):
    return {s.scenario_id:run_baseline(s,config) for s in scenarios()}


def test_warmup_fallback_converges(config):
    check = convergence(scenarios()[0],config,(96,120))
    assert check["maxIndoorDifferenceC"] < .2
    assert check["maxDeliveredSupplyDifferenceC"] < 1e-10
    assert check["maxFlowDifferenceM3s"] < 1e-10


@pytest.mark.parametrize("scenario_id", [s.scenario_id for s in scenarios()])
def test_all_five_stability_bounds_rates_and_energy(results,config,scenario_id):
    run = results[scenario_id]
    assert len(run.frames)==288
    assert run.frames[0].elapsed_s==300 and run.frames[-1].elapsed_s==86400
    stable_json(serialized_output(run))
    previous = restore(run.initial_state,next(s for s in scenarios() if s.scenario_id==scenario_id).parameters(),config)[0].controls
    for f,cs in zip(run.frames,run.controller_states):
        f.controls.validate(previous)
        assert f.controls.valves==config.valves
        if (f.elapsed_s-f.dt_s)%1800:
            assert f.controls==previous
        assert f.hydraulics.solver.status=="converged"
        assert f.hydraulics.solver.normalized_residual<1e-5
        assert f.mass_residual<1e-6 and f.heat_balance_residual<1e-5
        assert f.pipe_heat_balance_residual<1e-5 and f.building_heat_balance_residual<1e-5
        assert f.pipe_volume_residual<1e-10
        assert f.station_return_c<=f.controls.supply_c
        assert f.hydraulics.pump_power_w>=0 and min(f.hydraulics.flows_m3_s)>=0
        for z in f.zone_return_c:
            assert f.zone_return_c[z]<=f.delivered_supply_c[z]
        assert all(-10<s.indoor_temperature_c<50 for s in f.buildings.values())
        previous=f.controls
    # Lifetime accumulators include warmup; the official metric must subtract it.
    energy=run.frames[-1].heat_energy_j-run.initial_state["heatEnergyJ"]
    assert run.summary["heatEnergyMWh"]==pytest.approx(energy/3.6e9,abs=1e-11)
    assert run.frames[-1].heat_energy_j>energy*2
    assert run.summary["solverFailureCount"]==0


def test_normal_adequacy(results):
    assert results["normal_winter"].summary["complianceRate"]>=.95


@pytest.mark.parametrize("scenario_id", [s.scenario_id for s in scenarios()])
def test_restore_and_reproducibility(results,config,scenario_id):
    s=next(s for s in scenarios() if s.scenario_id==scenario_id)
    original=results[scenario_id]
    decoded=json.loads(stable_json(original.initial_state))
    restored=evaluate(s,config,decoded)
    assert asdict(restored.frames[0])==asdict(original.frames[0])
    assert stable_json(serialized_output(restored))==stable_json(serialized_output(original))


def test_hydraulic_disturbance_only_changes_coefficients(results,config):
    normal,imbalance=results["normal_winter"],results["hydraulic_imbalance"]
    assert normal.initial_state["buildingIndoorC"]==imbalance.initial_state["buildingIndoorC"]
    assert normal.initial_state["transport"]==imbalance.initial_state["transport"]
    assert normal.initial_state["previousHydraulicFlowsM3s"]==imbalance.initial_state["previousHydraulicFlowsM3s"]
    assert normal.frames[0].hydraulics.flows_m3_s[2]>imbalance.frames[0].hydraulics.flows_m3_s[2]
    assert normal.frames[0].controls.valves==imbalance.frames[0].controls.valves


def test_indoor_and_solar_have_no_control_feedback(results,config):
    scenario=scenarios()[0]
    original=results["normal_winter"]
    altered=deepcopy(original.initial_state)
    altered["buildingIndoorC"]={k:v+3 for k,v in altered["buildingIndoorC"].items()}
    changed=evaluate(scenario,config,altered)
    assert original.controller_states==changed.controller_states
    assert original.summary!=changed.summary
    sunny=replace(scenario,knots=tuple((h,t,solar+300,wind) for h,t,solar,wind in scenario.knots))
    sunlight=evaluate(sunny,config,original.initial_state)
    assert original.controller_states==sunlight.controller_states
    assert original.summary!=sunlight.summary


def test_metric_thresholds_and_lower_percentiles():
    result=thermal_metrics([17,18,20,21,22,23,25,26])
    assert result["complianceRate"]==7/8
    assert result["comfortRate"]==3/8
    assert result["overheatingRate"]==2/8
    assert result["severeOverheatingRate"]==1/8
    assert result["P10C"]==17 and result["P50C"]==21 and result["P90C"]==25


def test_corrupt_state_rejected(results,config):
    scenario=scenarios()[0]
    value=deepcopy(results["normal_winter"].initial_state)
    value["transport"]["near"]["packets"][0]=(999,50)
    with pytest.raises(ValueError,match="packet"):
        restore(value,scenario.parameters(),config)
    with pytest.raises(ValueError,match="hash"):
        restore(results["normal_winter"].initial_state,scenario.parameters(),replace(config,version="other"))


@pytest.mark.parametrize("dt", [600,900])
def test_other_physical_steps_keep_control_interval(config,dt):
    run=run_baseline(scenarios()[0],config,dt_s=dt)
    assert len(run.frames)==86400//dt
    assert all(s.last_boundary_s%1800==0 for s in run.controller_states)
