# P7 State Semantics Specification

## Independent state dimensions

P7 keeps five independent fields: `optimisation_status`, `verification_status`, `fallback_status`, `safety_status`, and `application_status`. No success boolean is used.

| Engineering outcome | Customer optimisation | Verification | Fallback | Safety | Optimised application |
|---|---|---|---|---|---|
| OSQP optimal + nonlinear pass | MPC Optimal | Verified in Digital Twin | Not Active | Normal Verified | APPLIED |
| `user_limit` + predefined fallback + nonlinear pass | Solver Limit Reached | Verified Fallback | Verified Fallback Active | Verified Fallback | APPLIED |
| Robust infeasible + unverified fallback | Constraint Infeasible | Not Verified | Fallback Active | Safety Not Guaranteed | FAILED_TO_APPLY |
| Solver error | Optimisation Failed | Not Verified | Not Active unless supplied | Nonlinear Verification Failed | FAILED_TO_APPLY |
| Nonlinear verification failure | Optimisation Failed | Not Verified | Report actual fallback state | Nonlinear Verification Failed | FAILED_TO_APPLY |

The near-18 engineering scenario additionally states: **Minimum indoor temperature cannot be guaranteed under the current simulated conditions.** It never receives normal/green success semantics.

## Control modes

- **Traditional Weather Compensation:** P2 only; any MPC recommendation is comparison data and remains `NOT_APPLIED`.
- **AI Advisory:** P6 recommendation exists but begins `NOT_APPLIED`. Only an explicit operator Apply action changes it to `APPLIED`.
- **AI Optimised:** an accepted nonlinear-verified MPC action or a nonlinear-verified frozen fallback may auto-apply. An infeasible/unverified action becomes `FAILED_TO_APPLY`.

`SUPERSEDED` is available when a later recommendation replaces an older one. It belongs to product state, never to the optimisation response.

## Lifecycle vocabulary

- **Predicted:** P4/P5 forecast output.
- **Optimised:** P6 candidate trajectory.
- **Verified:** candidate or fallback evaluated through nonlinear P1A.
- **Applied:** product/domain action state.
- **Realised:** subsequent Digital Twin state/result.

These labels are rendered separately in the reusable Simulation status component in both languages.
