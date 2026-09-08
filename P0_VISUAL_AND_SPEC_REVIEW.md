# P0 Visual and Spec Review

Review scope: SPEC v1.2, the four supplied prototype images, the original P0 prompt, and the P0.1 mandatory correction pass. Reference images are treated as visual guidance only; this review does not claim pixel-perfect fidelity. Logical, state, terminology, unit, and boundary correctness take priority.

Evidence:

- Spec: `/Users/yl/Downloads/AI_driven_Demand_Based_Heating_Optimisation_PoC_SPEC_CN_v1.2.html`
- References: `/Users/yl/Downloads/overview.png`, `/Users/yl/Downloads/simulation.png`, `/Users/yl/Downloads/forcast.png`, `/Users/yl/Downloads/result.png`
- Runtime captures: [p0-screenshots](/Users/yl/Documents/Codex/Heat/p0-screenshots)
- UI/domain: [src/App.tsx](/Users/yl/Documents/Codex/Heat/src/App.tsx), [src/domain.ts](/Users/yl/Documents/Codex/Heat/src/domain.ts)

Verdict meanings: PASS = met, PARTIAL = meaningful implementation with a non-blocking difference, FAIL = not met. “Blocks P0” is judged against P0/P0.1, not future physical-engineering gates.

## Overview

| Source | Requirement | Implemented component | Current behaviour | Verdict | Deviation / rationale | Blocks P0? |
|---|---|---|---|---|---|---|
| SPEC / prototype | Product, scenario, mode, timestamp, environment hierarchy | shared `topbar`, sidebar | Present on every route; Simulation Environment is explicit | PASS | Compact responsive dashboard rather than a pixel clone | No |
| SPEC | KPI hierarchy and correct units | `KpiCard`, Overview | Outdoor, heat load/supply, compliance, comfort, overheat, pump power; kW is used for power | PASS | KPI notes are fixture annotations | No |
| SPEC | One substation → near/mid/far → B01–B12 | `NetworkMap` | Schematic SVG shows all 12 buildings and hot/cold lines; nodes are selectable | PASS | Visual geometry is intentionally schematic | No |
| SPEC | Status, delay, risk, alerts | `SystemStatus`, risk/alerts panels | Supply/return/flow/pressure/pump, 10/20/35 min delays, 3/12 and 1/12 counts, alerts | PASS | Transport values are display-only fixture values | No |
| Correction | Traditional has comparison only | `Recommendation`, `changeMode` | No Apply and no AI auto-application | PASS | Comparison recommendation remains visible for context | No |
| Correction | Advisory is manual Apply | `Recommendation`, `apply` | Apply is rendered only in Advisory | PASS | State change is bounded fixture control | No |
| Correction | Optimised auto-applies without Apply | `Recommendation`, `changeMode`, timeline | Mode switch immediately generates/applies first bounded action; card shows MPC Active / Auto-applied | PASS | No production MPC is claimed | No |
| Correction | Complete EN/ZH | `src/i18n.ts` | Overview content and controls switch immediately and persist | PASS | Technical/product tokens remain invariant by design | No |

## Simulation

| Source | Requirement | Implemented component | Current behaviour | Verdict | Deviation / rationale | Blocks P0? |
|---|---|---|---|---|---|---|
| SPEC | Weather, scenario, mode, playback controls | simulation cards, mode selector, Play/Pause/Step/Reset | All controls are present; 08:00 canonical frame is default | PASS | Playback speed is a fixed fixture interval | No |
| SPEC | Clickable buildings and detail | `NetworkMap`, building detail panel | B01–B12 nodes select a structured detail panel; B03 is default | PASS | Detail is a lower panel rather than a side drawer | No |
| Correction | Shared equipment limits | `equipmentLimits`, `applyPrototypeControl` | Supply 40–60°C / ±2, pump 30–50 Hz / ±2, valves 20–100% / ±10pp; values are clamped and rate-limited | PASS | Native inputs rely on domain guard rather than custom validation copy | No |
| SPEC | Transport-delay display | map legend, detail, Settings | Near 10m, Mid 20m, Far 35m are read from network state | PASS | No physical V/Q transport calculation | No |
| Correction | Semantic event log | event log mapping | Mode change, recommendation generation/apply, auto ticks, steps, and reset show localized labels/details | PASS | Events are frontend semantic records | No |
| Correction | Full reset | App reset state | Restores frame 0, 08:00, paused playback, network/building state, B03, 6h context, no Advisory apply, clean reset event | PASS | Reset is a fixture-state reset, not a solver reset | No |
| Prototype | Network-first layout and control rail | simulation layout | Network, controls/recommendation, trends, detail, event log are in the expected hierarchy | PASS | Chart density is lighter than the reference | No |

## Forecast

