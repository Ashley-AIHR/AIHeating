"""Convex local MPC; callbacks retain P1A/P5 as nonlinear authorities."""
from dataclasses import asdict, dataclass
from hashlib import sha256
import json
from time import perf_counter
from typing import Callable, Mapping, Sequence

import cvxpy as cp
import numpy as np

from ..contracts import Controls


MPC_VERSION = "p6-mpc-v1"
LINEARISATION_VERSION = "p6-linearisation-v1"
SAFETY_VERSION = "p6-safety-policy-v1"
ACTUATORS = ("supplyC", "pumpHz", "nearValve", "midValve", "farValve")
FORBIDDEN_FORECAST_TOKENS = (
    "actual", "truth", "required_heat", "indoor", "scenario", "parameter",
    "episode", "split", "seed",
)


def assert_causal_forecast(rows: Sequence[Mapping[str, object]]) -> None:
    if not rows:
        raise ValueError("issued forecast is required")
    bad = sorted({key for row in rows for key in row
                  if any(token in key.lower() for token in FORBIDDEN_FORECAST_TOKENS)})
    if bad:
        raise ValueError(f"MPC forecast boundary rejected fields: {bad}")
    required = {"forecast_as_of", "horizon_minutes", "forecast_outdoor_temperature_c",
                "forecast_solar_radiation_w_m2", "forecast_wind_m_s"}
    missing = required - set(rows[0])
    if missing:
        raise ValueError(f"issued forecast missing fields: {sorted(missing)}")


def controls_to_array(controls: Sequence[Controls]) -> np.ndarray:
    return np.asarray([[item.supply_c, item.frequency_hz, *item.valves]
                       for item in controls], dtype=float)


def array_to_controls(values: np.ndarray) -> tuple[Controls, ...]:
    return tuple(Controls(float(row[0]), float(row[1]), tuple(map(float, row[2:])))
                 for row in values)


def legal_trajectory(current: Controls, trajectory: Sequence[Controls]) -> bool:
    previous = current
    try:
        for controls in trajectory:
            controls.validate(previous)
            previous = controls
    except ValueError:
        return False
    return True


@dataclass(frozen=True)
class NonlinearRollout:
    building_ids: tuple[str, ...]
    building_temperature_c: np.ndarray
    actual_heat_mw: np.ndarray
    zone_flow_m3_h: np.ndarray
    pump_power_kw: np.ndarray
    all_hydraulic_converged: bool
    maximum_mass_residual: float
    all_finite: bool


@dataclass(frozen=True)
class LinearSurrogate:
    version: str
    center_controls: tuple[Controls, ...]
    reference: NonlinearRollout
    temperature_jacobian: np.ndarray
    heat_jacobian: np.ndarray
    flow_jacobian: np.ndarray
    pump_jacobian: np.ndarray
    difference_rules: tuple[str, ...]
    perturbations: tuple[float, ...]

    def predict(self, controls: Sequence[Controls]) -> NonlinearRollout:
        delta = (controls_to_array(controls) - controls_to_array(self.center_controls)).reshape(-1)
        ref = self.reference
        return NonlinearRollout(ref.building_ids,
            (ref.building_temperature_c.reshape(-1) + self.temperature_jacobian @ delta)
                .reshape(ref.building_temperature_c.shape),
            ref.actual_heat_mw + self.heat_jacobian @ delta,
            (ref.zone_flow_m3_h.reshape(-1) + self.flow_jacobian @ delta)
                .reshape(ref.zone_flow_m3_h.shape),
            ref.pump_power_kw + self.pump_jacobian @ delta,
            ref.all_hydraulic_converged, ref.maximum_mass_residual, True)


def _output_difference(a: NonlinearRollout, b: NonlinearRollout, divisor: float):
    return ((a.building_temperature_c - b.building_temperature_c).reshape(-1) / divisor,
            (a.actual_heat_mw - b.actual_heat_mw) / divisor,
            (a.zone_flow_m3_h - b.zone_flow_m3_h).reshape(-1) / divisor,
            (a.pump_power_kw - b.pump_power_kw) / divisor)


