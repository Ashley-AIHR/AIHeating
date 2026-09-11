# P6 Robust Safety and Uncertainty Report

## Uncertainty rule

The hard requirement is `predicted temperature − P5 half-width ≥ 18.0°C` for every building and interval. Half-widths come unchanged from `p5_model_registry.json` forecast-driven calibration:

| MPC minute | Half-width |
|---:|---:|
| 30 | 0.024904°C |
| 60 | 0.041816°C |
| 90 | max(60m,120m) = 0.068465°C |
| 120 | 0.068465°C |
| 150 | max(120m,180m) = 0.091720°C |
| 180 | 0.091720°C |

Thus intermediate horizons use the larger adjacent accepted width, never optimistic interpolation. The robust constraint is inside the QP and is repeated in full nonlinear P1A/P5 verification.

## Active stress case

The physically preconditioned feasible case began at 19.0859°C after 54 legal reduced-heating P1A steps, without state overwrite. With an issued −11°C forecast, OSQP returned `optimal`; nonlinear verification passed; fallback was not used. The minimum predicted point temperature was 18.1700°C and the minimum robust lower-bound margin was +0.07825°C, so the safety constraint was active/near-active. In the separate realised P1A run at −11°C, the minimum was 18.1963°C. No energy-saving claim is made for this fixture.

## Infeasible stress case and fallback

The second physical state began at 18.4181°C after 66 legal reduced-heating steps. The issued −30°C forecast made the robust QP infeasible. The result remained `infeasible`; it was not presented as optimal. The predefined maximum-heating, rate-limited near-compliance fallback was legal and hydraulically converged, but its forecast verification remained below the floor (`fallback_unverified`). Under the separately declared realised −14°C environment, the minimum reached 17.3805°C. This is an explicit realised safety violation caused by an already marginal state and an infeasible forecast regime; it is neither hidden nor labelled safe, and no saving is claimed.

Across canonical decisions, minimum forecast robust margins were +2.93°C Normal, +2.20°C Cold, +3.43°C Rapid, +3.40°C Sunny and +2.80°C Hydraulic. Forecast-verified safety and realised simulation safety are reported as distinct concepts.