| Source | Requirement | Implemented component | Current behaviour | Verdict | Deviation / rationale | Blocks P0? |
|---|---|---|---|---|---|---|
| SPEC / correction | Default 6h canonical fixture | `forecastFixtures[6]`, selectors | Required 2.18 MW, planned 2.48 MW, oversupply 0.30 MW, interval/confidence and risk metrics render | PASS | Fixture-backed as required | No |
| Correction | 6/24/48 real horizon slices | `selectForecastForHorizon`, horizon tabs | Selecting a horizon updates KPIs, outdoor/load/indoor series and titles, interval, bins, insights, Key Forecast Metrics, and all 12 table rows/risk/confidence | PASS | Horizon fixtures are deterministic P0 slices | No |
| Correction | Oversupply terminology/formula | `selectAvoidableOversupply` | Label distinguishes required load, planned supply, and avoidable oversupply; `max(0, planned − required)` is used | PASS | No “current supply” ambiguity | No |
| SPEC | Forecast charts and distribution | `LineChart`, `BarChart` | Outdoor, required-vs-planned, indoor, distribution, legends, units, and chart aria labels render | PASS | Lightweight SVG/CSS charts, not a library clone | No |
| SPEC | 12-building table | `selectBuildingForecasts`, table | B01–B12 all render with current/predicted temperatures, risk and confidence | PASS | Full canonical set is shown | No |
| SPEC | Insights and forecast boundary | `selectForecastInsights`, boundary callout | Warming, solar, high-insulation, far-zone, and fixture-boundary explanations render | PASS | No production inference claim | No |
| Correction | Horizon consistency across all surfaces | shared horizon prop/selectors | Horizon state is page-level and feeds every forecast surface | PASS | No independent chart/table horizon state | No |

## Results

| Source | Requirement | Implemented component | Current behaviour | Verdict | Deviation / rationale | Blocks P0? |
|---|---|---|---|---|---|---|
| SPEC | Traditional vs AI comparison | `selectResultsComparison`, KPI/bar panels | Shared comparison values render for heat, pump electricity, rates, hydraulic flow, events, loss and balance | PASS | Fixture comparison, not a physical run | No |
| SPEC | Correct metric taxonomy/units | Results labels and chart units | Pump Power is kW; Pump Electricity is kWh/MWh; heat is MWh; flow is m³/h | PASS | Mixed-unit KPI comparison is explicitly labeled | No |
| Correction | Model Performance taxonomy | model panel, `modelMetrics` | “Heat Load Prediction Model Comparison” with Linear Regression, LightGBM, GRU Optional; held-out validation and RC/2R2C separation are explicit | PASS | Model names are taxonomy labels, not a control strategy | No |
| SPEC | P10/P50/P90 and spread | `selectTemperaturePercentiles` | Values are derived from shared building thermal state; AI comparison percentile values are fixture comparison data | PASS | Percentile convention is documented in data report | No |
| SPEC | Hydraulic redistribution and simulated windows | comparison panels, quote | Near/mid/far flow and window-opening events render with simulation-only boundary | PASS | Behavioural events are not detection claims | No |

## Cross-cutting requirements

| Source | Requirement | Implemented component | Current behaviour | Verdict | Deviation / rationale | Blocks P0? |
|---|---|---|---|---|---|---|
| Correction | Canonical shared state/selectors | `src/domain.ts` | Named fixtures and selectors feed Overview, Simulation, Forecast, Results and Settings | PASS | Presentation-only delta annotations remain local | No |
| SPEC | Simulation Environment labels | topbar, sidebar/footer, fixture notes | Every route identifies the simulation/fixture boundary | PASS | Product tier/version tokens stay invariant | No |
| Correction | No physical/backend scope expansion | domain helpers | No solver, backend, RC/2R2C execution, transport engine, production MPC or Tutor is implemented | PASS | Explicit P0 boundary | No |
| Correction | English/Chinese localization | dictionary parity test and toggle | EN default; Chinese switch works without reload; switch-back and persistence are implemented | PASS | Allowed product/technology/model/unit tokens remain invariant | No |
| SPEC | Accessibility basics | native controls, SVG roles, chart aria labels | Buttons, inputs, selectable building nodes, close/reset labels, and chart labels are present | PASS | Full accessibility audit remains future work | No |

## P0 Acceptance

### PASS WITH NON-BLOCKING ISSUES

Blocking issues: none identified after the P0.1 fix pass.

Non-blocking issues:

- Runtime charts are intentionally lightweight and do not reproduce every annotation, icon, or pixel proportion in the reference images.
- Day-over-day KPI delta notes are presentation annotations rather than derived domain fields.
- The fixture’s reset control restores frontend state; it does not represent a physical plant reset.
- The P0 Tutor/API seams remain documentation only.

Recommended fixes before Phase 1A:

- Obtain external review of the requirement matrix and terminology choices.
- If reviewers require it, move presentation-only delta annotations and chart metadata into named domain presentation fixtures.
- Run a dedicated keyboard/screen-reader pass on the final target viewport.

Items intentionally deferred to Phase 7:

- Replace fixture providers with Simulation, Prediction, Optimisation/MPC, and scenario APIs.
- Implement physical/thermal/transport modelling and real equipment integration gates.
- Add production model validation, calibration, safety interlocks, audit trails, and operator permissions.
- Add the AI Tutor provider using the documented structured context contract.

## Final validation

| Command | Exit result | Actual output |
|---|---:|---|
| `npx tsc --noEmit` | 0 | no diagnostics |
| `npm run build` | 0 | TypeScript build plus Vite production build; 18 modules transformed; `dist/index.html`, CSS and JS emitted |
| `npm run test` | 0 | `P0 invariant tests: 20 passed, 0 failed, 0 skipped` |
| `node scripts/capture-p0.mjs` | 0 | 9 runtime screenshots captured; 6/24/48 horizon assertions, reset assertion, Traditional no-Apply, Advisory Apply, and Optimised no-Apply/Auto-applied assertions passed |

No Phase 1A work was started. Stop here for external review.
