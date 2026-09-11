# P6 Canonical Benchmark Report

Weights and trust settings were frozen before this evaluation. All decisions used only issued forecasts; future truth entered only after the selected action. Traditional comparisons used identical initial states, weather and windows.

| Scenario | MPC heat MWh | MPC pump kWh | Compliance | <18°C | >23°C | Oversupply MWh | Fallbacks |
|---|---:|---:|---:|---:|---:|---:|---:|
| Normal Winter | 9.2539 | 24.4165 | 100% | 0% | 0% | 0.3620 | 1 |
| Cold Wave | 10.6679 | 28.5077 | 100% | 0% | 0% | 0.1012 | 6 |
| Rapid Warming | 7.8745 | 21.5032 | 100% | 0% | 30.84% | 1.1845 | 0 |
| Sunny Winter | 8.3039 | 22.8553 | 100% | 0% | 32.70% | 1.0893 | 0 |
| Hydraulic Imbalance | 9.1320 | 24.1644 | 100% | 0% | 0% | 0.3021 | 0 |

Normal reduced heat 3.86% and pump electricity 7.37% versus Traditional without comfort loss; however its maximum direction reversals were 7 versus Preview's 1, so small-command chatter remains visible. Cold remained safe (minimum 20.409°C), reduced neither comfort nor compliance, and used six verified fallbacks after OSQP `user_limit`. Rapid is the primary result described in the comparison report. Sunny explicitly consumed issued solar forecasts and reduced heat 5.56%, pump electricity 8.42%, and overheating by 30.03 percentage points versus Traditional while remaining compliant. Hydraulic retained the existing 2× Far-resistance definition, remained fully feasible, used no fallback, and improved heat/pump/oversupply without any claim of dramatic Far-zone recovery.

The full machine evidence, including every control trajectory, first action, status, verification record and boundary snapshot, is in `p6_canonical_benchmark_results.json`.
