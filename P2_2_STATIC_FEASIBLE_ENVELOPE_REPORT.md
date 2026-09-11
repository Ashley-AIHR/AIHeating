# P2.2 Static Feasible Control Envelope Report

**Decision Path C.** A legal all-building 18–25°C witness exists at −5°C, but not at −10°C under the current synthetic fixture, actuator set and equipment bounds. The all-building 20–22°C band is infeasible at both conditions. This is diagnostic evidence, not a new control policy or a baseline freeze.

## 1. Model and exact equilibrium

Unchanged `physical-fixture-v1.1`; internal gains as defined; zero solar and closed windows. Legal static actuators: supply 40–60°C, pump 30–50 Hz, each zone valve 20–100%. Rate limits are deliberately irrelevant to steady existence, not removed from the runtime controller.

For each distinct pump/valve point, call accepted `solve_hydraulics`. Allocate its solved zone flows with unchanged v1.1 design-load weights; obtain NTU conductance from accepted `radiator_conductance`. The active equilibrium is `Ti=(G×Ts+H×Tout+internalGain)/(G+H)`, H=1/R. Heating-off equilibrium is handled separately if outdoor+internal/H≥Ts. Every candidate is substituted into actual accepted `radiator` and `envelope_loss`: `Qrad+internal−Qenvelope=0`. Unit tests initialize the accepted dynamic engine at these exact steady temperatures and confirm no drift or heat-power discrepancy.

No manually assigned flow is used as an operating candidate. Repeated identical pump/valve settings reuse the accepted solver result because neither supply nor outdoor temperature occurs in the hydraulic equations. Adiabatic FIFO has no steady temperature offset; its code and volumes remain unchanged.

Hard violation = max_i(max(18−Ti,Ti−25,0)); comfort violation = max_i(max(20−Ti,Ti−22,0)). Feasibility tolerance is only 1e−7°C; no band widening. Static spread in this report is max Ti−min Ti, unlike the dynamic pooled P90−P10 metric used in the shadow report.

## 2. Search coverage and reproducibility

- Coarse grid: Ts 40:2:60, pump 30:4:50, each valve 20:20:100%. Exactly 11×6×5³=8,250 settings per outdoor case, covering all endpoints and the entire legal box at those spacings.
- Refinement: three distinct best coarse hydraulic regions per band/scope; Ts ±1°C/0.5°C, pump ±2Hz/1Hz, valves ±10pp/5pp, clipped at limits and deduplicated.
- Independent global search: SciPy differential evolution over all five bounded actuators, seeds 7 and 23, popsize multiplier 10, maxiter 180, tol 1e−8, atol 1e−10; bounded Powell polish. Whole/Near/Mid/Far objectives are run separately for each band and outdoor case.

| Audit | Actual |
| --- | --- |
| Static candidate evaluations | 233702.000000 |
| Accepted hydraulic solver calls | 175644.000000 |
| Largest normalized hydraulic residual | 1.17108504e-12 |
| Largest absolute thermal residual W | 3.63797881e-11 |
| Largest allocation relative mass residual | 2.22023125e-16 |
| Search wall seconds | 61.806442 |

Absolute heat-balance residual threshold is 1e−6 W; accepted solver residual <1e−8. All candidates validate equipment bounds. The JSON retains per-building signed thermal residuals, heat outputs, temperatures/violations and solved flows for each selected stage/seed best; aggregate maxima cover every evaluation. It is not a log of every rejected population member. Source plus deterministic seeds make the search reproducible.

**Optimizer qualification:** 16 of 32 DE runs reached the 180-generation cap rather than their tight tolerance. Their bounded-polished best points are valid evaluated points, not proofs of a global numeric optimum. All stages agree on the feasibility classification. Nonexistence conclusions below depend additionally on conservative analytic interval exclusions, not those optimizer stop flags. Positive values are best-found upper bounds on the minimum violation; the last decimal is not a certified optimum.

## 3. Three-stage results

