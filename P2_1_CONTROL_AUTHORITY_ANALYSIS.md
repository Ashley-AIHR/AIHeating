# P2.1 Static Control-Authority Analysis

Synthetic design sizing: 21°C indoors, −10°C outdoors, solar 0 W/m², windows closed. SPEC does not set a conflicting design outdoor condition; these are the requested synthetic design values, not climate standards. Representative operation is also evaluated at current −5°C. Controller curves, pump/valve equations and all R/C/UA values are unchanged.

## Equations and limits of this analysis

`H=1/R`; design envelope loss `H×31`; design maintenance heat `max(0,H×31−internalGain)`. No solar credit. At solved static zone flow, building mass flow is the existing normalized share allocation. Emitter conductance `G=m×cp×(1−exp(−UA/(m×cp)))` is the accepted NTU function.

Steady maintenance requires `Ts(T)=T + max(0,H×(T−Tout)−internalGain)/G`. Each building's inclusive 18–25°C feasible interval is `[Ts(18),Ts(25)]`; intersect within each zone and with equipment 40–60°C. These samples all have positive required heating, so the steady heating branch applies. Delivered common-zone supply equals inlet supply at steady state under the accepted adiabatic FIFO model.

These are fixed-flow, zero-solar steady analyses, not a transient guarantee or a proof over every possible pump/valve setting. Wind is context only in accepted P1A. No optimizer or additional control was implemented.

## v1.0 area allocation — outdoor -10°C

Pump 46 Hz; policy supply 55°C; fixed Near/Mid/Far openings 50/60/85%. No solar.

| Zone | Unclipped lower °C | Unclipped upper °C | Equipment intersection °C | Lower limiting building | Upper limiting building | Result |
| --- | --- | --- | --- | --- | --- | --- |
| far | 58.515591 | 61.327270 | 58.5156 … 60.0000 | B09 | B12 | NONEMPTY |
| mid | 46.582944 | 61.370512 | 46.5829 … 60.0000 | B05 | B05 | NONEMPTY |
| near | 58.419903 | 49.303106 | 58.4199 … 49.3031 | B03 | B01 | ZONE-LEVEL CONTROL AUTHORITY CONFLICT |

| Building | Allocated kg/s | G W/K | Min Ts for18°C | Max Ts for25°C | Equilibrium Ti at policy Ts |
| --- | --- | --- | --- | --- | --- |
| B09 | 0.813591 | 1052.928001 | 58.515591 | 76.285558 | 16.615128 |
| B10 | 0.949190 | 1228.416001 | 46.548961 | 61.327270 | 22.002980 |
| B11 | 1.175187 | 1520.896001 | 46.548961 | 61.327270 | 22.002980 |
| B12 | 1.039589 | 1345.408001 | 46.548961 | 61.327270 | 22.002980 |
| B05 | 0.987629 | 1285.381950 | 46.582944 | 61.370512 | 21.984387 |
| B06 | 0.942737 | 1226.955497 | 46.582944 | 61.370512 | 21.984387 |
| B07 | 0.826017 | 1075.046722 | 46.582944 | 61.370512 | 21.984387 |
| B08 | 1.059456 | 1378.864273 | 46.582944 | 61.370512 | 21.984387 |
| B01 | 1.099740 | 1407.227519 | 36.930841 | 49.303106 | 28.223198 |
| B02 | 0.898121 | 1149.235807 | 36.930841 | 49.303106 | 28.223198 |
| B03 | 0.898121 | 1149.235807 | 58.419903 | 76.164434 | 16.650890 |
| B04 | 1.008095 | 1289.958559 | 36.930841 | 49.303106 | 28.223198 |

### Design-load and emitter capacity at 21°C indoor

