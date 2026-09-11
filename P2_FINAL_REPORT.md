# Phase 2 Final Report — Traditional Heating Control Baseline

Date: 2026-09-08. Local version: traditional-v1.0. External acceptance pending. P0 frozen; P1A accepted and unchanged; P1B skipped; P3 not started.

## 1. Executive Summary

Implemented and locally froze a deterministic current-outdoor-only Traditional benchmark: unchanged recommended curves, fixed commissioned valves, 96-hour physical warm-up, five 24-hour scenarios and exact state replay. All 20 P2 Gates, 34 P2 tests, 84 P1A tests, 32 P1A Gates, and P0 typecheck/62 assertions/build pass.

This is a qualified engineering self-assessment, not external acceptance or proof of comfortable real-plant operation. Normal compliance is 98.4375%, but comfort is 0%, overheating 67.1007% and severe overheating 25%. These substantial benchmark limitations are disclosed rather than tuned away. No future AI benefit is claimed.

## 2. Scope

Delivered conventional weather compensation and pump scheduling; offline static commissioning; physical/controller snapshots; warm-up/convergence; five small benchmark exports; measured Gates, regression and hash-based freeze. No forecasting, ML, MPC, constant-ΔP loop, AI Advisory, Tutor, APIs, React integration, occupant model, floor heating or P3 training dataset generation.

## 3. Repository Changes

Added isolated `control/` and `benchmark/` modules, `p2_scenarios.py`, three P2 test files and five P2 scripts beneath `physical_core/`. Reused the accepted environment and dependencies; no new library or generic platform framework. This follows the ponytail skill's minimal implementation guidance.

Accepted P1A source, tests, scripts, parameter export, reports and dependency lock are protected by 27 pre-implementation SHA-256 entries in `p2_accepted_p1a_manifest.json`. All remain unchanged. Frozen P0 source/contracts/lock and test/build behavior remain unchanged. The existing `.gitignore` change and untracked accepted P1A work predate P2; they were preserved. No commit, remote push, tag or history rewrite was performed in this phase.

Required artifacts exist: implementation plan, Traditional spec, controller config, commissioning report, scenario manifest, five JSON initial states, five CSVs (288 rows × 56 columns each), 30 engineering plots, Gate Markdown/JSON, fairness review, freeze manifest and this report. Supporting adequacy, summary and command-output JSON files are retained.

## 4. Traditional Controller Architecture

`TraditionalHeatingController.update(timestamp_s, outdoor_c, state)` computes only from the current outdoor sample, immutable config and previous control state. The runner owns forcing and the accepted `SimulationEngine`; it cannot pass a future series, indoor state or solar value through the controller signature. One implementation operates unchanged in all five cases. Controller state is committed after the corresponding physical step succeeds. JSON state adapters are additive; no P1A snapshot API or physical equation was modified.

## 5. Weather Compensation

Piecewise linear interpolation at outdoor −15/−10/−5/0/5/10°C gives raw supply 58/55/51/47/43/40°C. Endpoint clamping applies beyond knots; applied equipment bounds stay 40–60°C. Original recommended values are unchanged; the tuning change ledger is empty. G2.1 sweeps 351 values from −20 to +15°C, measuring output 40–58°C with zero monotonicity violations.

## 6. Pump Frequency Policy

At the same outdoor knots, raw pump targets are 48/46/44/42/38/34 Hz. Linear interpolation and endpoint clamping; absolute limits 30–50 Hz. It is a current-outdoor frequency schedule, not constant differential pressure. Actual pressure/flow/power come from accepted coupled hydraulics. G2.2 reports no monotonicity or bound violation.

## 7. Zone Commissioning

One offline static calculation at 45 Hz uses heated areas 4260/4250/4400 m² and target shares 0.3299767622/0.3292021689/0.3408210689. Far is anchored at 85%; accepted resistance law solves continuous Near/Mid openings, rounded to practical 5pp increments. No future weather, indoor temperature or benchmark objective is used.

