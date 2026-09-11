# P4 UI/Data Alignment Report

## Scope and decision

This patch aligns the existing customer-facing P4 journey with the accepted P1A/P2/P3/P4 simulation world. It does not change prediction features, model training, the selected LightGBM artifacts, the 75-policy candidate space, the Preview optimiser, objective weights, P1A physics, the P2 Traditional baseline, the P3 dataset, or canonical scenario results. No model was retrained and no canonical simulation was rerun. P5 was not started.

## 1. Legacy P0 UI fields found

The active Simulation route previously rendered the legacy P0 `scenario`, `timeline`, `networkState`, `buildingItems`, and `recommendationFixture`. Customer-visible consequences included an 08:00 initial state beside a 10:30 P4 recommendation; fixture outdoor/solar/load/supply/return/flow/pressure/pump/valve/building values; editable P0 controls; nominal 10/20/35-minute delays; and the label `Fixture / mock data`.

The active Settings route previously rendered `Prototype Settings`, `P0 fixture profile`, P0 thresholds, 6/24/48 as a single forecast-horizon concept, `equipmentLimits`, fixed-looking 10/20/35-minute delays, and qualitative P0 objective weights as though they described the active P4 objective.

The P0 fixture components and domain seams remain in the codebase for regression/development use. The legacy Overview telemetry is collapsed, explicitly labelled `Legacy P0 engineering fixture telemetry`, and is not the default guided path.

## 2. Customer-facing source replacements

The shared `p4-guided-preview-provider-v1` is now the source for all overlapping guided-path values across Overview, Simulation, Forecast, Results, and Settings. Its added fields are derived from existing accepted evidence:

- the P3 Rapid Daytime Warming benchmark-holdout raw state at 10:30;
- the 12 matching P3 building-state rows;
- flow-dependent P1A zone state and FIFO transport delay at that snapshot;
- accepted P4 predictor identity, 1/2/3/6-hour predictions and calibrated intervals;
- the accepted P4 10:30 recommendation and projection;
- accepted canonical full-day Traditional/Preview comparisons;
- accepted objective and candidate-policy configuration metadata.

The frontend does not generate or hard-code replacement engineering values.

## 3. Simulation source before/after

Before: active customer Simulation was driven by P0 fixture/timeline state.

After: active customer Simulation is `GuidedSimulation`, driven by `guidedPreview.now`, `guidedPreview.zones`, `guidedPreview.buildings`, and `guidedPreview.recommendation`. It shows the accepted time, weather, Required Heat Load, Heat Supply, network state, controls, zone state, and all 12 building temperatures. It is labelled `Simulation Engine`, `physical-fixture-v1.2`, `Simulation Environment`, and `No real equipment control`.

## 4. Control-state semantics before/after

Before: `Applied in Simulation Environment` could appear while the displayed current controls differed from the recommendation.

After:

- Traditional displays the accepted Traditional controls and a comparison-only recommendation marked not applied.
- AI Advisory displays the accepted current controls and the proposed action marked `Recommended · not applied`.
- Predictive Preview displays the recommended supply, pump, and zone valves as `Current Applied Controls`; the recommendation is labelled as the applied action, not a pending action.

Browser assertions exercised all three states. No conflicting control sets are shown without an explicit relationship.

## 5. 08:00 versus 10:30 handling

The guided entry and direct active Simulation route now use the accepted `2025-01-15 10:30` snapshot. `simulationTime` equals `forecastAsOf`, and the shared header displays that same timestamp on all five routes. The weather/load/building panel is explicitly a decision snapshot measured before the displayed action, so it is not misrepresented as a post-action outcome.

## 6. Overview horizon alignment

Overview now selects the issued-weather row at 120 minutes and the P4 prediction at two hours. Both FORECAST and PREDICT explicitly show `+2h` and target time 12:30. PREDICT shows the point Required Heat Load and its unchanged 95% interval.

## 7. Overview VERIFY semantics

VERIFY is now labelled `Full-day Simulation Result`. The unchanged heat-energy and overheating comparison is therefore presented as canonical full-day evaluation, not as the direct outcome of one 10:30 recommendation.

## 8. Results thermal distribution

Results adds a compact five-bin stacked bar for `<18°C`, `18–20°C`, `20–22°C Comfort`, `22–23°C Warm`, and `>23°C Overheating`. Counts are computed from the 12 accepted P3 building-state rows at 10:30: `0 / 0 / 1 / 11 / 0`. The caption distinguishes this actual one-instant snapshot from canonical full-day building-time exposure rates; no metric definition or percentage was changed.

The model table is labelled `Held-out simulation evaluation`, names LightGBM, Linear Regression, Persistence, and Physics Predictor v0, and explicitly states that evaluation used held-out synthetic Digital Twin scenarios rather than real-site data. The primary model label is `Selected P4 Predictor v1 · LightGBM`; the internal registry ID is not exposed on active pages.

## 9. Settings source changes

