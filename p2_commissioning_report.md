# P2 Offline Zone Commissioning

Method `static-area-shares-anchor85-round5pp-v1`. Static synthetic design condition: accepted P1A branch resistances, 45 Hz pump frequency, no thermal/weather scenario input. Targets are heated-area shares, not fitted future heat loads.

| Zone | Area m² | Target share | All-60% flow m³/h | Continuous opening % | Fixed opening % | Final flow m³/h |
|---|---:|---:|---:|---:|---:|---:|
| Near | 4260 | 0.3299767622 | 16.029112 | 49.195795 | 50 | 13.776698 |
| Mid | 4250 | 0.3292021689 | 13.501587 | 60.590746 | 60 | 13.465320 |
| Far | 4400 | 0.3408210689 | 11.660192 | 85.000000 | 85 | 14.035989 |

Accepted resistance law: `K_i = K_pipe_i + K_valve_ref_i/u_i²`, branch pressure drop `K_i*q_i²`. For desired shares `s_i`, equal pressure gives common `K_i*s_i²`. Anchor the limiting Far branch at u=0.85, derive the others algebraically and round to 0.05 openings. This leaves 15 percentage points of Far headroom and a small practical residual mismatch. It is one static commissioning calculation, not a runtime optimiser.

Normalized L1 share mismatch `Σ|q_i/Σq−s_i|` falls from **0.1183307869 to 0.0075543790**. Corresponding HBI improves from 0.9408346066 to 0.9962228105. Final available branch pressure is 55.650477 kPa; normalized hydraulic solver residual is 2.4322e−13. Full precision is retained under `commissioning` in `p2_adequacy_review.json`.

The selected 50/60/85% values are inside 20–100% equipment limits and apply before warm-up. Runtime movement is zero in all five scenarios. The imbalance case changes Far pipe resistance, not these valves or target area shares.

Area balancing is reasonable but is not indoor-temperature balancing: accepted within-zone flow allocation cannot independently match heterogeneous building thermal resistances. Near B03 can approach 18°C while better-insulated Near buildings exceed 25°C. This limitation is disclosed in `P2_BASELINE_FAIRNESS_REVIEW.md`; neither physics nor controller curves were altered to conceal it.
