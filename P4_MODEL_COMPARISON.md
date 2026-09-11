# P4 Model Comparison

Model selection used only `validation_select`; test and benchmark holdout were opened once after the selection freeze. Equal weight is assigned to 1h/2h/3h/6h MAE.

| Model | Validation weighted MAE (MW) | Test weighted MAE (MW) | Test RMSE (MW) | Test R² |
| --- | ---: | ---: | ---: | ---: |
| Persistence | 0.047481 | 0.046808 | 0.066698 | 0.6552 |
| Physics Predictor v0 | 0.020414 | 0.020453 | 0.027538 | 0.9412 |
| Linear Regression | 0.008415 | 0.008370 | 0.011427 | 0.9899 |
| LightGBM | **0.004892** | **0.004494** | **0.006373** | **0.9969** |

LightGBM was selected because its validation MAE was 41.8% below Linear Regression and 76.0% below Physics Predictor v0; no simpler model was within the predeclared 1% tie window. Selection was evidence-based, not an “AI” preference.

Test Skill_vs_Persistence is **90.40%**, above the 10% Gate. Horizon skills are 85.45% (1h), 88.24% (2h), 89.81% (3h), and 93.17% (6h). LightGBM test MAE by horizon is 0.003009, 0.004447, 0.005233 and 0.005287 MW respectively.

Test equal-horizon MAE by scenario family is 0.004077 MW Cold Wave, 0.003552 Hydraulic Imbalance, 0.003572 Normal Winter, 0.006029 Rapid Warming and 0.005238 Sunny Winter. The canonical holdout weighted MAE is 0.003673 MW; it did not influence tuning or selection.

The full machine-readable breakdown, including every model/horizon/family combination, is in `p4_model_comparison.json`.

