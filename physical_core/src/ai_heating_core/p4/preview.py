"""Finite, forecast-only Preview policy search through the accepted Digital Twin."""
from copy import deepcopy
from dataclasses import asdict, dataclass
from math import fsum

import numpy as np

from ..benchmark.state import content_hash
from ..contracts import Controls, Weather, ZONES
from ..control.traditional import interpolate
from ..simulation import SimulationEngine
from .prediction import PredictionInput


def serialize_engine(engine):
    return {"parametersHash": content_hash(asdict(engine.parameters)), "elapsedSeconds": engine.elapsed_s,
        "dtSeconds": engine.dt_s, "controls": asdict(engine.controls), "temperatures": dict(engine.temperatures),
        "previousFlows": engine.previous_flows, "heatEnergyJ": engine.heat_energy_j,
        "pumpEnergyJ": engine.pump_energy_j,
        "transport": {zone: {"volume": line.equivalent_volume_m3, "packets": list(line.packets),
            "deliveredSupplyC": line.delivered_supply_c, "currentFlow": line.current_flow_m3_s}
            for zone, line in engine.buffers.items()}}


def clone_engine(snapshot, parameters):
    if snapshot["parametersHash"] != content_hash(asdict(parameters)):
        raise ValueError("Preview snapshot parameter mismatch")
    controls = Controls(**{**snapshot["controls"], "valves": tuple(snapshot["controls"]["valves"])})
    engine = SimulationEngine(parameters, controls, snapshot["temperatures"], snapshot["dtSeconds"])
    engine.elapsed_s = snapshot["elapsedSeconds"]
    engine.previous_flows = tuple(snapshot["previousFlows"]) if snapshot["previousFlows"] else None
    engine.heat_energy_j = snapshot["heatEnergyJ"]; engine.pump_energy_j = snapshot["pumpEnergyJ"]
    for zone, data in snapshot["transport"].items():
        engine.buffers[zone].packets.clear(); engine.buffers[zone].packets.extend(tuple(p) for p in data["packets"])
        engine.buffers[zone].delivered_supply_c = data["deliveredSupplyC"]
        engine.buffers[zone].current_flow_m3_s = data["currentFlow"]
    return engine


def interpolate_forecast(current_weather, issued, seconds):
    points = [(0, current_weather)] + [(int(row["horizon_minutes"]) * 60,
        Weather(float(row["forecast_outdoor_temperature_c"]), float(row["forecast_solar_radiation_w_m2"]),
                float(row["forecast_wind_m_s"]))) for row in issued if int(row["horizon_minutes"]) <= 180]
    times = [point[0] for point in points]
    return Weather(*(float(np.interp(seconds, times, [getattr(weather, field) for _, weather in points]))
                     for field in ("outdoor_c", "solar_w_m2", "wind_m_s")))


def _ramp(old, target, step, lo, hi):
    return min(hi, max(lo, old + max(-step, min(step, target - old))))


def policy_controls(previous, weather, config, policy):
    supply = _ramp(previous.supply_c, interpolate(config.supply_curve, weather.outdoor_c) + policy[0], 2, 40, 60)
    pump = _ramp(previous.frequency_hz, interpolate(config.pump_curve, weather.outdoor_c) + policy[1], 2, 30, 50)
    target_valves = tuple(base + offset / 100 for base, offset in zip(config.valves, policy[2]))
    valves = tuple(_ramp(old, target, .1, .2, 1) for old, target in zip(previous.valves, target_valves))
    controls = Controls(supply, pump, valves)
    controls.validate(previous)
    return controls


@dataclass(frozen=True)
class PreviewDecision:
    policy: tuple
    controls: Controls
    objective: float
    feasible: bool
    fallback: bool
    reason: str
    prediction_mw: dict[int, float]
    projection: dict[str, float]
    clone_hash: str


