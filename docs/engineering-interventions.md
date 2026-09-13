# Engineering interventions in the connected twin

The Beijing comfort case now separates operating controls from proposed equipment changes. The operator keeps B10 at a target of 21°C within 120 minutes, ±0.3°C tolerance, with every building between 18°C and 23°C from the deadline onwards. Existing violations cannot worsen before the deadline.

## Operating planner

Precise goals use six 30-minute stages with coordinated seeds followed by bounded coordinate search. This is not a globally optimal solver. Shared-control permission now includes all three branch valves, not only the selected building's branch. Supply, pump and valve ramp limits are retained. Each candidate is replayed for three hours in five-minute substeps. Only the first 30 minutes may be applied.

## Engineering alternatives

`engineering_study` clones the current model and compares existing controls, commissioned local valves, doubled and tripled selected-building emitter UA, a 30% envelope-conductance reduction, a 35% supplying-branch pipe-resistance reduction, and auxiliary electric heat sized on a discrete grid. The grid stops at its first passing capacity; it is not a certified minimum. Resistance reduction is an engineering hypothesis, not proof of obstruction or a diagnosed repair.

Local valves modify both flow distribution and normalised equivalent branch resistance. At all-open settings, the hydraulic equations recover the accepted original fixture. This model does not reproduce a surveyed building circuit or a particular pressure-independent valve. A design alternative assumes commissioning complete at its start, including initial valve positions. Installation time is outside the operational horizon.

Auxiliary heat is a local, capacity-limited ideal thermostat. Its heat enters the building energy balance and its electricity is separately accumulated at COP 1. It neither changes indoor temperatures by assignment nor removes heat when district supply alone exceeds the target. Electrical network capacity, distribution inside the aggregate building, costs, carbon and protections are not modelled.

## Agent and operator workflow

`compare_engineering_options` is an explicit read-only agent tool for eligible building-temperature goals. A failed `optimise_network` result also triggers this bounded comparison automatically, with visible streamed tool events. It does not relax the target or commission equipment. The engineering cards preview the actual alternative trajectories in the main 3D scene without issuing operating tokens.

The operator must explicitly confirm `engineering_open` to create a modified simulation, preserve the original and apply the first verified half-hour. `engineering_step` replans one step at a time using the remaining original deadline. This mission state lasts in the server session, not through a restart. Manual commissioned building valves are available from the selected building's 3D controls; manual overrides can disrupt the goal. `engineering_restore` recovers the original state with a fresh identity.

## Reproduction and limitations

Engineering feasibility summaries are bilingual, deterministic text derived from completed solver flags, explicitly labelled as tool-result summaries. The LLM chooses tools but does not reinterpret which engineering alternatives passed. This prevents a fluent explanation from contradicting the evidence cards. Normal diagnostic and operating missions retain provider-generated reporting.

The Beijing catalogue finds two passing routes: tripled selected-building emitter UA with local valves, and local valves plus a 60 kW auxiliary heater. Both complete four actual half-hour steps. Final B10 temperatures are approximately 20.78°C and 21.01°C respectively, both within the original ±0.3°C tolerance. Other buildings remain within the task's 18–23°C band, but some remain below 20°C; this is not district-wide 20°C comfort compliance. The catalogue order is not an economic ranking. Auxiliary electricity is included in the optimiser's illustrative electricity penalty as well as reported separately.

Run `npm run build`, `npm run test:operations`, and `npm run test:engineering-options`. Run `node scripts/export-beijing-engineering.mjs` to regenerate `docs/beijing-engineering-results.json`. Browser tests use a provider transport fixture but the real numerical engine. They do not establish live OpenRouter availability.

The Beijing example is fictional. Added valve characteristics, emitter multipliers, insulation changes and auxiliary sizes are explicit scenario assumptions, not specifications for field installation. No controls are connected to real equipment. Individual equipment and BIM references remain demonstrator associations; no surveyed hydraulic binding is inferred from geometry.
