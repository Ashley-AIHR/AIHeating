# P7 API Contracts

## Runtime snapshot

The active contract is a typed, read-only snapshot returned by `getGuidedRuntime()` in `src/p7-provider.ts`. Its main groups are:

- `now`, `zones`, `buildings`: P1A state;
- `forecast`, `predictions`: issued weather and P4 Required Heat Load;
- `thermalPrediction`: P5 points and simulation-calibrated intervals;
- `recommendation`, `optimisation`: P6 first action, 3 h trajectory and separate status fields;
- `comparison`: accepted Traditional, Preview and MPC results;
- `statusScenarios`: accepted normal, verified-fallback and infeasible engineering evidence;
- `configuration`: frozen read-only provider, horizon, actuator, movement, safety and fallback metadata.

## Time fields

The contract retains distinct fields:

| Field | Meaning |
|---|---|
| `simulationTime` | Current guided P1A snapshot |
| `forecastAsOf` | Issued-forecast cutoff |
| each `targetTime` | P4/P5 forecast target |
| `recommendationCreatedAt` | P6 decision creation |
| `recommendationEffectiveAt` | First control interval |
| `resultEvaluationWindow` | Frozen full-run result window |

The Rapid Warming guided snapshot aligns at `2025-01-15T10:30:00+08:00`; the first action is effective at `11:00:00+08:00`. The offset is preserved.

## Failure and freshness contract

`resolveProviderAvailability()` returns one of `AVAILABLE`, `UNAVAILABLE`, `TIMEOUT`, or `STALE`, plus `usable` and `stale`. Missing prediction, missing thermal prediction, provider error and timeout are not replaced with a success payload. Data older than its maximum age is `STALE`, explicitly marked `stale: true`, and `usable: false`.

Solver failure, solver limit, infeasibility, nonlinear verification failure and fallback activation are mapped by `deriveCustomerStatus()` without erasing their separate meanings. A raw `user_limit` never becomes `MPC_OPTIMAL`. Application is resolved separately by `applicationStatus()`.

## Frontend allowance

Pages may format numbers, aggregate display rows and select time ranges. Engineering calculations and canonical benchmark recomputation are prohibited and absent from the active page code.
