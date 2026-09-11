# P6 Final Report — Formal Supervisory MPC

## Executive decision

P6 implements the requested P4 demand + P5 thermal + local-sensitivity convex MPC, uses cvxpy/OSQP, and accepts a trajectory only after full nonlinear P1A/P5 verification. All 40 P6 gates and the full inherited regression passed. The result is suitable for the synthetic customer simulation, with two non-blocking issues: 7/160 solver `user_limit` outcomes used verified fallbacks, and small valve corrections increase direction reversals versus Preview.

## Required answers

1. **What does P6 optimise?** Avoidable heat oversupply, pump electricity, mild comfort deviation, overheating, severe overheating and control movement, subordinate to robust safety.
2. **What is the grid?** A 180-minute horizon with six 30-minute control intervals.
3. **Which controls?** Secondary supply temperature, pump frequency, and Near/Mid/Far zone-valve fractions.
4. **Which hard constraints?** Supply 40–60°C and ±2°C/step; pump 30–50 Hz and ±2 Hz/step; valves 20–100% and ±10 pp/step; trust-region and robust-temperature constraints are also inside the QP.
5. **How does P4 enter?** Selected P4 Predictor v1 predicts Required Heat Load at 1/2/3h; deterministic interpolation supplies the 30-minute demand-reference grid. It is never an actuator command or future truth.
6. **How does P5 enter?** Frozen calibrated H/C dynamics predict B01–B12 temperatures on the MPC grid and its accepted forecast-driven half-widths define uncertainty.
7. **How is nonlinear P1A represented during optimisation?** By finite-difference sensitivities produced through full P1A hydraulics/FIFO and P5 thermal rollouts, not by embedding the nonlinear world in OSQP.
8. **How is the surrogate built?** Around a legal frozen-Traditional issued-forecast continuation, using deterministic central or legal one-sided perturbations of 0.5°C, 0.5 Hz and 2 pp.
9. **How accurate?** 3h indoor MAE 0.000878°C, max error 0.010318°C, mean heat error 0.07965% and flow error 0.11348%; every gate passed.
10. **Trust region?** ±2°C supply, ±2 Hz pump and ±10 pp per valve around each reference point; one optional half-size retry.
11. **Objective?** Frozen normalized piecewise-linear/quadratic terms for oversupply, pump power, comfort bands, >23°C, >25°C and squared movement.
12. **How frozen?** `p6_mpc_objective_v1.json` was configured only from non-canonical development scenarios and marked frozen before canonical execution; canonical tuning is false.
13. **How is uncertainty used?** P5 forecast-driven half-widths are subtracted from predicted temperatures; 90/150m use the larger adjacent accepted widths.
14. **How is ≥18°C protected?** Every building/interval lower bound is a hard QP constraint and is rechecked through full nonlinear verification.
15. **QP infeasible?** Preserve the non-optimal status, run the predeclared legal Traditional continuation or near-boundary maximum-heating continuation, and return the reason/status.
16. **Nonlinear verification failure?** One candidate-centred relinearisation with half trust region is permitted; another failure invokes fallback.
17. **Relinearisation frequency?** 0 of 160 canonical decisions.
18. **Fallback frequency?** 7 of 160 (4.375%): one Normal, six Cold; all canonical fallbacks were nonlinear-verified. The deliberately infeasible stress fallback remained explicitly unverified.
19. **Deterministic?** Yes; same state/forecast/config produced the same recommendation ID and sensitivity results.
20. **Runtime?** 0.521 s median, 1.014 s P95, 1.045 s maximum; P95 passes the 5-second review target.
21. **Near-18 stress?** The feasible state was physically created at 19.086°C, accepted with +0.078°C robust margin, and realised 18.196°C. The harder state at 18.418°C made the −30°C-forecast QP infeasible; its legal fallback could not guarantee safety and realised 17.381°C under declared −14°C truth. No saving was claimed.
22. **Normal Winter?** 100% compliance/0 underheat, 9.254 MWh heat and 24.417 kWh pump; both improved versus Traditional, though direction reversals warrant review.
23. **Rapid Daytime Warming?** 100% compliance/0 underheat; heat 7.874 MWh, pump 21.503 kWh, overheating 30.84%, oversupply 1.184 MWh, all materially better than Traditional.
24. **Sunny Winter?** Forecast solar entered the future thermal chain; MPC remained 100% compliant and reduced heat, pump, oversupply and overheating versus Traditional and Preview.
25. **Cold Wave?** Minimum realised temperature 20.409°C, 100% compliance, zero underheating; six verified fallbacks occurred and no saving came from colder buildings.
26. **Hydraulic Imbalance?** The unchanged 2× Far-resistance secondary benchmark remained physically feasible with 100% compliance, zero fallback and sensible zone redistribution; no artificial strengthening or dramatic recovery claim.
27. **Supply-only?** On Rapid it achieved 7.975 MWh, 36.08% overheating and 1.230 MWh oversupply at 100% compliance.
28. **Supply+pump?** It reduced pump electricity to 21.479 kWh and improved heat/overheating/oversupply versus supply-only.
29. **What do zone valves add?** Full control achieved the best overheating (30.84%), oversupply (1.184 MWh) and spread (1.358°C), with small additional valve movement/chatter.
30. **Versus Traditional?** On Rapid, heat −5.95%, pump −8.13%, oversupply −19.94% and overheating −31.08 points, with unchanged 100% compliance and no underheat.
31. **Versus Preview v0?** On Rapid, heat −1.51%, pump −0.32%, oversupply −5.34% and overheating −6.97 points. The frozen objective was 0.9236 versus 1.0731 (13.93% better), so no review-required trigger.
32. **Savings without underheating?** Yes in all five canonical scenarios: compliance was 100% and underheating 0%; heat and pump accounting remain separate.
33. **Were P0–P5 frozen artifacts changed?** No. Freeze-manifest checks before and after the final regression returned no errors; P4/P5 registry and artifact hashes match.
34. **Limitations?** Synthetic-only evidence; local—not global—linearisation; simulation-calibrated uncertainty/H/C; no real sensors, distribution shift, primary network, building valves, PLC/DCS or tariff objective; 7 `user_limit` fallbacks and higher small-signal reversal counts need operational follow-up.
35. **Suitable for customer simulation?** Yes, for the synthetic PoC through the stable backend seam, with fallback/status visibility and without claiming real-world deployment validation.
36. **Is P7 ready?** Yes. P7 may integrate the provider seam while preserving explicit Advisory/Optimised application semantics and accepted UI behavior.

## Regression and integrity

P6 gates: 40/40. Unit tests: 5/5. Inherited gates: P5 32/32, P4 32/32, P3 14/14, P2 20/20, P1A 32/32; P0 typecheck/test/build all exited 0. P4 data alignment: 15/15. Browser UI tests: one justified skip because P6 changed no UI. P6 registry and P2/P1A freeze errors: none.

Customer MPC Readiness: GO

P7 Readiness: GO

P6 Gate: PASS WITH NON-BLOCKING ISSUES