Normalized L1 share mismatch improves from 0.1183307869 to 0.0075543790. Full before/after flows, method and rationale: `p2_commissioning_report.md`; full precision: `p2_adequacy_review.json`.

## 8. Fixed Zone Valve Values

Near **50%**, Mid **60%**, Far **85%**. The valves are applied before warm-up and held throughout all evaluations. Runtime valve movement is exactly zero, including after the Far-resistance disturbance. No dynamic balancing or hidden per-scenario valve branch exists.

## 9. Rate Limits

At each accepted boundary, applied supply/pump = previous applied value + clamp(raw−previous, −2, +2), using °C and Hz respectively. Across 1,440 official frames: zero bound violations, zero rate violations, zero off-boundary control changes and zero valve changes. Maximum observed boundary change is 0.9000000000000057°C and 0.9000000000000057 Hz (floating-point representation of 0.9).

The official weather is smooth enough that raw and applied curves usually overlap; dedicated abrupt-change unit tests exercise both ±2 limits. No delay is added to make the Traditional controller appear slow.

## 10. Controller Interval

Control interval 1,800 s (30 min); physical timestep 300 s by default, with 600/900 s tests. Recalculate only at boundaries, hold between boundaries, reject skipped/backward boundary transitions. Current left-end forcing is held for each physical step; frame/CSV timestamps denote interval ends. The first CSV row at 08:05 covers 08:00–08:05, not a missing initial interval.

## 11. Warm-up Strategy

Run the same physical model and controller over explicit repeated daily prehistory. Official warm-up is 96 hours in all five scenarios. The arbitrary 20°C seed is only a prehistory starting value; it is never injected at evaluation start. FIFO inventories, indoor state, controls, hydraulic warm-start and lifetime energy persist through elapsed zero. Warm-up samples are excluded from all official energy/exposure/percentile metrics.

## 12. Warm-up Convergence

| Comparison | Max indoor Δ°C | Delivered supply Δ°C | Flow Δ m³/s | First post-warm-up station return Δ°C | Decision |
| --- | --- | --- | --- | --- | --- |
| 72 vs 96 h | 0.3814111849 | 0 | 0 | 0.0389354590 | 72 h rejected |
| 96 vs 120 h | 0.1631001399 | 0 | 0 | 0.0148991381 | 96 h accepted against <0.2°C |

The threshold was not relaxed. Ordered packet lists are not bit-identical between different-length prehistories due to tiny boundary packet rounding; inspected inventory-volume difference is 1.776e−15 m³ and inventory-energy difference is at most 4.768e−7 J. Those inventory scalar comparisons use the first equal-forcing post-warm-up step; packet-list equality uses evaluation-start snapshots. Same-initial-state replay, unlike different-length convergence, is exactly identical.

## 13. Evaluation Initial State

Each `p2_initial_states/<scenarioId>.json` contains version, physical/config hashes, clock/timestep, twelve indoor temperatures, current applied controls, previous zone flows, cumulative heat/pump energy, all FIFO packet volumes/temperatures and delivered supply/current flow, plus controller raw/applied targets and last/next boundaries.

At evaluation elapsed zero, the zero boundary is pending and the last accepted boundary is −1800 s. Restoring performs that same boundary update on the first step. Quasi-steady pressure and return temperatures are recomputed by accepted P1A, not independently guessed. G2.15–G2.17 verify all five first frames and entire serialized outputs. Freeze preflight additionally reloaded exported snapshots and exactly matched every exported CSV field and summary in all five 288-row runs.

## 14. Scenario Definitions

| ID (all v1.0) | Outdoor °C | Solar peak W/m² | Evaluation physical change |
| --- | --- | --- | --- |
| normal_winter | −8→−2→−8 | 180 | None |
| cold_wave | −5→−14→−12 | 130 | None |
| rapid_warming | −8→5→−8 | 480 | None |
| sunny_winter | −6→0→−6 | 500 | None |
| hydraulic_imbalance | Same as normal | 180 | Far pipe resistance ×2 at t=0 |

