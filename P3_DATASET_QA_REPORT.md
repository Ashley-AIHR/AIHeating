# P3 Dataset QA Report

These are synthetic engineering distributions, not real customer-population statistics.

## Population and storage

| Split | Episodes | Raw | Building | Forecast | Load labels | Temperature labels | Compressed bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| train | 350 | 100,800 | 1,209,600 | 151,200 | 50,400 | 756,000 | 101,364,559 |
| validation | 75 | 21,600 | 259,200 | 32,400 | 10,800 | 162,000 | 21,731,045 |
| test | 75 | 21,600 | 259,200 | 32,400 | 10,800 | 162,000 | 21,723,755 |
| benchmark_holdout | 5 | 1,440 | 17,280 | 2,160 | 720 | 10,800 | 1,251,498 |

Total compressed shard size: 146,070,857 bytes.

## Per-split physical distributions

### train

| Metric | Count | Min | Mean | Max |
| --- | ---: | ---: | ---: | ---: |
| outdoor_temperature_c | 100,800 | -16.4499 | -5.67953 | 7.62002 |
| solar_radiation_w_m2 | 100,800 | 0 | 76.7941 | 698.532 |
| required_heat_load_mw | 100,800 | 0 | 0.373423 | 0.611458 |
| actual_heat_supply_mw | 100,800 | 0.221514 | 0.40041 | 0.557382 |
| indoor_temperature_c | 1,209,600 | 18.8881 | 22.5089 | 26.8947 |
| supply_setpoint_c | 100,800 | 41.428 | 51.4438 | 58 |
| pump_frequency_hz | 100,800 | 35.904 | 44.1817 | 48 |
| near_flow_m3_h | 100,800 | 7.60484 | 10.6038 | 12.8774 |
| mid_flow_m3_h | 100,800 | 10.0603 | 13.3125 | 16.1757 |
| far_flow_m3_h | 100,800 | 9.65194 | 14.1247 | 17.9171 |

Building-state percentages: <18°C 0.0000%; 20–22°C 30.9968%; >23°C 29.9704%.

### validation

| Metric | Count | Min | Mean | Max |
| --- | ---: | ---: | ---: | ---: |
| outdoor_temperature_c | 21,600 | -15.8709 | -5.72431 | 7.37036 |
| solar_radiation_w_m2 | 21,600 | 0 | 79.6282 | 676.495 |
| required_heat_load_mw | 21,600 | 0.00942737 | 0.373605 | 0.583743 |
| actual_heat_supply_mw | 21,600 | 0.237478 | 0.400796 | 0.534252 |
| indoor_temperature_c | 259,200 | 19.515 | 22.5133 | 26.4437 |
| supply_setpoint_c | 21,600 | 41.5778 | 51.49 | 58 |
| pump_frequency_hz | 21,600 | 36.1037 | 44.1986 | 48 |
| near_flow_m3_h | 21,600 | 7.73805 | 10.6385 | 12.4529 |
| mid_flow_m3_h | 21,600 | 10.3813 | 13.2697 | 15.6463 |
| far_flow_m3_h | 21,600 | 10.2911 | 13.9764 | 17.2362 |

Building-state percentages: <18°C 0.0000%; 20–22°C 30.8654%; >23°C 30.1250%.

### test

| Metric | Count | Min | Mean | Max |
| --- | ---: | ---: | ---: | ---: |
| outdoor_temperature_c | 21,600 | -15.9048 | -5.26488 | 7.70654 |
| solar_radiation_w_m2 | 21,600 | 0 | 78.3969 | 687.369 |
| required_heat_load_mw | 21,600 | 0.0072235 | 0.36501 | 0.605946 |
| actual_heat_supply_mw | 21,600 | 0.223872 | 0.393779 | 0.553612 |
| indoor_temperature_c | 259,200 | 19.2401 | 22.6151 | 26.5708 |
| supply_setpoint_c | 21,600 | 41.3761 | 51.1209 | 58 |
| pump_frequency_hz | 21,600 | 35.8348 | 43.9884 | 48 |
| near_flow_m3_h | 21,600 | 7.90505 | 10.5686 | 12.3671 |
| mid_flow_m3_h | 21,600 | 9.97094 | 13.2601 | 15.6021 |
| far_flow_m3_h | 21,600 | 10.7012 | 14.1464 | 17.5133 |

Building-state percentages: <18°C 0.0000%; 20–22°C 27.1231%; >23°C 33.2500%.

### benchmark_holdout

| Metric | Count | Min | Mean | Max |
| --- | ---: | ---: | ---: | ---: |
| outdoor_temperature_c | 1,440 | -14 | -5.61007 | 5 |
| solar_radiation_w_m2 | 1,440 | 0 | 75.7917 | 500 |
| required_heat_load_mw | 1,440 | 0.0389716 | 0.366531 | 0.535655 |
| actual_heat_supply_mw | 1,440 | 0.262783 | 0.394692 | 0.49678 |
| indoor_temperature_c | 17,280 | 20.9343 | 22.5623 | 24.4284 |
| supply_setpoint_c | 1,440 | 43 | 51.3958 | 57.4 |
| pump_frequency_hz | 1,440 | 38 | 44.1571 | 47.6 |
| near_flow_m3_h | 1,440 | 9.0353 | 10.58 | 11.3179 |
| mid_flow_m3_h | 1,440 | 11.3663 | 13.3096 | 14.2378 |
| far_flow_m3_h | 1,440 | 11.8595 | 14.1684 | 15.7956 |

