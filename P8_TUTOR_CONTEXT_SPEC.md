# P8 Tutor Context Specification

The canonical schema is `p8_tutor_context_schema.json`; runtime types are in `src/p8-tutor.ts`.

## Identity and time

Every packet contains `contextId`, `contextVersion`, `createdAt`, page, scenario, control mode, selected building, source boundary, Simulation Environment flag, and distinct simulation/forecast/recommendation/result times. The identity changes with page, scenario, simulation time, mode, selected building, recommendation, application state, freshness, or selected-building prediction.

## Page selection

| Page | Included priority data |
|---|---|
| Overview | Current state, weather, P4, P5, P6, application state and headline comparison |
| Simulation | Current/network/zone state, selected building, P5 risk, P6 recommendation/status, application and recent events |
| Forecast | Current reference, issued weather, P4 1/2/3/6 h, P5 0.5/1/2/3/6 h and selected building when available |
| Results | Compact Traditional/Preview/MPC metrics and temperature distribution |
| Settings | Versions, horizons, bounds, movement limits, safety and fallback policy only |

Context is bounded to four P4 points, at most twelve forecast points, six events, distribution/zone summaries, one selected building and compact result metrics. The executable gate limits the guided packet to 24 KB.

## Selected building

The packet supports ID, zone, observed simulation temperature, configured synthetic class/insulation labels, radiator/required heat, zone flow, delivered supply and optional structured P5 points with interval/risk. Effective H/C are knowledge concepts labelled calibrated effective simulation parameters; hidden truth parameters are excluded.

The accepted static P7 guided snapshot currently exposes aggregate P5 minimum-building trajectories, not a per-building P5 series. The builder therefore marks that selected-building series unavailable rather than inventing it; the optional structured provider field and deterministic test fixture prove the live seam.

## Freshness

`AVAILABLE`, `STALE`, `UNAVAILABLE` and `TIMEOUT` are preserved per simulation/load/thermal/optimisation/results provider. Non-available values are omitted and a limitation is added. General domain explanation remains available.
