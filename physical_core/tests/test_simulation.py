from copy import deepcopy
from dataclasses import asdict, replace
import json
from pathlib import Path
import subprocess

import pytest

from ai_heating_core.adapters import to_p0_frame
from ai_heating_core.contracts import Controls, Weather, ZONES
from ai_heating_core.hydraulics import solve_hydraulics
from ai_heating_core.scenarios import run_canonical
from ai_heating_core.simulation import SimulationEngine


@pytest.fixture(scope="module")
def canonical():
    return run_canonical()


def test_24h_conservation_and_stability(canonical):
    assert len(canonical) == 288 and canonical[-1].elapsed_s == 86400
    for frame in canonical:
        # Serialization rejects NaN/Inf in every numeric field, not just selected KPIs.
        json.dumps(asdict(frame), allow_nan=False)
        assert frame.hydraulics.solver.status == "converged"
        assert frame.hydraulics.solver.normalized_residual < 1e-5
        assert frame.mass_residual < 1e-6
        assert frame.heat_balance_residual < 1e-5
        assert frame.pipe_heat_balance_residual < 1e-5
        assert frame.building_heat_balance_residual < 1e-5
        assert frame.pipe_volume_residual < 1e-10
        assert all(q >= 0 for q in frame.hydraulics.flows_m3_s)
        assert frame.hydraulics.pump_power_w >= 0
        assert frame.station_return_c <= frame.controls.supply_c
        for z in ZONES:
            assert frame.zone_heat_residual[z] < 1e-5
            assert frame.zone_return_c[z] <= frame.delivered_supply_c[z]
        for state in frame.buildings.values():
            assert -10 < state.indoor_temperature_c < 50


def test_5_vs_10_minute_smooth_scenario():
    a, b = run_canonical(300, scheduled=False)[-1], run_canonical(600, scheduled=False)[-1]
    difference = max(abs(a.buildings[key].indoor_temperature_c - b.buildings[key].indoor_temperature_c) for key in a.buildings)
    assert difference < .3


def test_15_minute_stability_and_determinism(canonical):
    assert canonical == run_canonical()
    frames = run_canonical(900)
    assert len(frames) == 96
    assert all(-10 < s.indoor_temperature_c < 50 for f in frames for s in f.buildings.values())


def test_transport_vs_inertia_integrated():
    baseline, changed = SimulationEngine(), SimulationEngine()
    control = replace(changed.controls, supply_c=52)  # legal +2°C change
    first_delivery, first_heat, first_indoor = {}, {}, {}
    for _ in range(20):
        a = baseline.step(Weather(-5, 0))
        b = changed.step(Weather(-5, 0), control)
        for profile in baseline.parameters.buildings:
            key, zone = profile.building_id, profile.zone
            delta_supply = b.delivered_supply_c[zone] - a.delivered_supply_c[zone]
            delta_heat = b.buildings[key].heating_power_w - a.buildings[key].heating_power_w
            delta_indoor = b.buildings[key].indoor_temperature_c - a.buildings[key].indoor_temperature_c
            if delta_supply > 1e-9:
                first_delivery.setdefault(zone, b.elapsed_s)
            else:
                assert delta_heat == 0 and delta_indoor == 0
            if delta_heat > 1e-8:
                first_heat.setdefault(key, b.elapsed_s)
            if delta_indoor > 1e-10:
                first_indoor.setdefault(key, b.elapsed_s)
                assert 0 < delta_indoor < 2
    assert first_delivery["near"] < first_delivery["mid"] < first_delivery["far"]
    for profile in baseline.parameters.buildings:
        assert first_delivery[profile.zone] == first_heat[profile.building_id] == first_indoor[profile.building_id]


def test_solver_failure_and_invalid_command_leave_state_unchanged(monkeypatch):
    from ai_heating_core.hydraulics import HydraulicFailure
    import ai_heating_core.simulation as simulation
    engine = SimulationEngine()
    before = deepcopy(vars(engine))
    monkeypatch.setattr(simulation, "solve_hydraulics", lambda p, c, previous: solve_hydraulics(p, c, previous, max_nfev=1))
    with pytest.raises(HydraulicFailure):
        engine.step(Weather(-5, 0))
    assert engine.elapsed_s == before["elapsed_s"]
    assert engine.temperatures == before["temperatures"]
    assert engine.previous_flows is None
    for zone in ZONES:
        assert vars(engine.buffers[zone]) == vars(before["buffers"][zone])
    with pytest.raises(ValueError):
        engine.step(Weather(-5, 0), Controls(55))
    assert engine.elapsed_s == 0


def test_independent_control_interval_and_windows():
    engine = SimulationEngine()
    engine.step(Weather(-5, 0))
    with pytest.raises(ValueError, match="control boundary"):
        engine.step(Weather(-5, 0), Controls(52))
    with pytest.raises(ValueError, match="unknown building"):
        engine.step(Weather(-5, 0), windows={"B13": .5})
    for _ in range(5):
        engine.step(Weather(-5, 0))
    engine.step(Weather(-5, 0), Controls(52))


def test_adapter_against_frozen_types(canonical, tmp_path):
    payload = to_p0_frame(canonical[-1])
    assert payload["source"] == "simulation_engine"
    assert payload["solver"]["status"] == "converged"
    assert len(payload["buildingStates"]) == 12
    assert all(set(state) == {"indoorTemperatureC"} for state in payload["buildingStates"].values())
    assert payload["metrics"]["heatSupplyMw"] == payload["networkState"]["currentHeatSupplyMw"]
    assert payload["metrics"]["pumpPowerKw"] == canonical[-1].hydraulics.pump_power_w / 1000
    path = tmp_path / "frame.json"
    path.write_text(json.dumps(payload, allow_nan=False))
    script = Path(__file__).parents[1] / "scripts" / "check-p0-contract.mjs"
    result = subprocess.run(["node", str(script), str(path)], capture_output=True, text=True)
    assert result.returncode == 0, result.stdout + result.stderr


def test_nonuniform_return_is_flow_weighted(canonical):
    frame = canonical[-1]
    p = SimulationEngine().parameters
    for zone in ZONES:
        states = [frame.buildings[b.building_id] for b in p.buildings if b.zone == zone]
        weighted = sum(s.radiator_return_temperature_c * s.building_water_flow_kg_s for s in states) / sum(s.building_water_flow_kg_s for s in states)
        assert frame.zone_return_c[zone] == pytest.approx(weighted)
    mean = sum(frame.zone_return_c.values()) / 3
    assert abs(frame.station_return_c - mean) > .001
