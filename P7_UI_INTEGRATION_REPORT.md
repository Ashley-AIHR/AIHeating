# P7 UI Integration Report

The accepted customer structure was preserved; only the active provider chain and state semantics changed.

| Page | P7 integration |
|---|---|
| Overview | Keeps NOW → FORECAST → PREDICT → OPTIMISE → VERIFY. NOW is P1A, PREDICT separates P4 load and P5 thermal risk, OPTIMISE names Formal MPC v1, VERIFY uses accepted P1A/P6 result evidence. |
| Forecast | Shows P4 Required Heat Load at 1/2/3/6 h and P5 Building Thermal Prediction at 0.5/1/2/3/6 h, with issue/target times and simulation-calibrated uncertainty. |
| Simulation | Shows current applied controls, next P6 action and six 30-minute trajectory points, P5 minimum-temperature trajectory, five status dimensions, and collapsed technical/engineering evidence. |
| Results | Shows Traditional v1.2 vs Preview v0 vs Formal MPC v1 using accepted values, all required metrics, fallback/status summary, and provider-backed actuator ablation. |
| Settings | Shows P1A/P2/P4/P5/P6 versions, prediction/MPC horizons, 30-minute interval, bounds, movement limits, robust safety and fallback policy as read-only frozen configuration. |

The actuator explanation follows accepted P6 ablation: proactive supply-temperature adjustment first, pump optimisation second, and zone-valve fine-tuning/hydraulic redistribution third.

## Browser evidence

English: `p7-overview-en.png`, `p7-forecast-en.png`, `p7-simulation-en.png`, `p7-results-en.png`, `p7-settings-en.png`.

Chinese: `p7-overview-zh.png`, `p7-forecast-zh.png`, `p7-simulation-zh.png`, `p7-results-zh.png`, `p7-settings-zh.png`.

The automated browser suite asserted all page content plus Advisory, Traditional and Optimised application behavior, and expanded normal/fallback/infeasible engineering status evidence. Ten screenshots were generated; none were skipped.
