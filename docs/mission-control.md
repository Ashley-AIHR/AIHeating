# Missions as the operating surface

Delivered 13 September 2026. The important connection is intent → investigation → tested controls → changed physical state → measured response. The district remains visible throughout, including while inspecting the energy centre. Scene colouring and animation derive from numerical state, not generated prose.

## Responsibilities

- The operator supplies an asset, objective and investigation brief.
- The bounded LLM investigator receives the server-resolved network context, operating revision and diagnostic evidence. It chooses inspection, counterfactual simulation and optimisation tools. Optimisation now executes when the model calls the tool; it is no longer precomputed before the model begins. The model may decline intervention.
- The nonlinear Node solver computes the two-block schedule, compares it with unchanged controls and reruns the chosen trajectory to verify model limits. It retains revision-bound, expiring, single-use application tokens.
- The scene consumes the full selected trajectory. Branch flow drives particles; supply/return temperature controls pipe colour; asset labels show flow, delay, indoor temperature and differences against the matching baseline time. Agent-related assets are highlighted using known registry IDs.
- Manual application requires the existing simulator confirmation. The separate three-cycle mode explicitly authorises automatic simulator application. It waits between stages, reinspects fresh state and stops on failure, no feasible plan, stale context or user stop. Stop prevents future actions; an already accepted simulator step is not undone. Browser closure stops subsequent cycles.
- The outcome card compares the executed first step with the unchanged first step and reports model prediction residuals. It never presents a three-hour forecast saving as a measured thirty-minute saving.

## Streaming and evidence

`POST /api/investigation` with `stream: true` returns NDJSON tool events followed by a result or error. Authentication, session locks, provider budget and tool permissions are unchanged. Events are emitted at actual execution boundaries, not generated progress text or private chain-of-thought. HTTP failures before streaming remain JSON errors. The browser rejects interrupted streams without a completed result.

The persistent banner retains mission identity when the operator changes asset or opens mechanical detail. A late result cannot move the camera to its original asset. Forecasts do not mutate the current simulator. Applied outcomes remain tied to their recorded revision, and stale plans cannot be applied again.

## Relationship to real equipment

The simulated loop is functional. The real-world actuator loop is not connected. The existing authenticated observation gateway remains read-only and separate from the uncalibrated simulation. Moving to a site requires a canonical mapping from each scene asset to actual sensor and actuator tags, state estimation from quality-checked observations, a calibrated model and site-specific constraints. A commissioned control gateway would translate an approved plan into bounded PLC/BMS setpoints, acknowledge execution and feed resulting measurements back into the same mission. The LLM would still request tools; the numerical engine and gateway would own controls. No live command endpoint has been added by this change.

## Validation

- Production TypeScript/Vite build and all Node operations tests.
- Agent tool orchestration using explicit provider test doubles, including tool-selected objectives, declining intervention, invalid objective rejection and activity events.
- Full numerical planning and application: preview preserves state, applied hydraulics differ from unchanged controls, executed first-step temperatures match the predicted first step, and consumed plan tokens are rejected.
- Browser regression with the real server/physics: comparison changes 3D readings without mutating the present, application changes the state, outcome cards report results, three automatic cycles use successive revisions, stop prevents a pending step and stale plans remain disabled.
- Browser provider transport is explicitly mocked; these tests do not establish current DeepSeek provider availability or field accuracy.

Run `npm run test:operations`, then start the built service on port 3103 and run `npm run test:mission`. Screenshots are written to the configured screenshot directory. The existing integrated browser regression also remains available.
