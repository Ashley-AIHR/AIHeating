# P2.1 Building Diagnostic — Historical v1.0

Actual Normal Winter simulation: 288 five-minute evaluation endpoints per building; warm-up excluded. Original CSV indoor values are checked against the rerun. Power/flow means use interval-mean physical output, not inferred summary KPIs.

## Static profiles

| buildingId | zone | heatedAreaM2 | insulationLevel | envelopeHWK | thermalRKW | thermalCJK | radiatorUAWK | flowShareWeight |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| B01 | near | 1200 | High | 1080 | 0.000925926 | 216000000 | 1680 | 1200 |
| B02 | near | 980 | High | 882 | 0.00113379 | 186200000 | 1372 | 980 |
| B03 | near | 980 | Low | 1764 | 0.000566893 | 196000000 | 1372 | 980 |
| B04 | near | 1100 | High | 990 | 0.0010101 | 231000000 | 1540 | 1100 |
| B05 | mid | 1100 | Medium | 1430 | 0.000699301 | 198000000 | 1540 | 1100 |
| B06 | mid | 1050 | Medium | 1365 | 0.000732601 | 199500000 | 1470 | 1050 |
| B07 | mid | 920 | Medium | 1196 | 0.00083612 | 184000000 | 1288 | 920 |
| B08 | mid | 1180 | Medium | 1534 | 0.00065189 | 247800000 | 1652 | 1180 |
| B09 | far | 900 | Low | 1620 | 0.000617284 | 162000000 | 1260 | 900 |
| B10 | far | 1050 | Medium | 1365 | 0.000732601 | 199500000 | 1470 | 1050 |
| B11 | far | 1300 | Medium | 1690 | 0.000591716 | 260000000 | 1820 | 1300 |
| B12 | far | 1150 | Medium | 1495 | 0.000668896 | 241500000 | 1610 | 1150 |

## Design and allocation (21°C indoors, −10°C outdoors, no solar)

| buildingId | designEnvelopeLossW | designInternalGainW | designRequiredHeatW | actualFlowShare | areaFlowShare | designLoadShare | averageAllocatedFlowM3h |
| --- | --- | --- | --- | --- | --- | --- | --- |
| B01 | 33480 | 3600 | 29880 | 0.28169 | 0.28169 | 0.223961 | 3.81752 |
| B02 | 27342 | 2940 | 24402 | 0.230047 | 0.230047 | 0.182902 | 3.11764 |
| B03 | 54684 | 2940 | 51744 | 0.230047 | 0.230047 | 0.38784 | 3.11764 |
| B04 | 30690 | 3300 | 27390 | 0.258216 | 0.258216 | 0.205298 | 3.49939 |
| B05 | 44330 | 3300 | 41030 | 0.258824 | 0.258824 | 0.258824 | 3.42835 |
| B06 | 42315 | 3150 | 39165 | 0.247059 | 0.247059 | 0.247059 | 3.27251 |
| B07 | 37076 | 2760 | 34316 | 0.216471 | 0.216471 | 0.216471 | 2.86734 |
| B08 | 47554 | 3540 | 44014 | 0.277647 | 0.277647 | 0.277647 | 3.67768 |
| B09 | 50220 | 2700 | 47520 | 0.204545 | 0.204545 | 0.266861 | 2.82421 |
| B10 | 42315 | 3150 | 39165 | 0.238636 | 0.238636 | 0.219942 | 3.29491 |
| B11 | 52390 | 3900 | 48490 | 0.295455 | 0.295455 | 0.272309 | 4.07942 |
| B12 | 46345 | 3450 | 42895 | 0.261364 | 0.261364 | 0.240888 | 3.60871 |

## Measured temperatures and building-time fractions

| buildingId | averageIndoorC | minimumIndoorC | maximumIndoorC | comfortRate | overheatingRate | severeOverheatingRate | underheatingRate |
| --- | --- | --- | --- | --- | --- | --- | --- |
| B01 | 28.6318 | 28.4094 | 28.8216 | 0 | 1 | 1 | 0 |
| B02 | 28.8284 | 28.5502 | 29.0651 | 0 | 1 | 1 | 0 |
| B03 | 18.3614 | 18.0449 | 18.663 | 0 | 0 | 0 | 0 |
| B04 | 28.4527 | 28.2373 | 28.5859 | 0 | 1 | 1 | 0 |
| B05 | 23.0878 | 22.8357 | 23.3363 | 0 | 0.628472 | 0 | 0 |
| B06 | 23.2718 | 22.9773 | 23.5663 | 0 | 0.934028 | 0 | 0 |
| B07 | 23.1528 | 22.8983 | 23.3976 | 0 | 0.743056 | 0 | 0 |
| B08 | 22.9957 | 22.7869 | 23.1848 | 0 | 0.493056 | 0 | 0 |
| B09 | 18.2637 | 17.9268 | 18.583 | 0 | 0 | 0 | 0.1875 |
| B10 | 23.2882 | 22.9908 | 23.5862 | 0 | 0.954861 | 0 | 0 |
| B11 | 23.1693 | 22.9119 | 23.4173 | 0 | 0.774306 | 0 | 0 |
| B12 | 23.0122 | 22.8007 | 23.2044 | 0 | 0.524306 | 0 | 0 |

## Measured heating and persistence

| buildingId | severeOverheatingFrames | underheatingFrames | averageRadiatorPowerW | averageInstantaneousRequiredLoadW |
| --- | --- | --- | --- | --- |
| B01 | 288 | 0 | 32018 | 23520 |
| B02 | 288 | 0 | 25923.8 | 18750.7 |
| B03 | 0 | 0 | 37871.6 | 42545.1 |
| B04 | 288 | 0 | 29579.3 | 21765.3 |
| B05 | 0 | 0 | 36319.3 | 33293.3 |
| B06 | 0 | 0 | 34444.3 | 31290 |
| B07 | 0 | 0 | 30306.7 | 27673.6 |
| B08 | 0 | 0 | 39086.7 | 35934.9 |
| B09 | 0 | 54 | 34797.3 | 39240 |
| B10 | 0 | 0 | 34466.8 | 31290 |
| B11 | 0 | 0 | 42852.8 | 39104 |
| B12 | 0 | 0 | 38117.9 | 35021.3 |

## Allocation mismatch

Normalized L1 mismatch = Σ_building |actual share − design-load share| within each zone. Zero is exact share agreement; range 0–2. No area weighting of exposure rates.

{'near': 0.31558518225742294, 'mid': 0.0, 'far': 0.12463178423194146}

Severe-overheat contributors: B01 (288/288 frames), B02 (288/288 frames), B04 (288/288 frames)
Underheating contributors: B09 (54/288 frames)
