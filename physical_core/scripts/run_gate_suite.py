"""Recompute measured engineering Gates and export machine/human evidence."""
from dataclasses import asdict, replace
import hashlib
import json
from math import isfinite
from pathlib import Path
import platform
import subprocess
import tempfile

import numpy as np
import scipy

from ai_heating_core.adapters import to_p0_frame
from ai_heating_core.constants import WATER
from ai_heating_core.contracts import Controls, Weather, ZONES, validate_timestep, validate_window
from ai_heating_core.hydraulics import HydraulicFailure, solve_hydraulics
from ai_heating_core.parameters import TRANSPORT_REFERENCES, synthetic_parameters
from ai_heating_core.scenarios import HydraulicImbalanceGateFixture, run_canonical
from ai_heating_core.simulation import SimulationEngine
from ai_heating_core.thermal import advance_building, envelope_loss, radiator, required_load
from ai_heating_core.transport import DelayLine, OutletSegment
from ai_heating_core.units import m3h_to_m3s, m3s_to_m3h, seconds_to_minutes

ROOT = Path(__file__).resolve().parents[2]


def flow_values(result):
    return {**{z + "_flow_m3_h": m3s_to_m3h(q) for z, q in zip(ZONES, result.flows_m3_s)},
            "total_flow_m3_h": m3s_to_m3h(result.total_flow_m3_s),
            "pump_pressure_pa": result.pump_pressure_pa, "available_pressure_pa": result.available_pressure_pa,
            "normalized_residual": result.solver.normalized_residual}


def measure_arrival(volume, flow):
    line = DelayLine(volume, 45)
    for step in range(1, 40):
        line.advance(50, flow, 300)
        if line.delivered_supply_c >= 45.25:
            return step * 300
    raise AssertionError("transport step did not arrive within diagnostic window")


