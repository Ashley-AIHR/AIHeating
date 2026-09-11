# P6 Near-Compliance Safety Stress Report

`p6-near-compliance-safety-stress-v1` is non-canonical and does not modify Cold Wave. Both starting states were created by a 72-hour full P1A warm-up followed by legal reduced-heating operation under cold weather until a 30-minute control boundary; no indoor state was assigned directly.

| Case | Initial min | Issued forecast | Solver / fallback | Forecast robust margin | Realised P1A min |
|---|---:|---:|---|---:|---:|
| feasible_active | 19.0859°C | −11°C | optimal / not used | +0.07825°C | 18.1963°C at −11°C |
| infeasible_fallback | 18.4181°C | −30°C | infeasible / fallback_unverified | −2.14198°C | 17.3805°C at −14°C |

The feasible action obeyed all equipment/rate limits and full nonlinear verification, and did not deliberately cross 18°C. The infeasible case exercised the honest failure path: legal safest-rate heating was executed, hydraulic convergence and mass conservation held, but safety could not be guaranteed from the physical starting condition. Energy reduction is explicitly secondary and `energySavingClaim=false` for both cases.
