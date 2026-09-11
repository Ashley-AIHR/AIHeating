"""Warm up, fork and evaluate; no scenario data enters the controller object."""
from dataclasses import asdict, dataclass

from ..control.traditional import TraditionalHeatingController
from ..simulation import SimulationEngine
from .metrics import summary
from .state import restore, snapshot


@dataclass
class BenchmarkResult:
    scenario_id: str
    initial_state: dict
    frames: list
    controller_states: list
    summary: dict


def warm_up(scenario, config, hours=None, dt_s=300):
    hours = config.warmup_hours if hours is None else hours
    if hours <= 0 or (hours*3600) % 86400:
        raise ValueError("warmup uses positive complete daily cycles")
    beginning = -int(hours*3600)
    controller = TraditionalHeatingController(config)
    state = controller.initialize(beginning, scenario.weather(beginning, warmup=True).outdoor_c)
    engine = SimulationEngine(scenario.parameters(evaluation=False), state.controls(), dt_s=dt_s)
    # Initialize a prehistory coordinate. Subsequent clock changes are P1A.step only.
    engine.elapsed_s = beginning
    while engine.elapsed_s < 0:
        weather = scenario.weather(engine.elapsed_s, warmup=True)
        state = controller.update(engine.elapsed_s, weather.outdoor_c, state)
        engine.step(weather, state.controls())
    # An explicit static network disturbance changes coefficients, never dynamic flows/temperatures.
    engine.parameters = scenario.parameters(evaluation=True)
    return snapshot(engine, state, config)


def evaluate(scenario, config, initial_state):
    engine, state = restore(initial_state, scenario.parameters(), config)
    if engine.elapsed_s != 0:
        raise ValueError("official evaluation must start at elapsed time zero")
    controller = TraditionalHeatingController(config)
    frames, states = [], []
    while engine.elapsed_s < 86400:
        weather = scenario.weather(engine.elapsed_s)
        next_state = controller.update(engine.elapsed_s, weather.outdoor_c, state)
        frame = engine.step(weather, next_state.controls())
        state = next_state  # Commit controller state only after a successful physical step.
        frames.append(frame)
        states.append(state)
    areas = [sum(b.heated_area_m2 for b in scenario.parameters(evaluation=False).buildings if b.zone==z) for z in ("near","mid","far")]
    shares = tuple(a/sum(areas) for a in areas)
    metrics = summary(frames, scenario.scenario_id, config, shares)
    return BenchmarkResult(scenario.scenario_id, initial_state, frames, states, metrics)


def run_baseline(scenario, config, *, dt_s=300):
    return evaluate(scenario, config, warm_up(scenario, config, dt_s=dt_s))


def serialized_output(result):
    return {"frames": [asdict(f) for f in result.frames], "controllerStates": [asdict(s) for s in result.controller_states], "summary": result.summary}


def convergence(scenario, config, hours=(72,96)):
    a, b = warm_up(scenario, config, hours[0]), warm_up(scenario, config, hours[1])
    temperatures = {k: abs(v-b["buildingIndoorC"][k]) for k,v in a["buildingIndoorC"].items()}
    # First post-warmup frame supplies a return-temperature observation at equal forcing.
    ea, sa = restore(a, scenario.parameters(), config)
    eb, sb = restore(b, scenario.parameters(), config)
    controller = TraditionalHeatingController(config)
    weather = scenario.weather(0)
    fa = ea.step(weather, controller.update(0, weather.outdoor_c, sa).controls())
    fb = eb.step(weather, controller.update(0, weather.outdoor_c, sb).controls())
    return {"hoursCompared": list(hours), "perBuildingDifferenceC": temperatures,
            "maxIndoorDifferenceC": max(temperatures.values()),
            "maxDeliveredSupplyDifferenceC": max(abs(a["transport"][z]["deliveredSupplyC"]-b["transport"][z]["deliveredSupplyC"]) for z in a["transport"]),
            "maxFlowDifferenceM3s": max(abs(x-y) for x,y in zip(a["previousHydraulicFlowsM3s"],b["previousHydraulicFlowsM3s"])),
            "packetInventoriesIdentical": all(a["transport"][z]["packets"]==b["transport"][z]["packets"] for z in a["transport"]),
            "maxInventoryEnergyDifferenceJ": max(abs(ea.buffers[z].energy_j()-eb.buffers[z].energy_j()) for z in ea.buffers),
            "maxInventoryVolumeDifferenceM3": max(abs(ea.buffers[z].volume_m3-eb.buffers[z].volume_m3) for z in ea.buffers),
            "firstFrameStationReturnDifferenceC": abs(fa.station_return_c-fb.station_return_c),
            "thresholdC": .2, "recommendedWarmupHours": hours[0] if max(temperatures.values())<.2 else hours[1]}
