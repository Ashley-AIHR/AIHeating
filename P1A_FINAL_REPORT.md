# Phase 1A Final Engineering Report

## 1. Executive Summary

The standalone physical core is implemented and validated locally. **84 Python tests and 32 measured physical Gates pass, with 0 failures and 0 skips.** P0 typecheck, invariant runner and production build also pass. All frozen P0 product files remain identical to commit `7c3b89d`.

The model is internally conservative and deterministic for the documented synthetic fixture. This is not validation against a real heating plant. No controller, prediction model, optimisation, API service or React integration was added. Engineering review is still external to this self-assessment.

## 2. Scope

One station, three shared-pump zones, 12 radiator buildings, volume FIFO supply transport, water-side emitter heat, 1R1C building response, deterministic weather/solar/internal/window inputs, required and supplied heat, returns, pump electrical power, equipment validation and diagnostics. Floor heating and subsequent phases remain deferred.

## 3. Repository Changes

Added `physical_core/` with Python 3.12 packaging, `uv.lock`, 11 small source modules, five test files, two engineering exporters, a TypeScript contract-check script and an actual response example. Hydraulics, transport, thermal and integrated simulation are separate modules without a generic framework.

Added the required plan/model specification/Gate results/final report; `p1a_gate_results.json`, `p1a_parameters.json`, `p1a_canonical_run.csv`; and five PNGs in `validation_plots/`. The only existing tracked-file change is Python environment/cache ignore rules in `.gitignore`.

`git diff --exit-code HEAD -- src scripts package.json package-lock.json tsconfig.json index.html` and all P0 documents/screenshots returned no changes. No new commit or GitHub push was performed in this phase; the earlier P0 publication remains blocked by its previously reported GitHub permission error.

## 4. Physical Architecture

Validated forcing/controls → shared-pump nonlinear hydraulic solve → independent zone FIFO buffers → weighted building flow allocation → exact segment-wise radiator/building integration → weighted returns → required/actual/source heat and pump power → conservation diagnostics → atomic state commit → optional P0 serialization.

Static profiles are outside frames. Dynamic frames contain temperatures, powers, flows, returns, transport delivery/delay, cumulative energies and residuals. The engine has its own simulation clock starting Jan 15, 2025 08:00 +08:00.

## 5. Synthetic Parameter Disclosure

All plant coefficients are **Synthetic PoC Parameters**, exported in `p1a_parameters.json`. Buildings total 12,910 m². Envelope loss coefficients range from 0.9 to 1.8 W/(m² K); effective thermal capacitance 180–210 kJ/(m² K); radiator UA 1.4 W/(m² K). Internal gains are 3 W/m²; solar aperture is 4% of heated area with explicit orientation factors. Initial indoor temperature is 20°C, pipe temperature 50°C. These are neither Beijing standards nor customer operating data.

P0 identity/area/year/insulation metadata is retained. P0 heat/pump/current-temperature display numbers are not used for calibration. The only permitted nominal physical references are flow×delay values for equivalent supply-pipe volume.

## 6. Coupled Hydraulic Model

`Q_total=ΣQ_zone`; all zones share `rho g H_pump−K_common Q_total²`. The three nonnegative branch flows satisfy their pressure-loss equations simultaneously. The common-path coefficient is 1.5×10⁸ Pa s²/m⁶. Pressure coupling occurs in the equations, not post-processing.

## 7. Pump Model

Quadratic centrifugal curve: `H=16(f/50)²−40000 Q_total²` in metres, using SI flow. Head falls with flow and rises with frequency. Electrical efficiency is the explicit synthetic value 0.76. Frequency control is supported; differential-pressure control is rejected as unsupported in this phase.

## 8. Valve Model

`K_valve=K_ref/u²`, valid opening 0.2–1.0. Near/Mid/Far K_pipe are 0.6/1.2/2.0×10⁹; K_ref are 0.8/1.0/1.2×10⁹ Pa s²/m⁶. Monotonic resistance and bounds are tested.

## 9. Hydraulic Solver

SciPy bounded least_squares with analytic Jacobian, shutoff-pressure normalization and previous valid flows as warm start. Internal acceptance is optimizer success plus residual <1e-8; Gate remains <1e-5. Diagnostics include status, measured residual, nfev and message. No solver failure emits a converged frame or invented flow.

