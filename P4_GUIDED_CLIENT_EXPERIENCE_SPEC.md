# P4 Guided Client Experience Specification

The primary guided scenario is frozen Rapid Daytime Warming. Overview presents the compact causal path `NOW → FORECAST → PREDICT → OPTIMISE → VERIFY` before engineering telemetry and provides a single **Start Predictive Preview** action.

- NOW: provider-backed outdoor temperature, Required Heat Load, Actual Heat Supply and indoor P10/P50/P90.
- FORECAST: issued future outdoor and solar forecast with a shared `forecastAsOf`.
- PREDICT: 1h/2h/3h/6h Required Heat Load and 95% simulation-calibrated intervals.
- OPTIMISE: current Traditional controls, recommended Preview controls and the warming/solar rationale.
- VERIFY: provider-backed full-day Traditional versus Preview simulation outcomes.

Forecast exposes the formal P4 series and uncertainty. Simulation shows the same provider recommendation through existing P0 control-mode semantics. Results reads the canonical comparison and model results from the generated provider payload. English and Chinese copy explicitly labels this as a Simulation Environment and “Preview Optimiser v0 — not final MPC”; no real-site savings or autonomous-control claim is made.

The stable adapter is `src/p4-provider.ts`; its generated payload is `src/p4-preview-data.json`. P7 may replace this adapter without changing the journey.

