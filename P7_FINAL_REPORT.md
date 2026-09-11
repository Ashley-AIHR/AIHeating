# P7 Final Report

P7 replaced the remaining active Preview UI path with the accepted P1A + P4 + P5 + P6 chain while preserving the existing customer journey and P0 mode semantics. No algorithm was retrained, recalibrated or retuned.

## Required answers

1. **Which provider is active for Simulation?** P1A Simulation Engine, `physical-fixture-v1.2`.
2. **Which provider is active for Required Heat Load?** P4 Predictor v1, selected LightGBM.
3. **Which provider is active for Building Thermal Prediction?** P5 Thermal Model v1.
4. **Which provider is active for Optimisation?** P6 Formal MPC v1 (`p6-mpc-v1`).
5. **Is Preview Optimiser still used anywhere?** Yes, only as the labelled Preview v0 historical comparison / intermediate engineering benchmark in Results and provider metadata. It is not the active AI Optimised backend.
6. **How are Optimal / Fallback / Infeasible represented?** Optimal is `MPC Optimal`; verified fallback is `Solver Limit Reached` or the relevant failure plus `Verified Fallback Active`; infeasible is `Constraint Infeasible` + `Fallback Active` + `Safety Not Guaranteed`.
7. **How is nonlinear verification represented?** Independently as `Verified in Digital Twin`, `Verified Fallback`, or `Not Verified`, with raw technical status collapsed under details.
8. **How is safety-not-guaranteed represented?** Explicit `Safety Not Guaranteed` plus the minimum-temperature guarantee warning; unsafe actions are `FAILED_TO_APPLY`.
9. **How is OSQP user_limit represented?** `Solver Limit Reached`, with the verified fallback state shown separately. It is neither MPC success nor an application crash.
10. **How are recommendation and application state separated?** The optimisation response has no `applied` field. Product state owns NOT_APPLIED, APPLIED, SUPERSEDED and FAILED_TO_APPLY.
11. **Does Advisory remain manual?** Yes. It begins NOT_APPLIED and changes only after operator Apply.
12. **Does Optimised auto-apply only accepted actions?** Yes. Normal verified and frozen-policy verified fallback can apply; infeasible/unverified actions fail to apply.
13. **Are timestamps consistent across pages?** Yes. The guided snapshot aligns at 10:30 while simulation time, forecast issue/targets, recommendation creation/effect and result window remain distinct.
14. **Does Forecast distinguish P4 and P5?** Yes: separate panels, horizons, versions, target times and uncertainty.
15. **Does Results distinguish Traditional / Preview / MPC?** Yes, in three explicit columns using accepted evidence.
16. **Are all customer-visible engineering values provider-backed?** Yes. The frontend only formats, selects ranges and builds display rows from the P7 payload generated from accepted artifacts.
17. **Are P0–P6 frozen artifacts unchanged?** Yes. All registered hashes passed both before and after the complete regression; frozen artifact changes are empty.
18. **Do EN/ZH checks pass?** Yes. Exact key parity and five-page browser coverage passed, with 10 screenshots and no skips.
19. **Can the complete customer journey be demonstrated end to end?** Yes: NOW → FORECAST → PREDICT → OPTIMISE → VERIFY → application semantics → Simulation Result.
20. **Is P8 ready to proceed?** Yes, subject to the requested external review; P7 itself does not start P8.

## Executed verification

- P7: 36 integration/failure assertions, 23 UI/provider invariants, 22/22 Gates, 10 EN/ZH browser screenshots.
- Inherited: P6 5 tests; P5 10; P4 11 model tests + 20 provider invariants + 15 UI alignment; P3 7; Fixture v1.2 5; P2 34; P1A 84; P0 62 plus TypeScript typecheck and production build.
- P0–P6 registered hash/gate integrity: PASS before and after.
- Simulation/controller/scenario/model results were not regenerated or changed; only P7 runtime integration artifacts, UI code, tests, screenshots and documentation were added/updated.

Final Algorithm Integration: GO

P8 Readiness: GO

P7 Gate: PASS
