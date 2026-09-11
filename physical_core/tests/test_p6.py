import json
from pathlib import Path

import numpy as np
import pytest

from ai_heating_core.contracts import Controls
from ai_heating_core.p6.mpc import (
    FormalSupervisoryMPC,
    NonlinearRollout,
    assert_causal_forecast,
    build_linearisation,
    controls_to_array,
    legal_trajectory,
)


ROOT = Path(__file__).resolve().parents[2]


def payload(name):
    return json.loads((ROOT / name).read_text())


def linear_rollout(trajectory):
    values = controls_to_array(trajectory)
    supply = values[:, 0] - 50
    pump = values[:, 1] - 40
    valves = values[:, 2:] - .5
    temperature = 21 + np.cumsum(.015 * supply + .003 * pump
                                  + .02 * valves.mean(axis=1))[:, None]
    temperature = np.c_[temperature, temperature - .1]
    return NonlinearRollout(("B01", "B02"), temperature,
        .4 + .01 * supply + .002 * pump, 12 + 2 * valves,
        8 + .5 * pump, True, 1e-12, True)


def optimiser():
    return FormalSupervisoryMPC(payload("p6_mpc_config.json"),
        payload("p6_sensitivity_config.json"),
        payload("p6_mpc_objective_v1.json"),
        payload("p6_safety_policy_v1.json"),
        payload("p6_solver_config.json"))


def test_forecast_guard_rejects_truth_and_requires_issued_fields():
    clean = {"forecast_as_of": "t0", "horizon_minutes": 30,
        "forecast_outdoor_temperature_c": -5,
        "forecast_solar_radiation_w_m2": 0, "forecast_wind_m_s": 2}
    assert_causal_forecast([clean])
    with pytest.raises(ValueError, match="rejected"):
        assert_causal_forecast([{**clean, "future_actual_outdoor_c": -7}])


def test_linearisation_is_deterministic_and_exact_for_linear_callback():
    current = Controls(50, 40, (.5, .5, .5))
    reference = (current,) * 6
    steps = (.5, .5, .02, .02, .02)
    first = build_linearisation(current, reference, linear_rollout, steps)
    second = build_linearisation(current, reference, linear_rollout, steps)
    assert np.array_equal(first.temperature_jacobian, second.temperature_jacobian)
    candidate = tuple(Controls(49.5, 39.5, (.48, .5, .52)) for _ in range(6))
    assert np.max(np.abs(first.predict(candidate).building_temperature_c
                         - linear_rollout(candidate).building_temperature_c)) < 1e-12
    assert set(first.difference_rules) == {"central"}


def test_mpc_solution_is_constrained_verified_and_deterministic():
    current = Controls(50, 40, (.5, .5, .5))
    reference = (current,) * 6
    verify = lambda trajectory, widths: {
        "passed": float(np.min(linear_rollout(trajectory).building_temperature_c
                               - np.asarray(widths)[:, None])) >= 18,
        "minimumLowerBoundC": float(np.min(
            linear_rollout(trajectory).building_temperature_c
            - np.asarray(widths)[:, None])),
        "rollout": linear_rollout(trajectory)}
    arguments = dict(current=current, traditional_reference=reference,
        demand_mw=(.35,) * 6, half_widths_c=(.1,) * 6,
        forecast_as_of="t0", snapshot_hash="snapshot", rollout=linear_rollout,
        verify=verify, fallback=reference,
        model_versions={"p4": "selected-p4-predictor-v1",
                        "p5": "p5-thermal-model-v1"})
    first, second = optimiser().recommend(**arguments), optimiser().recommend(**arguments)
    assert first.solver == "OSQP" and first.solver_status in ("optimal", "optimal_inaccurate")
    assert first.nonlinear_verification_status == "passed"
    assert first.fallback_status == "not_used"
    assert first.recommendation_id == second.recommendation_id
    assert first.supply_trajectory_c == second.supply_trajectory_c
    assert legal_trajectory(current, tuple(Controls(s, p,
        tuple(first.valve_trajectories_fraction[z][i] for z in ("near", "mid", "far")))
        for i, (s, p) in enumerate(zip(first.supply_trajectory_c,
                                       first.pump_trajectory_hz))))
    assert "applied" not in first.__dict__


def test_infeasible_qp_returns_explicit_nonoptimal_fallback():
    current = Controls(50, 40, (.5, .5, .5))
    reference = (current,) * 6
    def verify(trajectory, widths):
        rollout = linear_rollout(trajectory)
        return {"passed": True, "minimumLowerBoundC": 18.1,
                "rollout": rollout}
    result = optimiser().recommend(current=current, traditional_reference=reference,
        demand_mw=(.35,) * 6, half_widths_c=(10,) * 6,
        forecast_as_of="t0", snapshot_hash="snapshot", rollout=linear_rollout,
        verify=verify, fallback=reference, model_versions={}, actuator_mode="full")
    assert result.solver_status in ("infeasible", "infeasible_inaccurate")
    assert result.fallback_status == "fallback_verified"
    assert result.nonlinear_verification_status == "fallback_verified"
    assert result.fallback_reason == "QP infeasible/invalid"


def test_ablation_modes_keep_disabled_actuators_on_reference():
    current = Controls(50, 40, (.5, .5, .5))
    reference = (current,) * 6
    def verify(trajectory, widths):
        rollout = linear_rollout(trajectory)
        return {"passed": True, "minimumLowerBoundC": 20,
                "rollout": rollout}
    common = dict(current=current, traditional_reference=reference,
        demand_mw=(.35,) * 6, half_widths_c=(.1,) * 6,
        forecast_as_of="t0", snapshot_hash="snapshot", rollout=linear_rollout,
        verify=verify, fallback=reference, model_versions={})
    supply = optimiser().recommend(**common, actuator_mode="supply_only")
    supply_pump = optimiser().recommend(**common, actuator_mode="supply_pump")
    assert supply.pump_trajectory_hz == pytest.approx((40,) * 6)
    assert all(values == pytest.approx((.5,) * 6)
               for values in supply.valve_trajectories_fraction.values())
    assert all(values == pytest.approx((.5,) * 6)
               for values in supply_pump.valve_trajectories_fraction.values())
