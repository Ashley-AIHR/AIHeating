# P0.2 Final Gate

Status: frontend-contract correction pass complete. Phase 1A has not started.

## 1. Summary of P0.2 fixes

- Unified Forecast as-of time with the single App-level simulationTime state.
- Rebased 6/24/48-hour labels from the selected as-of time, including day rollover labels.
- Reworked Forecast risk rows so summary counts, rates, and distributions are derived from the same endpoint-state rows.
- Replaced the line-chart polyline implementation with finite-point segment rendering that preserves all valid points and does not bridge null gaps.
- Corrected the future Simulation Engine seam so source and solver status are separate.
- Removed application state from the Optimisation Engine response and separated the 5/10/15-minute physical timestep from the 30-minute control interval.
- Moved Network Map labels away from the station and pipes and changed transport delay from a floating sentence to a compact structured status group.
- Added final P0.2 runtime capture assertions and domain invariants.

No hydraulic solver, thermal model, transport solver, prediction model, MPC engine, backend, or AI Tutor was added.

## 2. Canonical time decision

The canonical current time is App state: simulationTime. The initial value is Jan 15, 2025 08:00, restored by Reset and advanced by the fixture timeline.

Forecast receives forecastAsOf={simulationTime}. The Forecast page does not invent a separate Now value. Selectors accept the as-of value and rebase the fixture labels:

- 6 hours: 08:00 through 14:00
- 24 hours: 08:00 through +1d 08:00
- 48 hours: 08:00 through +2d 08:00

When the simulation reaches 10:00, the same selected horizon starts at 10:00. The fixture numeric slice is reused; only the presentation time base changes, as permitted for P0.

The Forecast page displays Forecast as of 08:00 and the selected-time distribution title carries the same timestamp. The table title carries the selected horizon, while the page as-of label supplies the shared timestamp.

## 3. Forecast risk semantic decision

P0 uses endpoint-state semantics. Each buildingForecasts row has exactly one endpoint risk: comfortable, overheating, underheating, or watch.

The following fields are derived from those rows:

- predictedOverheatingCount = count(risk === overheating)
- predictedUnderheatingCount = count(risk === underheating)
- predictedComfortCount = count(risk === comfortable)
- predictedWatchCount = count(risk === watch)
- predictedComplianceRate = (row count - underheating count) / row count
- overheatingRiskPct = overheating count / row count × 100
- distributionBins are derived from the row predictedTraditionalC and predictedAiC values

The main 6-hour fixture therefore shows 3 overheating, 1 underheating, 7 comfortable, and 1 watch row. The Key Forecast Metrics and building table use these same rows. There is no separate any-time horizon-risk concept in P0.

Avoidable Oversupply remains selector-derived:

2.48 MW - 2.18 MW = 0.30 MW

## 4. Chart continuity fix

The LineChart renderer uses finiteChartSegments. Every finite value is retained, consecutive finite values share one SVG path segment, and null/undefined gaps split segments without silently dropping valid points. Paths, point markers, and labels use the same index-to-coordinate mapping.

The helper chartDataIntegrity reports finite input points, plotted points, and dropped valid points. The invariant suite exercises a gapped series and every Forecast series for all three horizons.

Runtime review of the final 6-hour Forecast capture confirms all three affected chart families render full continuous series: Outdoor Temperature Forecast, Required Heat Load vs Planned Heat Supply, and Predicted Indoor Temperature.

## 5. Final Simulation API seam

The proposed SimulationFrameRequest uses scenarioId, simulationTime, a physical stepMinutes union of 5 | 10 | 15, a separate controlIntervalMinutes: 30, weather, and bounded supply/pump/zone controls.

The proposed SimulationFrameResponse contains simulationTime, weather, networkState, buildingStates keyed by building ID, per-zone transport delay and delivered supply temperature, and domain metrics.

source is either fixture or simulation_engine. solver is optional and, when present, reports only converged, infeasible, or failed with optional residual, iterations, and message. solver.status never contains fixture.

The current provider remains the domain fixture and timeline selectors in src/domain.ts. No API is implemented.

## 6. Final Prediction API seam

PredictionRequest is keyed by scenarioId, forecastAsOf, horizonHours (6 | 24 | 48), weather forecast, static building profiles, thermal states, and network state.