Building-state percentages: <18°C 0.0000%; 20–22°C 15.2025%; >23°C 24.9306%.

## Parameter multiplier distributions (500 generated variants)

| Dimension | Count | Min | Mean | Max |
| --- | ---: | ---: | ---: | ---: |
| c | 6,000 | 0.800217 | 1.00195 | 1.19997 |
| internal_gain | 6,000 | 0.800034 | 1.00043 | 1.19999 |
| kpipe | 1,500 | 0.800321 | 1.00165 | 1.19975 |
| kvalve | 1,500 | 0.800017 | 1.00242 | 1.19998 |
| pump_curve | 500 | 0.900412 | 1.00133 | 1.09764 |
| pump_head | 500 | 0.900021 | 0.999761 | 1.09991 |
| r | 6,000 | 0.800052 | 1.00057 | 1.19999 |
| radiator_margin | 6,000 | 0.900057 | 1.00084 | 1.09999 |
| solar | 6,000 | 0.800014 | 1.002 | 1.19998 |

## Forecast error by horizon

| Horizon min | Variable | Count | Min | Mean | Max |
| ---: | --- | ---: | ---: | ---: | ---: |
| 30 | outdoorC | 18,180 | -2.55376 | 0.0069825 | 2.177 |
| 30 | solarWm2 | 18,180 | -159.979 | 0.0263341 | 154.891 |
| 30 | windMs | 18,180 | -0.911736 | 0.000592375 | 0.962236 |
| 60 | outdoorC | 18,180 | -2.46636 | 0.00260126 | 2.43679 |
| 60 | solarWm2 | 18,180 | -183.204 | -0.0251824 | 178.559 |
| 60 | windMs | 18,180 | -1.10825 | -0.00260102 | 1.05092 |
| 90 | outdoorC | 18,180 | -3.01643 | -0.000848852 | 2.85767 |
| 90 | solarWm2 | 18,180 | -240.982 | -0.696276 | 233.331 |
| 90 | windMs | 18,180 | -1.30478 | 0.00324224 | 1.28767 |
| 120 | outdoorC | 18,180 | -3.1422 | 0.00596273 | 2.95626 |
| 120 | solarWm2 | 18,180 | -277.855 | -0.46513 | 228.053 |
| 120 | windMs | 18,180 | -1.61237 | -0.00139147 | 1.57753 |
| 150 | outdoorC | 18,180 | -3.59072 | -0.00140148 | 3.66409 |
| 150 | solarWm2 | 18,180 | -266.779 | -0.102739 | 243.066 |
| 150 | windMs | 18,180 | -1.63564 | -0.00116099 | 1.83415 |
| 180 | outdoorC | 18,180 | -3.52177 | -0.00273863 | 4.15085 |
| 180 | solarWm2 | 18,180 | -276.782 | 0.0708719 | 288.872 |
| 180 | windMs | 18,180 | -1.74508 | -0.00393512 | 1.66378 |
| 210 | outdoorC | 18,180 | -3.91356 | -0.00419279 | 3.63685 |
| 210 | solarWm2 | 18,180 | -304.295 | 0.0532094 | 299.538 |
| 210 | windMs | 18,180 | -1.82055 | -0.00242041 | 1.73457 |
| 240 | outdoorC | 18,180 | -4.84403 | -0.0149295 | 3.95036 |
| 240 | solarWm2 | 18,180 | -298.034 | -0.4492 | 292.108 |
| 240 | windMs | 18,180 | -2.00405 | 0.00244833 | 2.03371 |
| 270 | outdoorC | 18,180 | -4.36829 | -0.001588 | 4.64313 |
| 270 | solarWm2 | 18,180 | -343.081 | 0.368844 | 310.448 |
| 270 | windMs | 18,180 | -1.90998 | -0.00356925 | 1.92108 |
| 300 | outdoorC | 18,180 | -4.68192 | 0.00126064 | 4.67777 |
| 300 | solarWm2 | 18,180 | -358.52 | 0.000820296 | 349.853 |
| 300 | windMs | 18,180 | -2.44101 | 0.000750597 | 2.719 |
| 330 | outdoorC | 18,180 | -4.94499 | -0.0123808 | 4.28514 |
| 330 | solarWm2 | 18,180 | -361.3 | 0.167583 | 352.885 |
| 330 | windMs | 18,180 | -2.45822 | 0.00512097 | 2.81822 |
| 360 | outdoorC | 18,180 | -4.85547 | 0.0051407 | 4.66143 |
| 360 | solarWm2 | 18,180 | -402.082 | -0.105199 | 400.361 |
| 360 | windMs | 18,180 | -2.45096 | -0.00419845 | 2.36267 |

All 505 episodes passed finite-number, hydraulic, conservation, equipment, schema, timestamp, and target-alignment checks. Scenario-family counts are 70/15/15 generated variants per train/validation/test plus one canonical holdout per family.
