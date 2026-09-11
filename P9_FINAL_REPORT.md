# P9 Final Report — AI-Heating-PoC-RC1

## Release decision

**Final PoC:** AI Heating Optimisation Digital Twin — Synthetic PoC Release Candidate 1.

**FINAL POC MODE: Guided Validated Digital Twin Demonstration.** The product replays accepted, prevalidated synthetic scenario evidence through the P7 provider. It is not a Fully Live Autonomous Digital Twin.

**Customer PoC Release: GO**  
**Project Freeze: GO**  
**Real-site Pilot Readiness: DOCUMENTED**  
**Production Closed-loop Readiness: NOT READY**

## Required final answers

| # | Question | Answer |
|---:|---|---|
| 1 | What is the final PoC? | A reproducible customer demonstration of a synthetic secondary-network Digital Twin, predictive load/thermal models, Formal Supervisory MPC, nonlinear verification, structured application state and deterministic grounded explanation. |
| 2 | What runtime modes are actually supported? | Guided Evidence Mode is supported. User-visible Advisory/Optimised application semantics operate over accepted evidence. |
| 3 | Is Guided Evidence Mode supported? | **Yes.** Overview → Forecast → Simulation → Results → Tutor is verified end to end and cross-page consistent. |
| 4 | Is Live Interactive Runtime supported? | **No; DEFERRED.** No active path performs a new P1A step, issued forecast, P4/P5 refresh, P6 solve, verification, application and next-state progression. Legacy fixture playback does not meet this definition. |
| 5 | What is the final algorithm chain? | P1A Physical Digital Twin → P4 Required Heat Load Predictor v1 (selected LightGBM) → P5 Thermal Model v1 → P6 Formal MPC v1 → nonlinear P1A verification → P7 application/status provider → UI → P8 Deterministic Grounded Tutor. P1A–P6 run in offline evidence generation/validation; the release browser begins at frozen P7 evidence. |
| 6 | What is the final Tutor mode? | **Deterministic Grounded Tutor v1**, a Grounded PoC Explanation Assistant. |
| 7 | Is a live LLM connected? | **No.** No live LLM package, endpoint, credential or runtime dependency exists. |
| 8 | What is the primary demo scenario? | Rapid Daytime Warming. |
| 9 | What are the canonical scenarios? | Normal Winter, Cold Wave, Rapid Daytime Warming, Sunny Winter and Hydraulic Imbalance. Near-18°C is validation-only safety stress. |
| 10 | What customer claims are supported? | Qualified synthetic-simulation claims about predictive demand/temperature trajectories, Formal MPC recommendations, Digital Twin verification, verified fallback, and scenario-specific reductions in heat use/oversupply/overheating while maintaining recorded compliance. |
| 11 | What claims are explicitly unsupported? | Guaranteed savings/comfort/safety, real-world validated accuracy, live autonomous Digital Twin, production-ready control, field deployment readiness and live generative-LLM capability. |
| 12 | Are P0–P8 artifacts frozen? | **Yes.** Registered/hard-bound integrity passed before and after the full regression. |
| 13 | Did canonical evidence change? | **No.** All five canonical manifest hashes, accepted P2 evidence and P4/P5/P6 result hashes remain exact. No benchmark was regenerated or retuned. |
| 14 | Are all model/provider versions pinned? | **Yes.** `p9_release_registry.json` pins exact identities and SHA-256 hashes; no `latest` alias is used. |
| 15 | Does the production build pass? | **Yes.** TypeScript, P0 tests and `npm run build` exit 0. |
| 16 | Does clean-environment validation pass? | **Yes, within the documented scope.** A temporary directory used the exact lockfile, offline dependency install, core tests and production build; `dist/index.html` was produced and the directory removed. This is not fresh-OS certification. |
| 17 | Do EN/ZH checks pass? | **Yes.** Active terminology, all five pages, Tutor, three modes and the critical status branches pass. |
| 18 | Do status/fallback/safety semantics pass? | **Yes.** Optimisation, verification, fallback, safety and application remain independent. |
| 19 | Does solver fallback remain visible? | **Yes.** Customer wording is Verified Fallback Active; technical detail retains OSQP Solver Limit Reached/user_limit. |
| 20 | Does Safety Not Guaranteed remain explicit? | **Yes.** The near-18 case shows Constraint Infeasible, Fallback Active, Safety Not Guaranteed and FAILED_TO_APPLY; it is not green success. |
| 21 | Does Advisory remain manual? | **Yes.** It defaults to `NOT_APPLIED` until explicit Apply. |
| 22 | Does Optimised apply only verified actions? | **Yes.** Accepted optimal or verified fallback evidence maps to `APPLIED`; unsafe/unverified fallback maps to `FAILED_TO_APPLY`. |
| 23 | Does Tutor remain non-controlling? | **Yes.** It has no control callback and refuses control requests. |
| 24 | Does Tutor remain grounded? | **Yes.** Dynamic claims come from bounded P7 structured context; curated knowledge supplies definitions/limitations; response validation blocks unsupported claims. |
| 25 | Does Tutor use deterministic provider only? | **Yes.** Provider identity is `deterministic-grounded-v1`. |
| 26 | Does Tutor failure remain isolated? | **Yes.** Timeout/provider failure returns a safe Tutor fallback and cannot mutate P1A–P7. |
| 27 | Does the primary demo replay deterministically? | **Yes.** Five consecutive runs produced identical evidence/status/Tutor behavior and SHA-256 `27bfd25b32e544e6a49a409897095ef311c5b98c36d03807dec04e738aaeaf83`. |
| 28 | Are UI values traceable to evidence? | **Yes.** Primary panels use `src/p7-runtime-data.json` through P7 provider seams. Legacy P0 telemetry is collapsed and explicitly engineering/debug only. |
| 29 | Are customer results clearly labelled synthetic? | **Yes.** Simulation Environment, held-out simulation evaluation and simulation-calibrated interval wording remain active. |
| 30 | What P6 operational issues remain? | Local linearisation, solver-limit verified fallback occurrences, and small zone-valve direction reversals. A real site must assess deadband, meaningful movement, hold time, wear, backlash and latency. |
| 31 | What P5 limitations remain? | Effective H/C only; UA/solar/internal gains remain priors; synthetic calibration; no real sensor-noise or distribution-shift validation; insufficient `<18°C` positives in TEST. |
| 32 | What runtime limitations remain? | Static guided replay; no live scenario/time/weather/physical/model progression or results refresh; one selectable primary snapshot; no persistent audit-grade logging; 900×800 horizontal overflow; no field interfaces. |
| 33 | What work is required before a real-site pilot? | Read-only data integration, data/sensor validation, site calibration, shadow P4/P5, shadow MPC, operator advisory and separately defined model/savings/safety acceptance. |
| 34 | What work is required before closed-loop deployment? | Independent PLC/DCS protection, equipment/command bounds, watchdog, fail-safe and communication/stale/timeout policies, manual override, audit logging, rollback, alarms, cyber/operational review and staged bounded commissioning. |
| 35 | Is this release suitable for customer PoC demonstration? | **Yes**, as a desktop/laptop Guided Validated Digital Twin Demonstration with the scripts and qualifiers in this release package. |
| 36 | Is the project ready to freeze? | **Yes**, as AI-Heating-PoC-RC1. It is not production v1.0 and does not authorise a new algorithm or equipment-control phase. |