def build_linearisation(current: Controls, center: Sequence[Controls],
                        rollout: Callable[[Sequence[Controls]], NonlinearRollout],
                        perturbations: Sequence[float]) -> LinearSurrogate:
    center = tuple(center)
    reference = rollout(center)
    values = controls_to_array(center)
    columns = []
    rules = []
    for flat_index in range(values.size):
        row, column = divmod(flat_index, values.shape[1])
        step = float(perturbations[column])
        plus_values, minus_values = values.copy(), values.copy()
        plus_values[row, column] += step
        minus_values[row, column] -= step
        plus = array_to_controls(plus_values)
        minus = array_to_controls(minus_values)
        plus_legal, minus_legal = (legal_trajectory(current, plus),
                                   legal_trajectory(current, minus))
        if plus_legal and minus_legal:
            columns.append(_output_difference(rollout(plus), rollout(minus), 2 * step))
            rules.append("central")
        elif plus_legal:
            columns.append(_output_difference(rollout(plus), reference, step))
            rules.append("forward")
        elif minus_legal:
            columns.append(_output_difference(reference, rollout(minus), step))
            rules.append("backward")
        else:
            sizes = (reference.building_temperature_c.size,
                     reference.actual_heat_mw.size, reference.zone_flow_m3_h.size,
                     reference.pump_power_kw.size)
            columns.append(tuple(np.zeros(size) for size in sizes))
            rules.append("fixed-at-rate-boundary")
    return LinearSurrogate(LINEARISATION_VERSION, center, reference,
        np.column_stack([item[0] for item in columns]),
        np.column_stack([item[1] for item in columns]),
        np.column_stack([item[2] for item in columns]),
        np.column_stack([item[3] for item in columns]), tuple(rules),
        tuple(map(float, perturbations)))


@dataclass(frozen=True)
class MPCRecommendation:
    recommendation_id: str
    forecast_as_of: str
    horizon_minutes: int
    control_step_minutes: int
    supply_trajectory_c: tuple[float, ...]
    pump_trajectory_hz: tuple[float, ...]
    valve_trajectories_fraction: dict[str, tuple[float, ...]]
    first_action: Controls
    objective_components: dict[str, float | None]
    solver: str
    solver_status: str
    solve_time_s: float
    solver_iterations: int
    predicted_building_trajectories_c: dict[str, tuple[float, ...]]
    prediction_half_widths_c: tuple[float, ...]
    nonlinear_verification_status: str
    fallback_status: str
    fallback_reason: str | None
    model_versions: dict[str, str]
    constraint_margins: dict[str, float]
    relinearisation_count: int


