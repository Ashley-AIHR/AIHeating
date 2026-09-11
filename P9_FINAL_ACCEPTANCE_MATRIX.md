# P9 Final Acceptance Matrix

Provider chain for all cases unless stated otherwise: physical-fixture-v1.2 → selected-p4-predictor-v1 → p5-thermal-model-v1 → p6-mpc-v1 → p7-final-provider-v1 → deterministic-grounded-v1. All results below are executable evidence plus hash-bound source artifacts; no case passes from a screenshot alone.

| ID | Scenario / initial state | Expected state or metric | Actual evidence | Source artifact / executable test | Result |
|---|---|---|---|---|---|
| A | Rapid Daytime Warming; P7 snapshot at 2025-01-15 10:30 +08:00; outdoor −3.0625°C, Required Heat 0.253081 MW, supply 0.383025 MW | NOW→FORECAST→PREDICT→OPTIMISE→VERIFY; optimal, verified, applied; Traditional vs MPC synthetic comparison | P4 +2h 0.106560 MW; P5 +2h minimum 22.275663±0.068465°C; recommendation 48.20001°C/42.45289 Hz; heat 8.372903→7.874497 MWh; overheating 61.9213%→30.8449%; compliance 100%→100% | `src/p7-runtime-data.json`; P9-R2; 82-check browser matrix; 5-run replay | PASS |
| B | Sunny Winter accepted canonical state | Optimal and verified predictive-control evidence | `MPC_OPTIMAL`, `VERIFIED_IN_DIGITAL_TWIN`, robust margin 4.151927°C; exact canonical manifest unchanged | `p6_canonical_benchmark_results.json`; P9-F3/P9-S1 | PASS |
| C | Cold Wave accepted canonical state at 23:00 | Solver limit must be visible; only verified fallback may apply | raw `user_limit`, `fallback_verified`; customer `SOLVER_LIMIT_REACHED`, `VERIFIED_FALLBACK_ACTIVE`; robust margin 2.426060°C; browser EN/ZH status visible | `src/p7-runtime-data.json`; P9-S2/S7; P7/P9 browser | PASS |
| D | Hydraulic Imbalance with exactly 2× Far-pipe resistance | Secondary engineering benchmark; no scenario/numeric change | multiplier 2.0; role `secondary engineering benchmark`; fixture/adequacy 5 tests pass and canonical hash unchanged | `P2_BASELINE_FREEZE_MANIFEST_v1.2.json`; P9-X1; P2 test command | PASS |
| E | Normal Winter accepted canonical state | Stable Traditional/P1A behavior and unchanged canonical evidence | canonical manifest `1397dc…` verified; P2 34 and P1A 84 tests pass | `p6_model_registry.json`; `p9_regression_results.json` | PASS |
| F | Cold Wave solver-limit branch | Solver Limit → Verified Fallback; never MPC Optimal | derived status exactly `SOLVER_LIMIT_REACHED / VERIFIED_FALLBACK / VERIFIED_FALLBACK_ACTIVE / VERIFIED_FALLBACK`; application `APPLIED` under frozen verified-fallback policy | P9-S2/S7, P7 invariants and EN/ZH browser | PASS |
| G | Near-18 safety stress; realised minimum 17.380543°C | Constraint Infeasible → Fallback Active → Safety Not Guaranteed; cannot apply | derived unsafe status preserved; robust margin −2.141980°C; application `FAILED_TO_APPLY`; not green success | P9-S3/S5; P9 browser/source-style check | PASS |
| H | Rapid snapshot in AI Advisory mode | Recommendation remains `NOT_APPLIED` until explicit Apply | `applicationStatus('advisory', rapid)` returns `NOT_APPLIED`; EN/ZH browser mode transition passes | P9-S6; P7/P9 browser | PASS |
| I | Rapid snapshot in AI Optimised mode | Only verified accepted action/fallback auto-applies | optimal and verified fallback map to `APPLIED`; unsafe/unverified maps to `FAILED_TO_APPLY` | P9-S7; P7 invariants | PASS |
| J | Provider age 31 min with maximum 30 min | `STALE`, unusable, no auto-application | `{status:'STALE', usable:false, stale:true}` and stale Tutor context omits value | P9-S4; isolated P8 37/100/38 suites | PASS |
| K | Provider has no data | `UNAVAILABLE`, unusable, no invented telemetry | availability resolver returns unusable; Tutor evaluation reports zero numeric-grounding failures across stale/unavailable cases | P9-S4; P8 100-case evaluation | PASS |
| L | Current Rapid context, selected B03, current page | Tutor answer references current context/evidence only | grounded response class/validation stable; source boundary P7 structured provider; control request refused | P9-X4/X5; isolated P8 tests; P9 Tutor browser | PASS |
| M | Conversation contains old Rapid context, current context changes to Cold Wave/B03 20.4°C | Current scenario/state must override history | no prior Rapid telemetry or B03 21.9°C leaks; new context ID and correct fallback/current value used | isolated P8 context/evaluation suites | PASS |
| N | Active Overview/Simulation/Forecast/Results/Settings plus Tutor in EN and zh-CN | Equivalent terminology/status; three modes and all safety branches discoverable | P9 browser 82/82, P7 browser 10 screens, P8 Tutor browser 8 screens; zero semantic failures | `p9_browser_results.json`; `p9_regression_results.json` | PASS |
| O | Fresh temporary frontend directory with only copied release inputs and exact lockfile | dependency install, core tests and production build pass; `dist/index.html` exists | `npm ci --offline --ignore-scripts`, `npm run test`, `npm run build`: all exit 0; temporary directory removed | `p9_clean_env_results.json` | PASS |

## Determinism

Five consecutive primary guided runs produced the same scenario, P7 snapshot, recommendation ID, accepted benchmark values, status semantics, context ID, Tutor class/category/answer and SHA-256 `27bfd25b32e544e6a49a409897095ef311c5b98c36d03807dec04e738aaeaf83`.

## Recorded non-blocking responsive issue

At 900×800, all five application routes have document width 1186px and horizontal overflow. The 1672×941 customer-demo and 1366×768 common-laptop viewports pass without overflow. Mobile/narrow redesign is outside RC1 scope; this limitation is explicit and does not hide status semantics or invalidate the desktop customer journey.
