# P2.2 Implementation Plan — Diagnostic Only

## Scope and preservation

Answer static actuator feasibility and compare an offline shadow commissioning target. No physical fixture, equation, controller policy, original commissioning function, scenario or historical artifact will be edited. No baseline freeze or later phase. Capture/verify P2 and P2.1 evidence hashes before/after; all outputs use P2.2 names.

## Task A: exact steady thermal calculation

Use unchanged physical-fixture-v1.1, zero solar/closed windows, outdoor −5°C and −10°C. Every hydraulic operating point is obtained from accepted `solve_hydraulics`; repeated identical pump/valve inputs may reuse that exact solver result because supply/outdoor do not enter its equations. No flow is assigned as an actuator candidate.

Normalize unchanged within-zone design weights. Obtain NTU conductance using the accepted radiator function. Solve exact steady active-heating balance; handle heating-off equilibrium explicitly. Substitute each result into accepted radiator/envelope functions; require absolute thermal residual <1e−6 W and hydraulic normalized residual <1e−8. Static adiabatic transport has no steady offset; FIFO code remains untouched.

Independently assess all buildings in 18–25°C and 20–22°C, with feasibility tolerance 1e−7°C. Record per-building temperatures/violations, binding IDs, actuator inputs, flows, residuals and temperature spread. Per-zone scope optimizes the selected zone only but always solves the full coupled network.

## Three search stages

1. Whole legal Cartesian coarse grid: supply 40:2:60°C; pump 30:4:50 Hz; each valve 0.2:0.2:1.0. 8,250 candidates per outdoor case. Track best whole/Near/Mid/Far points for both bands.
2. Refine three distinct best coarse hydraulic regions per objective: supply ±1°C at 0.5°C, pump ±2 Hz at 1 Hz, valves ±0.10 at 0.05, clipped to equipment bounds. Deduplicate identical refined points. Re-evaluate exact physics, not interpolated KPIs.
3. Independent bounded SciPy differential evolution of all five actuators, seeds 7 and 23, population multiplier 10, up to 180 generations, tight convergence tolerance; followed by bounded local polish where useful. Starts are global, not restricted to grid winners. Run independently for each band and whole/zone scope at both outdoor conditions.

Feasible witness points prove existence; search alone will not be called a mathematical proof of nonexistence. If all stages fail to find feasibility, supplement with conservative per-zone flow-interval bounds where possible: bounds are analytical relaxations of legal hydraulics, not manually assigned operating candidates. Report numerical optimum uncertainty separately from a zero-feasibility certificate. If a certificate cannot be obtained, state the remaining uncertainty rather than claim complete infeasibility.

## Task B: shadow target and dynamic comparison

Compute zone design loads by summing the unchanged v1.1 21/−10°C, zero-solar maintenance loads. Reuse the exact existing commissioning implementation twice. Since it derives shares internally from `heated_area_m2`, a commissioning-only metadata view can present design-load values as target weights; no altered view may enter physical simulation. Hydraulics depend only on untouched pump/branch parameters. Validate shares/outputs independently and clearly label this input adapter. Same 45 Hz, 85% anchor and 5pp rounding; no tuning.

Run shadow Normal Winter and Cold Wave only, with the same runtime policy and v1.1 physics. Change only the resulting fixed commissioned valves in an in-memory shadow config (explicit shadow identity, no baseline export). Recompute 72/96-hour convergence, use 96/120 check when needed, preserve <0.2°C threshold. Export two new states/CSVs, summaries and per-building exposures. Compare against existing area-zone-commissioned v1.1 evidence using unchanged metrics.

## Tests and Gates

Unit tests cover exact residuals, bounds, independent band/scope violation metrics, unchanged parameters and commissioning target equivalence. F1–F17 bind actual stage coverage/results, solver use, per-zone conclusions, commissioning, immutable sources, shadow stability and full regressions. Run all accepted 84 P1A tests/32 Gates, 34 P2 tests/20 Gates with v1.1 input adapters, plus P0 typecheck/62 assertions/build. Do not invoke old report-writing entry points.

## Reports and decision

Produce all eight requested plan/report/JSON deliverables with exact witness settings, nonzero best violations, stage comparison, binding buildings, per-zone results and actual command outputs. Path A/B overlap is resolved by choosing the more specific Path B when hard feasibility exists at both conditions but comfort does not; Path A when both are feasible; Path C only when hard nonexistence is established at a design condition. Static feasibility is not a dynamic/MPC/real-site/savings claim. Stop for external review without fixture v1.2 or a new baseline freeze.