The active route is now `Simulation Configuration` / `Synthetic PoC / Digital Twin Configuration`. It uses provider metadata for `physical-fixture-v1.2`, `traditional-v1.2`, the selected predictor, Preview Optimiser v0, the 30-minute decision interval, and the 180-minute preview rollout.

Prediction Horizons (`1h / 2h / 3h / 6h`) and Forecast Display Windows (`6h / 24h / 48h`) are separate. Objective semantics and displayed source weights come from `p4-preview-objective-v0`: safety is a hard constraint; underheating has strong protection; overheating has high/very-high penalties; oversupply and pump energy are optimised; control movement is regularised. Runtime Near/Mid/Far delays are the flow-dependent 10:30 snapshot (`17.2 / 21.8 / 25.6 min`) and are explicitly not commissioned field measurements or fixed site delays.

## 10. Floating-point display cleanup

Formatting is applied only at render time: temperatures generally use one decimal °C, pump controls one decimal Hz, valves integer percent, instantaneous heat/load three decimals MW, and energy customer-readable precision. The underlying provider values are unchanged. Browser checks reject the raw `55.00000000000001` artifact.

## 11. Cross-page consistency

UI-A1 through UI-A15 all pass. The five routes share scenario, 10:30 simulation/forecast timestamp, selected model, optimiser label, P4 prediction horizons, current/recommended/applied controls, Required Heat Load, Heat Supply, and projected-versus-realised semantics through the single provider. EN/ZH translation-key parity passes, and the frozen P0 domain/control modes remain `Traditional Weather Compensation`, `AI Advisory`, and `Predictive Preview`.

## 12. Browser and screenshot checks

Headless Chromium checked and captured all routes at 1672×941 in English and Simplified Chinese:

- `/overview`: five-step journey, aligned +2h cards, full-day VERIFY, guided entry;
- `/simulation`: 10:30 provider state, mode semantics, formatted controls, zones, buildings;
- `/forecast`: unchanged +1/+2/+3/+6-hour predictions, issued-weather boundary, calibrated interval, simplified model label;
- `/results`: unchanged canonical metrics, actual snapshot distribution, held-out synthetic-evaluation caption;
- `/settings`: accepted configuration, separate horizons/windows, objective semantics, flow-dependent delays.

Ten screenshots are in `p4-screenshots/`. Visual QA found no clipping, overflow, misleading mock label, internal model ID, or raw floating-point artifact on the active pages.

## 13. Tests, gates, and regression

| Check | Result |
|---|---:|
| UI-A1–UI-A15 | 15/15 PASS |
| Existing P4 UI/provider invariants | 20/20 PASS |
| P4 gates | 32/32 PASS |
| P4 model/leakage/Preview tests | 11/11 PASS |
| P3 tests | 7/7 PASS |
| P3 integrity | 505 episode manifests checked; 0 manifest/shard errors |
| P3 gates | 14/14 PASS |
| P2 tests | 34/34 PASS |
| P2 gates | 20/20 PASS |
| P1A tests | 84/84 PASS |
| P1A gates | 32/32 PASS |
| P0 TypeScript check | PASS |
| P0 invariant tests | 62/62 PASS |
| P0 production build | PASS |
| EN/ZH five-route browser checks | 10/10 PASS |

The inherited regression result is PASS, with zero P2 freeze-integrity errors before and after execution.

## 14. Accepted-evidence preservation

Before/after SHA-256 values were identical for all P4 algorithm/result/configuration evidence and selected model artifacts:

| Artifact | SHA-256 |
|---|---|
| `p4_model_comparison.json` | `ee85a677462f4bc3f2ba7c78c14db2791fdaa5fc1509f971b9437fcfe3c4ab7d` |
| `p4_preview_benchmarks.json` | `23ce7ca70c7ec166f48c0317fcfe4fac534004f3ccd393b5f474c5d8933b29d9` |
| `p4_preview_objective_v0.json` | `ca21f57d661de13be6d229a0001544ac9dad8c585a5c338b1ac8ffd600a85f13` |
| `p4_candidate_policy_space_v0.json` | `8b99fb796f9b5354d157309050805f2015d1fbbf853ce9944a984b465175367c` |
| `p4_feature_schema.json` | `a9fd89e1ddc291362fb617f957bd95d5b19a2c121a287403f3c0726865a636aa` |
| `p4_model_registry.json` | `a069bbf1469ade3b3f8e878d6e6adbce74221a6e3b7daaa6a8babb9ed46b7882` |
| `p4_training_config.json` | `b371ad0115690955b9aff7f616fcb7d1c84d351410fb26aeda812e0c5700e84d` |
| selected 60/120/180/360-minute model artifacts | `bb8651… / a08b3a… / eadb6e… / c46df3…` |

P4-P1 independently reports zero P2 hash errors and zero P3 hash errors. `src/domain.ts`, `src/chart.ts`, and `P0_FUTURE_API_SEAMS.md` have no working-tree diff. No P1A physical definition, P2 controller/scenario definition, P3 dataset artifact, P4 prediction feature/model, Preview policy/objective, or canonical result changed.

P4 UI/Data Alignment: PASS

Customer Preview Consistency: GO
