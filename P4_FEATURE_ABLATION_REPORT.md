# P4 Feature Ablation Report

Ablations retrained the selected LightGBM architecture and evaluated only `validation_select`.

| Feature set | Weighted MAE (MW) | Change from full |
| --- | ---: | ---: |
| Full | 0.004892 | — |
| Minus issued-forecast features | 0.004823 | −1.42% |
| Minus indoor-state features | 0.004815 | −1.58% |
| Minus lagged-load features | 0.005163 | +5.52% |
| Minus solar features | 0.004896 | +0.07% |

Lagged Required Heat Load contributes measurable validation value. Solar is essentially neutral. Forecast and indoor features do not improve aggregate validation MAE in this synthetic dataset and very slightly worsen it, although the issued forecast remains causally necessary to the Preview decision story and longer-horizon behavior. This result is reported without post-test feature retuning; it is a limitation to revisit with P5/site-calibrated data.

