# P2.2 — Final Diagnostic Report

## Decision and scope

**Exactly one decision: PATH C.**

> The current synthetic fixture/control-authority combination has a structural hard-feasibility conflict.

This conclusion applies at **−10°C**, zero solar, closed windows, unchanged internal gains, physical-fixture-v1.1 and the specified station/zone actuator limits. It does not apply universally: a legal whole-system 18–25°C witness exists at −5°C.

**Diagnostic validation passes. Baseline freeze remains HOLD.** No fixture, controller policy or production commissioning default is changed.

## Direct answers to the 12 required questions

### 1. Does a legal all-building 18–25°C point exist at −5°C?

**Yes.** Supply **56.5°C**, pump **30 Hz**, Near/Mid/Far valves **20% / 50% / 75%**. The actual coupled hydraulic solver and exact thermal equilibrium give all 12 buildings between **18.302245°C and 24.702527°C**, with zero hard violation. This is an interior feasible witness, not a runtime policy recommendation.

### 2. Does one exist at −10°C?

**No within the specified legal envelope.** Coarse, refined and independent two-seed continuous searches agree on a positive residual violation. A separate monotone interval certificate excludes the entire conservative Near flow domain under the 40–60°C supply bound, establishing nonexistence independently of optimizer termination.

Best found: supply **59.999987°C**, pump **34.772531 Hz**, valves **23.628753% / 63.937141% / 94.165027%**. B03 is **17.416284°C** while B01/B02/B04 are **25.583716°C**; maximum hard violation **0.583716°C**. This positive value is a best-found upper bound on minimum violation, not a certified exact global optimum. The certificate proves no zero-violation point.

### 3. Can all buildings simultaneously remain within 20–22°C?

**No at either evaluated outdoor condition.** Independently optimized whole-system best found comfort violations are **2.085637°C at −5°C** and **2.921046°C at −10°C**. Near and Far each have narrow-band exclusion certificates at both conditions; Mid has legal narrow-band witnesses at both.

### 4. Which buildings bind the envelope?

The decisive cold hard-band conflict is **B03 versus B01/B02/B04**, within Near. At the −10°C whole-system hard minimum-violation point they oppose one another at the lower and upper temperature bounds. Supply is effectively at its 60°C ceiling.

For the narrow Far comfort objective, **B09 versus B10/B11/B12** binds. At −5°C the reported hard-feasible whole-system point has no active violating constraint; B01/B02/B04 are simply nearest the upper bound. The static report lists all 12 temperatures, violating IDs, flows and residuals for every whole-system objective.

### 5. Is Near still structurally conflicting when all five actuators vary?

**At −10°C, yes; at −5°C for 18–25°C, no.** Near's cold hard conflict persists even after relaxing legal coupled flows to a larger mathematical flow domain. It therefore is not explained solely by the old fixed pump or valve settings. Near remains narrow-comfort-infeasible at both temperatures.

This distinguishes the previous fixed-operating-point observation from the stronger, temperature-specific full-envelope conclusion.

### 6. Are B03/B09 radiator capacities still binding?

**B03's emitter/load relationship is part of the decisive cold hard-band conflict.** Increasing common Near heating helps B03 but overheats its better-insulated peers; decreasing it reverses the problem. Accepted NTU conductance, fixed within-zone allocation and the 60°C supply ceiling constrain this tradeoff.

**B09 is not the cause of whole-system cold hard infeasibility.** Far has legal 18–25°C witnesses at both conditions, and B09 is **18.872778°C** at the best whole-system cold hard point. B09's heterogeneous emitter/load relationship remains relevant to Far's unattainable 20–22°C band.

This does not prove either radiator cannot heat its building in isolation, or that UA alone is the unique cause. It identifies the current sizing/allocation/common-actuation combination as the conflict; no UA adjustment is calculated or installed.

### 7. What are the area-based zone shares?

Near/Mid/Far areas: **4,260 / 4,250 / 4,400 m²**. Normalized targets:

- Near: **32.997676%**
- Mid: **32.920217%**
- Far: **34.082107%**

### 8. What are the design-load zone shares?

At 21°C indoor, −10°C outdoor and zero solar, unchanged design maintenance loads are **133,416 / 158,525 / 178,070 W**, total **470,011 W**. Normalized targets:

- Near: **28.385719%**
- Mid: **33.727934%**
- Far: **37.886347%**

Only this target source differs in the shadow commissioning experiment.

### 9. What fixed valves result from the unchanged algorithm?

The exact accepted commissioning implementation produces continuous Near/Mid/Far openings **36.755795% / 54.079539% / 85%**, rounded under its unchanged 5pp policy to **35% / 55% / 85%**.

The area-target reference is **50% / 60% / 85%**. Both use 45 Hz and the same 85% limiting-branch anchor. Actual shadow flow shares are **27.370113% / 34.431406% / 38.198481%**; normalized L1 mismatch against its own target is **0.020312112**. These are algorithm outputs, not manually selected valves.

### 10. Does shadow commissioning materially improve Normal Winter?

**No overall.** Some measurements improve: maximum indoor **28.4828→27.6827°C**, P90−P10 **8.9674→8.2653°C**, heat **9.977267→9.923577 MWh**.

But comfort remains **0%**, severe overheating remains **25%**, and overheating worsens **57.2917→64.6123%**. Pump electricity rises **26.001788→26.358599 kWh**. Compliance remains 100%, which only means ≥18°C, not absence of overheating. B01/B02/B04 remain severely overheated throughout all evaluation samples.

