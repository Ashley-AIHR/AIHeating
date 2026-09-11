# P2.1 Unresolved Fixture Issues — External Review Required

Status: **FAIL for baseline promotion; no further parameter change authorised or applied.**

Physical Fixture v1.1 candidate did not resolve the control-authority conflict.

## Confirmed change and remaining result

Only building `flow_share_weight` changed, by `max(1 W, (21−(−10))/R−internalGain)`. All accepted physical equations and other coefficients, controller curves, zone commissioning algorithm and scenario forcing remain unchanged. Allocation share mismatch is eliminated and Normal compliance improves to 100%, but comfort remains 0% and B01/B02/B04 each remain above 25°C for all 288 evaluation endpoints. The pooled severe rate is still 25% in all five scenarios. The spread falls from 10.2697°C to 8.9674°C, an improvement of about 12.68%, not a resolution of structural imbalance.

## 1. Near-zone fixed-flow authority conflict

At current −5°C with zero solar and the unchanged 44 Hz pump/commissioned valves, B03 needs supply ≥48.6539°C for 18°C indoors, while B01/B02/B04 require supply ≤46.5906°C to stay at or below 25°C. At −10°C/46 Hz the conflicting bounds are ≥55.6593°C and ≤50.3931°C. These intervals are empty. Mid/Far intervals and every building's measured values are in `P2_1_CONTROL_AUTHORITY_ANALYSIS.md`.

This is a fixed-flow static conflict, not proof that the entire pump/valve operating envelope has no feasible solution. Do not overstate it as universal MPC impossibility.

## 2. Static sizing inconsistency relative to the declared design duty

UA remains `1.4×area` for all insulation levels. Envelope H is `0.9×area` for High versus `1.8×area` for Low. Increasing water share cannot make heat proportional to design load because radiator conductance saturates at UA. At design supply 55°C and indoor 21°C, B03's infinite-flow capacity is 46,648 W against 51,744 W required; B09's is 42,840 W against 47,520 W required. This proves insufficient design-21°C capacity at that supply even before finite-flow penalties. It does not make these emitter parameters intrinsically unphysical; it identifies inconsistent synthetic sizing against the declared load/supply design point.

Potential secondary correction for explicit external approval: define a consistent static emitter sizing rule using design duty, chosen supply and design water flow (NTU inversion where feasible), then rerun all regressions. Do not select UA by Normal Winter comfort optimisation. No proposed UA values have been installed; R/C/UA and all gains remain byte-for-byte unchanged in the inherited profiles apart from flow weights.

## 3. Additional authority would be separate scope

Building-level balancing, riser valves or terminal control could reduce excess delivery to better-insulated buildings, but cannot alone overcome deficient emitter capacity in another building. These controls require an explicit model/control-scope decision. No such control or future MPC was implemented.

## Stop / version decision

Do not create `p2_controller_config_v1.1.json` or `P2_BASELINE_FREEZE_MANIFEST_v1.1.json`; do not mark v1.0 superseded. The `traditional-v1.1` identity appearing inside candidate records is reserved for this unaccepted comparison, not an approved release. Candidate outputs are retained under `p2_1_candidate_results/` only as diagnostic evidence. v1.0's 99 historical files remain intact and its external review hold remains in force.

No P3/P4/P5/P6 or UI integration has started. Await external decision on the remaining fixture/control-authority issue.

