from dataclasses import replace

import pytest

from ai_heating_core.contracts import Controls
from ai_heating_core.hydraulics import HydraulicFailure, pump_head, solve_hydraulics, valve_resistance
from ai_heating_core.parameters import synthetic_parameters


def test_H1_H2_conservation_and_independent_equation_residual():
    p, c = synthetic_parameters(), Controls()
    h = solve_hydraulics(p, c)
    assert h.mass_residual < 1e-6
    assert h.solver.status == "converged" and h.solver.normalized_residual < 1e-5
    for b, u, q in zip(p.branches, c.valves, h.flows_m3_s):
        branch_dp = (b.pipe_k_pa_s2_m6 + b.valve_ref_k_pa_s2_m6 / u**2) * q**2
        assert abs(branch_dp - h.available_pressure_pa) / h.pump_pressure_pa < 1e-5


def test_H3_H4_coupled_valve():
    p, c = synthetic_parameters(), Controls()
    base = solve_hydraulics(p, c)
    opened = solve_hydraulics(p, replace(c, valves=(.8, .6, .6)))
    closed = solve_hydraulics(p, replace(c, valves=(.5, .6, .6)))
    assert opened.flows_m3_s[0] / base.flows_m3_s[0] >= 1.05
    assert min(opened.flows_m3_s[i] / base.flows_m3_s[i] for i in (1, 2)) <= .99
    assert opened.available_pressure_pa != base.available_pressure_pa
    assert closed.flows_m3_s[2] > opened.flows_m3_s[2]


def test_H5_frequency_and_pump_curve():
    p, c = synthetic_parameters(), Controls()
    a, b = solve_hydraulics(p, c), solve_hydraulics(p, replace(c, frequency_hz=47))
    assert b.total_flow_m3_s > a.total_flow_m3_s
    assert all(y > x for x, y in zip(a.flows_m3_s, b.flows_m3_s))
    assert b.pump_pressure_pa > a.pump_pressure_pa
    assert pump_head(p, .01, 45) > pump_head(p, .02, 45)
    assert valve_resistance(1e9, .4) > valve_resistance(1e9, .8)


def test_failure_is_explicit():
    with pytest.raises(HydraulicFailure) as failure:
        solve_hydraulics(synthetic_parameters(), Controls(), max_nfev=1)
    assert failure.value.diagnostics.status == "failed"


def test_solver_exception_does_not_invent_residual():
    with pytest.raises(HydraulicFailure) as failure:
        solve_hydraulics(synthetic_parameters(), Controls(), max_nfev=0)
    assert failure.value.diagnostics.normalized_residual is None