The nfev=1 failure experiment raises an explicit failed result. If the optimizer raises before calculating a residual, the residual is null. The engine preserves clock, buffers and indoor state when solving fails. `iterations` in the seam is documented as function evaluations.

## 10. Hydraulic Coupling Evidence

At 45 Hz with all valves 60%, changing only Near to 80% produces:

| Measurement | Actual change | Gate |
| --- | --- | --- |
| Near flow | +17.3939313% | ≥+5% |
| Mid flow | −4.9535485% | Mid or Far ≤−1% |
| Far flow | −4.9535485% | Mid or Far ≤−1% |
| Available branch pressure | −9.6617207% | Must change |

Opened-case flows are Near 18.817205, Mid 12.832779, Far 11.082599 m³/h. Reclosing Near to 50% restores Far flow relative to the 80% case. Raising pump frequency to 47 Hz increases total and all zone flows. Full baselines, changes and residuals are in H1–H5 of `P1A_GATE_RESULTS.md`.

H3 is a **fixture-specific fixed-frequency-pump Gate**, not a universal law. Future ideal constant-ΔP operation needs its own expectations.

## 11. Transport Delay Model

FIFO movement is Q×dt; pipe volume remains fixed. Existing water packets move when flow changes. Equivalent volumes computed from permitted references are Near 2.966666667, Mid 4.733333333, Far 6.183333333 m³. Transport state and building capacitance are separate.

Delivered temperature and powers are interval means, timestamped at interval end; the thermal integrator retains exact within-step arrival segments. A +5°C step at nominal flow gives first meaningful sampled responses at 15/25/40 minutes, within 10/20/35 ±5 minutes. The physical fronts themselves arrive at the nominal times; this one-step reporting offset is not a model lag.

## 12. Flow-Dependent Delay Evidence

Reducing Far flow by 20% with unchanged volume yields V/Q=43.75 minutes and a measured first sampled response at 45 minutes, compared with 40 minutes at nominal flow. The delay field is never directly edited to obtain this result. An additional regression changes flow while the hot water is already in transit and proves preexisting packets move accordingly.

## 13. Radiator Heat Transfer

The allowed NTU alternative uses `G=m cp(1−exp(−UA/(m cp)))`, `Q=G max(Ts−Ti,0)`, `Tr=Ts−Q/(m cp)`. It conserves water energy, is monotone in positive flow/supply temperature, saturates toward the emitter limit and tends to zero heat at zero flow. Heating-mode return is bounded between indoor and delivered supply temperature. R1–R4 cover zero through high flows, including finite near-zero behavior.

## 14. Building 1R1C Model

The node solves `C dT/dt=Q_rad+Q_solar+Q_internal−Q_envelope−Q_window`. Within each constant outlet segment, linear heating/ambient conductances are integrated analytically, including exact heating-on/off boundary crossing if indoor temperature crosses supply temperature. Endpoint temperature and time-mean thermal terms are distinct. No room-temperature clipping or hidden delay in C.

## 15. Solar / Internal / Window Gains

Solar is radiation×effective solar area×orientation. Internal gains are fixed by profile. Window loss is G_window×fraction×(T_indoor−T_outdoor), with default fraction 0 and explicit bounds [0,1]. Windows are a physical input only. SPEC's signed loss notation is represented consistently as a positive outward loss subtracted from gains.

## 16. Required Heat Load

Sum of `max(0,H_loss(21−T_outdoor)−solar−internal)` over buildings. It measures target-maintenance demand under the current forcing; it is not actual emitter output, recovery demand or a future prediction. Cold outdoor conditions increase it; solar decreases it.

## 17. Actual Heat Supply

Actual delivered heat is the sum of radiator powers and independently matches water-side zone/station delivered heat. The canonical final value is 0.402848101 MW. The final required load is 0.416360889 MW. The two fields remain separate, and neither is tuned toward the P0 display's MW values.

The instantaneous station source input is separately accounted for because pipe water can store energy. During a supply transient, source input minus delivered heat equals supply-pipe storage change. Maximum absolute storage power in the canonical run is 97.584496 kW. This is not pipe heat loss.

## 18. Pump Power

`P_electric=ΔP_pump Q_total/0.76`. Final canonical power is 1.137992607 kW. Cumulative electrical energy is 27.306588985 kWh over 24 hours; delivered heat is 9.864774511 MWh. Source equations use W and J; conversion functions handle kW/kWh/MWh explicitly.