| Outdoor °C | Band | Scope | Coarse best Δ°C | Refined best Δ°C | DE/polish seed7 Δ°C | Seed23 Δ°C | Refined points | Conclusion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| -5.000000 | hard | all | 0.000000 | 0.000000 | 0.000000 | 0.000000 | 3105.000000 | FEASIBLE WITNESS |
| -5.000000 | hard | near | 0.000000 | 0.000000 | 0.000000 | 0.000000 | 1485.000000 | FEASIBLE WITNESS |
| -5.000000 | hard | mid | 0.000000 | 0.000000 | 0.000000 | 0.000000 | 6125.000000 | FEASIBLE WITNESS |
| -5.000000 | hard | far | 0.000000 | 0.000000 | 0.000000 | 0.000000 | 3600.000000 | FEASIBLE WITNESS |
| -5.000000 | comfort | all | 2.097439 | 2.097439 | 2.085747 | 2.085637 | 3447.000000 | INFEASIBLE (interval exclusion) |
| -5.000000 | comfort | near | 2.097439 | 2.052565 | 2.004495 | 2.004479 | 2385.000000 | INFEASIBLE (interval exclusion) |
| -5.000000 | comfort | mid | 0.000000 | 0.000000 | 0.000000 | 0.000000 | 3375.000000 | FEASIBLE WITNESS |
| -5.000000 | comfort | far | 0.684314 | 0.678355 | 0.674664 | 0.674685 | 2205.000000 | INFEASIBLE (interval exclusion) |
| -10.000000 | hard | all | 0.588615 | 0.583789 | 0.583716 | 0.583718 | 2475.000000 | INFEASIBLE (interval exclusion) |
| -10.000000 | hard | near | 0.588615 | 0.583789 | 0.583724 | 0.583723 | 2475.000000 | INFEASIBLE (interval exclusion) |
| -10.000000 | hard | mid | 0.000000 | 0.000000 | 0.000000 | 0.000000 | 3375.000000 | FEASIBLE WITNESS |
| -10.000000 | hard | far | 0.000000 | 0.000000 | 0.000000 | 0.000000 | 2925.000000 | FEASIBLE WITNESS |
| -10.000000 | comfort | all | 2.950488 | 2.924894 | 2.921046 | 2.921069 | 2925.000000 | INFEASIBLE (interval exclusion) |
| -10.000000 | comfort | near | 2.943027 | 2.924303 | 2.921046 | 2.921051 | 2205.000000 | INFEASIBLE (interval exclusion) |
| -10.000000 | comfort | mid | 0.000000 | 0.000000 | 0.000000 | 0.000000 | 4125.000000 | FEASIBLE WITNESS |
| -10.000000 | comfort | far | 1.314674 | 1.314644 | 1.314458 | 1.314443 | 3672.000000 | INFEASIBLE (interval exclusion) |

Per-zone objectives still solve the entire coupled hydraulic network, but only score that zone. A zone's witness must not be mistaken for a whole-system witness; other buildings may violate bounds in a zone-only solution.

## 4. Whole-system witnesses and best violating points

Actuator order below: supply °C / pump Hz / Near % / Mid % / Far %.

### Outdoor -5°C — 18–25°C

Result: FEASIBLE; best-found max violation 0.000000000°C. Actuators: **56.500000 / 30.000000 / 20.000000% / 50.000000% / 75.000000%**.

| Building | Indoor °C | Violation °C |
| --- | --- | --- |
| B01 | 24.702527 | 0.000000 |
| B02 | 24.702527 | 0.000000 |
| B03 | 18.302245 | 0.000000 |
| B04 | 24.702527 | 0.000000 |
| B05 | 24.008048 | 0.000000 |
| B06 | 24.008048 | 0.000000 |
| B07 | 24.008048 | 0.000000 |
| B08 | 24.008048 | 0.000000 |
| B09 | 20.028940 | 0.000000 |
| B10 | 24.002478 | 0.000000 |
| B11 | 24.002478 | 0.000000 |
| B12 | 24.002478 | 0.000000 |

Minimum 18.302245°C; maximum 24.702527°C; range 6.400282°C. Near/Mid/Far flows 4.544845/9.045884/10.146178 m³/h; total 23.736906 m³/h. Hydraulic residual 1.29067e-16; thermal residual 7.27596e-12 W.

Nearest-bound buildings (not active constraints in this interior witness): B01, B02, B04. Violating buildings: none.

### Outdoor -5°C — 20–22°C

Result: INFEASIBLE; best-found max violation 2.085637419°C. Actuators: **55.976517 / 30.000110 / 20.000182% / 60.082848% / 99.995311%**.

