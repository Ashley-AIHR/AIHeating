# P5 Uncertainty Report

P5 uses horizon- and mode-specific symmetric split-conformal absolute-residual intervals. Half-widths are calibrated exclusively on the five validation sites after fitting from their days 1–4 and before TEST is opened. No TEST or canonical residual tunes an interval.

| Mode | Horizon | TEST coverage | Mean interval width °C |
|---|---|---:|---:|
| Oracle Exogenous | 30 min | 92.86% | 0.0126 |
| Oracle Exogenous | 1 h | 92.80% | 0.0237 |
| Oracle Exogenous | 2 h | 92.78% | 0.0405 |
| Oracle Exogenous | 3 h | 93.02% | 0.0509 |
| Oracle Exogenous | 6 h | 93.20% | 0.0829 |
| Forecast-driven | 30 min | 95.57% | 0.0498 |
| Forecast-driven | 1 h | 94.29% | 0.0836 |
| Forecast-driven | 2 h | 93.78% | 0.1369 |
| Forecast-driven | 3 h | 93.22% | 0.1834 |
| Forecast-driven | 6 h | 96.41% | 0.3333 |

Coverage is close to the intended 90–95% band. The 6h forecast-driven interval is mildly conservative at 96.41%, which is accepted as a non-blocking synthetic-calibration limitation rather than retuned against TEST.

Intervals are pooled globally by horizon/mode because the five-site validation sample does not justify additional class/zone partitioning. They quantify this deterministic synthetic generator and forecast-error model only. They are not claimed to be calibrated for a real site, real sensor noise, or distribution shift.
