"""Serialization only: the React application does not import or call this module."""
from .contracts import ZONES
from .simulation import Frame
from .units import fraction_to_percent, m3s_to_m3h, pa_to_kpa, seconds_to_minutes, w_to_kw, w_to_mw


def to_p0_frame(frame: Frame) -> dict:
    h, c = frame.hydraulics, frame.controls
    required, actual, pump = w_to_mw(frame.required_heat_w), w_to_mw(frame.actual_heat_w), w_to_kw(h.pump_power_w)
    temperatures = [s.indoor_temperature_c for s in frame.buildings.values()]
    return {
        "simulationTime": frame.simulation_time,
        "weather": {"outdoorTemperatureC": frame.weather.outdoor_c, "solarRadiationWm2": frame.weather.solar_w_m2, "windSpeedMs": frame.weather.wind_m_s},
        "networkState": {
            "requiredHeatLoadMw": required, "supplyTemperatureC": c.supply_c,
            "returnTemperatureC": frame.station_return_c, "totalFlowM3h": m3s_to_m3h(h.total_flow_m3_s),
            "pumpFrequencyHz": c.frequency_hz, "differentialPressureKpa": pa_to_kpa(h.pump_pressure_pa),
            "currentHeatSupplyMw": actual, "pumpPowerKw": pump,
            "zones": {z: {"key": z, "valveOpeningPct": fraction_to_percent(u), "flowM3h": m3s_to_m3h(q),
                          "transportDelayMin": seconds_to_minutes(frame.delay_s[z])}
                      for z, u, q in zip(ZONES, c.valves, h.flows_m3_s)},
        },
        "buildingStates": {key: {"indoorTemperatureC": s.indoor_temperature_c} for key, s in frame.buildings.items()},
        "transport": {z: {"delayMin": seconds_to_minutes(frame.delay_s[z]), "deliveredSupplyTemperatureC": frame.delivered_supply_c[z]} for z in ZONES},
        "metrics": {"requiredHeatLoadMw": required, "heatSupplyMw": actual, "pumpPowerKw": pump,
                    "complianceRate": sum(t >= 18 for t in temperatures) / len(temperatures),
                    "comfortRate": sum(20 <= t <= 22 for t in temperatures) / len(temperatures)},
        "source": "simulation_engine",
        "solver": {"status": h.solver.status, "residual": h.solver.normalized_residual,
                   "iterations": h.solver.iterations, "message": h.solver.message},
    }
