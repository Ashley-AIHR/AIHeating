"""Transactional physical steps: failure never advances clock or transport."""
from copy import deepcopy
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from math import fsum, isfinite

from .constants import finite
from .contracts import BuildingThermalState, Controls, Weather, ZONES, validate_timestep, validate_window
from .hydraulics import HydraulicResult, solve_hydraulics
from .parameters import Parameters, synthetic_parameters
from .thermal import advance_building, required_load
from .transport import DelayLine

START = datetime(2025, 1, 15, 8, tzinfo=timezone(timedelta(hours=8)))
CONTROL_INTERVAL_S = 1800


@dataclass(frozen=True)
class Frame:
    simulation_time: str
    elapsed_s: float
    dt_s: float
    weather: Weather
    controls: Controls
    hydraulics: HydraulicResult
    buildings: dict[str, BuildingThermalState]
    delivered_supply_c: dict[str, float]
    delay_s: dict[str, float]
    zone_return_c: dict[str, float]
    station_return_c: float
    required_heat_w: float
    actual_heat_w: float
    source_heat_w: float
    pipe_storage_power_w: float
    mass_residual: float
    zone_heat_residual: dict[str, float]
    heat_balance_residual: float
    pipe_heat_balance_residual: float
    building_heat_balance_residual: float
    pipe_volume_residual: float
    heat_energy_j: float
    pump_energy_j: float


class SimulationEngine:
    def __init__(self, parameters: Parameters | None = None, controls: Controls | None = None,
                 initial_temperatures: dict[str, float] | None = None, dt_s=300):
        validate_timestep(dt_s)
        self.parameters = parameters or synthetic_parameters()
        self.controls = controls or Controls()
        self.controls.validate()
        ids = {b.building_id for b in self.parameters.buildings}
        self.temperatures = dict(initial_temperatures) if initial_temperatures is not None else {i: 20.0 for i in sorted(ids)}
        if set(self.temperatures) != ids:
            raise ValueError("initial temperatures must contain exactly B01–B12")
        for value in self.temperatures.values():
            finite("initial indoor", value)
        self.buffers = {b.zone: DelayLine(b.equivalent_volume_m3, self.controls.supply_c) for b in self.parameters.branches}
        self.dt_s = dt_s
        self.elapsed_s = 0.0
        self.previous_flows = None
        self.heat_energy_j = 0.0
        self.pump_energy_j = 0.0

    def step(self, weather: Weather, controls: Controls | None = None,
             windows: dict[str, float] | None = None) -> Frame:
        p, dt = self.parameters, self.dt_s
        controls = controls or self.controls
        controls.validate(self.controls)
        if controls != self.controls and self.elapsed_s % CONTROL_INTERVAL_S != 0:
            raise ValueError("control changes require a 1800-second control boundary")
        windows = dict(windows or {})
        if set(windows) - set(self.temperatures):
            raise ValueError("unknown building in window input")
        for value in windows.values():
            validate_window(value)
        # Frozen dataclasses have validated weather/parameters before physical work.
        hydraulic = solve_hydraulics(p, controls, self.previous_flows)
        buffers = deepcopy(self.buffers)
        before_energy = fsum(b.energy_j(p.water) for b in buffers.values())
        buildings, delivered, delays, returns, zone_heat, zone_residual = {}, {}, {}, {}, {}, {}
        mass_residual = hydraulic.mass_residual
        for zone, flow in zip(ZONES, hydraulic.flows_m3_s):
            outlet = buffers[zone].advance(controls.supply_c, flow, dt)
            delivered[zone] = buffers[zone].delivered_supply_c
            delays[zone] = buffers[zone].estimated_delay_s
            profiles = [b for b in p.buildings if b.zone == zone]
            weight_sum = fsum(b.flow_share_weight for b in profiles)
            zone_mass = p.water.rho_water * flow
            for profile in profiles:
                mass = zone_mass * profile.flow_share_weight / weight_sum
                buildings[profile.building_id] = advance_building(profile,
                    self.temperatures[profile.building_id], outlet, mass, weather,
                    windows.get(profile.building_id, 0.0), p.water)
            states = [buildings[b.building_id] for b in profiles]
            allocated_mass = fsum(s.building_water_flow_kg_s for s in states)
            mass_residual = max(mass_residual, abs(allocated_mass - zone_mass) / max(zone_mass, 1e-15))
            returns[zone] = fsum(s.building_water_flow_kg_s * s.radiator_return_temperature_c for s in states) / zone_mass
            zone_heat[zone] = zone_mass * p.water.cp_water * (delivered[zone] - returns[zone])
            emitters = fsum(s.heating_power_w for s in states)
            zone_residual[zone] = abs(zone_heat[zone] - emitters) / max(abs(emitters), 1.0)
        total_mass = p.water.rho_water * hydraulic.total_flow_m3_s
        station_return = fsum(q * returns[z] for z, q in zip(ZONES, hydraulic.flows_m3_s)) / hydraulic.total_flow_m3_s
        weighted_supply = fsum(q * delivered[z] for z, q in zip(ZONES, hydraulic.flows_m3_s)) / hydraulic.total_flow_m3_s
        actual = fsum(s.heating_power_w for s in buildings.values())
        water_heat = total_mass * p.water.cp_water * (weighted_supply - station_return)
        source_heat = total_mass * p.water.cp_water * (controls.supply_c - station_return)
        pipe_storage = (fsum(b.energy_j(p.water) for b in buffers.values()) - before_energy) / dt
        required = fsum(required_load(b, weather, windows.get(b.building_id, 0.0), p.target_indoor_c) for b in p.buildings)
        heat_residual = abs(water_heat - actual) / max(abs(actual), 1.0)
        pipe_residual = abs(source_heat - actual - pipe_storage) / max(abs(source_heat), abs(actual), 1.0)
        building_residual = max(abs(s.energy_residual_w) / max(abs(s.heating_power_w) + s.solar_gain_w + s.internal_gain_w, 1.0) for s in buildings.values())
        volume_residual = max(abs(b.volume_m3 - b.equivalent_volume_m3) / b.equivalent_volume_m3 for b in buffers.values())
        diagnostics = (heat_residual, pipe_residual, building_residual, mass_residual, volume_residual, *zone_residual.values())
        if not all(isfinite(x) and x < 1e-7 for x in diagnostics):
            raise ArithmeticError(f"physical conservation check failed: {diagnostics}")
        if not all(isfinite(v) for s in buildings.values() for v in vars(s).values()):
            raise ArithmeticError("nonfinite building state")
        elapsed = self.elapsed_s + dt
        frame = Frame((START + timedelta(seconds=elapsed)).isoformat(), elapsed, dt, weather, controls,
            hydraulic, buildings, delivered, delays, returns, station_return, required, actual,
            source_heat, pipe_storage, mass_residual, zone_residual, heat_residual, pipe_residual,
            building_residual, volume_residual, self.heat_energy_j + actual * dt,
            self.pump_energy_j + hydraulic.pump_power_w * dt)
        self.buffers = buffers
        self.temperatures = {key: state.indoor_temperature_c for key, state in buildings.items()}
        self.controls = controls
        self.elapsed_s = elapsed
        self.previous_flows = hydraulic.flows_m3_s
        self.heat_energy_j = frame.heat_energy_j
        self.pump_energy_j = frame.pump_energy_j
        return frame