| Building | Indoor °C | Violation °C |
| --- | --- | --- |
| B01 | 24.085637 | 2.085637 |
| B02 | 24.085637 | 2.085637 |
| B03 | 17.914363 | 2.085637 |
| B04 | 24.085637 | 2.085637 |
| B05 | 24.085617 | 2.085617 |
| B06 | 24.085617 | 2.085617 |
| B07 | 24.085617 | 2.085617 |
| B08 | 24.085617 | 2.085617 |
| B09 | 20.029434 | 0.000000 |
| B10 | 24.056246 | 2.056246 |
| B11 | 24.056246 | 2.056246 |
| B12 | 24.056246 | 2.056246 |

Minimum 17.914363°C; maximum 24.085637°C; range 6.171275°C. Near/Mid/Far flows 4.333242/9.870536/10.994109 m³/h; total 25.197887 m³/h. Hydraulic residual 1.93600e-16; thermal residual 1.45519e-11 W.

Binding maximum-violation buildings: B01, B02, B03, B04. Violating buildings: B01, B02, B03, B04, B05, B06, B07, B08, B10, B11, B12.

### Outdoor -10°C — 18–25°C

Result: INFEASIBLE; best-found max violation 0.583715682°C. Actuators: **59.999987 / 34.772531 / 23.628753% / 63.937141% / 94.165027%**.

| Building | Indoor °C | Violation °C |
| --- | --- | --- |
| B01 | 25.583716 | 0.583716 |
| B02 | 25.583716 | 0.583716 |
| B03 | 17.416284 | 0.583716 |
| B04 | 25.583716 | 0.583716 |
| B05 | 23.843107 | 0.000000 |
| B06 | 23.843107 | 0.000000 |
| B07 | 23.843107 | 0.000000 |
| B08 | 23.843107 | 0.000000 |
| B09 | 18.872778 | 0.000000 |
| B10 | 23.580058 | 0.000000 |
| B11 | 23.580058 | 0.000000 |
| B12 | 23.580058 | 0.000000 |

Minimum 17.416284°C; maximum 25.583716°C; range 8.167431°C. Near/Mid/Far flows 5.798018/11.731959/12.233578 m³/h; total 29.763555 m³/h. Hydraulic residual 2.88209e-16; thermal residual 2.91038e-11 W.

Binding maximum-violation buildings: B01, B02, B03, B04. Violating buildings: B01, B02, B03, B04.

### Outdoor -10°C — 20–22°C

Result: INFEASIBLE; best-found max violation 2.921045692°C. Actuators: **60.000000 / 35.457162 / 20.651722% / 62.358146% / 82.571668%**.

| Building | Indoor °C | Violation °C |
| --- | --- | --- |
| B01 | 24.921046 | 2.921046 |
| B02 | 24.921046 | 2.921046 |
| B03 | 17.078954 | 2.921046 |
| B04 | 24.921046 | 2.921046 |
| B05 | 23.939465 | 1.939465 |
| B06 | 23.939465 | 1.939465 |
| B07 | 23.939465 | 1.939465 |
| B08 | 23.939465 | 1.939465 |
| B09 | 18.842314 | 1.157686 |
| B10 | 23.536821 | 1.536821 |
| B11 | 23.536821 | 1.536821 |
| B12 | 23.536821 | 1.536821 |

Minimum 17.078954°C; maximum 24.921046°C; range 7.842091°C. Near/Mid/Far flows 5.328600/12.071819/12.090481 m³/h; total 29.490900 m³/h. Hydraulic residual 1.84791e-16; thermal residual 1.45519e-11 W.

Binding maximum-violation buildings: B01, B02, B03, B04. Violating buildings: B01, B02, B03, B04, B05, B06, B07, B08, B09, B10, B11, B12.

## 5. Independent zone feasibility and relevant actuator regions