def evaluate_gates():
    records = []

    def record(gate, description, inputs, baseline, changed, measured, thresholds, passed, residual=None):
        records.append({"gate": gate, "description": description, "inputs": inputs,
            "baseline_output": baseline, "changed_input": changed, "measured": measured,
            "thresholds": thresholds, "residual": residual, "status": "PASS" if passed else "FAIL"})

    fixture = HydraulicImbalanceGateFixture.create()
    p, c = fixture.parameters, fixture.controls
    base = solve_hydraulics(p, c)
    opened = solve_hydraulics(p, replace(c, valves=(.8, .6, .6)), base.flows_m3_s)
    closed = solve_hydraulics(p, replace(c, valves=(.5, .6, .6)), opened.flows_m3_s)
    faster = solve_hydraulics(p, replace(c, frequency_hz=47), base.flows_m3_s)
    inputs = {"fixture": "HydraulicImbalanceGateFixture", "frequency_hz": 45, "valves_fraction": [.6, .6, .6]}
    record("H1", "Station volumetric mass balance", inputs, flow_values(base), "none",
           {"relative_mass_residual": base.mass_residual}, {"relative_mass_residual_lt": 1e-6}, base.mass_residual < 1e-6, base.mass_residual)
    max_residual = max(h.solver.normalized_residual for h in (base, opened, closed, faster))
    record("H2", "Nonlinear equations converge at all four operating points", inputs, asdict(base.solver),
           {"near_valves": [.8, .5], "frequency_hz": 47}, {"max_normalized_residual": max_residual},
           {"status": "converged", "residual_lt": 1e-5}, all(h.solver.status == "converged" for h in (base, opened, closed, faster)) and max_residual < 1e-5, max_residual)
    changes = {z + "_flow_change_pct": (b / a - 1) * 100 for z, a, b in zip(ZONES, base.flows_m3_s, opened.flows_m3_s)}
    changes["available_dp_change_pct"] = (opened.available_pressure_pa / base.available_pressure_pa - 1) * 100
    record("H3", "Fixed-frequency coupled Near valve opening (fixture-specific)", inputs, flow_values(base),
           {"near_valve_fraction": .8}, {**changes, **flow_values(opened)},
           {"near_min_increase_pct": 5, "other_branch_min_decrease_pct": 1, "shared_dp_changes": True},
           changes["near_flow_change_pct"] >= 5 and min(changes["mid_flow_change_pct"], changes["far_flow_change_pct"]) <= -1 and changes["available_dp_change_pct"] != 0, opened.solver.normalized_residual)
    record("H4", "Reverse coupling", inputs, flow_values(opened), {"near_valve_fraction": .5}, flow_values(closed),
           {"far_flow_gt_near80_case": True}, closed.flows_m3_s[2] > opened.flows_m3_s[2], closed.solver.normalized_residual)
    record("H5", "Pump frequency causality", inputs, flow_values(base), {"frequency_hz": 47}, flow_values(faster),
           {"total_and_all_zone_flows_increase": True, "pump_pressure_changes": True},
           faster.total_flow_m3_s > base.total_flow_m3_s and all(b > a for a, b in zip(base.flows_m3_s, faster.flows_m3_s)) and faster.pump_pressure_pa != base.pump_pressure_pa)

    arrivals = {z: seconds_to_minutes(measure_arrival(b.equivalent_volume_m3, m3h_to_m3s(ref[0])))
                for z, b, ref in zip(ZONES, p.branches, TRANSPORT_REFERENCES)}
    record("D1", "Nominal +5°C transport step and delay ordering", {"initial_c": 45, "nominal_m3_h": [r[0] for r in TRANSPORT_REFERENCES], "dt_s": 300},
           {"delivered_initial_c": 45}, {"inlet_c": 50, "arrival_threshold_c": 45.25}, {"first_arrival_min": arrivals},
           {"nominal_min": [10, 20, 35], "allowed_error_min": 5, "ordering": "far > mid > near"},
           all(abs(arrivals[z] - ref[1]) <= 5 for z, ref in zip(ZONES, TRANSPORT_REFERENCES)) and arrivals["far"] > arrivals["mid"] > arrivals["near"])
    slow_flow = m3h_to_m3s(TRANSPORT_REFERENCES[2][0]) * .8
    slow_arrival = seconds_to_minutes(measure_arrival(p.branches[2].equivalent_volume_m3, slow_flow))
    theoretical = seconds_to_minutes(p.branches[2].equivalent_volume_m3 / slow_flow)
    record("D2", "Flow-dependent Far transport delay", {"volume_m3": p.branches[2].equivalent_volume_m3},
           {"first_arrival_min": arrivals["far"]}, {"flow_multiplier": .8},
           {"first_arrival_min": slow_arrival, "volume_over_flow_min": theoretical},
           {"delay_increases": True, "allowed_error_min": 5}, slow_arrival > arrivals["far"] and abs(slow_arrival - theoretical) <= 5)
    line = DelayLine(3, 45)
    enthalpy_residual, volume_residual = 0, 0
    transport_sequence = [(0.002, 50, 300), (.004, 48, 600), (.01, 55, 900), (0, 40, 300)]
    for flow, temp, dt in transport_sequence:
        before = line.energy_j()
        segments = line.advance(temp, flow, dt)
        incoming = WATER.rho_water * WATER.cp_water * flow * dt * temp
        outgoing = WATER.rho_water * WATER.cp_water * flow * sum(s.duration_s * s.temperature_c for s in segments)
        enthalpy_residual = max(enthalpy_residual, abs(line.energy_j() - before - incoming + outgoing) / max(abs(incoming), 1))
        volume_residual = max(volume_residual, abs(line.volume_m3 - 3) / 3)
    record("D3", "FIFO volume/enthalpy under changing flow, long step, zero flow", {"volume_m3": 3, "initial_c": 45},
           {"initial_volume_m3": 3}, {"sequence_flow_m3_s_inlet_c_dt_s": transport_sequence},
           {"volume_residual": volume_residual, "enthalpy_residual": enthalpy_residual, "zero_flow_delay": line.estimated_delay_s},
           {"residual_lt": 1e-10, "zero_flow_finite_state": True}, max(volume_residual, enthalpy_residual) < 1e-10 and line.estimated_delay_s is None)

    samples = [{"mass_kg_s": m, "heat_w": radiator(50, 21, m, 1500)[0], "return_c": radiator(50, 21, m, 1500)[1]}
               for m in (0, 1e-12, 1e-6, .1, 1, 100)]
    r_inputs = {"supply_c": 50, "indoor_c": 21, "ua_w_k": 1500}
    record("R1", "Nonnegative radiator heat", r_inputs, samples[0], {"mass_kg_s": [s["mass_kg_s"] for s in samples]},
           {"samples": samples}, {"heat_w_min": 0}, all(s["heat_w"] >= 0 for s in samples))
    record("R2", "Heating return bounded by indoor and supply", r_inputs, samples[0], "positive flow sweep",
           {"return_c": [s["return_c"] for s in samples]}, {"return_c_min": 21, "return_c_max": 50}, all(21 <= s["return_c"] <= 50 for s in samples))
    water_error = max(abs(s["heat_w"] - s["mass_kg_s"] * WATER.cp_water * (50 - s["return_c"])) / max(s["heat_w"], 1) for s in samples)
    record("R3", "Radiator water-side energy balance", r_inputs, samples[0], "flow sweep", {"max_relative_residual": water_error},
           {"relative_residual_lt": 1e-5}, water_error < 1e-5, water_error)
    record("R4", "Zero and near-zero flow stability", r_inputs, samples[0], {"mass_kg_s": 1e-12}, samples[1],
           {"finite": True, "near_zero_heat_w_lt": .001}, all(isfinite(v) for s in samples[:2] for v in s.values()) and samples[0]["heat_w"] == 0 and samples[1]["heat_w"] < .001)

    b = p.buildings[0]
    weather = Weather(-5, 0)
    a = advance_building(b, 21, [OutletSegment(300, 50)], 1, weather)
    cold = advance_building(b, 21, [OutletSegment(300, 50)], 1, Weather(-10, 0))
    load = required_load(b, weather)
    record("T1", "Colder outdoor increases envelope loss and required load", {"building": b.building_id, "indoor_c": 21, "supply_c": 50, "mass_kg_s": 1, "dt_s": 300},
           {"envelope_w": a.envelope_loss_w, "required_w": load}, {"outdoor_c": [-5, -10]},
           {"envelope_w": cold.envelope_loss_w, "required_w": required_load(b, Weather(-10, 0))},
           {"both_increase": True}, cold.envelope_loss_w > a.envelope_loss_w and required_load(b, Weather(-10, 0)) > load)
    solar_load = required_load(b, Weather(-5, 400))
    record("T2", "Solar reduces required load", {"building": b.building_id, "outdoor_c": -5}, {"required_w": load}, {"solar_w_m2": [0, 400]},
           {"required_w": solar_load}, {"required_load_decreases": True}, solar_load < load)
    rad0 = radiator(50, 21, 1, 1500)[0]
    rad1 = radiator(55, 21, 1, 1500)[0]
    record("T3", "Delivered supply temperature increases emitter heat", r_inputs, {"heat_w": rad0}, {"supply_c": 55}, {"heat_w": rad1}, {"heat_increases": True}, rad1 > rad0)
    sweep = [radiator(50, 21, m, 1500)[0] for m in (1e-12, .01, .1, 1, 10, 1000)]
    record("T4", "Emitter monotone flow response to UA limit", r_inputs, {"heat_w": sweep[0]}, {"mass_kg_s": [1e-12, .01, .1, 1, 10, 1000]},
           {"heat_w": sweep, "ua_limit_w": 1500 * 29}, {"monotonic": True, "bounded_by_ua": True}, all(y > x for x, y in zip(sweep, sweep[1:])) and sweep[-1] <= 1500 * 29)
    insulated = replace(b, thermal_resistance_k_w=2 * b.thermal_resistance_k_w)
    before_loss, after_loss = envelope_loss(b, 21, -5), envelope_loss(insulated, 21, -5)
    record("T5", "Insulation reduces steady envelope loss", {"indoor_c": 21, "outdoor_c": -5}, {"envelope_w": before_loss}, {"R_multiplier": 2},
           {"envelope_w": after_loss}, {"loss_decreases": True}, after_loss < before_loss)
    window = advance_building(b, 21, [OutletSegment(300, 50)], 1, weather, .5)
    record("T6", "Physical window input increases loss and lowers temperature tendency", {"building": b.building_id, "dt_s": 300},
           {"window_w": a.window_loss_w, "end_indoor_c": a.indoor_temperature_c}, {"window_fraction": [0, .5]},
           {"window_w": window.window_loss_w, "end_indoor_c": window.indoor_temperature_c}, {"loss_increases": True, "tendency_decreases": True},
           window.window_loss_w > a.window_loss_w and window.indoor_temperature_c < a.indoor_temperature_c)

    frames = run_canonical()
    maxima = {key: max(getattr(f, key) for f in frames) for key in ("mass_residual", "heat_balance_residual", "pipe_heat_balance_residual", "building_heat_balance_residual", "pipe_volume_residual")}
    max_zone_residual = max(max(f.zone_heat_residual.values()) for f in frames)
    for gate, description, key, threshold in (
        ("C1", "Station and zone-to-building mass balance", "mass_residual", 1e-6),
        ("C3", "Flow-weighted station delivered water heat equals emitters", "heat_balance_residual", 1e-5),
        ("C4", "Source input minus delivered heat equals pipe storage", "pipe_heat_balance_residual", 1e-5),
        ("C5", "Exact 1R1C energy storage equals net gains/losses", "building_heat_balance_residual", 1e-5),
    ):
        record(gate, description, {"canonical_24h": True, "dt_s": 300}, {key: getattr(frames[0], key)},
               "predefined control schedule and weather", {"max_relative_residual": maxima[key]}, {"residual_lt": threshold}, maxima[key] < threshold, maxima[key])
    record("C2", "Every zone water heat equals allocated building emitter heat", {"frames": len(frames)},
           frames[0].zone_heat_residual, "24h forcing", {"max_relative_residual": max_zone_residual}, {"residual_lt": 1e-5}, max_zone_residual < 1e-5, max_zone_residual)

    ref, step = SimulationEngine(), SimulationEngine()
    arrivals_integrated = {}
    early_delta = 0.0
    max_indoor_delta = 0.0
    valid_chain = True
    for _ in range(20):
        f0, f1 = ref.step(weather), step.step(weather, Controls(52))
        for profile in p.buildings:
            key, zone = profile.building_id, profile.zone
            ds = f1.delivered_supply_c[zone] - f0.delivered_supply_c[zone]
            dh = f1.buildings[key].heating_power_w - f0.buildings[key].heating_power_w
            di = f1.buildings[key].indoor_temperature_c - f0.buildings[key].indoor_temperature_c
            max_indoor_delta = max(max_indoor_delta, abs(di))
            if ds <= 1e-9:
                early_delta = max(early_delta, abs(di), abs(dh))
            if ds > 1e-9 and key not in arrivals_integrated:
                arrivals_integrated[key] = {"zone": zone, "first_response_min": seconds_to_minutes(f1.elapsed_s), "supply_delta_c": ds, "heat_delta_w": dh, "indoor_delta_c": di}
                valid_chain &= dh > 0 and 0 < di < ds
    record("I1", "Transport response precedes gradual indoor response", {"dt_s": 300, "weather": asdict(weather), "identical_initial_state": True},
           {"supply_c": 50}, {"supply_c": 52, "within_control_rate_limit": True},
           {"first_responses": arrivals_integrated, "max_prearrival_effect": early_delta, "max_indoor_delta_c": max_indoor_delta},
           {"prearrival_effect_max": 0, "all_12_respond": True, "indoor_response_smaller_than_supply_step": True},
           early_delta == 0 and len(arrivals_integrated) == 12 and valid_chain and max_indoor_delta < 2)

    all_t = [s.indoor_temperature_c for f in frames for s in f.buildings.values()]
    encoded = json.dumps([asdict(f) for f in frames], allow_nan=False, sort_keys=True)
    stable = all(f.hydraulics.solver.status == "converged" and min(f.hydraulics.flows_m3_s) >= 0
                 and f.hydraulics.pump_power_w >= 0 and f.station_return_c <= f.controls.supply_c
                 and all(f.zone_return_c[z] <= f.delivered_supply_c[z] for z in ZONES) for f in frames)
    record("N1", "24h numerical stability", {"start": "2025-01-15T08:00:00+08:00", "dt_s": 300},
           {"initial_indoor_c": 20}, "canonical 24h forcing", {"frames": len(frames), "min_indoor_c": min(all_t), "max_indoor_c": max(all_t), **maxima},
           {"frames": 288, "finite": True, "indoor_bounds_c": [-10, 50], "all_solvers_converge": True},
           len(frames) == 288 and min(all_t) > -10 and max(all_t) < 50 and stable and maxima["pipe_volume_residual"] < 1e-10)
    smooth5, smooth10 = run_canonical(300, scheduled=False)[-1], run_canonical(600, scheduled=False)[-1]
    differences = {key: abs(s.indoor_temperature_c - smooth10.buildings[key].indoor_temperature_c) for key, s in smooth5.buildings.items()}
    record("N2", "5 vs 10 min smooth-forcing consistency", {"weather": "same linearly interpolated knots", "controls": "fixed"},
           {"dt_s": 300, "final_c": {k: s.indoor_temperature_c for k, s in smooth5.buildings.items()}}, {"dt_s": 600},
           {"final_c": {k: s.indoor_temperature_c for k, s in smooth10.buildings.items()}, "absolute_differences_c": differences, "max_difference_c": max(differences.values())},
           {"max_difference_c_lt": .3}, max(differences.values()) < .3)
    repeated = json.dumps([asdict(f) for f in run_canonical()], allow_nan=False, sort_keys=True)
    record("N3", "Deterministic repeatability", {"same_parameters_weather_controls_dt": True}, {"sha256": hashlib.sha256(encoded.encode()).hexdigest()},
           "repeat full 24h run", {"sha256": hashlib.sha256(repeated.encode()).hexdigest()}, {"byte_identical": True}, encoded == repeated)
    coarse = run_canonical(900)
    record("N4", "15-minute stability", {"scenario": "canonical"}, {"dt_s": 300}, {"dt_s": 900},
           {"frames": len(coarse), "min_indoor_c": min(s.indoor_temperature_c for f in coarse for s in f.buildings.values()), "max_indoor_c": max(s.indoor_temperature_c for f in coarse for s in f.buildings.values())},
           {"finite": True, "indoor_bounds_c": [-10, 50]}, all(-10 < s.indoor_temperature_c < 50 for f in coarse for s in f.buildings.values()))

    invalid_calls = {
        "supply_70": lambda: Controls(70), "pump_60": lambda: Controls(frequency_hz=60),
        "valve_150pct": lambda: Controls(valves=(1.5, .6, .6)),
        "R_zero": lambda: replace(b, thermal_resistance_k_w=0), "C_zero": lambda: replace(b, thermal_capacitance_j_k=0),
        "pipe_negative": lambda: replace(p.branches[0], pipe_k_pa_s2_m6=-1), "UA_negative": lambda: replace(b, radiator_ua_w_k=-1),
        "volume_zero": lambda: DelayLine(0, 50), "efficiency_zero": lambda: replace(p.pump, efficiency=0),
        "efficiency_gt1": lambda: replace(p.pump, efficiency=1.1), "window_gt1": lambda: validate_window(1.1),
        "timestep_30min": lambda: validate_timestep(1800), "dp_mode": lambda: Controls(pump_mode="differential_pressure"),
        "supply_rate": lambda: Controls(53).validate(Controls()),
        "pump_rate": lambda: Controls(frequency_hz=48).validate(Controls()),
        "valve_rate": lambda: Controls(valves=(.8, .6, .6)).validate(Controls()),
    }
    errors = {}
    for name, operation in invalid_calls.items():
        try:
            operation()
            errors[name] = None
        except ValueError as exc:
            errors[name] = str(exc)
    record("E1", "Early parameter/equipment/rate validation", {"defaults": "valid"}, {"valid_default": True}, list(invalid_calls),
           {"rejections": errors}, {"all_rejected": True}, all(errors.values()))
    engine = SimulationEngine()
    engine.step(weather)
    rejected = False
    try:
        engine.step(weather, Controls(52))
    except ValueError:
        rejected = True
    record("E2", "Physical step and control interval are independent", {"dt_s": 300, "control_interval_s": 1800}, {"time_s": 300},
           {"supply_c": 52}, {"rejected_off_boundary": rejected, "time_after_s": engine.elapsed_s},
           {"rejected": True, "clock_unchanged": True}, rejected and engine.elapsed_s == 300)
    try:
        solve_hydraulics(p, c, max_nfev=1)
        failure = None
    except HydraulicFailure as exc:
        failure = asdict(exc.diagnostics)
    record("S1", "Solver nonconvergence is explicit, no invented flow", inputs, asdict(base.solver), {"max_nfev": 1},
           {"failure_diagnostics": failure}, {"status": "failed", "raises": True}, failure is not None and failure["status"] == "failed")

    payload = to_p0_frame(frames[-1])
    with tempfile.TemporaryDirectory(prefix="p1a-gate-contract-") as tmp:
        sample = Path(tmp) / "frame.json"
        sample.write_text(json.dumps(payload, allow_nan=False))
        check = subprocess.run(["node", str(Path(__file__).with_name("check-p0-contract.mjs")), str(sample)], capture_output=True, text=True)
    record("P1", "Frozen SimulationFrameResponse and imported P0 types", {"source_contract": "P0_FUTURE_API_SEAMS.md + src/domain.ts"},
           {"expected_source": "simulation_engine", "building_count": 12}, "serialize actual final canonical frame",
           {"typecheck_exit_code": check.returncode, "output": check.stdout + check.stderr, "source": payload["source"], "solver": payload["solver"]},
           {"typecheck_exit_code": 0, "no_static_metadata_in_frame": True}, check.returncode == 0 and all(set(s) == {"indoorTemperatureC"} for s in payload["buildingStates"].values()))
    return records


