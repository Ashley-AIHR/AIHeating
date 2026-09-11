# P9 Final Architecture

## Release architecture

```text
SYNTHETIC DATA / ACCEPTED STATE
              ↓
      P1A DIGITAL TWIN
  physical truth + nonlinear verification
              ↓
   P4 LOAD PREDICTION v1
  issued forecast → Required Heat Load
              ↓
  P5 THERMAL PREDICTION v1
 effective H/C → temperature trajectory
              ↓
      P6 FORMAL MPC v1
 constrained candidate + safety policy
              ↓
   NONLINEAR P1A VERIFICATION
              ↓
 P7 APPLICATION / STATUS PROVIDER
 frozen structured evidence + state semantics
              ↓
              UI
              ↓
 P8 DETERMINISTIC GROUNDED TUTOR
 explanation only; no control authority
```

The arrows through P1A–P6 describe the **offline evidence-production and validation chain**. The released browser application starts at the frozen P7 snapshot; it does not execute that chain on each UI action.

## Guided Evidence Runtime

Implemented and verified. `src/p7-provider.ts` imports `src/p7-runtime-data.json` and exposes stable Simulation, Prediction, Thermal Prediction, Optimisation, Results, Scenario and Application State seams. Overview, Forecast, Simulation, Results and Settings render the same snapshot. The Tutor builds a bounded page-aware context from that structured state and curated knowledge. The official journey is NOW → FORECAST → PREDICT → OPTIMISE → VERIFY → SIMULATION → RESULTS → AI TUTOR EXPLANATION.

## Live Interactive Runtime

Not implemented in RC1. No active orchestration service performs Reset → P1A step → issued forecast → P4 refresh → P5 refresh → P6 solve → nonlinear verification → Apply → next realised state. The legacy TypeScript timeline changes fixture display controls only and is not mounted by the active simulation route. It is neither a model server nor evidence of a live autonomous Digital Twin.

## Status and application boundary

- Optimisation, verification, fallback, safety and application are separate dimensions.
- Advisory is `NOT_APPLIED` until an explicit user action.
- Optimised maps only an accepted verified action or verified fallback to `APPLIED`.
- Stale, unavailable, infeasible or unverified states are not auto-applied.
- “Verified” means verified in the synthetic Digital Twin, never guaranteed safe at a real site.
- P8 receives no control callback and cannot mutate P1A–P7.

## Runtime identity and logging

P7 carries scenario, simulation timestamp, `forecastAsOf`, model/provider versions, MPC/verification/fallback status and recommendation identity. P8 adds context ID and Tutor provider/validation status to its technical response detail. There is no persistent production engineering log sink in this PoC; audit-grade logging is a real-site pilot requirement.
