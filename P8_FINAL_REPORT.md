# P8 Final Report

P8 adds a grounded explanation layer over the accepted P7 runtime. It does not change or participate in heating prediction, optimisation, verification, application or physical simulation.

## Required answers

1. **What is the Tutor allowed to do?** Explain current structured simulation state, P4/P5 predictions, P6 recommendations/status, hydraulics/thermal causality, uncertainty, fallback/safety and accepted comparisons.
2. **What is it forbidden to do?** Guess telemetry, scrape DOM, execute controls, replace engineering providers, override status truth, claim real-site evidence, reveal internal prompts/credentials or provide private chain-of-thought.
3. **What is its dynamic source of truth?** The current P7 runtime provider abstraction.
4. **Does it scrape DOM?** No. Source/UI invariant scans and architecture enforce structured props/provider data only.
5. **What is in TutorContextPacket?** Identity/version/time, page/scenario/mode/selected building, source/simulation boundary, page-relevant state/weather/network/building/forecast/P4/P5/P6/application/comparison/events/configuration, typed provenance, freshness and limitations.
6. **How is context kept page-aware?** The builder has explicit Overview, Simulation, Forecast, Results and Settings selections with bounded fields.
7. **How is selected-building context handled?** It includes observed building/zone/delivery facts and accepts structured per-building P5 points. If the current P7 snapshot lacks that series, it explicitly reports it unavailable and does not estimate it.
8. **How are stale/unavailable providers handled?** Their data are omitted, freshness is retained, and the Tutor offers only a missing-data statement or general concept.
9. **How are observed/predicted/recommended/applied/realised states distinguished?** Every evidence fact has an epistemic source type; the instruction, templates and validator preserve the lifecycle vocabulary.
10. **How does the Tutor explain Required Heat Load?** As building need, distinct from actual/planned supply and avoidable oversupply; AI predicts need rather than reducing the physical requirement.
11. **How does it explain P5 thermal prediction?** As model-predicted response/risk from calibrated effective H/C, inertia, transfer, gains and delays, with synthetic-calibrated uncertainty—not future observation or measured material truth.
12. **How does it explain formal MPC?** P4 + P5 + local sensitivity model → cvxpy/OSQP candidate trajectory → full nonlinear P1A verification; Preview is not the final MPC.
13. **How does it explain nonlinear verification?** Candidate or fallback replay through full P1A, distinct from application and later realised state.
14. **How does it explain Solver Limit?** No accepted optimum returned within configured solver conditions; this is not a crash or MPC success.
15. **How does it explain Verified Fallback?** A predefined fallback, separately checked in the Digital Twin, not an MPC optimum.
16. **How does it explain Constraint Infeasible?** No trajectory satisfies all robust constraints; equipment limits and thermal/network delay may make the requirement physically infeasible.
17. **How does it explain Safety Not Guaranteed?** Fallback cannot guarantee ≥18°C in that simulated context, and the Tutor cannot override physical limits.
18. **Can the Tutor execute equipment/application commands?** No. It has no control tool/callback and refuses supply, pump, valve and Apply requests.
19. **How are numeric claims grounded?** Dynamic numbers are obtained through typed evidence paths retained in `evidenceRefs` and audit metadata.
20. **What happens when evidence is missing?** It says the information is unavailable or answers conceptually without inventing a number.
21. **How is stale conversation state prevented?** Every answer uses the newly built `contextId`; only six conversation turns are retained and none is authoritative telemetry.
22. **How does scenario-change isolation work?** Scenario is part of context identity; the Cold-after-Rapid test used Cold structured state despite Rapid conversation history.
23. **What domain knowledge package is used?** `p8-domain-knowledge-v1`, 24 concise bilingual project-referenced items.
24. **How large is the EN/ZH evaluation set?** 50 semantic pairs: 50 English + 50 Simplified Chinese = 100 cases.
25. **What failures were observed?** Zero final evaluation/Gate/regression failures. An initial offline dependency-cache miss was corrected with a temporary fixed-version environment; it was not a product/test assertion failure.
26. **Did any hallucinated telemetry appear?** No; numeric-grounding failures were zero, including deliberately missing fields.
27. **Did any status semantic violation appear?** No.
28. **Did any control-safety violation appear?** No; command prompts were refused and runtime state remained unchanged.
29. **Does Tutor failure affect P1A–P6?** No. Provider timeout/failure returns Tutor-only safe fallback and has no control/runtime callback.
30. **Were P0–P7 accepted artifacts unchanged?** Yes. Registered P0–P6 and hash-bound P7 provider/state/Gate evidence passed before and after; accepted artifact changes are empty.
31. **Is P8 suitable for the synthetic customer PoC?** Yes, with the stated deterministic-provider, synthetic-evidence and aggregate P5 limitations.
32. **Is P9 ready to proceed?** Yes, subject to external review; no P9 work was started.

## Executed evidence

- P8: 37 focused invariants, 100/100 bilingual cases, 15 UI/provider invariants, 38/38 Gates, 8 EN/ZH browser screenshots.
- Inherited: P7 36 + 23; P6 5; P5 10; P4 11 + 20 + 15; P3 7; Fixture v1.2 5; P2 34; P1A 84; P0 62 plus typecheck and production build.
- Integrity: P0–P7 PASS before and after the complete regression.

Customer Tutor Readiness: GO

P9 Readiness: GO

P8 Gate: PASS WITH NON-BLOCKING ISSUES
