# P5 Parameter Recovery Report

## Interpretation

Truth was loaded only after every site fit completed. Recovery is therefore an evaluation, never a feature. The selected quantities are **effective H and C scales** under fixed UA/solar/internal-gain priors; they are not claims of uniquely measured physical R, C and UA.

| Effective parameter | Median absolute relative error | P90 absolute relative error | Bias | Estimate/truth correlation |
|---|---:|---:|---:|---:|
| H scale | 7.35% | 15.71% | +0.55% | 0.548 |
| C scale | 6.81% | 13.62% | +1.06% | 0.801 |

The moderate H correlation is consistent with the identifiability warning: predictive effective parameters are recoverable within useful error bands, but not exact independent material properties. UA and solar scale were not fitted and have no recovery claim.

## Group review

| Group | H median/P90 absolute error | C median/P90 absolute error |
|---|---:|---:|
| Near | 6.89% / 17.02% | 6.83% / 13.65% |
| Mid | 8.17% / 14.07% | 6.53% / 12.88% |
| Far | 7.22% / 15.24% | 7.15% / 13.11% |
| High insulation | 6.67% / 16.02% | 6.83% / 13.48% |
| Medium insulation | 7.72% / 15.24% | 6.97% / 13.66% |
| Low insulation | 7.40% / 17.19% | 6.17% / 13.45% |

Building medians are bounded by 4.46–9.06% for H and 3.18–9.62% for C. The highest site-level median is 10.71% for H (`P5-S15`) and 10.88% for C (`P5-S07`). No group suggests a physically implausible fit or a boundary-driven failure.

The complete machine-readable report in `p5_prediction_results.json` contains count, median absolute relative error, P90 absolute relative error, bias and estimate/truth correlation for every parameter overall and by building, insulation class, zone and virtual site, plus all individual site/building records.
