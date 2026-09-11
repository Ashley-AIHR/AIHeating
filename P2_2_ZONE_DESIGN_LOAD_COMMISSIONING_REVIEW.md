# P2.2 — Zone Design-Load Commissioning Review

Status: SHADOW DIAGNOSTIC ONLY. Do not adopt or freeze this alternative. The accepted physical fixture, original configuration files and runtime controller are unchanged.

## Target calculation and unchanged algorithm

At design indoor 21°C, outdoor −10°C, zero solar and unchanged internal gains:

`Qdesign_i = max(0, (21 - (-10))/R_i - Qinternal_i)`

`zoneTarget_z = sum(Qdesign_i in z) / sum(Qdesign_i)`

All fixture loads are positive; this equals the v1.1 design-maintenance definition on this fixture (its positive allocation-weight floor is inactive). Design loads total **470,011 W**. These are thermal loads, not heated areas.

| Zone | Heated area (m²) | Design load (W) | Area target (%) | Design-load target (%) |
| --- | ---: | ---: | ---: | ---: |
| near | 4260 | 133416 | 32.9977 | 28.3857 |
| mid | 4250 | 158525 | 32.9202 | 33.7279 |
| far | 4400 | 178070 | 34.0821 | 37.8863 |

The exact existing `control/commissioning.py::commission()` runs twice. It has no target-share argument and reads heated-area metadata internally. The analysis-only adapter supplies a disposable dataclass view whose target-weight input contains design loads. This is not a physical-area modification: that view never enters SimulationEngine or a saved physical fixture. Its legacy area-labelled result field is renamed `zoneDesignLoadTargetWeightsW`. The original physical parameters independently reproduce the final hydraulic flows exactly.

Both runs retain the accepted 45 Hz design condition, actual coupled hydraulic solver, equipment bounds, limiting-branch 85% anchor and 5-percentage-point practical rounding. There is no thermal-objective fitting, manual valve tuning or new optimisation algorithm. The legacy method ID remains `static-area-shares-anchor85-round5pp-v1` to identify the reused implementation; the shadow result separately states `targetSource: design-maintenance-load-share`.

| Target | Zone | Continuous valve (%) | Rounded fixed valve (%) | Actual resulting flow share (%) |
| --- | --- | ---: | ---: | ---: |
| Area | near | 49.1958 | 50.0000 | 33.3754 |
| Area | mid | 60.5907 | 60.0000 | 32.6211 |
| Area | far | 85.0000 | 85.0000 | 34.0036 |
| Design load (shadow) | near | 36.7558 | 35.0000 | 27.3701 |
| Design load (shadow) | mid | 54.0795 | 55.0000 | 34.4314 |
| Design load (shadow) | far | 85.0000 | 85.0000 | 38.1985 |

Normalized mismatch is `sum_z abs(actualShare_z - targetShare_z)`, a dimensionless L1 difference after rounding. Each result uses its **own** target: area 0.007554379; design load 0.020312112. Available pressure is 55650.4768 / 62988.9536 Pa respectively. The resulting shadow fixed valves are **35% / 55% / 85% (Near / Mid / Far)**.

## Fresh warm-up and comparable dynamic runs

Only Normal Winter and Cold Wave are evaluated, 24 hours each, 288 five-minute endpoint frames. The original Traditional weather/pump curves, 30-minute control interval, slew limits, forcing, physics and within-zone v1.1 flow weights are reused. Shadow identity and fixed commissioned valve values are isolated in the analysis configuration, not installed as runtime defaults.

The accepted convergence rule is rerun under the new valve settings; old initial states are not reused.

| Scenario | 72 vs 96 h max indoor difference (°C) | 96 vs 120 h max indoor difference (°C) | Selected warm-up |
| --- | ---: | ---: | ---: |
| normal_winter | 0.354725 | 0.159312 | 96 h |
| cold_wave | 0.351427 | 0.158142 | 96 h |

The initial 72/96 comparison fails the 0.2°C indoor criterion; the fallback 96/120 comparison passes. Delivered supply and flow differences are zero. Each scenario has a freshly exported initial state. Exact CSV and summary replay passes for both cases, with zero solver failures.

## Metric definitions

