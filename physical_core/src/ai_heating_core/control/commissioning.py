"""One offline hydraulic design calculation. No evaluation/weather inputs."""
from math import sqrt

from ..contracts import Controls, ZONES
from ..hydraulics import solve_hydraulics
from ..parameters import Parameters


def commission(parameters: Parameters, design_frequency_hz=45., anchor_opening=.85, increment=.05):
    areas = [sum(b.heated_area_m2 for b in parameters.buildings if b.zone == z) for z in ZONES]
    shares = [a / sum(areas) for a in areas]
    # Equal branch pressure at target shares requires K_i * share_i² = common value.
    candidates = [(b.pipe_k_pa_s2_m6 + b.valve_ref_k_pa_s2_m6 / anchor_opening**2) * s**2
                  for b, s in zip(parameters.branches, shares)]
    common_value = max(candidates)
    continuous = [sqrt(b.valve_ref_k_pa_s2_m6 / (common_value / s**2 - b.pipe_k_pa_s2_m6))
                  for b, s in zip(parameters.branches, shares)]
    valves = tuple(round(round(u / increment) * increment, 10) for u in continuous)
    before = solve_hydraulics(parameters, Controls(frequency_hz=design_frequency_hz))
    after = solve_hydraulics(parameters, Controls(frequency_hz=design_frequency_hz, valves=valves))
    mismatch = lambda h: sum(abs(q / h.total_flow_m3_s - s) for q, s in zip(h.flows_m3_s, shares))
    return {"method": "static-area-shares-anchor85-round5pp-v1", "designFrequencyHz": design_frequency_hz,
            "targetShares": dict(zip(ZONES, shares)), "zoneHeatedAreaM2": dict(zip(ZONES, areas)),
            "anchorZone": ZONES[candidates.index(common_value)], "anchorOpeningFraction": anchor_opening,
            "roundingIncrementFraction": increment, "continuousValveFractions": continuous,
            "fixedValveFractions": valves, "preFlowM3s": before.flows_m3_s, "finalFlowM3s": after.flows_m3_s,
            "preNormalizedShareMismatch": mismatch(before), "finalNormalizedShareMismatch": mismatch(after),
            "finalAvailablePressurePa": after.available_pressure_pa,
            "solverResidual": after.solver.normalized_residual,
            "rationale": "Area-proportional design shares; retain 15% valve headroom at limiting branch and round to practical 5pp increments. No thermal/stress-scenario fitting."}
