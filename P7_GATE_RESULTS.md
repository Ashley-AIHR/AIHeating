# P7 Gate Results

Machine-readable source: `p7_gate_results.json`.

Summary: **22/22 PASS, 0 failed, 0 skipped**.

## Provider gates

| Gate | Result | Evidence |
|---|---|---|
| P7-P1 | PASS | P0–P6 registered hashes and accepted gate results verified before and after regression |
| P7-P2 | PASS | Active AI Optimised provider is Formal MPC v1 through `p7-provider` |
| P7-P3 | PASS | Preview is legacy comparison only; active UI does not import `p4-provider` |
| P7-P4 | PASS | One generated provider payload; no active frontend engineering calculator |
| P7-P5 | PASS | P4 Predictor v1, P5 Thermal Model v1 and Formal MPC v1 explicit |
| P7-P6 | PASS | 10:30 simulation/forecast/MPC snapshot aligned; 11:00 effective action distinct |

## State gates

| Gate | Result | Evidence |
|---|---|---|
| P7-S1 | PASS | Optimal + nonlinear verified → MPC Optimal / Verified in Digital Twin |
| P7-S2 | PASS | Verified fallback remains explicitly fallback |
| P7-S3 | PASS | Infeasible → Fallback Active / Safety Not Guaranteed |
| P7-S4 | PASS | `user_limit` → Solver Limit Reached |
| P7-S5 | PASS | Fallback never maps to MPC Optimal |
| P7-S6 | PASS | Optimisation response has no application field |
| P7-S7 | PASS | Advisory defaults to NOT_APPLIED |
| P7-S8 | PASS | Only verified action/fallback applies; unverified unsafe action fails to apply |

## UI gates

| Gate | Result | Evidence |
|---|---|---|
| P7-U1 | PASS | Five-step journey retained |
| P7-U2 | PASS | Forecast renders separate P4 and P5 layers |
| P7-U3 | PASS | Simulation renders five statuses, controls and 3 h trajectory |
| P7-U4 | PASS | Traditional / Preview / MPC comparison present |
| P7-U5 | PASS | Final read-only configuration present |
| P7-U6 | PASS | Predicted / Optimised / Verified / Applied / Realised separately labelled |
| P7-U7 | PASS | Exact EN/ZH key parity plus browser coverage |
| P7-U8 | PASS | No production, real-site savings or guaranteed real-site safety claim |

## Regression evidence

`p7_regression_results.json` records zero exit codes for P7 integration/UI/Gates/browser, P6, P5, P4, P3, Fixture v1.2, P2, P1A, P0 typecheck/tests/build, and before/after integrity checks. Browser coverage produced 10 screenshots and skipped none.
