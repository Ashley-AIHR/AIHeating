# P5 Prediction Validation

## TEST protocol

Five held-out virtual site identities are calibrated only from their own days 1–4. All results below use unseen days 5–6; method, bounds, parameterisation, uncertainty method and thresholds were frozen first. Each horizon contains 5,100 building forecasts.

### Calibrated grey-box: Oracle Exogenous

| Horizon | MAE °C | RMSE °C | Bias °C | P90 AE °C | P95 AE °C |
|---|---:|---:|---:|---:|---:|
| 30 min | 0.0022 | 0.0035 | -0.0002 | 0.0053 | 0.0075 |
| 1 h | 0.0042 | 0.0065 | -0.0004 | 0.0100 | 0.0138 |
| 2 h | 0.0071 | 0.0108 | -0.0007 | 0.0170 | 0.0236 |
| 3 h | 0.0090 | 0.0135 | -0.0011 | 0.0217 | 0.0293 |
| 6 h | 0.0144 | 0.0215 | -0.0020 | 0.0341 | 0.0467 |

### Calibrated grey-box: Forecast-driven

| Horizon | MAE °C | RMSE °C | Bias °C | P90 AE °C | P95 AE °C |
|---|---:|---:|---:|---:|---:|
| 30 min | 0.0085 | 0.0115 | +0.0011 | 0.0189 | 0.0240 |
| 1 h | 0.0150 | 0.0202 | +0.0034 | 0.0342 | 0.0436 |
| 2 h | 0.0270 | 0.0355 | +0.0091 | 0.0587 | 0.0730 |
| 3 h | 0.0379 | 0.0493 | +0.0156 | 0.0805 | 0.1002 |
| 6 h | 0.0646 | 0.0801 | +0.0360 | 0.1311 | 0.1552 |

Oracle error rises monotonically from 30 minutes to 6 hours. Forecast-driven error also rises monotonically, with the expected additional weather-forecast contribution. There is no non-intuitive horizon inversion.

## Baselines and upper bound

| Horizon | Persistence MAE °C | Nominal grey-box MAE °C | Calibrated MAE °C | Oracle-parameter diagnostic MAE °C |
|---|---:|---:|---:|---:|
| 30 min | 0.0632 | 0.0162 | 0.0022 | 0.0000006 |
| 1 h | 0.1256 | 0.0320 | 0.0042 | 0.0000010 |
| 2 h | 0.2459 | 0.0619 | 0.0071 | 0.0000014 |
| 3 h | 0.3574 | 0.0898 | 0.0090 | 0.0000014 |
| 6 h | 0.6326 | 0.1614 | 0.0144 | 0.0000022 |

The calibrated model beats persistence at every horizon and improves over nominal by 86.4–91.1%. The oracle-parameter result is an upper-bound diagnostic only.

## Robustness slices

At 3h/6h, Oracle MAE is Near `0.0093/0.0158°C`, Mid `0.0094/0.0152°C`, and Far `0.0083/0.0121°C`. By insulation class it is High `0.0077/0.0136°C`, Medium `0.0087/0.0135°C`, and Low `0.0121/0.0186°C`. Mixed evaluation family A records `0.0064/0.0098°C`; family B records `0.0117/0.0179°C`.

The worst building is B05: `0.0142°C` at 3h and `0.0235°C` at 6h, far inside the 0.75/1.00°C gates. Full metrics by building, zone, class and scenario family are in `p5_prediction_results.json`.

## Canonical holdout

The separately frozen base-fixture calibration was evaluated without refitting. Forecast-driven 3h/6h MAE is Normal Winter `0.0334/0.0624°C`, Cold Wave `0.0402/0.0791°C`, Rapid Daytime Warming `0.0448/0.0563°C`, Sunny Winter `0.0372/0.0854°C`, and Hydraulic Imbalance `0.0290/0.0522°C`.

Rapid Warming and Sunny Winter reach actual maxima of 24.329°C and 24.427°C, so the provider represents emerging `>23°C` risk. The model retains thermal inertia through C and uses transported water inputs, so reduced heating affects buildings only through their subsequent physical trajectories. Different B01–B12 H/C values preserve different response rates. Cold Wave remains directionally safe (minimum 20.934°C in the frozen run). Hydraulic Imbalance remains a secondary engineering benchmark: P1A Far-zone flow/supply differences feed distinct P5 trajectories without any harsher disturbance.

These are synthetic PoC engineering results, not real-site accuracy claims.