Each evaluates 2025-01-15 08:00 through January 16 08:00 (+08:00), after 96 hours of explicit warm-up. Normal and Cold Wave were the only adequacy cases before stress evaluation; curves were not retuned. Exact weather/solar/wind knots, prehistories, configuration IDs and physical override are frozen in `p2_baseline_scenarios.json`. No randomness, forced indoor temperatures or overwritten hydraulic flows.

## 15. Normal Winter Results

Heat 9.978827 MWh; pump electricity 26.001788 kWh. Compliance 98.4375%, comfort 0.0000%, overheating 67.1007%, severe overheating 25.0000%, underheating 1.5625%. Indoor range 17.9268–29.0651°C. Solver failures: 0.

Meets the predeclared ≥95% compliance adequacy criterion without solver/control malfunction. It does not meet an aspirational high-comfort outcome: the accepted mixed-insulation fixture produces a large spread. Do not present this as a fully balanced comfortable building portfolio.

Evidence: `p2_normal_winter.csv`, `p2_initial_states/normal_winter.json`, and six engineering plots under `p2_validation_plots/normal_winter/`.

## 16. Cold Wave Results

Heat 11.497637 MWh; pump electricity 29.890133 kWh. Compliance 91.7824%, comfort 0.0000%, overheating 52.2280%, severe overheating 25.0000%, underheating 8.2176%. Indoor range 16.7105–28.7769°C. Solver failures: 0.

Targets rise during all 18 declining-outdoor transitions; minimum raw rises are approximately 0.3°C supply and 0.2 Hz pump. Compliance drops as the physical load grows; minimum indoor temperature is 16.71°C. No knowledge of cold-wave arrival is available to the controller.

Evidence: `p2_cold_wave.csv`, `p2_initial_states/cold_wave.json`, and six engineering plots under `p2_validation_plots/cold_wave/`.

## 17. Rapid Warming Results

Heat 8.633956 MWh; pump electricity 23.090458 kWh. Compliance 99.5370%, comfort 2.3148%, overheating 79.1667%, severe overheating 25.0000%, underheating 0.4630%. Indoor range 17.9332–30.1151°C. Solver failures: 0.

Supply drops during all 12 rising-outdoor transitions; largest raw change is −0.8°C (all negative). Solar gain and stored heat raise overheating while control follows current outdoor only. Lower total heat relative to a different-weather day is not an AI saving.

Evidence: `p2_rapid_warming.csv`, `p2_initial_states/rapid_warming.json`, and six engineering plots under `p2_validation_plots/rapid_warming/`.

## 18. Sunny Winter Results

Heat 9.094554 MWh; pump electricity 24.618198 kWh. Compliance 100.0000%, comfort 0.0000%, overheating 82.3785%, severe overheating 25.0000%, underheating 0.0000%. Indoor range 18.2866–30.1948°C. Solver failures: 0.

Strong solar physically reduces reference required load while actual delivery remains higher. Controller actions are solar-independent; a paired +300 W/m² experiment keeps every control action identical while thermal output changes.

Evidence: `p2_sunny_winter.csv`, `p2_initial_states/sunny_winter.json`, and six engineering plots under `p2_validation_plots/sunny_winter/`.

## 19. Hydraulic Imbalance Results

Heat 9.909719 MWh; pump electricity 26.245431 kWh. Compliance 96.2674%, comfort 0.0000%, overheating 61.5451%, severe overheating 25.0000%, underheating 3.7326%. Indoor range 17.5821–29.0887°C. Solver failures: 0.

Healthy-network warm-up is preserved; Far pipe K changes from 2e9 to 4e9 Pa·s²/m⁶ at evaluation start. First-step Far flow falls from 0.00391621434 to 0.00326966740 m³/s; Near/Mid rise through the coupled solver. Initial indoor states match the normal case and valves remain fixed.

