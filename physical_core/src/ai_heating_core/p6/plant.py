"""Accepted P1A/P5 adapter used by P6 sensitivity and verification callbacks."""
from math import isfinite
from typing import Mapping, Sequence

import numpy as np

from ..contracts import Controls, ZONES
from ..p4.preview import clone_engine, interpolate_forecast, policy_controls
from ..p5.thermal import ThermalParameters, step_temperature
from .mpc import NonlinearRollout, legal_trajectory


class P1AP5RolloutAdapter:
    def __init__(self, snapshot, parameters, current_weather, issued_forecast,
                 nominal_profiles, calibrations):
        self.snapshot = snapshot
        self.parameters = parameters
        self.current_weather = current_weather
        self.issued_forecast = tuple(issued_forecast)
        self.nominals = dict(nominal_profiles)
        self.calibrations = dict(calibrations)
        self.profiles = {profile.building_id: profile for profile in parameters.buildings}
        self.building_ids = tuple(sorted(self.profiles))

    def __call__(self, trajectory: Sequence[Controls]) -> NonlinearRollout:
        if len(trajectory) != 6:
            raise ValueError("P6 rollout requires six controls")
        engine = clone_engine(self.snapshot, self.parameters)
        if not legal_trajectory(engine.controls, trajectory):
            raise ValueError("P6 rollout trajectory is not legal")
        temperatures = dict(engine.temperatures)
        endpoint_temperatures = []
        heat, flow, pump = [], [], []
        interval_heat, interval_flow, interval_pump = [], [], []
        maximum_mass_residual = 0.0
        converged = True
        for physical_step in range(36):
            interval = physical_step // 6
            weather = interpolate_forecast(self.current_weather, self.issued_forecast,
                                           physical_step * engine.dt_s)
            frame = engine.step(weather, trajectory[interval])
            next_temperatures = {}
            for building_id in self.building_ids:
                profile = self.profiles[building_id]
                peers = [item for item in self.parameters.buildings
                         if item.zone == profile.zone]
                share = profile.flow_share_weight / sum(item.flow_share_weight
                                                        for item in peers)
                zone_index = ZONES.index(profile.zone)
                mass = (self.parameters.water.rho_water
                        * frame.hydraulics.flows_m3_s[zone_index] * share)
                next_temperatures[building_id] = step_temperature(
                    temperatures[building_id], weather.outdoor_c, weather.solar_w_m2,
                    frame.delivered_supply_c[profile.zone], mass,
                    self.nominals[building_id], self.calibrations[building_id],
                    engine.dt_s)
            temperatures = next_temperatures
            interval_heat.append(frame.actual_heat_w / 1e6)
            interval_flow.append([value * 3600
                                  for value in frame.hydraulics.flows_m3_s])
            interval_pump.append(frame.hydraulics.pump_power_w / 1000)
            maximum_mass_residual = max(maximum_mass_residual, frame.mass_residual)
            converged &= frame.hydraulics.solver.status == "converged"
            if physical_step % 6 == 5:
                endpoint_temperatures.append([temperatures[key]
                                              for key in self.building_ids])
                heat.append(float(np.mean(interval_heat)))
                flow.append(np.mean(interval_flow, axis=0).tolist())
                pump.append(float(np.mean(interval_pump)))
                interval_heat, interval_flow, interval_pump = [], [], []
        arrays = [np.asarray(endpoint_temperatures), np.asarray(heat),
                  np.asarray(flow), np.asarray(pump)]
        return NonlinearRollout(self.building_ids, *arrays, bool(converged),
            maximum_mass_residual,
            all(isfinite(float(value)) for array in arrays for value in array.flat))

    def verify(self, trajectory, half_widths_c):
        rollout = self(trajectory)
        minimum_lower = float(np.min(rollout.building_temperature_c
                                     - np.asarray(half_widths_c)[:, None]))
        return {"passed": bool(rollout.all_hydraulic_converged
                    and rollout.maximum_mass_residual < 1e-7
                    and rollout.all_finite and minimum_lower >= 18 - 1e-8),
                "minimumLowerBoundC": minimum_lower,
                "minimumPointTemperatureC": float(
                    np.min(rollout.building_temperature_c)),
                "rollout": rollout,
                "authority": "full nonlinear P1A hydraulics/FIFO plus accepted P5"}


def traditional_reference(current, current_weather, issued_forecast, config):
    previous = current
    output = []
    for interval in range(6):
        weather = interpolate_forecast(current_weather, issued_forecast,
                                       interval * 1800)
        previous = policy_controls(previous, weather, config,
                                   (0, 0, (0, 0, 0)))
        output.append(previous)
    return tuple(output)


def safe_heating_fallback(current):
    previous = current
    output = []
    for _ in range(6):
        controls = Controls(min(60, previous.supply_c + 2),
                            min(50, previous.frequency_hz + 2),
                            tuple(min(1, value + .1) for value in previous.valves))
        controls.validate(previous)
        output.append(controls)
        previous = controls
    return tuple(output)


def p5_half_width_grid(registry):
    widths = {int(key): float(value) for key, value in
              registry["intervalHalfWidthsC"]["forecast_driven"].items()}
    return (widths[30], widths[60], max(widths[60], widths[120]), widths[120],
            max(widths[120], widths[180]), widths[180])


def calibrations_for_site(calibration_artifact: Mapping[str, object], site_id: str):
    return {building_id: ThermalParameters(**record["fittedParameters"])
            for building_id, record in calibration_artifact["sites"][site_id].items()}