class PreviewLookaheadOptimiserV0:
    version = "preview-lookahead-optimiser-v0"

    def __init__(self, config, prediction_provider, policies, objective):
        self.config, self.prediction_provider = config, prediction_provider
        self.policies, self.objective = tuple(policies), objective

    def _rollout(self, snapshot, parameters, current_weather, issued, policy, demand):
        engine = clone_engine(snapshot, parameters)
        previous = engine.controls
        frames, movement = [], 0.0
        for offset in range(0, 180 * 60, engine.dt_s):
            weather = interpolate_forecast(current_weather, issued, offset)
            controls = previous
            if offset % 1800 == 0:
                controls = policy_controls(previous, weather, self.config, policy)
                movement += abs(controls.supply_c - previous.supply_c) / 2
                movement += abs(controls.frequency_hz - previous.frequency_hz) / 2
                movement += sum(abs(a - b) / .1 for a, b in zip(controls.valves, previous.valves))
            frame = engine.step(weather, controls); frames.append(frame); previous = controls
        demand_points = ((0, demand[0]), (60, demand[60]), (120, demand[120]), (180, demand[180]))
        demand_energy = fsum(np.interp((i + 1) * 5, [p[0] for p in demand_points], [p[1] for p in demand_points]) * frame.dt_s / 3600
                             for i, frame in enumerate(frames))
        oversupply = fsum(max(0, frame.actual_heat_w / 1e6 - np.interp((i + 1) * 5,
            [p[0] for p in demand_points], [p[1] for p in demand_points])) * frame.dt_s / 3600
            for i, frame in enumerate(frames))
        pump_kwh = fsum(frame.hydraulics.pump_power_w * frame.dt_s for frame in frames) / 3.6e6
        degree = lambda threshold, fn: fsum(fn(state.indoor_temperature_c - threshold) * frame.dt_s / 3600
            for frame in frames for state in frame.buildings.values()) / 12
        return {"frames": frames, "oversupplyMWh": oversupply, "demandMWh": demand_energy,
            "pumpKWh": pump_kwh, "mildOverheatDegreeHours": degree(23, lambda x: max(0, x)),
            "severeOverheatDegreeHours": degree(25, lambda x: max(0, x)),
            "belowComfortDegreeHours": degree(20, lambda x: max(0, -x)),
            "movement": movement, "minimumIndoorC": min(s.indoor_temperature_c for f in frames for s in f.buildings.values()),
            "firstControls": frames[0].controls}

    def decide(self, engine, parameters, current_weather, issued_forecast, features_by_horizon):
        forbidden = [key for row in issued_forecast for key in row if any(token in key.lower() for token in ("actual", "truth", "required_heat", "indoor"))]
        if forbidden:
            raise ValueError(f"Forecast-only boundary rejected fields: {sorted(set(forbidden))}")
        predictions = {h: self.prediction_provider.predict_required_heat(PredictionInput(h, features_by_horizon[h])).point_mw
                       for h in (60, 120, 180)}
        predictions[0] = features_by_horizon[60]["current_required_load_mw"]
        snapshot = serialize_engine(engine); clone_hash = content_hash(snapshot)
        rollouts = [(policy, self._rollout(snapshot, parameters, current_weather, issued_forecast, policy, predictions))
                    for policy in self.policies]
        traditional = next(result for policy, result in rollouts if policy == (0, 0, (0, 0, 0)))
        weights = self.objective["weights"]
        evaluated = []
        for policy, result in rollouts:
            score = weights["normalizedAvoidableOversupply"] * result["oversupplyMWh"] / max(result["demandMWh"], .001)
            score += weights["normalizedPumpElectricity"] * result["pumpKWh"] / max(traditional["pumpKWh"], .001)
            score += weights["mildOverheatingDegreeHoursAbove23"] * result["mildOverheatDegreeHours"]
            score += weights["severeOverheatingDegreeHoursAbove25"] * result["severeOverheatDegreeHours"]
            score += weights["belowComfortDegreeHoursBelow20"] * result["belowComfortDegreeHours"]
            score += weights["normalizedControlMovement"] * result["movement"]
            evaluated.append((score, policy, result, result["minimumIndoorC"] >= 18))
        feasible = [item for item in evaluated if item[3]]
        fallback = not feasible
        chosen = min(feasible, key=lambda item: (item[0], item[1])) if feasible else next(item for item in evaluated if item[1] == (0, 0, (0, 0, 0)))
        if serialize_engine(engine) != snapshot:
            raise RuntimeError("Candidate evaluation mutated shared starting state")
        score, policy, result, safe = chosen
        projection = {key: value for key, value in result.items() if key not in ("frames", "firstControls")}
        return PreviewDecision(policy, result["firstControls"], score, safe, fallback,
            "Traditional continuation: no safe candidate" if fallback else "minimum frozen Preview objective",
            predictions, projection, clone_hash)


def policy_space(payload):
    return tuple((supply, pump, tuple(pattern)) for supply in payload["supplyOffsetsC"]
                 for pump in payload["pumpOffsetsHz"]
                 for pattern in payload["zoneOffsetPatternsPercentagePoints"].values())
