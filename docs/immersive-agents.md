# HeatPilot: physics-grounded agents inside the immersive twin

Design decision, 13 September 2026. This is an implementation direction, not a claim that a field-connected multi-agent system is complete.

## Model and current status

Use DeepSeek V4 Flash through the existing server-side OpenRouter integration, pinned to `deepseek/deepseek-v4-flash-0731`. Do not silently switch to V4.1 or a moving latest alias. Credentials remain server-side. Existing environment overrides require explicit migration; no paid inference or remote deployment was performed for this configuration change.

Verified primary references:

- [OpenRouter's V4 Flash 0731 model page](https://openrouter.ai/deepseek/deepseek-v4-flash-0731) lists the model identifier and tool-calling support.
- [DeepSeek model documentation](https://api-docs.deepseek.com/quick_start/pricing) lists V4 Flash and tool calls on the direct API. Direct DeepSeek and OpenRouter identifiers and credentials are not interchangeable.

The application currently has one bounded tool-calling investigator, synthetic state inspection, rule-based diagnosis, five fixed candidate comparisons and bounded counterfactual simulation. It has no live SCADA, general constrained optimiser, site-calibrated estimator, spatially bound multi-agent coordinator or unified city-to-BIM interface. Existing model assumptions and previous test results must remain visible.

## One operational world, shared by humans and agents

Use a canonical asset registry to join geospatial feature IDs, IFC GlobalIds, hydraulic graph nodes/edges and telemetry tags. Geometry establishes location and identity; surveyed connectivity establishes physical relationships. Spatial proximity alone must never imply a pipe connection. Unrelated public benchmark datasets remain separate sources until an explicit, valid mapping exists.

Each agent run receives a server-validated, immutable context envelope:

- Site ID; selected asset IDs; bounded connected subgraph; coordinate system, elevations and geometry revision.
- Data mode (live, replay or simulation), timestamp/window, telemetry revision, units, source and quality/freshness per measurement.
- Physical-model version, calibrated parameters, current estimated state, residuals, known omissions and calibration validity.
- Weather forecast vintage, operating limits, operator objective and permitted actions.
- Current scene selection and layer state for interaction context, not as evidence of physical connectivity.

Resolve authoritative values server-side. A browser selection, retrieved manual, BIM property or model response cannot grant authority or overwrite sensor facts. Unknown mappings and absent measurements are explicit gaps.

## Agent responsibilities

### Diagnostic agent

Retrieve the selected asset's history, connected branch and relevant equipment records. Check data quality before testing competing explanations: sensor bias, inadequate differential pressure, branch imbalance, obstruction, excessive demand or transport delay. Call numerical residual and counterfactual tools, link every conclusion to evidence and distinguish observations from hypotheses. Request a field measurement when evidence cannot distinguish causes. Do not invent certainty scores or diagnose an unmodelled component from appearance.

### Optimisation agent

Translate the operator's objective into an approved optimisation request, retrieve constraints and call a numerical solver. The solver, not LLM prose, computes time-varying supply temperature, pump speed and valve schedules. The initial target is constrained receding-horizon optimisation of heat and pumping energy with explicit comfort, differential-pressure, actuator and ramp limits. Include tariffs only when sourced; include uncertainty scenarios only when supported and calibrated.

Compare the computed plan with the current strategy across the full trajectory, including the initial state and transport delay. Report feasibility, solver status, baseline definition and limitations. Do not call the existing five-candidate comparison a general optimiser or label a merely feasible result globally optimal.

### Independent verification gate

Use deterministic checks and a separately executed physical rollout to verify limits, balance residuals, stale inputs and plan validity. A second LLM may critique an explanation but cannot certify safety or override a failed gate. Validation with the same physical model is a consistency check, not proof of field accuracy. Missing uncertainty estimates must remain missing, not be replaced with invented confidence intervals.

### Coordinator

Route bounded jobs between diagnosis, optimisation and verification; retain evidence references, tool inputs/results and run status. Record model/provider identity, context/model revisions, runtime and token use. Permit cancel, timeout and retry without duplicate actions. Start with operator-triggered runs; subsequently add authorised, debounced alarm triggers with per-site rate and cost budgets. Do not invoke an LLM on each telemetry sample or rendering frame.

## Immersive interaction contract

The district remains the persistent canvas. Selecting an alarm focuses its asset and connected branch, opens the same time window in trends and starts an explicitly requested diagnosis in a docked panel. Tool progress appears as short operational events (checking sensor quality, tracing supply path, testing a hypothesis), not fabricated internal reasoning.

Agent scene actions use a small validated command schema: focus known assets, highlight known paths, open mapped BIM detail, set a replay window or preview a computed trajectory. No model-generated JavaScript, arbitrary URLs or unrestricted DOM commands. A user's newer selection must not be hijacked by a late agent response; keep that response attached to its original run.

An optimisation preview colours affected buildings and pipes using solver output, moves the shared forecast timeline and updates the evidence panel. Predicted changes are visually distinct from measurements. BIM inspection retains the selected asset, timestamp and investigation when returning to the district. Returning to live mode restores observations and labels stale/missing data.

## Control and data boundaries

LLM tools have no direct PLC/SCADA write access. Initially support read-only field monitoring and sandbox simulation. Any future field application requires authenticated operator approval, a plan hash bound to the state/model revisions, an expiry time, revalidation, idempotent execution and equipment-side interlocks with a tested fallback. Abnormal conditions or stale data block application.

Before sending real operational data to OpenRouter, agree the permitted data scope, provider routing/retention and access controls. Exclude resident-identifying data and credentials. Keep audit evidence access-controlled; it is not public chat content.

## Delivery sequence and acceptance

1. Shared asset/time context and persistent dark district workspace; mapped BIM drill-down and honest connection status.
2. Structured agent runs and scene actions, diagnostic tools and replayable evidence; test cancellation, injection resistance, invalid asset IDs and stale results.
3. Numerical constrained optimiser and independent verification; test infeasible scenarios, limit violations, delays and sensible baseline comparisons before enabling plan previews.
4. Read-only pilot telemetry and model calibration; verify tag mapping, units, timestamps, missing/biased sensors and observed-vs-predicted residuals against site data.
5. Only after operational review, add separately authorised field commands and commissioning tests.

Acceptance must demonstrate one end-to-end workflow: select an affected building, inspect its actual supplying branch, diagnose using timestamped evidence, compute and verify a plan, preview district-wide consequences and preserve the same context through BIM inspection. A convincing screenshot alone is not acceptance.