| Building | Envelope W | Internal W | Required W | Q at47°C W | Q at51°C W | Q at55°C W | Supply for21°C at this flow | Infinite-flow lower Ts limit |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| B09 | 50220.000000 | 2700.000000 | 47520.000000 | 27376.128024 | 31587.840027 | 35799.552031 | 66.131291 | 58.714286 |
| B10 | 42315.000000 | 3150.000000 | 39165.000000 | 31938.816027 | 36852.480032 | 41766.144036 | 52.882522 | 47.642857 |
| B11 | 52390.000000 | 3900.000000 | 48490.000000 | 39543.296034 | 45626.880039 | 51710.464044 | 52.882522 | 47.642857 |
| B12 | 46345.000000 | 3450.000000 | 42895.000000 | 34980.608030 | 40362.240035 | 45743.872039 | 52.882522 | 47.642857 |
| B05 | 44330.000000 | 3300.000000 | 41030.000000 | 33419.930694 | 38561.458493 | 43702.986292 | 52.920473 | 47.642857 |
| B06 | 42315.000000 | 3150.000000 | 39165.000000 | 31900.842935 | 36808.664925 | 41716.486915 | 52.920473 | 47.642857 |
| B07 | 37076.000000 | 2760.000000 | 34316.000000 | 27951.214762 | 32251.401648 | 36551.588535 | 52.920473 | 47.642857 |
| B08 | 47554.000000 | 3540.000000 | 44014.000000 | 35850.471108 | 41365.928201 | 46881.385295 | 52.920473 | 47.642857 |
| B01 | 33480.000000 | 3600.000000 | 29880.000000 | 36587.915497 | 42216.825574 | 47845.735650 | 42.233240 | 38.785714 |
| B02 | 27342.000000 | 2940.000000 | 24402.000000 | 29880.130989 | 34477.074218 | 39074.017448 | 42.233240 | 38.785714 |
| B03 | 54684.000000 | 2940.000000 | 51744.000000 | 29880.130989 | 34477.074218 | 39074.017448 | 66.024702 | 58.714286 |
| B04 | 30690.000000 | 3300.000000 | 27390.000000 | 33538.922539 | 38698.756776 | 43858.591013 | 42.233240 | 38.785714 |

## v1.0 area allocation — outdoor -5°C

Pump 44 Hz; policy supply 51°C; fixed Near/Mid/Far openings 50/60/85%. No solar.

| Zone | Unclipped lower °C | Unclipped upper °C | Equipment intersection °C | Lower limiting building | Upper limiting building | Result |
| --- | --- | --- | --- | --- | --- | --- |
| far | 51.082751 | 56.015079 | 51.0828 … 56.0151 | B09 | B11 | NONEMPTY |
| mid | 41.203911 | 56.053562 | 41.2039 … 56.0536 | B07 | B05 | NONEMPTY |
| near | 51.001311 | 45.625820 | 51.0013 … 45.6258 | B03 | B02 | ZONE-LEVEL CONTROL AUTHORITY CONFLICT |

| Building | Allocated kg/s | G W/K | Min Ts for18°C | Max Ts for25°C | Equilibrium Ti at policy Ts |
| --- | --- | --- | --- | --- | --- |
| B09 | 0.778218 | 1044.653149 | 51.082751 | 68.938029 | 17.967558 |
| B10 | 0.907921 | 1218.762007 | 41.175156 | 56.015079 | 22.634384 |
| B11 | 1.124092 | 1508.943438 | 41.175156 | 56.015079 | 22.634384 |
| B12 | 0.994389 | 1334.834579 | 41.175156 | 56.015079 | 22.634384 |
| B05 | 0.944689 | 1275.216035 | 41.203911 | 56.053562 | 22.617794 |
| B06 | 0.901748 | 1217.251670 | 41.203911 | 56.053562 | 22.617794 |
| B07 | 0.790103 | 1066.544320 | 41.203911 | 56.053562 | 22.617794 |
| B08 | 1.013393 | 1367.959019 | 41.203911 | 56.053562 | 22.617794 |
| B01 | 1.051926 | 1396.308154 | 33.211542 | 45.625820 | 28.030322 |
| B02 | 0.859073 | 1140.318326 | 33.211542 | 45.625820 | 28.030322 |
| B03 | 0.859073 | 1140.318326 | 51.001311 | 68.829867 | 17.999485 |
| B04 | 0.964265 | 1279.949141 | 33.211542 | 45.625820 | 28.030322 |

## v1.1 design-load allocation — outdoor -10°C

Pump 46 Hz; policy supply 55°C; fixed Near/Mid/Far openings 50/60/85%. No solar.