### 11. Does it materially improve Cold Wave?

**No; compliance worsens.** Compliance **96.4120→94.9363%**, underheating **3.5880→5.0637%**, overheating **44.8785→50.6944%**. Comfort remains **0%** and severe overheating **25%**.

Although peak indoor and spread fall, and B09 underheating falls **35.7639→31.9444%**, B03 underheating rises **7.2917→28.8194%**. Heat falls slightly **11.489182→11.421256 MWh**, while pump electricity rises **29.890133→30.300303 kWh**. This mixed redistribution does not justify promoting the shadow settings.

### 12. Which next action is supported?

**Option C: propose “Physical Fixture v1.2 — Coherent Radiator Sizing” for the NEXT external decision.**

The cold hard-band exclusion, not merely discomfort under Traditional control, justifies a sizing review. Revising zone commissioning alone is not supported by the shadow benchmark. Accepting only a narrow-band control limitation would overlook the proven cold hard-band conflict.

This is a recommendation for review, **not authorization already exercised**. No v1.2 fixture, new actuator, UA tuning or replacement baseline is implemented.

## Evidence strength and limits

The five-actuator search includes 8,250 full-box coarse settings per case, local refinement and independent SciPy differential evolution seeds 7/23 plus bounded local polish, separately for both bands and all/three-zone scopes. Total: **233,702 evaluations**, **175,644 distinct actual hydraulic solver calls**. Exact repeated hydraulic inputs may reuse the accepted solver result; no flow is manually assigned as an operating candidate.

All evaluated thermal equilibria are substituted into the accepted heat-balance equations. Maximum absolute thermal residual is **3.637979e−11 W**, below **1e−6 W**; maximum normalized hydraulic residual **1.171085e−12**. Feasibility tolerance is only **1e−7°C**.

**16 of 32 DE runs reach the generation cap.** Their evaluated points are valid but their positive optima are not certified exact. Negative classification is independently protected by complete monotone interval exclusion of a relaxed legal-flow superset. The static report provides the equations and every exclusion interval.

Static feasibility does not establish dynamic 24h comfort, MPC performance, future savings or real-site feasibility. Static infeasibility is limited to the current synthetic grouping, fixture, actuators and equipment limits—not every possible building-level control system.

The shadow simulations retain real scenario weather and solar, unlike the zero-solar static design conditions. Warm-up is recomputed: 72/96 h does not meet the accepted indoor criterion, while 96/120 h does; selected warm-up is 96 h. Two 24h CSVs replay exactly with zero solver failures. Both reference and shadow retain the original metric definitions, including the area-referenced hydraulic balance index.

## Actual validation

| Validation | Actual result | Failed / skipped |
| --- | --- | --- |
| New P2.2 tests | 20 passed, command exit 0 | 0 / 0 |
| P2.2 diagnostic Gates | 17 passed, runner exit 0 | 0 / 0 |
| Full P1A tests | 84 passed, command exit 0 | 0 / 0 |
| All P1A Gates | 32 passed | 0 / 0 |
| Full P2 tests | 34 passed, command exit 0 | 0 / 0 |
| All P2 Gates | 20 passed | 0 / 0 |
| P0 `npx tsc --noEmit` | exit 0, no output | N/A |
| P0 `npm run test` | 62 passed, exit 0 | 0 / 0 |
| P0 `npm run build` | exit 0, 19 modules, built in 63 ms | N/A |

Total tests: **200 passed, 0 failed, 0 skipped**. [Gate report](P2_2_GATE_RESULTS.md) contains commands, exit results and captured outputs, not just pass labels; [Gate JSON](p2_2_gate_results.json) contains complete original Gate measurements.

All **170 historical files** in the preservation ledger remain unchanged after regression. The physical parameter hash is unchanged. No new baseline freeze manifest exists. Existing unrelated repository changes are retained.

Following the minimal-change approach, the new implementation is confined to offline analysis/evidence runners and tests; it reuses accepted hydraulics, thermal functions, metrics and commissioning rather than introducing a controller or generic framework.

## Required deliverables

- [Implementation plan](P2_2_IMPLEMENTATION_PLAN.md)
- [Static envelope report](P2_2_STATIC_FEASIBLE_ENVELOPE_REPORT.md)
- [Static envelope JSON](p2_2_static_feasible_envelope.json)
- [Zone commissioning review](P2_2_ZONE_DESIGN_LOAD_COMMISSIONING_REVIEW.md)
- [Zone commissioning JSON](p2_2_zone_commissioning_results.json)
- [Gate results report](P2_2_GATE_RESULTS.md)
- [Gate results JSON](p2_2_gate_results.json)
- This final report: `P2_2_FINAL_REPORT.md`

Additional evidence: `p2_2_shadow_results/normal_winter.csv`, `cold_wave.csv`, scenario-specific fresh initial-state JSONs, and `p2_2_historical_hashes.json` (input-preservation ledger only).

## Stop condition

**P2.2 diagnostic work complete; awaiting external review.** No R/C/UA, gains, equipment, equations, FIFO, within-zone weights, controller curves, timestep semantics, scenario forcing or UI change. No Physical Fixture v1.2, Traditional v1.1 freeze, P3 dataset, prediction or MPC work started.