class FormalSupervisoryMPC:
    version = MPC_VERSION

    def __init__(self, mpc_config, sensitivity_config, objective_config,
                 safety_config, solver_config):
        self.mpc = mpc_config
        self.sensitivity = sensitivity_config
        self.objective = objective_config
        self.safety = safety_config
        self.solver = solver_config
        if (self.mpc["horizonMinutes"], self.mpc["controlStepMinutes"],
                self.mpc["controlIntervals"]) != (180, 30, 6):
            raise ValueError("P6 v1 requires six 30-minute intervals")
        if self.solver["primarySolver"] != "OSQP":
            raise ValueError("P6 v1 requires OSQP")

    def _solve(self, current, surrogate, demand_mw, half_widths_c,
               actuator_mode, trust_scale):
        n, dimensions = 6, 5
        center = controls_to_array(surrogate.center_controls)
        variable = cp.Variable((n, dimensions))
        delta = cp.reshape(variable - center, (n * dimensions,), order="C")
        ref = surrogate.reference
        temperature = cp.reshape(ref.building_temperature_c.reshape(-1)
            + surrogate.temperature_jacobian @ delta,
            ref.building_temperature_c.shape, order="C")
        heat = ref.actual_heat_mw + surrogate.heat_jacobian @ delta
        pump = ref.pump_power_kw + surrogate.pump_jacobian @ delta
        bounds = self.mpc["equipmentBounds"]
        rates = np.asarray([2, 2, .1, .1, .1])
        trust = np.asarray([2, 2, .1, .1, .1]) * trust_scale
        tolerance_margin = float(self.solver["constraintInteriorMargin"])
        constraints = [variable[:, 0] >= bounds["supplyC"][0] + tolerance_margin,
            variable[:, 0] <= bounds["supplyC"][1] - tolerance_margin,
            variable[:, 1] >= bounds["pumpHz"][0] + tolerance_margin,
            variable[:, 1] <= bounds["pumpHz"][1] - tolerance_margin,
            variable[:, 2:] >= bounds["valveFraction"][0] + tolerance_margin,
            variable[:, 2:] <= bounds["valveFraction"][1] - tolerance_margin,
            cp.abs(variable - center) <= trust - tolerance_margin,
            cp.abs(variable[0] - controls_to_array((current,))[0]) <= rates - tolerance_margin,
            cp.abs(variable[1:] - variable[:-1]) <= rates - tolerance_margin,
            temperature - np.asarray(half_widths_c)[:, None]
                >= self.safety["hardComplianceFloorC"] + tolerance_margin]
        if actuator_mode == "supply_only":
            constraints.append(variable[:, 1:] == center[:, 1:])
        elif actuator_mode == "supply_pump":
            constraints.append(variable[:, 2:] == center[:, 2:])
        elif actuator_mode != "full":
            raise ValueError("actuator mode must be supply_only, supply_pump or full")
        weights = self.objective["weights"]
        normalization = self.objective["normalization"]
        movement = cp.vstack([variable[0] - controls_to_array((current,))[0],
                              variable[1:] - variable[:-1]]) / np.asarray(normalization["movement"])
        expressions = {
            "avoidableOversupply": cp.sum(cp.pos(heat - np.asarray(demand_mw)))
                / normalization["heatMW"],
            "pumpElectricity": cp.sum(cp.pos(pump)) / normalization["pumpKW"],
            "belowComfort": cp.sum(cp.pos(20 - temperature)) / temperature.size,
            "aboveComfort": cp.sum(cp.pos(temperature - 22)) / temperature.size,
            "overheating": cp.sum(cp.pos(temperature - 23)) / temperature.size,
            "severeOverheating": cp.sum(cp.pos(temperature - 25)) / temperature.size,
            "movement": cp.sum_squares(movement),
        }
        objective = (weights["normalizedAvoidableOversupply"] * expressions["avoidableOversupply"]
            + weights["normalizedPumpElectricity"] * expressions["pumpElectricity"]
            + weights["belowComfortDegreeHoursBelow20"] * expressions["belowComfort"]
            + weights["aboveComfortDegreeHoursAbove22"] * expressions["aboveComfort"]
            + weights["overheatingDegreeHoursAbove23"] * expressions["overheating"]
            + weights["severeOverheatingDegreeHoursAbove25"] * expressions["severeOverheating"]
            + weights["normalizedControlMovement"] * expressions["movement"])
        problem = cp.Problem(cp.Minimize(objective), constraints)
        if not problem.is_dcp():
            raise ValueError("P6 optimisation problem is not DCP")
        started = perf_counter()
        try:
            problem.solve(solver="OSQP", warm_start=self.solver["warmStart"],
                          **self.solver["settings"])
        except cp.error.SolverError:
            return None, problem, {}, perf_counter() - started
        elapsed = perf_counter() - started
        components = {name: float(value.value) if value.value is not None else None
                      for name, value in expressions.items()}
        if problem.status not in self.solver["acceptedStatuses"] or variable.value is None:
            return None, problem, components, elapsed
        candidate = array_to_controls(np.asarray(variable.value))
        if not legal_trajectory(current, candidate):
            return None, problem, components, elapsed
        return candidate, problem, components, elapsed

    def recommend(self, *, current: Controls, traditional_reference,
                  demand_mw, half_widths_c, forecast_as_of, snapshot_hash,
                  rollout, verify, fallback, model_versions,
                  actuator_mode="full"):
        total_started = perf_counter()
        perturb = self.sensitivity["perturbations"]
        steps = (perturb["supplyC"], perturb["pumpHz"],
                 perturb["valveFraction"], perturb["valveFraction"],
                 perturb["valveFraction"])
        center = tuple(traditional_reference)
        relinearisation_count = 0
        last_problem = None
        total_solver_s = 0.0
        components = {}
        verification = None
        candidate = None
        for attempt in range(2):
            surrogate = build_linearisation(current, center, rollout, steps)
            trust_scale = 1.0 if attempt == 0 else self.mpc["relinearisation"]["trustRegionScale"]
            candidate, problem, components, solve_s = self._solve(
                current, surrogate, demand_mw, half_widths_c, actuator_mode, trust_scale)
            last_problem, total_solver_s = problem, total_solver_s + solve_s
            if candidate is None:
                break
            verification = verify(candidate, half_widths_c)
            if verification["passed"]:
                break
            if attempt == self.mpc["relinearisation"]["maximumAttempts"]:
                candidate = None
                break
            center = candidate
            relinearisation_count = 1
        fallback_reason = None
        if candidate is None:
            candidate = tuple(fallback)
            verification = verify(candidate, half_widths_c)
            status = last_problem.status if last_problem is not None else "solver_error"
            fallback_reason = ("QP infeasible/invalid" if status not in
                self.solver["acceptedStatuses"] else "nonlinear verification failed")
            fallback_status = "fallback_verified" if verification["passed"] else "fallback_unverified"
            verification_status = fallback_status
        else:
            status = last_problem.status
            fallback_status = "not_used"
            verification_status = "passed"
        exact = verification["rollout"]
        values = controls_to_array(candidate)
        min_equipment = min(values[:, 0].min() - 40, 60 - values[:, 0].max(),
            values[:, 1].min() - 30, 50 - values[:, 1].max(),
            values[:, 2:].min() - .2, 1 - values[:, 2:].max())
        rate_values = np.vstack([values[0] - controls_to_array((current,))[0],
                                 values[1:] - values[:-1]])
        min_rate = float(np.min(np.asarray([2, 2, .1, .1, .1]) - np.abs(rate_values)))
        digest_payload = json.dumps({"version": self.version, "forecastAsOf": forecast_as_of,
            "snapshotHash": snapshot_hash, "actuatorMode": actuator_mode,
            "trajectory": values.tolist()}, sort_keys=True, separators=(",", ":"))
        recommendation_id = "p6-" + sha256(digest_payload.encode()).hexdigest()[:20]
        temperatures = {building_id: tuple(map(float, exact.building_temperature_c[:, index]))
            for index, building_id in enumerate(exact.building_ids)}
        stats = getattr(last_problem, "solver_stats", None)
        return MPCRecommendation(recommendation_id, forecast_as_of, 180, 30,
            tuple(map(float, values[:, 0])), tuple(map(float, values[:, 1])),
            {zone: tuple(map(float, values[:, index]))
             for index, zone in enumerate(("near", "mid", "far"), 2)}, candidate[0],
            components, "OSQP", status, perf_counter() - total_started,
            int(stats.num_iters or 0) if stats else 0, temperatures,
            tuple(map(float, half_widths_c)), verification_status, fallback_status,
            fallback_reason, dict(model_versions),
            {"minimumEquipmentMargin": float(min_equipment),
             "minimumRateMargin": min_rate,
             "minimumRobustTemperatureMarginC": float(
                verification["minimumLowerBoundC"] - self.safety["hardComplianceFloorC"]),
             "maximumMassResidual": float(exact.maximum_mass_residual),
             "solverTimeS": total_solver_s}, relinearisation_count)