| Outdoor °C | Zone | Band | Feasible? | Best-found max violation °C | Binding/nearest IDs | Evaluated actuator example |
| --- | --- | --- | --- | --- | --- | --- |
| -5.000000 | near | hard | YES | 0.000000 | B03 | 58.000000 / 30.000000 / 20.000000% / 95.000000% / 90.000000% |
| -5.000000 | mid | hard | YES | 0.000000 | B05, B06, B07, B08 | 47.500000 / 44.000000 / 35.000000% / 90.000000% / 70.000000% |
| -5.000000 | far | hard | YES | 0.000000 | B09 | 60.000000 / 35.000000 / 85.000000% / 90.000000% / 40.000000% |
| -5.000000 | near | comfort | NO | 2.004479 | B01, B02, B03, B04 | 56.985528 / 30.000199 / 20.000040% / 99.999381% / 99.997674% |
| -5.000000 | mid | comfort | YES | 0.000000 | B05, B06, B07, B08 | 48.500000 / 44.000000 / 30.000000% / 35.000000% / 20.000000% |
| -5.000000 | far | comfort | NO | 0.674664 | B09, B10, B11, B12 | 60.000000 / 31.231983 / 68.598575% / 68.958193% / 37.151987% |
| -10.000000 | near | hard | NO | 0.583723 | B01, B02, B03, B04 | 59.999901 / 38.279119 / 21.344438% / 87.215316% / 65.897043% |
| -10.000000 | mid | hard | YES | 0.000000 | B05, B06, B07, B08 | 55.000000 / 48.000000 / 100.000000% / 50.000000% / 65.000000% |
| -10.000000 | far | hard | YES | 0.000000 | B09 | 60.000000 / 40.000000 / 30.000000% / 90.000000% / 100.000000% |
| -10.000000 | near | comfort | NO | 2.921046 | B01, B02, B03, B04 | 60.000000 / 35.616271 / 20.793286% / 64.084097% / 89.563741% |
| -10.000000 | mid | comfort | YES | 0.000000 | B05, B06, B07, B08 | 54.000000 / 38.000000 / 100.000000% / 80.000000% / 100.000000% |
| -10.000000 | far | comfort | NO | 1.314443 | B09, B10, B11, B12 | 59.999961 / 39.721683 / 90.011315% / 37.519931% / 77.255921% |

Near: broad-band feasibility exists at −5°C near low pump/Near-valve settings and elevated supply, so the earlier fixed-flow conflict was not universal. At −10°C, Near alone prevents whole-system hard feasibility. Mid can achieve both bands at both outdoor values. Far can achieve 18–25°C at both values but cannot achieve 20–22°C simultaneously for all four buildings. Zone-only optimum actuator tuples are examples, not rectangular feasible-region bounds or recommended runtime setpoints.

## 6. Conservative exclusion certificate: why this is not a false coarse-grid rejection

For a zone, all legal flows lie within `[0,qmax]`, where `qmax=sqrt(Pshutoff(50Hz)/(Kpipe+Kvalve_ref))`. This deliberately drops positive pump-flow/common losses and assumes valve fully open, so it is a **superset** of the actual coupled hydraulic flows. The bound is a mathematical necessary-condition relaxation, not a manually assigned actuator candidate.

At positive flow and these winter conditions, maintenance loads at both temperature bounds are positive. Each building's required common supply for a bound is `Ts(T,q)=T+[H(T−Tout)−internal]/G_i(q)`. Accepted NTU G increases with q; therefore the maximum lower supply L(q) and minimum upper supply U(q) are decreasing. For any q in `[a,b]`, feasibility requires `max(40,L(b)) ≤ min(60,U(a))`. If the left side exceeds the right side, **every flow in that interval is excluded**. Bisection partitions the whole relaxed domain; q=0 itself cannot maintain winter temperatures. Excluding the entire superset rules out every legal actuator tuple, regardless of grid resolution or optimizer success.

The following certificates cover every interval without gaps. Arithmetic uses double precision with a 1e−7°C strict exclusion margin; gaps are large compared with numerical substitution residuals. These certificates establish zero-feasibility impossibility, not an exact lower bound equal to the reported numerical minimum violation.

### -5°C / near / comfort

Relaxed flow domain: 0–0.010576003404 m³/s; 4 intervals, no unresolved remainder.

| Flow interval m³/s | Required supply lower bound °C | Allowed supply upper bound °C | Strict exclusion gap °C |
| --- | --- | --- | --- |
| 0.000000000000 … 0.001322000425 | 60.643431 | 60.000000 | 0.643431 |
| 0.001322000425 … 0.002644000851 | 55.067606 | 49.837797 | 5.229809 |
| 0.002644000851 … 0.005288001702 | 52.469705 | 42.969795 | 9.499910 |
| 0.005288001702 … 0.010576003404 | 51.218792 | 39.947390 | 11.271402 |

