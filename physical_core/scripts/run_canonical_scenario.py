"""Export deterministic 24h physical CSV, parameters, adapter frame and plots."""
import csv
from dataclasses import asdict
import json
import os
from pathlib import Path
import tempfile

from ai_heating_core.adapters import to_p0_frame
from ai_heating_core.contracts import LIMITS, ZONES
from ai_heating_core.parameters import TRANSPORT_REFERENCES, synthetic_parameters
from ai_heating_core.scenarios import CONTROL_SCHEDULE, WEATHER_KNOTS, run_canonical
from ai_heating_core.units import fraction_to_percent, m3s_to_m3h, pa_to_kpa, seconds_to_hours, seconds_to_minutes, w_to_kw, w_to_mw

ROOT = Path(__file__).resolve().parents[2]


def row_for(f):
    h, c = f.hydraulics, f.controls
    row = {"timestamp": f.simulation_time, "elapsed_hours": seconds_to_hours(f.elapsed_s),
           "outdoor_temperature_c": f.weather.outdoor_c, "solar_radiation_w_m2": f.weather.solar_w_m2,
           "secondary_supply_setpoint_c": c.supply_c}
    row.update({f"delivered_supply_{z}_c": f.delivered_supply_c[z] for z in ZONES})
    row["total_flow_m3_h"] = m3s_to_m3h(h.total_flow_m3_s)
    row.update({f"{z}_flow_m3_h": m3s_to_m3h(q) for z, q in zip(ZONES, h.flows_m3_s)})
    row.update({f"{z}_valve_pct": fraction_to_percent(u) for z, u in zip(ZONES, c.valves)})
    row.update({"pump_frequency_hz": c.frequency_hz, "pump_head_kpa": pa_to_kpa(h.pump_pressure_pa),
                "pump_power_kw": w_to_kw(h.pump_power_w), "required_heat_load_mw": w_to_mw(f.required_heat_w),
                "actual_heat_supply_mw": w_to_mw(f.actual_heat_w)})
    row.update({f"{key}_indoor_c": state.indoor_temperature_c for key, state in f.buildings.items()})
    row.update({f"{z}_return_c": f.zone_return_c[z] for z in ZONES})
    row["station_return_c"] = f.station_return_c
    row.update({f"{z}_transport_delay_min": seconds_to_minutes(f.delay_s[z]) for z in ZONES})
    row.update({"hydraulic_residual": h.solver.normalized_residual, "heat_balance_residual": f.heat_balance_residual,
                "solver_status": h.solver.status, "source_heat_mw": w_to_mw(f.source_heat_w),
                "pipe_storage_power_kw": w_to_kw(f.pipe_storage_power_w), "pipe_energy_residual": f.pipe_heat_balance_residual,
                "building_energy_residual": f.building_heat_balance_residual, "mass_residual": f.mass_residual,
                "heat_energy_j": f.heat_energy_j, "pump_energy_j": f.pump_energy_j})
    return row


def export_plots(rows):
    # Matplotlib cache is temporary; only acceptance plots enter the repository.
    with tempfile.TemporaryDirectory(prefix="p1a-matplotlib-") as cache:
        os.environ["MPLCONFIGDIR"] = cache
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        target = ROOT / "validation_plots"
        target.mkdir(exist_ok=True)
        plots = [
            ("01_zone_flows.png", "Shared-pump zone flows", "Flow (m³/h)", [(f"{z}_flow_m3_h", z.title()) for z in ZONES]),
            ("02_transport_supply_temperatures.png", "Station setpoint and delayed zone supply", "Temperature (°C)", [("secondary_supply_setpoint_c", "Station")] + [(f"delivered_supply_{z}_c", z.title()) for z in ZONES]),
            ("03_representative_indoor_temperatures.png", "Radiator building response", "Indoor temperature (°C)", [(f"{key}_indoor_c", key) for key in ("B03", "B06", "B11")]),
            ("04_required_vs_actual_heat.png", "Target heat requirement and delivered heat", "Heat rate (MW)", [("required_heat_load_mw", "Required"), ("actual_heat_supply_mw", "Actual delivered")]),
            ("05_pump_power.png", "Pump electrical power", "Power (kW)", [("pump_power_kw", "Pump")]),
        ]
        for filename, title, ylabel, series in plots:
            fig, ax = plt.subplots(figsize=(10, 4.5))
            for key, label in series:
                ax.plot([r["elapsed_hours"] for r in rows], [r[key] for r in rows], label=label)
            ax.set(xlabel="Hours since Jan 15 08:00", ylabel=ylabel, title=title + " · Synthetic PoC")
            ax.grid(alpha=.25)
            ax.legend()
            fig.tight_layout()
            fig.savefig(target / filename, dpi=130)
            plt.close(fig)


def main():
    frames = run_canonical()
    rows = [row_for(f) for f in frames]
    with (ROOT / "p1a_canonical_run.csv").open("w", newline="") as output:
        writer = csv.DictWriter(output, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    parameters = {"label": "Synthetic PoC Parameters", "parameters": asdict(synthetic_parameters()),
                  "equipment_limits": asdict(LIMITS), "transport_design_references_m3_h_min": TRANSPORT_REFERENCES,
                  "weather_knots_hours_outdoor_c_solar_w_m2_wind_m_s": WEATHER_KNOTS,
                  "control_schedule_hours": [(h, asdict(c)) for h, c in CONTROL_SCHEDULE],
                  "initial_indoor_c": 20, "initial_pipe_c": 50, "physical_timestep_s": 300, "control_interval_s": 1800}
    (ROOT / "p1a_parameters.json").write_text(json.dumps(parameters, indent=2, allow_nan=False) + "\n")
    (ROOT / "physical_core" / "p0_frame_example.json").write_text(json.dumps(to_p0_frame(frames[-1]), indent=2, allow_nan=False) + "\n")
    export_plots(rows)
    print(f"Canonical scenario: {len(rows)} frames, 24 hours, 5-minute timestep, {len(rows[0])} CSV columns")
    print("Parameters, P0 frame example and 5 engineering plots exported")
    print(f"Final delivered heat: {w_to_mw(frames[-1].actual_heat_w):.6f} MW; pump: {w_to_kw(frames[-1].hydraulics.pump_power_w):.6f} kW")


if __name__ == "__main__":
    main()