Evidence: `p2_hydraulic_imbalance.csv`, `p2_initial_states/hydraulic_imbalance.json`, and six engineering plots under `p2_validation_plots/hydraulic_imbalance/`.

## 20. Energy Metrics

| Scenario | Heat MWh | Pump electricity kWh | Excess delivered heat MWh |
| --- | --- | --- | --- |
| normal_winter | 9.978827 | 26.001788 | 0.872549 |
| cold_wave | 11.497637 | 29.890133 | 0.434796 |
| rapid_warming | 8.633956 | 23.090458 | 1.626106 |
| sunny_winter | 9.094554 | 24.618198 | 1.572028 |
| hydraulic_imbalance | 9.909719 | 26.245431 | 0.803441 |

Heat = Σ(actualHeatW×dt)/3.6e9; pump electricity = Σ(pumpPowerW×dt)/3.6e6. CSV pump power uses kW, not kWh. Excess integrates max(0, actual−instantaneous required) and is labelled **Excess Delivered Heat Above Instantaneous Required Load**. It is neither avoidable savings nor guaranteed waste. G2.7 checks the evaluation integral against lifetime energy minus the exact exported warm-up energy, error <0.001 J.

## 21. Comfort / Compliance Metrics

Fractions are unweighted building-time exposure over 12×288=3,456 endpoint samples: compliance ≥18°C, comfort inclusive 20–22°C, overheating >23°C, severe >25°C, underheating <18°C. Summary rates equal frame-rate time averages at constant timestep. No independently hard-coded rates.

| Scenario | P10 °C | P50 °C | P90 °C | Spread °C |
| --- | --- | --- | --- | --- |
| normal_winter | 18.4109 | 23.1617 | 28.6807 | 10.2697 |
| cold_wave | 18.3390 | 23.0299 | 28.4813 | 10.1424 |
| rapid_warming | 19.6578 | 24.0235 | 29.2430 | 9.5853 |
| sunny_winter | 19.5168 | 24.0281 | 29.3344 | 9.8176 |
| hydraulic_imbalance | 18.3212 | 23.1190 | 28.7213 | 10.4000 |

Quantiles use sorted pooled samples at index floor((n−1)p), matching the frozen lower-order-statistic convention. P50 is a lower median. These pooled quantiles are not averages of per-frame quantiles; CSV quantiles use each frame's twelve temperatures.

## 22. Hydraulic Metrics

HBI = 1−0.5Σ|zone-flow share−static area target share|, time-averaged. Healthy scenarios each score 0.9962228105; imbalance scores 0.9521344432. Under accepted quadratic branch laws, healthy shares stay near constant as frequency changes; this explains repeated HBI, not hard-coded output. It does not imply thermal comfort.

CSV includes total/zone flow m³/h, pump pressure kPa, pump power kW, delivered supply/returns °C, delays minutes and hydraulic/heat/mass residuals. All official runs have finite state, valid returns and no solver failure; full measured residual maxima and accepted tolerances appear under G2.14.

## 23. Fairness Review

`P2_BASELINE_FAIRNESS_REVIEW.md` answers all ten required questions. Self-review finds no intentional weakening: original curves unchanged; static commissioning improves the network; no stress tuning, energy minimisation, artificial delay, indoor/solar feedback or AI logic.

The Normal comfort deficit deserves external engineering review. At static −5°C and zero solar, accepted Near B03 needs approximately 51.0013°C supply to maintain 18°C, while high-insulation B01/B02/B04 need supply ≤45.6258°C to stay ≤25°C under that same allocation. This explanatory calculation is not a controller input or proof covering every transient state. It identifies a within-zone authority conflict; changing accepted coefficients or individual allocation is outside P2. Future MPC must not be assumed capable of eliminating it.

Root-cause review inspected curves, raw/applied state, scheduling, slew, warm-up, commissioning, all five output summaries and leakage audit. Visually inspected engineering plots across all five scenarios and all six plot categories; axes/units and trends were readable. Required representative B03/B06/B11 plots do not show the hottest Near buildings, so all-building CSV/summary maxima and severe-overheat rates must accompany them. This is an engineering review, not product UI fidelity work.