All dynamic rates use the unchanged equally weighted building-time endpoint samples (12 × 288 = 3,456 per scenario). Compliance means ≥18°C, **not** the two-sided static 18–25°C criterion. Comfort is inclusive 20–22°C; overheating >23°C; severe overheating >25°C; underheating <18°C. Percentiles sort these samples and select index `floor((n-1)*p)`. Dynamic spread is P90−P10, unlike the static report's max−min. Heat integrates actual heat power to MWh; pump electricity integrates pump power to kWh. Neither is a claim of savings from MPC.

The unchanged hydraulic balance index still references **area targets** for both runs. Its decrease is not a design-load-target tracking metric. Use the own-target commissioning mismatch above for that separate question.

## Aggregate measured comparison

### normal_winter

| Metric | Area-zone v1.1 reference | Design-load-zone shadow |
| --- | ---: | ---: |
| Compliance ≥18°C (%) | 100.0000 | 100.0000 |
| Comfort 20–22°C (%) | 0.0000 | 0.0000 |
| Overheating >23°C (%) | 57.2917 | 64.6123 |
| Severe overheating >25°C (%) | 25.0000 | 25.0000 |
| Underheating <18°C (%) | 0.0000 | 0.0000 |
| Minimum indoor (°C) | 18.4858 | 18.5986 |
| Maximum indoor (°C) | 28.4828 | 27.6827 |
| P10 (°C) | 19.1256 | 19.0152 |
| P50 (°C) | 23.0841 | 23.1398 |
| P90 (°C) | 28.0931 | 27.2805 |
| P90−P10 spread (°C) | 8.9674 | 8.2653 |
| Heat (MWh) | 9.977267 | 9.923577 |
| Pump electricity (kWh) | 26.001788 | 26.358599 |
| Excess delivered heat above instantaneous required load (MWh) | 0.870988 | 0.817299 |
| Hydraulic balance index (original area target) | 0.996223 | 0.943724 |
| Solver failures | 0 | 0 |

| Zone | Reference mean flow (m³/h) | Shadow mean flow (m³/h) |
| --- | ---: | ---: |
| near | 13.552189 | 10.525327 |
| mid | 13.245885 | 13.240786 |
| far | 13.807255 | 14.689435 |

### normal_winter — all-building exposure

Each cell below is **reference → shadow**. Rates are percentages of that building's 288 endpoint samples.

| Building | Mean flow (m³/h) | Mean indoor (°C) | Min indoor (°C) | Max indoor (°C) | Comfort (%) | Overheat (%) | Severe (%) | Underheat (%) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| B01 | 3.035 → 2.357 | 28.042 → 27.229 | 27.813 → 26.991 | 28.234 → 27.427 | 0.0000 → 0.0000 | 100.0000 → 100.0000 | 100.0000 → 100.0000 | 0.0000 → 0.0000 |
| B02 | 2.479 → 1.925 | 28.244 → 27.438 | 27.960 → 27.145 | 28.483 → 27.683 | 0.0000 → 0.0000 | 100.0000 → 100.0000 | 100.0000 → 100.0000 | 0.0000 → 0.0000 |
| B03 | 5.256 → 4.082 | 19.321 → 18.914 | 19.011 → 18.599 | 19.617 → 19.214 | 0.0000 → 0.0000 | 0.0000 → 0.0000 | 0.0000 → 0.0000 | 0.0000 → 0.0000 |
| B04 | 2.782 → 2.161 | 27.860 → 27.045 | 27.641 → 26.819 | 27.996 → 27.186 | 0.0000 → 0.0000 | 100.0000 → 100.0000 | 100.0000 → 100.0000 | 0.0000 → 0.0000 |
| B05 | 3.428 → 3.427 | 23.088 → 23.087 | 22.836 → 22.835 | 23.336 → 23.335 | 0.0000 → 0.0000 | 62.8472 → 62.5000 | 0.0000 → 0.0000 | 0.0000 → 0.0000 |
| B06 | 3.273 → 3.271 | 23.272 → 23.271 | 22.977 → 22.976 | 23.566 → 23.565 | 0.0000 → 0.0000 | 93.4028 → 93.0556 | 0.0000 → 0.0000 | 0.0000 → 0.0000 |
| B07 | 2.867 → 2.866 | 23.153 → 23.152 | 22.898 → 22.897 | 23.398 → 23.397 | 0.0000 → 0.0000 | 74.3056 → 73.9583 | 0.0000 → 0.0000 | 0.0000 → 0.0000 |
| B08 | 3.678 → 3.676 | 22.996 → 22.995 | 22.787 → 22.786 | 23.185 → 23.184 | 0.0000 → 0.0000 | 49.3056 → 49.3056 | 0.0000 → 0.0000 | 0.0000 → 0.0000 |
| B09 | 3.685 → 3.920 | 18.818 → 18.929 | 18.486 → 18.599 | 19.134 → 19.244 | 0.0000 → 0.0000 | 0.0000 → 0.0000 | 0.0000 → 0.0000 | 0.0000 → 0.0000 |
| B10 | 3.037 → 3.231 | 23.086 → 23.241 | 22.787 → 22.944 | 23.385 → 23.538 | 0.0000 → 0.0000 | 60.0694 → 85.0694 | 0.0000 → 0.0000 | 0.0000 → 0.0000 |
| B11 | 3.760 → 4.000 | 22.966 → 23.122 | 22.708 → 22.865 | 23.215 → 23.369 | 0.0000 → 0.0000 | 44.4444 → 68.0556 | 0.0000 → 0.0000 | 0.0000 → 0.0000 |
| B12 | 3.326 → 3.539 | 22.808 → 22.965 | 22.596 → 22.754 | 23.001 → 23.156 | 0.0000 → 0.0000 | 3.1250 → 43.4028 | 0.0000 → 0.0000 | 0.0000 → 0.0000 |