### -5°C / far / comfort

Relaxed flow domain: 0–0.006995368718 m³/s; 5 intervals, no unresolved remainder.

| Flow interval m³/s | Required supply lower bound °C | Allowed supply upper bound °C | Strict exclusion gap °C |
| --- | --- | --- | --- |
| 0.000000000000 … 0.001748842179 | 60.747631 | 60.000000 | 0.747631 |
| 0.001748842179 … 0.002186052724 | 58.433381 | 57.012862 | 1.420519 |
| 0.002186052724 … 0.002623263269 | 56.935782 | 54.347947 | 2.587835 |
| 0.002623263269 … 0.003497684359 | 55.115199 | 52.638675 | 2.476524 |
| 0.003497684359 … 0.006995368718 | 52.492354 | 50.579413 | 1.912941 |

### -10°C / near / hard

Relaxed flow domain: 0–0.010576003404 m³/s; 6 intervals, no unresolved remainder.

| Flow interval m³/s | Required supply lower bound °C | Allowed supply upper bound °C | Strict exclusion gap °C |
| --- | --- | --- | --- |
| 0.000000000000 … 0.001322000425 | 63.869015 | 60.000000 | 3.869015 |
| 0.001322000425 … 0.001652500532 | 61.283963 | 60.000000 | 1.283963 |
| 0.001652500532 … 0.001983000638 | 59.610769 | 58.403071 | 1.207698 |
| 0.001983000638 … 0.002644000851 | 57.576299 | 55.963144 | 1.613154 |
| 0.002644000851 … 0.005288001702 | 54.644381 | 53.058176 | 1.586205 |
| 0.005288001702 … 0.010576003404 | 53.232637 | 49.014113 | 4.218523 |

### -10°C / near / comfort

Relaxed flow domain: 0–0.010576003404 m³/s; 3 intervals, no unresolved remainder.

| Flow interval m³/s | Required supply lower bound °C | Allowed supply upper bound °C | Strict exclusion gap °C |
| --- | --- | --- | --- |
| 0.000000000000 … 0.002644000851 | 62.582093 | 60.000000 | 2.582093 |
| 0.002644000851 … 0.005288001702 | 59.427499 | 47.400033 | 12.027466 |
| 0.005288001702 … 0.010576003404 | 57.908533 | 43.739092 | 14.169441 |

### -10°C / far / comfort

Relaxed flow domain: 0–0.006995368718 m³/s; 2 intervals, no unresolved remainder.

| Flow interval m³/s | Required supply lower bound °C | Allowed supply upper bound °C | Strict exclusion gap °C |
| --- | --- | --- | --- |
| 0.000000000000 … 0.003497684359 | 62.639885 | 60.000000 | 2.639885 |
| 0.003497684359 … 0.006995368718 | 59.455002 | 56.366522 | 3.088480 |

## 7. Binding reason and interpretation

At −10°C the best-found all-building hard point uses supply almost 60°C, with B03 near 17.4163°C and B01/B02/B04 near 25.5837°C. More Near heat helps B03 but worsens the high-insulation peers; throttling reverses that trade-off. The certificate shows that no alternative legal zone flow can close it within the 60°C supply ceiling. This is an emitter/load/within-zone allocation/common-authority conflict, not a hydraulic solver failure.

B09 remains capacity/heterogeneity-limited for the narrow Far comfort band, but is not the binding cause of whole-system 18–25°C impossibility: Far has legal hard-band witnesses at −10°C, and B09 is above 18°C at the best whole hard point. Do not simply label both low-insulation buildings as hard-infeasible without this distinction.

Path C applies because hard feasibility fails at one representative condition. At −5°C it exists, so do not claim universal winter infeasibility. Static results do not establish dynamic 24-hour comfort, MPC performance, real-site feasibility or savings. They apply only to this synthetic fixture, grouping, actuator set and equipment limits.

Next external decision may consider Physical Fixture v1.2 — Coherent Radiator Sizing. No such change, controller, actuator, new baseline freeze or later phase is implemented here.

