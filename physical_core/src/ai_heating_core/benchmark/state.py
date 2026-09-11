"""Serializable engine/controller snapshot adapter; accepted P1A is unchanged."""
from collections import deque
from dataclasses import asdict
import hashlib
import json

from ..contracts import Controls, ZONES
from ..control.traditional import ControllerState, config_to_dict
from ..simulation import SimulationEngine
from ..transport import DelayLine


def stable_json(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False)


def content_hash(value):
    return hashlib.sha256(stable_json(value).encode()).hexdigest()


def snapshot(engine, controller_state, config):
    return {"schemaVersion": "evaluation-initial-state-v1", "physicalParameterHash": content_hash(asdict(engine.parameters)),
            "controllerConfigHash": content_hash(config_to_dict(config)), "elapsedSeconds": engine.elapsed_s,
            "physicalTimestepSeconds": engine.dt_s, "controls": asdict(engine.controls),
            "buildingIndoorC": dict(engine.temperatures), "previousHydraulicFlowsM3s": engine.previous_flows,
            "heatEnergyJ": engine.heat_energy_j, "pumpEnergyJ": engine.pump_energy_j,
            "transport": {z:{"equivalentVolumeM3": b.equivalent_volume_m3, "packets": list(b.packets),
                               "deliveredSupplyC": b.delivered_supply_c, "currentFlowM3s": b.current_flow_m3_s}
                          for z,b in engine.buffers.items()}, "controllerState": asdict(controller_state)}


def restore(value, parameters, config):
    stable_json(value)  # reject nonfinite serialized state
    if value["schemaVersion"] != "evaluation-initial-state-v1":
        raise ValueError("unsupported evaluation state schema")
    if value["physicalParameterHash"] != content_hash(asdict(parameters)) or value["controllerConfigHash"] != content_hash(config_to_dict(config)):
        raise ValueError("snapshot parameter/config hash mismatch")
    c = Controls(**{**value["controls"], "valves": tuple(value["controls"]["valves"])})
    engine = SimulationEngine(parameters, c, value["buildingIndoorC"], value["physicalTimestepSeconds"])
    if value["elapsedSeconds"] % engine.dt_s:
        raise ValueError("snapshot clock not on physical timestep")
    engine.elapsed_s = value["elapsedSeconds"]
    engine.heat_energy_j = value["heatEnergyJ"]
    engine.pump_energy_j = value["pumpEnergyJ"]
    flows = value["previousHydraulicFlowsM3s"]
    if flows is not None and (len(flows) != 3 or min(flows) < 0):
        raise ValueError("invalid hydraulic warm start")
    engine.previous_flows = tuple(flows) if flows is not None else None
    if set(value["transport"]) != set(ZONES):
        raise ValueError("invalid transport zone keys")
    for branch in parameters.branches:
        data = value["transport"][branch.zone]
        if data["equivalentVolumeM3"] != branch.equivalent_volume_m3 or data["currentFlowM3s"] < 0:
            raise ValueError("transport volume/flow mismatch")
        line = DelayLine(branch.equivalent_volume_m3, data["deliveredSupplyC"])
        line.packets = deque(tuple(packet) for packet in data["packets"])
        if not line.packets or any(v<=0 for v,t in line.packets) or abs(line.volume_m3-branch.equivalent_volume_m3) > 1e-10*branch.equivalent_volume_m3:
            raise ValueError("invalid transport packet inventory")
        line.delivered_supply_c = data["deliveredSupplyC"]
        line.current_flow_m3_s = data["currentFlowM3s"]
        engine.buffers[branch.zone] = line
    state = ControllerState.from_dict(value["controllerState"])
    if state.controls() != c or state.controller_version != config.version or state.fixed_valves != config.valves:
        raise ValueError("controller and engine applied states disagree")
    if not state.last_boundary_s <= engine.elapsed_s <= state.next_boundary_s or state.next_boundary_s-state.last_boundary_s != config.interval_s:
        raise ValueError("controller boundary state is inconsistent")
    return engine, state
