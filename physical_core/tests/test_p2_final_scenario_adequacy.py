from dataclasses import asdict
import json
from pathlib import Path

from ai_heating_core.benchmark.runner import run_baseline
from ai_heating_core.control.traditional import config_from_dict
from ai_heating_core.p1_2_scenarios import scenarios

ROOT = Path(__file__).resolve().parents[2]


def test_retained_hydraulic_imbalance_is_far_resistance_only_and_observable():
    healthy, disturbed = scenarios()[0], scenarios()[4]
    assert disturbed.far_pipe_multiplier == 2.0
    assert disturbed.knots == healthy.knots and disturbed.warmup_knots == healthy.warmup_knots
    base, changed = healthy.parameters(), disturbed.parameters()
    expected = asdict(base)
    expected["branches"][2]["pipe_k_pa_s2_m6"] *= 2
    assert asdict(changed) == expected

    config = config_from_dict(json.loads((ROOT / "p1_2_controller_config.json").read_text()))
    a, b = run_baseline(healthy, config), run_baseline(disturbed, config)
    assert a.initial_state["buildingIndoorC"] == b.initial_state["buildingIndoorC"]
    assert a.initial_state["transport"] == b.initial_state["transport"]
    q0, q1 = a.frames[0].hydraulics.flows_m3_s, b.frames[0].hydraulics.flows_m3_s
    assert q1[2] / q0[2] < .85 and q1[0] > q0[0] and q1[1] > q0[1]
    far_ids = [p.building_id for p in base.buildings if p.zone == "far"]
    far_mean = lambda run: sum(frame.buildings[i].indoor_temperature_c for frame in run.frames for i in far_ids) / (len(run.frames) * len(far_ids))
    assert far_mean(b) < far_mean(a) - .1
    assert b.summary["solverFailureCount"] == 0
