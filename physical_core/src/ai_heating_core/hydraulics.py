"""Three simultaneously solved branches sharing one pump and common loss."""
from dataclasses import dataclass

import numpy as np
from scipy.optimize import least_squares

from .constants import positive
from .contracts import Controls, LIMITS, SolverDiagnostics
from .parameters import Parameters


class HydraulicFailure(RuntimeError):
    def __init__(self, diagnostics: SolverDiagnostics):
        self.diagnostics = diagnostics
        super().__init__(diagnostics.message)


@dataclass(frozen=True)
class HydraulicResult:
    flows_m3_s: tuple[float, float, float]
    total_flow_m3_s: float
    pump_pressure_pa: float
    available_pressure_pa: float
    pump_power_w: float
    mass_residual: float
    solver: SolverDiagnostics


def valve_resistance(reference_k: float, opening: float) -> float:
    positive("valve resistance", reference_k)
    if not LIMITS.valve_min <= opening <= LIMITS.valve_max:
        raise ValueError("valve opening outside equipment bounds")
    return reference_k / max(opening, LIMITS.valve_min) ** 2


def pump_head(p: Parameters, total_flow_m3_s: float, frequency_hz: float) -> float:
    positive("total flow", total_flow_m3_s, allow_zero=True)
    if not LIMITS.frequency_min_hz <= frequency_hz <= LIMITS.frequency_max_hz:
        raise ValueError("frequency outside equipment bounds")
    return p.pump.shutoff_head_m * (frequency_hz / p.pump.reference_frequency_hz) ** 2 - p.pump.curve_a_s2_m5 * total_flow_m3_s ** 2


def solve_hydraulics(p: Parameters, controls: Controls, previous=None, *, max_nfev=100) -> HydraulicResult:
    controls.validate()
    rho_g = p.water.rho_water * p.water.g
    shutoff_pa = rho_g * p.pump.shutoff_head_m * (controls.frequency_hz / p.pump.reference_frequency_hz) ** 2
    coupled_k = rho_g * p.pump.curve_a_s2_m5 + p.common_k_pa_s2_m6
    branch_k = np.array([b.pipe_k_pa_s2_m6 + valve_resistance(b.valve_ref_k_pa_s2_m6, u)
                         for b, u in zip(p.branches, controls.valves)])
    # Characteristic physical scale, not an expected flow answer.
    flow_scale = np.sqrt(shutoff_pa / (9 * coupled_k + np.mean(branch_k)))

    def residual(q):
        return (shutoff_pa - coupled_k * np.sum(q) ** 2 - branch_k * q ** 2) / shutoff_pa

    def jacobian(q):
        return (-2 * coupled_k * np.sum(q) * np.ones((3, 3)) - np.diag(2 * branch_k * q)) / shutoff_pa

    initial = np.array(previous if previous is not None else [flow_scale] * 3, dtype=float)
    if initial.shape != (3,) or not np.all(np.isfinite(initial)) or np.any(initial < 0):
        raise ValueError("warm start must contain three finite nonnegative SI flows")
    try:
        result = least_squares(residual, initial, jac=jacobian, bounds=(0, np.inf),
                               x_scale=flow_scale, ftol=1e-12, xtol=1e-12, gtol=1e-12, max_nfev=max_nfev)
    except (ValueError, FloatingPointError) as exc:
        raise HydraulicFailure(SolverDiagnostics("failed", None, 0, str(exc))) from exc
    norm = float(np.max(np.abs(residual(result.x))))
    if not result.success or not np.isfinite(norm) or norm >= 1e-8:
        raise HydraulicFailure(SolverDiagnostics("failed", norm, result.nfev, str(result.message)))
    flows = tuple(float(q) for q in result.x)
    total = sum(flows)
    pump_pa = rho_g * pump_head(p, total, controls.frequency_hz)
    available_pa = pump_pa - p.common_k_pa_s2_m6 * total ** 2
    if pump_pa < 0 or available_pa < 0:
        raise HydraulicFailure(SolverDiagnostics("infeasible", norm, result.nfev, "negative operating pressure"))
    return HydraulicResult(flows, total, pump_pa, available_pa,
        pump_pa * total / p.pump.efficiency, abs(total - sum(flows)) / max(total, 1e-15),
        SolverDiagnostics("converged", norm, result.nfev, str(result.message)))
