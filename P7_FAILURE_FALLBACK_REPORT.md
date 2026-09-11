# P7 Failure and Fallback Report

## Required cases

| Case | Representation | Stale-success behavior |
|---|---|---|
| P4 prediction unavailable | Provider `UNAVAILABLE`; unusable | No successful prediction substitution |
| P5 thermal prediction unavailable | Provider `UNAVAILABLE`; unusable | No successful thermal substitution |
| Provider timeout | Provider `TIMEOUT`; unusable | No success presentation |
| Stale recommendation/data | Provider `STALE`, `stale: true`, unusable | Must be labelled stale; cannot silently apply |
| Solver failure | Optimisation Failed / Not Verified | Cannot auto-apply |
| Solver `user_limit` with verified fallback | Solver Limit Reached / Verified Fallback Active / Verified Fallback | Applied only as fallback, never called optimal |
| Robust infeasible + unverified fallback | Constraint Infeasible / Fallback Active / Safety Not Guaranteed | `FAILED_TO_APPLY` |
| Nonlinear verification failure | Optimisation Failed / Not Verified / Nonlinear Verification Failed | Cannot auto-apply |

## Executed evidence

- Rapid Warming and Sunny Winter map to normal optimal/verified.
- Cold Wave accepted `user_limit` occurrence maps to verified fallback, not MPC optimal.
- The near-18 accepted stress result maps to infeasible/fallback active/safety not guaranteed; its realised minimum remains exactly `17.380542524267337°C`.
- Provider availability tests cover unavailable, timeout, stale and available states.
- AI Advisory is `NOT_APPLIED` until operator action; Traditional is `NOT_APPLIED`; unsafe Optimised is `FAILED_TO_APPLY`.

The near-18 case appears only under collapsed Engineering / Validation evidence, not as the primary customer demonstration.
