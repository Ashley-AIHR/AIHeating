# P8 Tutor Evaluation Report

Machine evidence: `p8_tutor_evaluation_results.json`.

## Result

- Total: 100/100 PASS, 0 failed, 0 skipped.
- Semantic pairs: 50; English 50/50, Simplified Chinese 50/50.
- Numeric grounding failures: 0.
- Status-semantic failures: 0.
- Context leakage failures: 0.
- Control-safety failures: 0.
- EN/ZH parity failures: 0.

| Category | Passed | Failed |
|---|---:|---:|
| Current state | 6 | 0 |
| Thermal | 10 | 0 |
| Forecast | 16 | 0 |
| Optimisation | 18 | 0 |
| Fallback | 8 | 0 |
| Safety | 4 | 0 |
| Comparison | 10 | 0 |
| Hydraulic | 10 | 0 |
| Domain concept | 6 | 0 |
| Unsupported/control/injection | 12 | 0 |

Normal evaluation responses required no validator substitution: 0 activations and 0 Tutor fallback responses. Focused invariant tests deliberately injected one unsafe response and one provider timeout; both activated the validator/safe-fallback path as required.

No hallucinated telemetry, fallback-as-optimal wording, unsafe infeasible claim, stale-context leakage, scenario leakage, recommendation/application confusion, real-site claim or control mutation was observed.