PredictionResponse returns forecastAsOf, horizonHours, outdoor temperature values, ForecastSeries, endpoint building forecast rows, prediction interval, confidence/model metadata, and metrics derived from those rows, including overheating, underheating, comfort, watch, compliance, and overheating percentage.

The current providers are forecastFixtures and the existing Forecast selectors. No prediction service is implemented.

## 7. Final Optimisation API seam

OptimisationRequest contains scenarioId, simulationTime, network state, building forecast rows, equipment limits, and the selected strategy.

OptimisationResponse returns recommendationId, strategy, actions, pumpControl, objective values, feasibility, and optional solver status. It does not contain an applied boolean.

Application ownership remains in the frontend control-mode state machine:

- Traditional: no AI application.
- AI Advisory: recommendation is pending until the operator selects Apply.
- AI Optimised (MPC): recommendation is automatically applied and the UI shows MPC Active / Auto-applied with no Apply button.

The current provider is recommendationFixture plus the bounded domain control functions. No optimiser is implemented.

## 8. Simulation timestep vs MPC interval

The future physical simulation contract allows stepMinutes 5, 10, or 15 only. The future control orchestrator carries controlIntervalMinutes 30 separately. This avoids treating a 30-minute MPC recomputation interval as a physical integration step and preserves the intended 10, 20, and 35-minute nominal zone delays.

## 9. Network Map UI fixes

Primary Network and Secondary Heating Network labels were moved to a dedicated left-side label area above the station, so they no longer overlap the station graphic or pipes. The station label remains below the station graphic.

Estimated Transport Delay is now a compact structured group with a localized heading and three values:

- Near 10 min
- Mid 20 min
- Far 35 min

The Chinese view uses 估算输运延迟, 近端, 中端, 远端, and the same invariant min units. The final Chinese Overview capture visibly includes this group.

## 10. Test and build results

Validation was run against the final P0.2 source:

- Command: npx tsc --noEmit
  Exit code: 0. Result: TypeScript typecheck completed with no diagnostics.
- Command: npm run test
  Exit code: 0. Result: P0 invariant tests: 50 passed, 0 failed, 0 skipped.
- Command: npm run build
  Exit code: 0. Result: production build completed; tsc -b and Vite succeeded, 19 modules transformed, dist assets emitted.
- Command: node scripts/capture-p0.mjs
  Exit code: 0. Result: three final runtime screenshots captured at the consistent 1672 × 941 viewport; all runtime assertions passed.

## 11. Final runtime screenshots

- [Overview — Chinese](/Users/yl/Documents/Codex/Heat/p0-screenshots/p0.2-overview-zh.png)
- [Forecast — English — Next 6 Hours](/Users/yl/Documents/Codex/Heat/p0-screenshots/p0.2-forecast-6h-en.png)
- [Simulation — English — AI Optimised (MPC)](/Users/yl/Documents/Codex/Heat/p0-screenshots/p0.2-simulation-optimised-en.png)

The final Simulation capture confirms no Apply to Simulation button is present and shows both MPC Active and Auto-applied. The final Forecast capture shows Forecast as of 08:00, the 08:00–14:00 x-axis, timestamped selected-time distribution, 0.30 MW avoidable oversupply, aligned 3 / 12 and 1 / 12 risk metrics, and the 12-row table.

## 12. Remaining non-blocking issues and self-assessment

Remaining non-blocking issues:

- P0 remains fixture-backed; future engines and services are intentionally not implemented.
- The visual system is logically aligned to the supplied prototypes but is not claimed to be pixel-perfect.
- Some P0 comparison values and model taxonomy labels remain fixture presentation data by design.
- A full external accessibility review with assistive technology remains outside this frontend-contract gate.

Blocking issues: none identified for P0.2.

Recommended fixes before Phase 1A:

- Keep the canonical time and row-derived selectors as the integration boundary.
- Preserve the explicit source/solver and timestep/control-interval contracts when wiring future engines.
- Keep runtime capture assertions in the P0 smoke path until the external review is complete.

Items intentionally deferred to Phase 7:

- Production backend and API integration.
- Physical thermal, hydraulic, transport, prediction, and MPC engines.
- Real equipment control and live telemetry.
- AI Tutor implementation.

P0 Acceptance:

PASS WITH NON-BLOCKING ISSUES

P0.2 is frozen pending external review. Phase 1A has not started.