Maximum normalized physical residuals in shadow run: `mass_residual` 1.556e-16; `heat_balance_residual` 1.748e-15; `pipe_heat_balance_residual` 6.071e-15; `building_heat_balance_residual` 7.561e-14; `pipe_volume_residual` 1.876e-16. Runtime conservation checks remain enabled.

### cold_wave

| Metric | Area-zone v1.1 reference | Design-load-zone shadow |
| --- | ---: | ---: |
| Compliance ≥18°C (%) | 96.4120 | 94.9363 |
| Comfort 20–22°C (%) | 0.0000 | 0.0000 |
| Overheating >23°C (%) | 44.8785 | 50.6944 |
| Severe overheating >25°C (%) | 25.0000 | 25.0000 |
| Underheating <18°C (%) | 3.5880 | 5.0637 |
| Minimum indoor (°C) | 17.3046 | 17.4245 |
| Maximum indoor (°C) | 28.1957 | 27.3913 |
| P10 (°C) | 18.9858 | 18.9407 |
| P50 (°C) | 22.9128 | 23.0100 |
| P90 (°C) | 27.8810 | 27.0416 |
| P90−P10 spread (°C) | 8.8951 | 8.1008 |
| Heat (MWh) | 11.489182 | 11.421256 |
| Pump electricity (kWh) | 29.890133 | 30.300303 |
| Excess delivered heat above instantaneous required load (MWh) | 0.431504 | 0.399955 |
| Hydraulic balance index (original area target) | 0.996223 | 0.943724 |
| Solver failures | 0 | 0 |

| Zone | Reference mean flow (m³/h) | Shadow mean flow (m³/h) |
| --- | ---: | ---: |
| near | 14.188724 | 11.019692 |
| mid | 13.868033 | 13.862694 |
| far | 14.455770 | 15.379385 |

### cold_wave — all-building exposure

Each cell below is **reference → shadow**. Rates are percentages of that building's 288 endpoint samples.

