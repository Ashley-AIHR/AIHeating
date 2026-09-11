# P5 Calibration Specification

## Frozen method

- Model: `p5-thermal-model-v1`
- Method: `p5-calibration-method-v1`
- Dataset: `p5-identification-dataset-v1.0`
- Input schema: `p5-observability-schema-v1`
- Seed: `20260910`
- Estimated per building: positive H scale and C scale
- Fixed priors: UA scale `1.0`, solar scale `1.0`, configured internal gain
- Bounds: log-scales corresponding to `[0.5, 1.5]`
- Solver: `scipy.optimize.least_squares`, Huber loss, three deterministic starts

The objective uses complete daily rollout trajectories sampled every 30 minutes. Temperature residuals are scaled by `0.1°C`; a weak `0.02 × log(scale)` prior penalty prevents unsupported drift without dominating the data. Maximum evaluations are 120 per start. Initialization, bounds, loss, regularisation and gates were frozen before TEST.

## Split discipline

Each site is calibrated only on its own days 1–4 observable history. Days 5–6 are not read by fitting and are used for prediction evaluation. Development, validation and test site IDs are disjoint. Validation sites alone calibrate conformal interval widths. TEST is evaluated after method freeze.

`P5-BASE-FIXTURE` is calibrated from a separate non-canonical six-day history using the exact frozen fixture. That calibration is frozen before the five canonical scenarios are opened. No canonical trajectory is used for fitting or uncertainty selection.

## Leakage enforcement

The calibration function accepts observable row mappings and fails closed if any truth-shaped key is present. Simulation truth is stored in physically separate shards and loaded only after fitting for recovery evaluation or the explicitly labelled oracle-parameter diagnostic. Forecast-driven evaluation substitutes only issued forecasts; actual future weather is unavailable to that path.

## Artifact contract

Every building calibration records a unique calibration ID, model/method/parameterisation/schema versions, history identity, site/building, calibration window, configuration hash, seed, all four scale values (including fixed priors), solver diagnostics, identifiability classification and actual held-out day-5/6 metrics at all five horizons. No ambiguous `latest` lookup is permitted.