## 19. Mass Conservation

Zone flow is allocated by normalized area weights. Maximum relative zone/station mass residual during the 24-hour run is **1.3439749×10⁻¹⁶**, against <1×10⁻⁶. No mass is created by building allocation or transport movement. FIFO relative volume residual is at most 1.8764333×10⁻¹⁶.

## 20. Heat Conservation

| Check | Maximum relative residual, 24h | Gate |
| --- | --- | --- |
| Zone water versus emitters | 2.4272216×10⁻¹⁵ | <1×10⁻⁵ |
| Station delivered water versus emitters | 1.4875529×10⁻¹⁵ | <1×10⁻⁵ |
| Source minus delivered minus pipe storage | 4.0864674×10⁻¹⁵ | <1×10⁻⁵ |
| Building storage versus net gains/losses | 5.6249320×10⁻¹⁴ | <1×10⁻⁵ |

Both return mixing levels are flow-weighted. All powers share consistent interval sampling and water constants. Small residuals demonstrate internal accounting, not external predictive accuracy.

## 21. Timestep Strategy

Physical dt=5/10/15 minutes, default 5. Command changes are permitted on independent 30-minute boundaries, bounded per accepted change. A +5°C component-level transport experiment does not bypass integrated-engine rate validation; the integrated causality experiment uses a legal +2°C step.

The smooth-forcing 5-versus-10-minute final-temperature maximum difference is **0.0000130725655°C**, versus the unchanged <0.3°C Gate. A separate scheduled-run comparison is similarly small: 0.0000130891740°C. Exact thermal integration and within-step transport-front handling avoid first-order thermal stepping errors; remaining difference is primarily weather sampling.

## 22. Numerical Stability

288 steps at 5 minutes span 24 hours. Every frame serializes with `allow_nan=False`; all hydraulic solves converge, flows are nonnegative, pump power finite and positive, returns consistent with heating, and buffers valid. All building temperatures remain within broad −10 to 50°C sanity bounds; observed range is **19.146582–26.403540°C**. A 96-step, 15-minute run also passes.

Two identical full runs produce identical serialized frame data (including energies/diagnostics). The recorded SHA-256 is `aeb0c1960715abaf7c2c58295c6bdac941b9ccfc6e9fd1e673e5ee8a03de93b3` on this runtime.

## 23. Causality Tests and Root-Cause Review

T1–T6 all call actual model functions with changed physical inputs. The integrated +2°C experiment finds **exactly zero heat/indoor effect before delivered supply changes**. At first response, indoor differences are only approximately 0.0020–0.0031°C, compared with delivered supply differences of 1.27–1.59°C. The pipe delay and building inertia are independently visible.

Final review covered all requested areas:

| Review area | Finding / evidence |
| --- | --- |
| Dimensions | SI-only solver and heat equations; conversions isolated; K/a units documented |
| Signs | Outward loss subtracted; radiator heating nonnegative; pipe storage signed |
| Weighted averaging | Unequal building/zone flows tested against mass-weighted returns |
| Convergence | Explicit optimizer success and residual; failure/exception tests preserve state |
| Pump behavior | Head decreases with flow; frequency causes all branches to respond |
| Valve monotonicity | Resistance decreases with opening; H3/H4 emerge from equations |
| Zero flow | Zero heat, finite emitter states, unchanged FIFO inventory, undefined delay explicitly null |
| Transport volume | Long-step, zero-flow and changing-flow tests conserve inventory and enthalpy |
| Thermal energy | Exact interval means and on/off crossings; C1–C5 measured independently |
| Timestep sensitivity | 5/10-minute threshold unchanged; 15-minute run stable |
| Parameter realism | Explicit order-of-magnitude rationale; no empirical calibration claims |
| Hidden coupling | Only shared pump/header equations and explicit radiator/indoor feedback |
| Hard-coded Gate answers | Source search found no test/gate conditionals, special valve cases or expected-flow assignments |
| P0 fixture leakage | Nominal 17.8/14.2/10.6 values only in permitted transport references; no 2.78/42.6 target matching |

Two review improvements were made before finalizing: the insulation Gate now calls the same envelope-loss function used by the engine; a solver exception without a calculated residual returns null instead of a placeholder. No Gate was weakened and no physical coefficient was adjusted to hit a passing answer.