def main():
    records = evaluate_gates()
    result = {"phase": "1A", "parameter_policy": "Synthetic PoC Parameters", "python": platform.python_version(),
              "numpy": np.__version__, "scipy": scipy.__version__, "gates": records,
              "passed": sum(r["status"] == "PASS" for r in records), "failed": sum(r["status"] == "FAIL" for r in records), "skipped": 0}
    (ROOT / "p1a_gate_results.json").write_text(json.dumps(result, indent=2, allow_nan=False) + "\n")
    lines = ["# Phase 1A Physical Gate Results", "", "Generated by `physical_core/scripts/run_gate_suite.py` from actual physical function calls. All parameters are Synthetic PoC Parameters.",
             "", f"{result['passed']} PASS / {result['failed']} FAIL / 0 SKIPPED. Python {result['python']}; NumPy {result['numpy']}; SciPy {result['scipy']}.",
             "", "H3 is a fixture-specific fixed-frequency-pump test, not a universal network law. An ideal constant-ΔP controller could behave differently. The standalone +5°C transport and +20pp hydraulic Gate perturbations test components; live engine control changes remain rate-limited.", ""]
    for r in records:
        lines += [f"## {r['gate']} — {r['description']} — {r['status']}", ""]
        for key in ("inputs", "baseline_output", "changed_input", "measured", "thresholds", "residual"):
            lines += [f"**{key.replace('_', ' ').capitalize()}:**", "", "```json", json.dumps(r[key], indent=2, allow_nan=False), "```", ""]
    (ROOT / "P1A_GATE_RESULTS.md").write_text("\n".join(lines))
    print(f"Physical Gates: {result['passed']} passed, {result['failed']} failed, 0 skipped")
    for r in records:
        print(f"{r['gate']}: {r['status']}")
    return bool(result["failed"])


if __name__ == "__main__":
    raise SystemExit(main())
