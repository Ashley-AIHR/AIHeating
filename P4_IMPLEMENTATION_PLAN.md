# P4 Implementation Plan

## Immutable inputs

Verify all P2 v1.2 freeze hashes and all P3 v1.0 schema, episode-manifest, and shard hashes before writing P4 artifacts. P4 reads the accepted Digital Twin, Traditional controller, fixture, scenarios, P3 splits, and P0 mode semantics; it does not modify them.

## Prediction sequence

1. Build causal modelling rows from P3 episodes, preserving train/validation/test/benchmark-holdout identities.
2. Deterministically divide validation into 50 selection and 25 calibration episodes by manifest-hash order within each family.
3. Reuse `thermal.required_load` for Physics Predictor v0 and evaluate Persistence, Physics, one linear model per horizon, and a two-candidate LightGBM grid.
4. Select by validation-select equal-horizon weighted MAE, preferring the simpler model when effectively tied; freeze selection before test, then evaluate test once and canonical holdout once.
5. Calibrate per-horizon 95% split-conformal absolute-residual intervals on validation-calibration only.

## Preview sequence

1. Freeze the 75-policy candidate space, three-hour horizon, safety rules, fallback, and objective before canonical evaluation.
2. At each 30-minute decision, clone one serialized current Digital Twin state for every policy, interpolate only the issued forecast, generate a fair Traditional forecast continuation plus offsets, and run all projected outcomes through the accepted five-minute engine.
3. Validate on one deterministic validation-select episode per family, then run the frozen preview once on all five canonical holdouts.

## Guided experience and gates

Adapt the current fixture providers behind the existing P0 selectors. Add one compact Overview flow and entry action; keep EN/ZH complete and label every result as forecast, projection, or simulation result. Run prediction P1–P12, preview V1–V12, UI U1–U8, complete P0/P1A/P2/P3 regression, write reports, and stop before P5/P6.