| Zone | Unclipped lower °C | Unclipped upper °C | Equipment intersection °C | Lower limiting building | Upper limiting building | Result |
| --- | --- | --- | --- | --- | --- | --- |
| far | 56.891800 | 61.866512 | 56.8918 … 60.0000 | B09 | B10 | NONEMPTY |
| mid | 46.582944 | 61.370512 | 46.5829 … 60.0000 | B05 | B05 | NONEMPTY |
| near | 55.659295 | 50.393066 | 55.6593 … 50.3931 | B03 | B01 | ZONE-LEVEL CONTROL AUTHORITY CONFLICT |

| Building | Allocated kg/s | G W/K | Min Ts for18°C | Max Ts for25°C | Equilibrium Ti at policy Ts |
| --- | --- | --- | --- | --- | --- |
| B09 | 1.061456 | 1096.889311 | 56.891800 | 74.230127 | 17.236224 |
| B10 | 0.874830 | 1210.448123 | 46.972741 | 61.866512 | 21.772773 |
| B11 | 1.083123 | 1498.650058 | 46.972741 | 61.866512 | 21.772773 |
| B12 | 0.958147 | 1325.728897 | 46.972741 | 61.866512 | 21.772773 |
| B05 | 0.987629 | 1285.381950 | 46.582944 | 61.370512 | 21.984387 |
| B06 | 0.942737 | 1226.955497 | 46.582944 | 61.370512 | 21.984387 |
| B07 | 0.826017 | 1075.046722 | 46.582944 | 61.370512 | 21.984387 |
| B08 | 1.059456 | 1378.864273 | 46.582944 | 61.370512 | 21.984387 |
| B01 | 0.874362 | 1346.824349 | 37.779862 | 50.393066 | 27.556728 |
| B02 | 0.714062 | 1099.906552 | 37.779862 | 50.393066 | 27.556728 |
| B03 | 1.514156 | 1233.480327 | 55.659295 | 72.669994 | 17.728696 |
| B04 | 0.801498 | 1234.588987 | 37.779862 | 50.393066 | 27.556728 |

### Design-load and emitter capacity at 21°C indoor

| Building | Envelope W | Internal W | Required W | Q at47°C W | Q at51°C W | Q at55°C W | Supply for21°C at this flow | Infinite-flow lower Ts limit |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| B09 | 50220.000000 | 2700.000000 | 47520.000000 | 28519.122091 | 32906.679336 | 37294.236581 | 64.322512 | 58.714286 |
| B10 | 42315.000000 | 3150.000000 | 39165.000000 | 31471.651209 | 36313.443702 | 41155.236196 | 53.355786 | 47.642857 |
| B11 | 52390.000000 | 3900.000000 | 48490.000000 | 38964.901497 | 44959.501727 | 50954.101957 | 53.355786 | 47.642857 |
| B12 | 46345.000000 | 3450.000000 | 42895.000000 | 34468.951324 | 39771.866912 | 45074.782500 | 53.355786 | 47.642857 |
| B05 | 44330.000000 | 3300.000000 | 41030.000000 | 33419.930694 | 38561.458493 | 43702.986292 | 52.920473 | 47.642857 |
| B06 | 42315.000000 | 3150.000000 | 39165.000000 | 31900.842935 | 36808.664925 | 41716.486915 | 52.920473 | 47.642857 |
| B07 | 37076.000000 | 2760.000000 | 34316.000000 | 27951.214762 | 32251.401648 | 36551.588535 | 52.920473 | 47.642857 |
| B08 | 47554.000000 | 3540.000000 | 44014.000000 | 35850.471108 | 41365.928201 | 46881.385295 | 52.920473 | 47.642857 |
| B01 | 33480.000000 | 3600.000000 | 29880.000000 | 35017.433085 | 40404.730482 | 45792.027880 | 43.185521 | 38.785714 |
| B02 | 27342.000000 | 2940.000000 | 24402.000000 | 28597.570352 | 32997.196561 | 37396.822769 | 43.185521 | 38.785714 |
| B03 | 54684.000000 | 2940.000000 | 51744.000000 | 32070.488507 | 37004.409816 | 41938.331125 | 62.949595 | 58.714286 |
| B04 | 30690.000000 | 3300.000000 | 27390.000000 | 32099.313661 | 37037.669609 | 41976.025557 | 43.185521 | 38.785714 |

## v1.1 design-load allocation — outdoor -5°C

