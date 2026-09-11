# P4 Uncertainty Report

Selected-model absolute residuals from the isolated `validation_calibration` partition define split-conformal, horizon-specific 95% intervals. Test data was not used for calibration.

| Horizon | Half-width (MW) | Test coverage | Mean width (MW) |
| --- | ---: | ---: | ---: |
| 1h | 0.008822 | 94.63% | 0.017644 |
| 2h | 0.013001 | 94.96% | 0.026002 |
| 3h | 0.016368 | 95.79% | 0.032736 |
| 6h | 0.013758 | 94.83% | 0.027516 |

Aggregate empirical test coverage is **95.05%** across 9,600 rows and aggregate mean width is 0.025974 MW. These are simulation-calibrated intervals; they are not real-plant uncertainty guarantees.

