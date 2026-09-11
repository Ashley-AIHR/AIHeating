# P9 Runtime Capability Matrix

## Frozen release decision

**FINAL POC MODE: Guided Validated Digital Twin Demonstration.** The active React routes consume one accepted, immutable P7 evidence snapshot through `getGuidedRuntime()`. They do not invoke the Python P1A/P4/P5/P6 implementations at runtime. A complete live control interval is therefore not implemented; Live Interactive Simulation Runtime is **DEFERRED**.

`src/domain.ts` still contains a legacy fixture timeline and control helpers. The active `/simulation` route renders `GuidedSimulation`, not the legacy `Simulation` component. Those helpers do not prove a P1A→P4→P5→P6 recomputation loop.

| Function | Status | Exact supported boundary | Executable/source evidence |
|---|---|---|---|
| Scenario selection | PARTIAL | Rapid Warming is the only active selectable snapshot; other scenarios appear as validation status evidence. | `scripts/p9-browser.mjs`; `src/App.tsx` single `<option>` |
| Simulation reset | NOT IMPLEMENTED | A hidden legacy UI reset exists, but it cannot reset or recompute the accepted P7 snapshot. | `scripts/p9-invariants.ts` |
| Play / pause / step | NOT IMPLEMENTED | Functions exist only in the inactive legacy component. | Active route audit in `scripts/p9-invariants.ts` |
| Time progression | NOT IMPLEMENTED | Display time is frozen at `2025-01-15T10:30:00+08:00`. | `src/p7-runtime-data.json`; deterministic replay |
| Weather progression | NOT IMPLEMENTED | Forecast trajectory is replayed; no weather service or runtime advance. | provider snapshot and runtime audit |
| P1A physical state progression | NOT IMPLEMENTED | P1A evidence is precomputed and P1A is the verification authority offline. | no Python/engine call in active frontend path |
| P4 prediction refresh | NOT IMPLEMENTED | Accepted P4 prediction points are replayed. | `PredictionProvider.current()` returns static payload |
| P5 thermal prediction refresh | NOT IMPLEMENTED | Accepted P5 trajectory is replayed. | `ThermalPredictionProvider.current()` returns static payload |
| P6 MPC re-solve | NOT IMPLEMENTED | Accepted recommendation/status/trajectory is replayed. | `OptimisationProvider.current()` returns static payload |
| Advisory recommendation generation | PARTIAL | Accepted recommendation is presented; no new solve occurs. | P7/P9 browser Advisory checks |
| Manual Apply | IMPLEMENTED | Advisory remains `NOT_APPLIED` until the explicit application path; this changes application state only within the guided UI. | `applicationStatus`; `scripts/p7-browser.mjs`; `scripts/p9-invariants.ts` |
| Optimised auto-apply | PARTIAL | A verified accepted snapshot maps to `APPLIED`; there is no live plant/control interval. Unsafe/unverified states map to `FAILED_TO_APPLY`. | `applicationStatus`; P9 safety tests |
| Nonlinear verification | PARTIAL | Results of accepted P1A verification are displayed; verification is not run in-browser. | P7 status payload and full offline P6 regression |
| Fallback | IMPLEMENTED | Solver-limit and verified fallback remain distinct and visible in engineering detail. | P9 browser/status tests |
| Infeasible state | IMPLEMENTED | Near-18 validation case maps to `Constraint Infeasible`, fallback active and `Safety Not Guaranteed`. | P9 status tests |
| Safety status | IMPLEMENTED | Optimal, verified fallback, unverified/failed branches remain distinct; unsafe is not green. | P9 browser and source-style checks |
| Results refresh | NOT IMPLEMENTED | Results are accepted full-day canonical evidence, not a result of user actions. | `ResultsProvider.current()` static payload |
| AI Tutor context refresh | IMPLEMENTED | Page, mode, application state and selected-building changes produce a new context identity. | P8 context tests; `scripts/p9-guided-replay.ts` |
| Selected-building context refresh | PARTIAL | Context builder supports it, but the guided primary pages do not expose a dedicated selector on every page. | P8 selected-building invariant |

## Live runtime proof outcome

The conditional three-interval test was not run because there is no active code path that advances physical state, issues a new forecast, reloads P4/P5, solves P6, verifies, applies and supersedes the prior recommendation. This is an evidence-based `NOT IMPLEMENTED`, not a skipped claim.