Pump 44 Hz; policy supply 51°C; fixed Near/Mid/Far openings 50/60/85%. No solar.

| Zone | Unclipped lower °C | Unclipped upper °C | Equipment intersection °C | Lower limiting building | Upper limiting building | Result |
| --- | --- | --- | --- | --- | --- | --- |
| far | 49.701400 | 56.495050 | 49.7014 … 56.4950 | B09 | B10 | NONEMPTY |
| mid | 41.203911 | 56.053562 | 41.2039 … 56.0536 | B08 | B07 | NONEMPTY |
| near | 48.653898 | 46.590584 | 48.6539 … 46.5906 | B03 | B01 | ZONE-LEVEL CONTROL AUTHORITY CONFLICT |

| Building | Allocated kg/s | G W/K | Min Ts for18°C | Max Ts for25°C | Equilibrium Ti at policy Ts |
| --- | --- | --- | --- | --- | --- |
| B09 | 1.015306 | 1090.172674 | 49.701400 | 67.103422 | 18.522365 |
| B10 | 0.836794 | 1200.188620 | 41.533801 | 56.495050 | 22.429002 |
| B11 | 1.036031 | 1485.947815 | 41.533801 | 56.495050 | 22.429002 |
| B12 | 0.916489 | 1314.492298 | 41.533801 | 56.495050 | 22.429002 |
| B05 | 0.944689 | 1275.216035 | 41.203911 | 56.053562 | 22.617794 |
| B06 | 0.901748 | 1217.251670 | 41.203911 | 56.053562 | 22.617794 |
| B07 | 0.790103 | 1066.544320 | 41.203911 | 56.053562 | 22.617794 |
| B08 | 1.013393 | 1367.959019 | 41.203911 | 56.053562 | 22.617794 |
| B01 | 0.836346 | 1333.914810 | 33.923056 | 46.590584 | 27.436617 |
| B02 | 0.683016 | 1089.363762 | 33.923056 | 46.590584 | 27.436617 |
| B03 | 1.448323 | 1227.641585 | 48.653898 | 65.712208 | 18.962740 |
| B04 | 0.766651 | 1222.755243 | 33.923056 | 46.590584 | 27.436617 |

## Why the conflict remains

Area-based splitting is demonstrably mismatched: the same 980 m² B02 and B03 received equal flows despite design loads of 24,402 W versus 51,744 W. v1.1 changes their shares to the normalized design loads. But proportional water flow does not imply proportional radiator heat: the NTU conductance saturates below UA. UA remains proportional only to area, while envelope H depends on insulation.

At −10°C, v1.1 Near requires common supply ≥55.6593°C to keep B03 at 18°C and ≤50.3931°C to keep B01 at 25°C: intersection EMPTY (gap 5.2662°C). At −5°C, the corresponding bounds are ≥48.6539°C and ≤46.5906°C: EMPTY (gap 2.0633°C). B02/B04 have essentially the same high-insulation upper bound as B01; the identity selected for a bound can differ under roundoff.

B03 design load is 51,744 W. Even at infinite flow, its unchanged UA=1,372 W/K limits heat at 55/21°C to 46,648 W, below design load. B09 similarly needs 47,520 W but has a 42,840 W infinite-flow limit at 55/21°C. Both require supply approaching at least 58.7143°C at infinite flow to maintain design 21°C; finite-flow requirements are higher. This is a mismatch between the chosen synthetic design duty, emitter sizing and the frozen outdoor-reset supply, not a defect in the accepted NTU equation.

Mid and Far have nonempty 18–25°C zone intervals at both conditions, but that does not mean their current policy supply achieves design 21°C in every building. Nor do independently nonempty zone intervals guarantee one station setpoint works for all zones.

## External-review options — not implemented

Review coherent emitter sizing against the explicit design duty and actual design flow; alternatively review additional building/riser/terminal authority together with sufficient emitter capacity. Throttling overheated buildings and increasing flow alone cannot bypass an emitter's UA limit. Do not alter R/C, solar gains, curves or weather to target a desired KPI. A future full feasible-region analysis across allowed pump/zone controls is separate work; this patch does not conclude that every future control arrangement is impossible.

Physical Fixture v1.1 candidate did not resolve the control-authority conflict.

