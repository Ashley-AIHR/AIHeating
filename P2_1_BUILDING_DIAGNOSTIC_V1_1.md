# P2.1 Building Diagnostic — v1.1 Candidate

Actual Normal Winter simulation: 288 five-minute evaluation endpoints per building; warm-up excluded. Candidate is a fresh warm-up/run; no v1.0 initial state is reused. Power/flow means use interval-mean physical output, not inferred summary KPIs.

## Static profiles

| buildingId | zone | heatedAreaM2 | insulationLevel | envelopeHWK | thermalRKW | thermalCJK | radiatorUAWK | flowShareWeight |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| B01 | near | 1200 | High | 1080 | 0.000925926 | 216000000 | 1680 | 29880 |
| B02 | near | 980 | High | 882 | 0.00113379 | 186200000 | 1372 | 24402 |
| B03 | near | 980 | Low | 1764 | 0.000566893 | 196000000 | 1372 | 51744 |
| B04 | near | 1100 | High | 990 | 0.0010101 | 231000000 | 1540 | 27390 |
| B05 | mid | 1100 | Medium | 1430 | 0.000699301 | 198000000 | 1540 | 41030 |
| B06 | mid | 1050 | Medium | 1365 | 0.000732601 | 199500000 | 1470 | 39165 |
| B07 | mid | 920 | Medium | 1196 | 0.00083612 | 184000000 | 1288 | 34316 |
| B08 | mid | 1180 | Medium | 1534 | 0.00065189 | 247800000 | 1652 | 44014 |
| B09 | far | 900 | Low | 1620 | 0.000617284 | 162000000 | 1260 | 47520 |
| B10 | far | 1050 | Medium | 1365 | 0.000732601 | 199500000 | 1470 | 39165 |
| B11 | far | 1300 | Medium | 1690 | 0.000591716 | 260000000 | 1820 | 48490 |
| B12 | far | 1150 | Medium | 1495 | 0.000668896 | 241500000 | 1610 | 42895 |

## Design and allocation (21°C indoors, −10°C outdoors, no solar)

| buildingId | designEnvelopeLossW | designInternalGainW | designRequiredHeatW | actualFlowShare | areaFlowShare | designLoadShare | averageAllocatedFlowM3h |
| --- | --- | --- | --- | --- | --- | --- | --- |
| B01 | 33480 | 3600 | 29880 | 0.223961 | 0.28169 | 0.223961 | 3.03516 |
| B02 | 27342 | 2940 | 24402 | 0.182902 | 0.230047 | 0.182902 | 2.47872 |
| B03 | 54684 | 2940 | 51744 | 0.38784 | 0.230047 | 0.38784 | 5.25607 |
| B04 | 30690 | 3300 | 27390 | 0.205298 | 0.258216 | 0.205298 | 2.78223 |
| B05 | 44330 | 3300 | 41030 | 0.258824 | 0.258824 | 0.258824 | 3.42835 |
| B06 | 42315 | 3150 | 39165 | 0.247059 | 0.247059 | 0.247059 | 3.27251 |
| B07 | 37076 | 2760 | 34316 | 0.216471 | 0.216471 | 0.216471 | 2.86734 |
| B08 | 47554 | 3540 | 44014 | 0.277647 | 0.277647 | 0.277647 | 3.67768 |
| B09 | 50220 | 2700 | 47520 | 0.266861 | 0.204545 | 0.266861 | 3.68462 |
| B10 | 42315 | 3150 | 39165 | 0.219942 | 0.238636 | 0.219942 | 3.03679 |
| B11 | 52390 | 3900 | 48490 | 0.272309 | 0.295455 | 0.272309 | 3.75983 |
| B12 | 46345 | 3450 | 42895 | 0.240888 | 0.261364 | 0.240888 | 3.32601 |

## Measured temperatures and building-time fractions

| buildingId | averageIndoorC | minimumIndoorC | maximumIndoorC | comfortRate | overheatingRate | severeOverheatingRate | underheatingRate |
| --- | --- | --- | --- | --- | --- | --- | --- |
| B01 | 28.042 | 27.8132 | 28.2343 | 0 | 1 | 1 | 0 |
| B02 | 28.2436 | 27.9596 | 28.4828 | 0 | 1 | 1 | 0 |
| B03 | 19.3207 | 19.011 | 19.617 | 0 | 0 | 0 | 0 |
| B04 | 27.8602 | 27.6405 | 27.9958 | 0 | 1 | 1 | 0 |
| B05 | 23.0878 | 22.8357 | 23.3363 | 0 | 0.628472 | 0 | 0 |
| B06 | 23.2718 | 22.9773 | 23.5663 | 0 | 0.934028 | 0 | 0 |
| B07 | 23.1528 | 22.8983 | 23.3976 | 0 | 0.743056 | 0 | 0 |
| B08 | 22.9957 | 22.7869 | 23.1848 | 0 | 0.493056 | 0 | 0 |
| B09 | 18.8182 | 18.4858 | 19.1344 | 0 | 0 | 0 | 0 |
| B10 | 23.0857 | 22.787 | 23.3845 | 0 | 0.600694 | 0 | 0 |
| B11 | 22.9662 | 22.7078 | 23.2151 | 0 | 0.444444 | 0 | 0 |
| B12 | 22.8084 | 22.5962 | 23.0015 | 0 | 0.03125 | 0 | 0 |

## Measured heating and persistence

| buildingId | severeOverheatingFrames | underheatingFrames | averageRadiatorPowerW | averageInstantaneousRequiredLoadW |
| --- | --- | --- | --- | --- |
| B01 | 288 | 0 | 31384.2 | 23520 |
| B02 | 288 | 0 | 25410.6 | 18750.7 |
| B03 | 0 | 0 | 39574.4 | 42545.1 |
| B04 | 288 | 0 | 28991.4 | 21765.3 |
| B05 | 0 | 0 | 36319.3 | 33293.3 |
| B06 | 0 | 0 | 34444.3 | 31290 |
| B07 | 0 | 0 | 30306.7 | 27673.6 |
| B08 | 0 | 0 | 39086.7 | 35934.9 |
| B09 | 0 | 0 | 35698.9 | 39240 |
| B10 | 0 | 0 | 34188.2 | 31290 |
| B11 | 0 | 0 | 42505.9 | 39104 |
| B12 | 0 | 0 | 37808.9 | 35021.3 |

## Allocation mismatch

Normalized L1 mismatch = Σ_building |actual share − design-load share| within each zone. Zero is exact share agreement; range 0–2. No area weighting of exposure rates.

{'near': 0.0, 'mid': 0.0, 'far': 0.0}

Severe-overheat contributors: B01 (288/288 frames), B02 (288/288 frames), B04 (288/288 frames)
Underheating contributors: 