| Building | Mean flow (m³/h) | Mean indoor (°C) | Min indoor (°C) | Max indoor (°C) | Comfort (%) | Overheat (%) | Severe (%) | Underheat (%) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| B01 | 3.178 → 2.468 | 27.839 → 27.014 | 27.671 → 26.862 | 27.997 → 27.186 | 0.0000 → 0.0000 | 100.0000 → 100.0000 | 100.0000 → 100.0000 | 0.0000 → 0.0000 |
| B02 | 2.595 → 2.016 | 28.001 → 27.183 | 27.781 → 27.002 | 28.196 → 27.391 | 0.0000 → 0.0000 | 100.0000 → 100.0000 | 100.0000 → 100.0000 | 0.0000 → 0.0000 |
| B03 | 5.503 → 4.274 | 18.912 → 18.498 | 17.929 → 17.493 | 19.535 → 19.137 | 0.0000 → 0.0000 | 0.0000 → 0.0000 | 0.0000 → 0.0000 | 7.2917 → 28.8194 |
| B04 | 2.913 → 2.262 | 27.677 → 26.855 | 27.509 → 26.725 | 27.792 → 26.982 | 0.0000 → 0.0000 | 100.0000 → 100.0000 | 100.0000 → 100.0000 | 0.0000 → 0.0000 |
| B05 | 3.589 → 3.588 | 22.795 → 22.794 | 22.220 → 22.219 | 23.165 → 23.164 | 0.0000 → 0.0000 | 46.5278 → 46.5278 | 0.0000 → 0.0000 | 0.0000 → 0.0000 |
| B06 | 3.426 → 3.425 | 22.962 → 22.961 | 22.370 → 22.369 | 23.350 → 23.349 | 0.0000 → 0.0000 | 55.5556 → 55.5556 | 0.0000 → 0.0000 | 0.0000 → 0.0000 |
| B07 | 3.002 → 3.001 | 22.876 → 22.875 | 22.327 → 22.326 | 23.227 → 23.226 | 0.0000 → 0.0000 | 50.6944 → 50.6944 | 0.0000 → 0.0000 | 0.0000 → 0.0000 |
| B08 | 3.850 → 3.849 | 22.759 → 22.758 | 22.255 → 22.254 | 23.071 → 23.070 | 0.0000 → 0.0000 | 31.5972 → 30.9028 | 0.0000 → 0.0000 | 0.0000 → 0.0000 |
| B09 | 3.858 → 4.104 | 18.343 → 18.456 | 17.305 → 17.425 | 19.034 → 19.142 | 0.0000 → 0.0000 | 0.0000 → 0.0000 | 0.0000 → 0.0000 | 35.7639 → 31.9444 |
| B10 | 3.179 → 3.383 | 22.768 → 22.926 | 22.167 → 22.334 | 23.161 → 23.315 | 0.0000 → 0.0000 | 36.4583 → 53.8194 | 0.0000 → 0.0000 | 0.0000 → 0.0000 |
| B11 | 3.936 → 4.188 | 22.683 → 22.841 | 22.124 → 22.291 | 23.039 → 23.192 | 0.0000 → 0.0000 | 17.7083 → 48.9583 | 0.0000 → 0.0000 | 0.0000 → 0.0000 |
| B12 | 3.482 → 3.705 | 22.565 → 22.723 | 22.052 → 22.219 | 22.884 → 23.037 | 0.0000 → 0.0000 | 0.0000 → 21.8750 | 0.0000 → 0.0000 | 0.0000 → 0.0000 |

Maximum normalized physical residuals in shadow run: `mass_residual` 1.465e-16; `heat_balance_residual` 1.413e-15; `pipe_heat_balance_residual` 6.361e-15; `building_heat_balance_residual` 5.413e-14; `pipe_volume_residual` 1.876e-16. Runtime conservation checks remain enabled.

## Interpretation and decision

Normal Winter is a mixed redistribution, not a materially more credible baseline. Maximum indoor temperature decreases 28.4828→27.6827°C and P90−P10 narrows 8.9674→8.2653°C; heat falls slightly. But comfort remains 0%, severe overheating remains 25%, overheating exposure increases 57.2917→64.6123%, and pump electricity increases. B01/B02/B04 remain severely overheated throughout all sampled endpoints.

Cold Wave has a worse compliance tradeoff: 96.4120→94.9363%, with underheating 3.5880→5.0637%. B09 underheating improves 35.7639→31.9444%, but B03 underheating worsens 7.2917→28.8194%. Peak temperature and spread improve, yet severe overheating remains 25%, comfort remains 0%, overall overheating rises and pump electricity increases.

**Do not replace area commissioning or freeze the shadow configuration.** Design-load zone shares alone do not remove the within-Near heating conflict. This result complements, but does not itself prove, the static infeasibility certificate at −10°C.

## Reproducibility and artifacts

Run from repository root:

```sh
physical_core/.venv/bin/python physical_core/scripts/run_p2_2_shadow.py
```

Actual exit: 0. Generated evidence: [machine-readable comparison](p2_2_zone_commissioning_results.json), [Normal CSV](p2_2_shadow_results/normal_winter.csv), [Cold CSV](p2_2_shadow_results/cold_wave.csv), and separate scenario initial-state JSON files in the same directory. The runner exports evidence only; it does not promote a baseline.

Implementation: `physical_core/src/ai_heating_core/shadow_commissioning_analysis.py` and `physical_core/scripts/run_p2_2_shadow.py`. Physical parameter hash remains `bd4b142e38b7c85a2749c34d129efdfe6f44d4c1f9bd9943cac7b4c7357c0260`. Historical hash preservation and exact replay are independently checked by F12–F14.

