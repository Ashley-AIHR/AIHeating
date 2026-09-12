# Direct spatial operation

The current scene is an operating surface for the simulator. Select a building or branch and choose Operate to open its supplying branch valve. In the energy centre, a selected heat exchanger leads to the shared supply setpoint; a pump or drive cabinet leads to the equivalent pump frequency. These bindings do not claim independent duty/standby, motor or exchanger models that the engine does not implement.

Manual control follows preview → verification → explicit application. `POST /api/control/preview` requires the current revision, a mapped asset, an allowed control and a finite value inside equipment and ramp limits. A feasible three-hour rollout creates an expiring single-use token. `POST /api/apply` revalidates it and advances the current model by one 30-minute control block. The engine still integrates five-minute thermal substeps. A preview never mutates the current physical state; rejected controls cannot be applied. After a manual command the agent can replan from its resulting revision. Manual takeover stops subsequent automatic cycles.

Scene particles integrate branch flow over animation time, so a speed change does not restart every particle. Building labels distinguish normal, warm, cold, critical and suspect readings, and flash on meaningful displayed changes. Thermal rings pulse for out-of-band values. Metric counters animate within the same asset/data mode; changing selection resets them rather than presenting a change between unrelated units. An event log retains the last thirty local operational events and exposes recent commands and failures beside the persistent alarm count.

The equipment workbench shows actual shared station-model readings and three connected branches; branch selection returns to the corresponding district asset. The optional source BIM viewer offers focus, isolation, sectioning and surface-to-surface distance measurement. It remains an unrelated public reference file, so it is never used to command this heating network.

## AI configuration

Only `OPENROUTER_API_KEY` is required for the public demonstrator. `AI_ACCESS_TOKEN` is an optional password when the operator wants to restrict paid AI requests; it is not an OpenRouter requirement. If omitted, visitors can use the bounded global request budget. If set, it is still enforced. Observation reads remain protected. `/api/config` reports the deployed commit, provider-key presence and whether the optional password is enabled, without disclosing values. Model availability is established by a completed provider request, not by credential presence alone.

## Verification

Node tests cover manual binding, finite values, ramp bounds, stale revision rejection, non-mutating previews, infeasible-plan rejection, one-use application and replanning after manual operation. HTTP tests verify OpenRouter-only access, optional-password enforcement and protected observation reads without making paid requests. Browser checks cover direct valve and pump operation, updated flows/pressure, command acknowledgements, manual-to-numerical planning handoff and picked-point BIM measurement.