The first complete test run found one compatibility-check tooling error: it assumed a legacy TypeScript compiler API, while P0 uses TypeScript 7. The checker was changed to invoke the installed `tsc` CLI. This changed only new validation tooling; the P0 contract and product remained frozen.

## 24. 24-Hour Canonical Scenario

Deterministic weather: −8°C morning → +5°C at 14:00 with 480 W/m² solar → overnight cooling → −8°C next morning. Midpoint sampling uses explicit linear-interpolation knots. The predefined supply/pump/valve schedule exists solely to exercise physical transients, not to represent a Traditional Baseline or an AI action.

`p1a_canonical_run.csv` contains **288 rows and 49 columns**, including every requested weather/control/zone flow/supply/return/building/heat/pump/delay/residual field, plus source/pipe/building-energy diagnostics. Timestamps mark interval ends from Jan 15 08:05 to Jan 16 08:00; initialization is Jan 15 08:00.

All five engineering plots were generated and visually inspected:

- `validation_plots/01_zone_flows.png`
- `validation_plots/02_transport_supply_temperatures.png`
- `validation_plots/03_representative_indoor_temperatures.png` — B03/B06/B11
- `validation_plots/04_required_vs_actual_heat.png`
- `validation_plots/05_pump_power.png`

Axes, units and legends are readable. Transport curves show the response order and room curves show gradual thermal evolution; no product-UI work was performed.

## 25. P0 Contract Adapter

`adapters.py::to_p0_frame` outputs the documented `SimulationFrameResponse`: simulationTime/weather/networkState/buildingStates/transport/metrics/source/solver. `source="simulation_engine"`, solver status is `converged` for valid frames, and no static building metadata is repeated.

Actual response JSON is compiled against the response interface **extracted from the frozen Markdown seam** and imports `WeatherState`, `HeatingNetworkState`, `BuildingThermalState` from the frozen TypeScript domain. This checks actual field names, casing, nested shape and units mapping. Compliance and comfort are fractions derived from endpoint building temperatures. `differentialPressureKpa` reports pump differential pressure, while available branch pressure remains a distinct core diagnostic.

The seam leaves sampling unspecified; the implementation documents interval-mean heat/return/delivered values and endpoint indoor temperatures. No frozen field was renamed, removed or semantically aliased. React remains fixture-backed.

## 26. Full Gate Matrix

Detailed inputs, baseline outputs, changed inputs, measurements, thresholds, residuals and PASS/FAIL are in `P1A_GATE_RESULTS.md` and `p1a_gate_results.json`.

| Gates | Coverage | Result |
| --- | --- | --- |
| H1, H2, H3, H4, H5 | Mass, nonlinear convergence, opening coupling, reverse coupling, pump causality | 5 PASS |
| D1, D2, D3 | Nominal transport, reduced Far flow, variable-flow FIFO volume/enthalpy | 3 PASS |
| R1, R2, R3, R4 | Nonnegative heat, bounded returns, energy, zero flow | 4 PASS |
| T1, T2, T3, T4, T5, T6 | Outdoor, solar, supply, flow, insulation, window | 6 PASS |
| C1, C2, C3, C4, C5 | Allocation mass, zone heat, station heat, pipe storage, building storage | 5 PASS |
| I1 | Integrated transport versus inertia separation | 1 PASS |
| N1, N2, N3, N4 | 24h, 5/10-minute consistency, determinism, 15-minute stability | 4 PASS |
| E1, E2 | Invalid inputs/bounds/rates, separate control interval | 2 PASS |
| S1 | Explicit solver failure | 1 PASS |
| P1 | Frozen P0 TypeScript contract compatibility | 1 PASS |

Total: **32 PASS, 0 FAIL, 0 SKIPPED**. Parameter/units tests, failure atomicity and extra edge cases also run in pytest.

## 27. Python Test Results and Executed Commands

Environment: Python 3.12.13, NumPy 2.5.3, SciPy 1.18.1, pytest 9.1.1, matplotlib 3.11.1. Dependencies are locked in `physical_core/uv.lock`.

