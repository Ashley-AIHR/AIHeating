# P4 Required Heat Load Prediction Specification

## Target

The target is the accepted P1A/P3 `required_heat_load_mw` at forecast target time: the sum of positive building envelope demand after accepted outdoor, wind, solar and internal-gain terms. It is calculated only by `ai_heating_core.thermal.required_load`. It is not actual supply, planned supply, recovery energy, a control command or cumulative energy.

Predictions are made at 60, 120, 180 and 360 minutes. Inputs contain only state observed at `forecast_as_of`, lagged observations ending at that instant, known metadata/configuration, and weather values from the forecast issued at that instant. Labels and future actual weather are forbidden features.

## Providers and models

`PredictionProvider.predict_required_heat(PredictionInput) -> LoadPrediction` is the replaceable boundary. Implementations are Persistence, Physics Predictor v0, horizon-specific scaled Linear Regression, horizon-specific LightGBM, and Selected P4 Predictor v1.

Physics Predictor v0 applies the accepted Required Heat Load equation to issued forecast weather and configured synthetic building parameters. Those parameters are privileged in this synthetic PoC and require P5/site calibration before real deployment.

The learned feature schema is frozen in `p4_feature_schema.json`. Validation episodes are deterministically partitioned by episode-manifest SHA-256 into `validation_select` and `validation_calibration`; test and canonical holdout are untouched until after selection. The selected model is the lowest equal-horizon validation MAE, with a simpler model preferred when within 1%.

## Metrics and uncertainty

MAE, RMSE, R² and normalized MAE are reported overall, by horizon and scenario family. Weighted MAE is the equal average of the four horizon MAEs. Skill is `1 - selected_weighted_MAE / persistence_weighted_MAE`.

The 95% interval is split-conformal using absolute residual quantiles from `validation_calibration`, separately by horizon. It is simulation-calibrated, not a real-site confidence guarantee.