## 24. No-Future-Leakage Evidence

G2.5 compares equal history/current outdoor/controller state with different future weather and gets identical current actions. G2.6 shifts all starting indoor temperatures +3°C over a full evaluation: physical behavior changes, every controller action stays identical. G2.12 adds 300 W/m² solar with identical outdoor forcing and state: actions remain identical. Signature accepts only timestamp/current outdoor/state. G2.20 source/AST audit finds no prohibited dependency, prediction access, indoor/solar control input or scenario-specific controller condition.

## 25. Full Gate Matrix

| Gate | Requirement | Result |
| --- | --- | --- |
| G2.1 | Weather compensation monotonicity | PASS |
| G2.2 | Pump policy monotonicity | PASS |
| G2.3 | Absolute equipment bounds | PASS |
| G2.4 | Rate limits, 30-minute interval and fixed runtime valves | PASS |
| G2.5 | No future-weather leakage | PASS |
| G2.6 | No indoor/prediction/AI feedback | PASS |
| G2.7 | Warm-up excluded from official metrics | PASS |
| G2.8 | Warm-up convergence and documented fallback | PASS |
| G2.9 | Normal Winter adequacy | PASS |
| G2.10 | Cold-wave causality | PASS |
| G2.11 | Rapid-warming causality | PASS |
| G2.12 | Solar cannot influence conventional actions | PASS |
| G2.13 | Imbalance is a physical resistance disturbance | PASS |
| G2.14 | Five 24-hour evaluations remain physically stable | PASS |
| G2.15 | Reproducibility from identical serialized evaluation state | PASS |
| G2.16 | Controller state serialization | PASS |
| G2.17 | Common physical initial-state export | PASS |
| G2.18 | Complete accepted P1A regression and immutable physics | PASS |
| G2.19 | Frozen P0 regression | PASS |
| G2.20 | No forbidden controller dependencies or scenario branches | PASS |

20 passed, 0 failed, 0 skipped. Every input, baseline, changed input, measured output, numerical threshold and note is preserved in `P2_GATE_RESULTS.md` and `p2_gate_results.json`; this table is the complete index, not a replacement for those measurements.

Actual command: `physical_core/.venv/bin/python physical_core/scripts/run_p2_gate_suite.py`; exit 0. Terminal output: `P2 Gates: 20 passed, 0 failed, 0 skipped`.

## 26. P2 Test Results

`/Users/yl/Documents/Codex/Heat/physical_core/.venv/bin/python -m pytest physical_core/tests/test_p2_control.py physical_core/tests/test_p2_benchmark.py physical_core/tests/test_p2_freeze.py -q`

Exit 0; passed 34; failed 0; skipped 0.

```text
..................................                                       [100%]
34 passed in 2.75s
```

Coverage includes interpolation/clamping, invalid config, scheduling, abrupt slew, fixed valves, no-future/indoor/solar feedback, commissioning, warm-up exclusion/convergence, five stable scenarios, 5/10/15-minute steps, JSON replay, snapshot rejection and immutable/hash behavior.

The first freeze preflight correctly stopped before creating a freeze because an in-memory tuple was compared directly with a deserialized JSON list. Fixed only the manifest identity comparison to use canonical JSON SHA-256; added the JSON-array round-trip regression above. Then reran all Gates and P2/P1A/P0 commands successfully. No physics, controller policy, threshold or scenario was changed for this fix.

Other actual commands:

