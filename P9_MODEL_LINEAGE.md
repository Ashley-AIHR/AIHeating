# P9 Model Lineage

## P4 — Required Heat Load

| Candidate | Role | Decision |
|---|---|---|
| Persistence | time-series baseline | retained for comparison |
| Physics Predictor | engineering baseline | retained for comparison |
| Linear Regression | learned linear baseline | retained for comparison |
| LightGBM | selected aggregate predictor | **selected-p4-predictor-v1** |

LightGBM was selected under the frozen P4 model comparison across 1/2/3/6-hour horizons. Its MAE/RMSE/R² are held-out synthetic simulation metrics. Forecasts used by control are issued-forecast values; aggregate feature importance is explanatory evidence and does not mean a forecast variable was the realised control input.

## P5 — Building Thermal Prediction

Nominal grey-box physics provides the structure. The accepted calibrated grey-box identifies only effective heat-loss and capacitance scales (`H/C`) because the richer parameterisation was locally confounded. UA, solar and internal-gain terms remain priors. The selected `p5-thermal-model-v1` supports the three-hour P6 supervisory horizon; six hours remains secondary planning evidence. Calibration and uncertainty are synthetic, with no real sensor noise or distribution-shift validation and insufficient `<18°C` positives in P5 TEST.

## P6 — Optimisation

Preview Optimiser v0 is an intermediate engineering benchmark. Formal MPC v1 is the final optimiser because it applies explicit bounds/rate limits, a frozen objective, robust temperature constraint, solver status, nonlinear verification and fallback semantics. Local linearisation is checked against P1A; P1A remains the nonlinear verification authority. Solver-limit verified fallback is accepted behavior, not hidden success. Small valve direction reversals remain an operational follow-up.

## P8 — Explanation

Deterministic Grounded Tutor v1 was selected for the release. It is bilingual, page-aware, bounded to structured P7 evidence and curated knowledge, and explanation-only. It was chosen because it is reproducible and cannot invent open-ended live-LLM claims. No live LLM or LLM credential is part of RC1.
