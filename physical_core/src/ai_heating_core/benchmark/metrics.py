"""Evaluation-only metrics. Fractions use equally weighted building-time samples."""
from math import floor, fsum

from ..units import j_to_kwh, j_to_mwh

METRIC_VERSION = "building-time-endpoints-lower-percentiles-v1"


def thermal_metrics(temperatures):
    t = sorted(temperatures)
    if not t:
        raise ValueError("nonempty temperature sample required")
    rate = lambda predicate: sum(predicate(v) for v in t) / len(t)
    percentile = lambda p: t[floor((len(t)-1)*p)]
    return {"complianceRate": rate(lambda v:v>=18), "comfortRate": rate(lambda v:20<=v<=22),
            "overheatingRate": rate(lambda v:v>23), "severeOverheatingRate": rate(lambda v:v>25),
            "underheatingRate": rate(lambda v:v<18), "minimumIndoorC": t[0], "maximumIndoorC": t[-1],
            "P10C": percentile(.1), "P50C": percentile(.5), "P90C": percentile(.9),
            "temperatureSpreadC": percentile(.9)-percentile(.1)}


def summary(frames, scenario_id, config, target_shares):
    if not frames or frames[0].elapsed_s <= 0 or frames[-1].elapsed_s != 86400:
        raise ValueError("metrics require evaluation-only frames covering 24 hours")
    if len({f.dt_s for f in frames}) != 1 or fsum(f.dt_s for f in frames) != 86400:
        raise ValueError("evaluation must contain a regular, complete 24-hour interval")
    temperatures = [s.indoor_temperature_c for f in frames for s in f.buildings.values()]
    energy = fsum(f.actual_heat_w * f.dt_s for f in frames)
    power = fsum(f.hydraulics.pump_power_w * f.dt_s for f in frames)
    excess = fsum(max(0, f.actual_heat_w - f.required_heat_w) * f.dt_s for f in frames)
    balance = lambda f: 1 - .5 * sum(abs(q/f.hydraulics.total_flow_m3_s - share)
                                    for q, share in zip(f.hydraulics.flows_m3_s, target_shares))
    return {"scenarioId": scenario_id, "controllerVersion": config.version, "metricDefinitionVersion": METRIC_VERSION,
            "evaluationHours": 24, "frameCount": len(frames), **thermal_metrics(temperatures),
            "heatEnergyMWh": j_to_mwh(energy), "pumpElectricityKWh": j_to_kwh(power),
            "excessDeliveredHeatMWh": j_to_mwh(excess),
            "excessHeatLabel": "Excess Delivered Heat Above Instantaneous Required Load",
            "hydraulicBalanceIndex": fsum(balance(f)*f.dt_s for f in frames)/86400,
            "solverFailureCount": sum(f.hydraulics.solver.status != "converged" for f in frames)}
