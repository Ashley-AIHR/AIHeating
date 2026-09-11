"""Export exactly five small P2 validation runs and their forkable initial states."""
import csv
from dataclasses import asdict
import json
import os
from pathlib import Path
import tempfile

from ai_heating_core.benchmark.metrics import thermal_metrics
from ai_heating_core.benchmark.runner import run_baseline
from ai_heating_core.control.traditional import config_from_dict
from ai_heating_core.p2_scenarios import scenarios
from ai_heating_core.units import fraction_to_percent, m3s_to_m3h, pa_to_kpa, seconds_to_hours, seconds_to_minutes, w_to_kw, w_to_mw

ROOT=Path(__file__).resolve().parents[2]


def candidate_config():
    review=json.loads((ROOT/"p2_adequacy_review.json").read_text())
    if not review["normalAdequate"]:
        raise ValueError("normal adequacy review must succeed before official runs")
    return config_from_dict(review["config"])


def row_for(frame,state):
    h=frame.hydraulics
    row={"timestamp":frame.simulation_time,"elapsed_hours":seconds_to_hours(frame.elapsed_s),
         "outdoor_temperature_c":frame.weather.outdoor_c,"solar_radiation_w_m2":frame.weather.solar_w_m2,"wind_m_s":frame.weather.wind_m_s,
         "raw_supply_target_c":state.raw_supply_target_c,"applied_supply_setpoint_c":state.applied_supply_c,
         "raw_pump_target_hz":state.raw_pump_target_hz,"applied_pump_frequency_hz":state.applied_pump_hz}
    row.update({f"{z}_valve_pct":fraction_to_percent(u) for z,u in zip(("near","mid","far"),state.fixed_valves)})
    row["total_flow_m3_h"]=m3s_to_m3h(h.total_flow_m3_s)
    row.update({f"{z}_flow_m3_h":m3s_to_m3h(q) for z,q in zip(("near","mid","far"),h.flows_m3_s)})
    row.update({"pump_pressure_kpa":pa_to_kpa(h.pump_pressure_pa),"pump_power_kw":w_to_kw(h.pump_power_w)})
    row.update({f"delivered_supply_{z}_c":t for z,t in frame.delivered_supply_c.items()})
    row.update({f"return_{z}_c":t for z,t in frame.zone_return_c.items()})
    row["station_return_c"]=frame.station_return_c
    row.update({"required_heat_load_mw":w_to_mw(frame.required_heat_w),"actual_heat_supply_mw":w_to_mw(frame.actual_heat_w)})
    row.update({f"{k}_indoor_c":s.indoor_temperature_c for k,s in frame.buildings.items()})
    m=thermal_metrics([s.indoor_temperature_c for s in frame.buildings.values()])
    row.update({"compliance_rate":m["complianceRate"],"comfort_rate":m["comfortRate"],"overheating_rate":m["overheatingRate"],
                "severe_overheating_rate":m["severeOverheatingRate"],"underheating_rate":m["underheatingRate"],
                "P10_c":m["P10C"],"P50_c":m["P50C"],"P90_c":m["P90C"]})
    row.update({f"{z}_transport_delay_min":seconds_to_minutes(t) for z,t in frame.delay_s.items()})
    row.update({"hydraulic_residual":h.solver.normalized_residual,"heat_balance_residual":frame.heat_balance_residual,
                "mass_residual":frame.mass_residual,"pipe_heat_balance_residual":frame.pipe_heat_balance_residual,
                "building_heat_balance_residual":frame.building_heat_balance_residual,"solver_status":h.solver.status})
    return row


def plots(rows,directory):
    import matplotlib.pyplot as plt
    directory.mkdir(parents=True,exist_ok=True)
    x=[r["elapsed_hours"] for r in rows]
    definitions=[
        ("01_outdoor_supply.png","Current outdoor and weather compensation","Temperature (°C)",[("outdoor_temperature_c","Outdoor"),("raw_supply_target_c","Raw supply"),("applied_supply_setpoint_c","Applied supply")]),
        ("02_pump_frequency.png","Pump frequency policy","Frequency (Hz)",[("raw_pump_target_hz","Raw pump"),("applied_pump_frequency_hz","Applied pump")]),
        ("03_zone_flows.png","Coupled zone flows","Flow (m³/h)",[(f"{z}_flow_m3_h",z.title()) for z in ("near","mid","far")]),
        ("04_indoor_temperatures.png","Representative indoor temperatures","Temperature (°C)",[(f"{b}_indoor_c",b) for b in ("B03","B06","B11")]),
        ("05_required_actual_heat.png","Instantaneous required and actual delivered heat","Heat rate (MW)",[("required_heat_load_mw","Required"),("actual_heat_supply_mw","Delivered")]),
        ("06_compliance_overheating.png","Building exposure rates","Fraction of buildings",[("compliance_rate","Compliance ≥18°C"),("overheating_rate","Overheating >23°C")]),
    ]
    for filename,title,ylabel,series in definitions:
        fig,ax=plt.subplots(figsize=(10,4.5))
        for key,label in series:
            ax.plot(x,[r[key] for r in rows],"--" if key.startswith("raw_") else "-",label=label)
        ax.set(xlabel="Hours since evaluation start (warm-up excluded)",ylabel=ylabel,title=f"{directory.name} · {title}")
        if filename.startswith("04"):
            ax.axhline(18,color="gray",linestyle=":",label="18°C compliance")
        ax.grid(alpha=.25)
        ax.legend()
        fig.tight_layout()
        fig.savefig(directory/filename,dpi=120)
        plt.close(fig)


def main():
    if (ROOT/"P2_BASELINE_FREEZE_MANIFEST.json").exists():
        raise RuntimeError("P2 is frozen. Validate/replay separately; do not overwrite acceptance artifacts.")
    config=candidate_config()
    summaries=[]
    (ROOT/"p2_initial_states").mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="p2-mpl-") as cache:
        os.environ["MPLCONFIGDIR"]=cache
        import matplotlib
        matplotlib.use("Agg")
        for s in scenarios():
            run=run_baseline(s,config)
            rows=[row_for(f,c) for f,c in zip(run.frames,run.controller_states)]
            with (ROOT/f"p2_{s.scenario_id}.csv").open("w",newline="") as f:
                writer=csv.DictWriter(f,fieldnames=list(rows[0]));writer.writeheader();writer.writerows(rows)
            (ROOT/"p2_initial_states"/f"{s.scenario_id}.json").write_text(json.dumps(run.initial_state,indent=2,allow_nan=False)+"\n")
            plots(rows,ROOT/"p2_validation_plots"/s.scenario_id)
            summaries.append(run.summary)
            print(f"{s.scenario_id}: {len(rows)} evaluation frames, heat={run.summary['heatEnergyMWh']:.6f} MWh, compliance={run.summary['complianceRate']:.4%}")
    (ROOT/"p2_baseline_scenarios.json").write_text(json.dumps([s.manifest(config) for s in scenarios()],indent=2,allow_nan=False)+"\n")
    (ROOT/"p2_baseline_summaries.json").write_text(json.dumps(summaries,indent=2,allow_nan=False)+"\n")
    print("5 scenario CSVs, 5 complete initial states, 30 engineering plots, scenario manifest and summaries exported")


if __name__=="__main__":
    main()