- `physical_core/.venv/bin/python physical_core/scripts/review_p2_adequacy.py` — exit 0; Normal/Cold Wave review, 72/96 and 96/120 h evidence; not a test-counted suite.
- `physical_core/.venv/bin/python physical_core/scripts/run_p2_baselines.py` — exit 0; five × 288 evaluation frames, five states, 30 plots; failed/skipped scenarios 0/0.
- `physical_core/.venv/bin/python physical_core/scripts/review_p2_fairness.py` — final exit 0 after Gates; output `FAIR_WITH_DISCLOSED_LIMITATIONS`.
- `physical_core/.venv/bin/python physical_core/scripts/freeze_p2_baseline.py` — final exit 0; 70 P2 artifacts + 27 accepted P1A files verified; five exact CSV/summary replays of 288 rows × 56 columns each.

## 27. P1A Regression Results

`/Users/yl/Documents/Codex/Heat/physical_core/.venv/bin/python -m pytest physical_core/tests/test_hydraulics.py physical_core/tests/test_transport.py physical_core/tests/test_thermal.py physical_core/tests/test_validation.py physical_core/tests/test_simulation.py -q`

Exit 0; passed 84; failed 0; skipped 0.

```text
........................................................................ [ 85%]
............                                                             [100%]
84 passed in 0.47s
```

All 32 accepted P1A Gates were executed read-only via the existing `evaluate_gates()` inside the P2 Gate command, with 32 PASS / 0 FAIL / 0 skipped. Accepted P1A reports were not regenerated or overwritten. G2.18 records no changed accepted files against the pre-implementation manifest.

Post-freeze combined Python regression was also executed: `physical_core/.venv/bin/python -m pytest physical_core/tests -q`, exit 0. Actual final output: `118 passed in 3.10s` (34 P2 + 84 P1A; 0 failed, 0 skipped).

## 28. P0 Regression Results

`npx tsc --noEmit`

Exit 0; passed N/A (not a test suite); failed 0; skipped 0.

```text
(no output)
```

`npm run test`

Exit 0; passed 62; failed 0; skipped 0.

```text
> ai-heating-optimisation-digital-twin@0.1.0 test
> tsx scripts/p0-invariants.ts

P0 invariant tests: 62 passed, 0 failed, 0 skipped
```

`npm run build`

Exit 0; passed N/A (not a test suite); failed 0; skipped 0.

```text
> ai-heating-optimisation-digital-twin@0.1.0 build
> tsc -b && vite build

vite v8.2.2 building client environment for production...
transforming...
✓ 19 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.47 kB │ gzip:  0.30 kB
dist/assets/index-C2i2aTou.css   17.11 kB │ gzip:  4.67 kB
dist/assets/index-Dx143W9w.js   252.56 kB │ gzip: 78.48 kB

✓ built in 51ms
```

Commands ran in the project root. `tsx` required permission to create its local IPC pipe outside the restricted sandbox; the commands actually executed with exit 0. Production output: 19 modules, index HTML 0.47 kB, CSS 17.11 kB, JS 252.56 kB (gzip 0.30/4.67/78.48 kB). No UI product behavior or contract change.

Post-freeze confirmation: `npx tsc --noEmit && npm run test && npm run build` also exited 0. Typecheck emitted no errors; actual test output remained `P0 invariant tests: 62 passed, 0 failed, 0 skipped`; Vite transformed 19 modules and reported `built in 51ms` with the identical asset names and sizes above.

## 29. Baseline Freeze Manifest

Created `p2_controller_config.json` and `P2_BASELINE_FREEZE_MANIFEST.json` only after all Gates and the final fairness review passed. Freeze preflight verifies exported content against actual replay, not just file existence.

| Identity | SHA-256 / version |
| --- | --- |
| Controller | traditional-v1.0 |
| Controller config | 8c819ff901fa7b9fa1d7ff3fd8b2b1f5fd4853e9eee6d415e28600739fca007e |
| Accepted P1A core | accepted-p1a-sha256:38bb987bd665f6317ef5ba93da5da9ffaafcd087f7de62eb744ac0f5279bda46 |
| Accepted parameter set | 21973a48bd5a801690f7ebe9772195075a1f775b6ca900a17a9407cb1ed253ac |
| Scenario manifest | db01ae4957cce1bfea4175563eea7a35b894cc026fc474b2d7187d156136dd4c |
| Metrics | building-time-endpoints-lower-percentiles-v1 |
| Warm-up | daily-repeat-96h-convergence-v1 |

