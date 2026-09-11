# Traditional vs Preview vs Formal MPC

The frozen Traditional v1.2 and accepted PreviewLookaheadOptimiserV0 evidence were not modified. The Rapid Warming comparison uses the same fixture, initial state, weather and 24-hour window.

| Metric | Traditional | Preview v0 | MPC v1 |
|---|---:|---:|---:|
| Heat consumption | 8.3729 MWh | 7.9952 MWh | 7.8745 MWh |
| Pump electricity | 23.4073 kWh | 21.5725 kWh | 21.5032 kWh |
| Compliance | 100% | 100% | 100% |
| Underheating | 0% | 0% | 0% |
| Overheating >23°C | 61.92% | 37.82% | 30.84% |
| Severe >25°C | 0% | 0% | 0% |
| Avoidable oversupply | 1.4795 MWh | 1.2513 MWh | 1.1845 MWh |
| P10 / P50 / P90 | 22.242 / 23.166 / 23.792°C | 22.131 / 22.829 / 23.530°C | 22.087 / 22.718 / 23.445°C |
| Frozen engineering objective | 1.5995 | 1.0731 | 0.9236 |

Against Traditional, MPC reduced heat by 5.95%, pump electricity by 8.13%, avoidable oversupply by 19.94%, and overheating by 31.08 percentage points without underheating. Against Preview, MPC reduced heat by 1.51%, pump electricity by 0.32%, oversupply by 5.34%, and overheating by 6.97 points. Its frozen objective is 13.93% lower than Preview, so REVIEW REQUIRED is not triggered.

MPC supply movement (24.667°C) and pump movement (17.762 Hz) were close to Preview (24.667°C and 18.333 Hz), but full MPC recorded 17 maximum direction reversals versus Preview's 1, primarily from small valve corrections. This chatter indication is a non-blocking item for P7 presentation/operational review; constraints and the movement term remain active.
