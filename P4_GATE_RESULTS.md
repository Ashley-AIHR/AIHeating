# P4 Gate Results

Result: **PASS**. Machine-readable measurements are in `p4_gate_results.json`; command-level regressions are in `p4_regression_results.json`.

## Prediction gates

| Gate | Result | Evidence |
| --- | --- | --- |
| P4-P1 | PASS | P2 hash errors 0; P3 schema/505 manifest/all shard hash errors 0 |
| P4-P2 | PASS | 31 model features use A/B/B+D/C/D only; label class F excluded |
| P4-P3 | PASS | 44,800 train; 6,400 selection; 3,200 calibration; 9,600 test; 640 holdout rows |
| P4-P4 | PASS | Exact separate `required_heat_load_mw` target |
| P4-P5 | PASS | Persistence, Physics, Linear Regression and LightGBM evaluated |
| P4-P6 | PASS | 1h/2h/3h/6h metrics reported |
| P4-P7 | PASS | All five scenario families reported |
| P4-P8 | PASS | Test Skill_vs_Persistence 90.40% ≥10% |
| P4-P9 | PASS | Validation criterion permits any simplest defensible winner |
| P4-P10 | PASS | Full and four ablation variants complete |
| P4-P11 | PASS | Split-conformal 95% interval; test coverage 95.05% |
| P4-P12 | PASS | Fixed seed 20260910; reproducibility rerun byte-identical |

## Preview gates

| Gate | Result | Evidence |
| --- | --- | --- |
| P4-V1 | PASS | Same serialized starting state in all five canonical comparisons |
| P4-V2 | PASS | Forecast-field rejection guard; actual future truth environment-only |
| P4-V3 | PASS | All canonical controls legal |
| P4-V4 | PASS | Supply/pump/valve rate limits legal |
| P4-V5 | PASS | Every accepted projection minimum ≥18°C |
| P4-V6 | PASS | Deterministic Traditional safe fallback implemented |
| P4-V7 | PASS | Same-state/forecast/config validation decisions repeat exactly |
| P4-V8 | PASS | Every candidate clones and steps `SimulationEngine` |
| P4-V9 | PASS | Policy/objective/horizon/fallback frozen before canonical evaluation |
| P4-V10 | PASS | Rapid Warming directional Gate true |
| P4-V11 | PASS | Cold Wave safety Gate true; no underheating |
| P4-V12 | PASS | P2/P3 frozen inputs unchanged |

## UI gates

| Gate | Result | Evidence |
| --- | --- | --- |
| P4-U1 | PASS | Overview visibly explains NOW→FORECAST→PREDICT→OPTIMISE→VERIFY |
| P4-U2 | PASS | One-click Start Predictive Preview entry |
| P4-U3 | PASS | Required Heat Load and Heat Supply are separate provider values |
| P4-U4 | PASS | Selected model/version/interval visible |
| P4-U5 | PASS | Preview Optimiser v0 explicitly says “not final MPC” |
| P4-U6 | PASS | Guided comparison consumes `p4-guided-preview-provider-v1` |
| P4-U7 | PASS | EN/ZH parity and browser checks pass |
| P4-U8 | PASS | `traditional/advisory/optimised` semantics and 62 P0 invariants pass |

## Executed regression commands

| Command | Exit | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: | ---: |
| `pytest physical_core/tests/test_p4.py -q` | 0 | 11 | 0 | 0 |
| `pytest physical_core/tests/test_p3_dataset.py -q` | 0 | 7 | 0 | 0 |
| accepted-v1.2 P2 regression | 0 | 34 | 0 | 0 |
| accepted-v1.2 P1A regression | 0 | 84 | 0 | 0 |
| `npx tsc --noEmit` | 0 | — | 0 | 0 |
| `npm run test` | 0 | 62 | 0 | 0 |
| `npm run build` | 0 | — | 0 | 0 |
| `npx tsx scripts/p4-invariants.ts` | 0 | 20 | 0 | 0 |
| `node scripts/capture-p4.mjs` | 0 | 4 routes | 0 | 0 |

P1A gates: 32/32. P2 gates: 20/20. P3 gates: 14/14 with current full dataset hash verification. P4 gates: 32/32.

P2 G2.19 historically required a zero diff across the entire P0 UI tree. P4 explicitly requires extending that UI. The regression records the expected legacy whole-tree diff while enforcing the unchanged frozen domain/API seams, unchanged control-mode semantics, typecheck, all P0 tests and production build. This is a scope update, not a waived behavioral failure.

