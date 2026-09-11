# P6 Linearisation Validation

Validation used `p6-development-scenarios-v1`: five non-canonical states (Normal, Cold, Rapid Warming, Sunny and Hydraulic variation), five parameter fixtures P5-S01…P5-S05, and four independent legal trial trajectories per state, for 20 trials. Canonical data use was false.

| Measure | Result | Gate |
|---|---:|---:|
| 3h indoor MAE | 0.000878°C | ≤0.15°C |
| Indoor maximum absolute error | 0.010318°C | ≤0.35°C |
| Mean heat-supply relative error | 0.07965% | ≤5% |
| Mean zone-flow relative error | 0.11348% | ≤5% |

All perturbations and trial trajectories were legal, sensitivity generation was deterministic, and directional checks passed. The largest indoor error occurred in the Cold fixture P5-S02 under the `[+0.5°C, -1.5 Hz, -5 pp, +5 pp, 0]` trial. The largest flow error was 0.20187% in Hydraulic P5-S05. These are local results within the frozen trust region, not evidence of global linear-model validity.

No canonical decision required relinearisation. The allowed policy remains one candidate-centred rebuild at half trust-region size, followed by one final nonlinear verification.