## Verification summary

- P9 core runtime/status/claims gates: 31/31.
- Official P9 gates: 33/33; zero failed, zero skipped.
- Primary guided replay: 5/5 identical.
- P9 browser matrix: 82/82 blocking checks across EN/ZH, Overview/Simulation/Forecast/Results/Settings/Tutor, Traditional/Advisory/Optimised, and Optimal/Verified Fallback/Safety Not Guaranteed.
- P8 isolated regression: 37 context/safety, 100 bilingual evaluation, 15 UI/provider and 38 gates; all pass without changing P8.
- P7: 36 integration/state and 23 UI/provider invariants plus EN/ZH browser pass.
- P6/P5/P4/P3: 5/10/11/7; P4 provider 20 and alignment 15; all pass.
- Physical Fixture/P2: 5, Traditional P2: 34, P1A: 84; all pass.
- P0: TypeScript, 62 invariants and production build pass.
- Clean exact-lockfile frontend install/test/build passes.
- P0–P8 integrity and the 171-artifact RC1 release freeze pass both before and after testing.

## Release limitations and configuration sanity

The evidence is synthetic; no real sensor, weather-service, actuator, PLC/DCS, primary-network, tariff or deployment validation exists. The 900×800 viewport has 286px horizontal overflow on all five routes; the 1672×941 demo and 1366×768 laptop viewports pass. No API key, frontend secret, live LLM dependency, hidden credential or developer-absolute build dependency is required. The available Git commit is recorded, but the accepted phase artifacts are not a clean committed tree; RC1 identity therefore comes from the exact registry and SHA-256 manifest.

P9 used a minimal release-only implementation: integrity binding, deterministic/runtime/security/browser checks, clean build validation and documentation. No accepted physical, controller, scenario, prediction, MPC, provider or Tutor implementation was changed.

P9 Gate: PASS WITH NON-BLOCKING ISSUES
