# P7 Provider Architecture

## Accepted runtime chain

`Current state → P1A Simulation Engine → P4 Required Heat Predictor → P5 Thermal Predictor → P6 Formal MPC → nonlinear P1A verification → recommendation status → application state → realised simulation result`

P7 adds no model or control algorithm. `scripts/write-p7-runtime-data.mjs` assembles the accepted P4, P5 and P6 evidence into one immutable UI payload, `src/p7-runtime-data.json`. `src/p7-provider.ts` is the only active customer-page data boundary. Pages format and select provider values; they do not reproduce load, thermal, objective, feasibility, fallback, safety or savings calculations.

## Stable seams

| Seam | Active source | Responsibility |
|---|---|---|
| `SimulationProvider` | P1A / physical-fixture-v1.2 | Current physical state and realised simulation state |
| `PredictionProvider` | P4 Predictor v1 / LightGBM | Required Heat Load at 1/2/3/6 h with intervals |
| `ThermalPredictionProvider` | P5 Thermal Model v1 | Building thermal risk at 0.5/1/2/3/6 h |
| `OptimisationProvider` | P6 Formal MPC v1 | Candidate controls, trajectory and technical outcome |
| `ResultsProvider` | Accepted P6 canonical evidence | Traditional / Preview / MPC comparison |
| `ScenarioProvider` | Accepted Rapid Warming snapshot | Scenario identity and family |
| `ApplicationStateProvider` | Product/domain state | NOT_APPLIED / APPLIED / SUPERSEDED / FAILED_TO_APPLY |

The P4 Preview Optimiser remains in `comparison.preview` and `legacyPreview` only, labelled **Intermediate Prototype / Engineering Benchmark**. It is not imported by the active page path and is not the `AI Optimised` provider.

## Boundary guarantees

- One `guidedRuntime` snapshot is shared by Overview, Forecast, Simulation, Results and Settings.
- The optimisation response contains no `applied` field.
- Provider-friendly versions are visible; artifact hashes remain technical metadata.
- P0 `domain.ts` and `chart.ts`, P1A physics, P2 Traditional, and accepted P3–P6 evidence were not changed.
- The minimal P7 structure follows the ponytail skill: one generated payload, one typed provider module, and one reusable status component instead of parallel page fixtures or speculative service classes.