| Actual command | Exit | Passed | Failed | Skipped | Result |
| --- | --- | --- | --- | --- | --- |
| `uv venv --python 3.12 physical_core/.venv` | 0 | N/A | N/A | N/A | Downloaded Python 3.12.13 and created isolated environment |
| `uv lock --project physical_core` | 0 | N/A | N/A | N/A | 18 packages resolved |
| `uv sync --project physical_core --extra validation --frozen` | 0 | N/A | N/A | N/A | Editable core + validation dependencies installed |
| `physical_core/.venv/bin/python -m pytest physical_core/tests -q` | 0 | 84 | 0 | 0 | `84 passed in 0.52s` in final source-test run |
| `physical_core/.venv/bin/python physical_core/scripts/run_gate_suite.py` | 0 | 32 | 0 | 0 | Gate JSON/Markdown exported from measured results |
| `physical_core/.venv/bin/python physical_core/scripts/run_canonical_scenario.py` | 0 | N/A | 0 | 0 | 288 frames, 49 columns, parameters, frame example, five PNGs |

The staged implementation tests first passed 31 component cases; the initial integrated run had 81 passed/1 failed due to the TypeScript-checker API assumption, fixed as described above; the completed and reviewed suite has 84 passing tests. This history is reported rather than concealed.

## 28. P0 Regression Results

| Actual command | Exit | Passed | Failed | Skipped | Output/result |
| --- | --- | --- | --- | --- | --- |
| `npx tsc --noEmit` | 0 | N/A | 0 diagnostics | N/A | No output |
| `npm run test` | 0 | 62 reported | 0 reported | 0 reported | `P0 invariant tests: 62 passed, 0 failed, 0 skipped` |
| `npm run build` | 0 | N/A | 0 | N/A | TypeScript + Vite 8.2.2; 19 modules transformed; built in 66ms |

The P0 count is the frozen assertion script's own printed summary, not a newly discovered framework test count. Its assertions executed successfully. Initial sandboxed invocation failed with `tsx` IPC `EPERM`; rerunning with the required execution permission succeeded. This was an environment restriction, not a product defect.

Build output: `dist/index.html` 0.47 kB; `index-C2i2aTou.css` 17.11 kB; `index-Dx143W9w.js` 252.56 kB (gzip 78.48 kB). Build files remain ignored. Frozen product files and P0 acceptance evidence are unchanged.

## 29. Known Limitations

Non-blocking, explicit model scope: synthetic uncalibrated coefficients; adiabatic supply-only transport; instant return mixing; fixed within-zone allocation; one thermal node/building; constant UA and pump efficiency; no wind/occupancy dynamics; pump heat deposition excluded from the thermal budget; interval-mean frame outputs; same-runtime rather than universal bitwise determinism.

The station supply temperature is a prescribed thermal boundary, not a simulated primary-side heat exchanger. The validated canonical operating envelope has positive source heat and heating-consistent returns. Source capacity/saturation and unusual transient boundary feasibility need review before deployment to a real system. None of these limitations substitutes for a failed critical Gate.

## 30. Contract Issues

No conflict requiring a frozen P0 semantic change was found. `P1A_CONTRACT_ISSUES.md` was therefore not created. The window sign convention, live-command versus isolated-component perturbations, and interval sampling are documented interpretations consistent with SPEC and the seam. No outstanding product decision blocks this phase.

## 31. Phase 1B Readiness

The independent building/transport layers allow a future explicit slab-state model, but no floor-heating code or claim is present. Phase 1B remains optional and requires a separate request plus SPEC Gate 15.1-E. This report does not authorize implementation.

## 32. Phase 2 Readiness

The model can support later baseline-control experiments after external engineering review. Phase 2 must implement a genuine defined weather-compensation/pump policy; this phase's fixed/scheduled forcing is not an acceptable baseline comparison. Further phases remain stopped.

## 33. Blocking Issues

None identified for the stated synthetic Phase 1A scope: every critical hydraulic, transport, thermal, conservation, causality, numerical and P0-compatibility Gate passes. No threshold has been weakened. Real-world calibration, source/return modeling refinements and controller validation are future review topics, not claims made here.

## 34. Final Self-Assessment

The required implementation, tests, Gate evidence, parameters, canonical CSV, five plots and engineering documents exist. Final source and unit review found no hard-coded Gate responses or unauthorized P0 changes. The implementation remains local and independent of the frozen frontend. Stop here for external engineering review.

Phase 1A Gate: PASS WITH NON-BLOCKING ISSUES