The manifest also binds individual scenario versions/parameter hashes, commissioning-result hash, all 70 P2 evidence/source/test files and 27 accepted P1A files, actual test results and export replay results. Domain hashes use sorted compact finite JSON; file hashes use exact bytes. The final report references the manifest and is excluded from its hash table to avoid circular binding.

This is a content-addressed local reference, not a signed Git release, OS write lock or external approval. Future edits are detectable; approved changes require an explicitly new P2 version. Baseline exporters refuse to overwrite frozen evidence. Verification command: `physical_core/.venv/bin/python physical_core/scripts/freeze_p2_baseline.py --verify`. P3 remains on hold pending external acceptance.

Actual verification: exit 0, output `{"freezeVerification": "PASS", "changedOrMissingFiles": []}`. Final-report additions do not alter any hash-bound file.

## 30. Known Limitations

Synthetic inputs and uncalibrated coefficients; five deterministic days do not cover the operating envelope. Normal comfort is poor and severe overheating is substantial. Fixed area-based within-zone allocation and zone-only authority leave conflicting thermal needs. No indoor/solar/occupancy feedback, individual balancing, floor heating or return-FIFO refinement.

Wind is exported and passed as weather context, but the accepted P1A model does not use it as an active heat-loss term. References to weather entering the engine must not be read as a new wind-dependent physical equation. No occupant/window model is active. Percentiles and HBI are explicit synthetic metrics, not industry standards. Exact replay is demonstrated in the locked runtime; different numeric library/platform versions need fresh verification. Convergence was required and measured for Normal Winter, not proven for every possible prehistory.

These are disclosed benchmark scope/fairness limitations, not hidden solver failures. The self-assessment does not override external judgment about whether this baseline is acceptable for future comparison.

## 31. P3 Readiness

The review package and frozen reference are available. P3 has not started; no training dataset, features, labels or predictor was implemented. External acceptance of this P2 package, especially Normal adequacy and severe overheating, is required before P3 begins.

## 32. P6 Future Comparison Contract

Verify the frozen manifest, then fork the same exported physical state into Traditional and any future MPC run. Keep the same outdoor/solar forcing, left-end sampling, physical coefficients and disturbance, 5-minute integration, 30-minute control timing, equipment/slew limits, 24-hour horizon and metric implementation. Do not separately precondition the AI plant; retain FIFO and cumulative-energy origin. Traditional restores its full controller state; the future controller starts from identical applied equipment settings and cannot jump past initial slew limits.

Use evaluation-only integrated heat and pump energy and the same building-time exposure definitions. Disclose control authority and inability to correct some within-zone conflicts. Never retune the frozen Traditional curves using MPC outcomes. Any changed baseline/scenario/metric definition requires a newly approved P2 version. No P6 implementation is included.

## 33. Blocking Issues

No critical implementation/test Gate remains failed. No accepted P1A equation or frozen P0 contract was modified. All required artifacts exist and the local reference is hash-verified.

External review is still a release hold: fairness acceptance has not been granted by the user. Poor Normal comfort and 25% severe-overheating exposure are explicitly flagged for that decision. This self-review cannot authorise P3 or certify real-plant suitability.

## 34. Final Self-Assessment

Qualified PASS for the specified P2 engineering implementation and measured Gates. The current-outdoor-only policy is simple, deterministic and constraint compliant; commissioning is static; warm-up is justified; five physical scenarios are reproducible; accepted P0/P1A regression is intact. Fairness self-review finds no deliberate weakening, but synthetic plant adequacy and high overheating remain non-blocking issues for this self-assessment and require external scrutiny.

All work stops here. No P3, prediction, MPC or UI integration has begun.

Phase 2 Gate: PASS WITH NON-BLOCKING ISSUES
