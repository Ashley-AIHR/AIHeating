"""Water-side NTU emitter and exact piecewise-linear 1R1C building update."""
from math import expm1, fsum, log

from .constants import WATER, PhysicalConstants, finite, positive
from .contracts import BuildingStaticProfile, BuildingThermalState, Weather, validate_window
from .transport import OutletSegment


def radiator_conductance(mass_flow_kg_s: float, ua_w_k: float, water: PhysicalConstants = WATER):
    positive("radiator mass flow", mass_flow_kg_s, allow_zero=True)
    positive("radiator UA", ua_w_k, allow_zero=True)
    capacity = mass_flow_kg_s * water.cp_water
    return -capacity * expm1(-ua_w_k / capacity) if capacity > 0 else 0.0


def radiator(supply_c: float, indoor_c: float, mass_flow_kg_s: float, ua_w_k: float,
             water: PhysicalConstants = WATER) -> tuple[float, float]:
    finite("radiator supply", supply_c)
    finite("radiator indoor", indoor_c)
    conductance = radiator_conductance(mass_flow_kg_s, ua_w_k, water)
    heat = conductance * max(supply_c - indoor_c, 0.0)
    return_c = supply_c - heat / (mass_flow_kg_s * water.cp_water) if mass_flow_kg_s else supply_c
    return heat, return_c


def gains(p: BuildingStaticProfile, weather: Weather, window_fraction: float):
    validate_window(window_fraction)
    solar = weather.solar_w_m2 * p.effective_solar_area_m2 * p.orientation_factor
    loss = 1 / p.thermal_resistance_k_w + p.window_conductance_w_k * window_fraction
    return solar, p.internal_gain_w, loss


def required_load(p: BuildingStaticProfile, weather: Weather, window_fraction=0.0, target_c=21.0):
    finite("target indoor", target_c)
    solar, internal, loss = gains(p, weather, window_fraction)
    return max(0.0, loss * (target_c - weather.outdoor_c) - solar - internal)


def envelope_loss(p: BuildingStaticProfile, indoor_c: float, outdoor_c: float):
    finite("envelope indoor", indoor_c)
    finite("envelope outdoor", outdoor_c)
    return (indoor_c - outdoor_c) / p.thermal_resistance_k_w


def linear_update(initial_c, equilibrium_c, conductance_w_k, capacitance_j_k, dt_s):
    """End temperature and exact time-mean temperature, stable for small dt/tau."""
    rate = conductance_w_k / capacitance_j_k
    x = rate * dt_s
    change = -expm1(-x)
    end = initial_c + (equilibrium_c - initial_c) * change
    mean = equilibrium_c + (initial_c - equilibrium_c) * change / x
    return end, mean


def _constant_segment(initial, supply, dt, conductance, loss, forcing, capacity):
    # max(Ts-Ti,0) is piecewise linear. Split exactly at a heating on/off crossing.
    remaining, temperature = dt, initial
    temp_integral = heat_energy = 0.0
    for _ in range(2):  # A constant forcing can cross Ts at most once.
        active = temperature < supply or (temperature == supply and forcing - loss * supply < 0)
        emitter = conductance if active else 0.0
        total_g = loss + emitter
        equilibrium = (forcing + emitter * supply) / total_g
        duration = remaining
        end, mean = linear_update(temperature, equilibrium, total_g, capacity, duration)
        crossing = (temperature - supply) * (end - supply) < 0
        if crossing:
            duration = -capacity / total_g * log((supply - equilibrium) / (temperature - equilibrium))
            _, mean = linear_update(temperature, equilibrium, total_g, capacity, duration)
            end = supply
        temp_integral += mean * duration
        heat_energy += emitter * max(supply - mean, 0.0) * duration
        temperature = end
        remaining -= duration
        if not crossing:
            break
    return temperature, temp_integral, heat_energy


def advance_building(p: BuildingStaticProfile, initial_c: float, segments: list[OutletSegment],
                     mass_flow_kg_s: float, weather: Weather, window_fraction=0.0,
                     water: PhysicalConstants = WATER) -> BuildingThermalState:
    finite("indoor temperature", initial_c)
    conductance = radiator_conductance(mass_flow_kg_s, p.radiator_ua_w_k, water)
    solar, internal, loss = gains(p, weather, window_fraction)
    if not segments:
        raise ValueError("at least one transport segment required")
    total_dt = fsum(s.duration_s for s in segments)
    temperature, temp_integral, heat_energy = initial_c, 0.0, 0.0
    for segment in segments:
        positive("segment duration", segment.duration_s)
        finite("segment temperature", segment.temperature_c)
        temperature, integral, energy = _constant_segment(temperature, segment.temperature_c,
            segment.duration_s, conductance, loss, solar + internal + loss * weather.outdoor_c,
            p.thermal_capacitance_j_k)
        temp_integral += integral
        heat_energy += energy
    mean_indoor = temp_integral / total_dt
    heat = heat_energy / total_dt
    mean_supply = fsum(s.duration_s * s.temperature_c for s in segments) / total_dt
    return_c = mean_supply - heat / (mass_flow_kg_s * water.cp_water) if mass_flow_kg_s else mean_supply
    envelope = envelope_loss(p, mean_indoor, weather.outdoor_c)
    window = p.window_conductance_w_k * window_fraction * (mean_indoor - weather.outdoor_c)
    storage = p.thermal_capacitance_j_k * (temperature - initial_c) / total_dt
    residual = storage - (heat + solar + internal - envelope - window)
    return BuildingThermalState(temperature, heat, solar, internal, envelope, window,
        mass_flow_kg_s, return_c, mean_indoor, storage, residual)
