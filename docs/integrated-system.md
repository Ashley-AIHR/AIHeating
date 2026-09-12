# Integrated spatial heating operations

## Delivered on 13 September 2026

Default `/` is the dark immersive workspace. The authored winter-city scene remains mounted while the right-hand tool changes or the camera enters the energy centre. Asset selection connects the 3D display, synthetic branch model, telemetry tag identity, history, forecast and agent context. The selected asset and timeline survive opening/closing optional reference BIM.

The current scene is an authored Yinchuan-inspired winter residential district, following the supplied architectural renders. Its original modular meshes include balconies, recessed windows, roof equipment, landscaped streets, vehicles, and a detailed energy centre. `public/site-assets/vision-district.json` is shared by rendering and server-side spatial context. Twelve aggregate thermal archetypes bind to the visible buildings; their heated areas do not describe the visual buildings' complete floor areas. Six mechanical assemblies bind to ST01 for contextual inspection, with shared station readings rather than fabricated per-device telemetry. The prior public OSM extract remains geographic research context only. This is a vision demonstrator, not surveyed or commissioned geometry; offline-reference photorealism is not certified.

The scene uses GPU instancing, locally served CC0 Poly Haven surface materials, shadows, contact occlusion, selectable winter-daylight/blue-hour art direction, and a performance setting. The browser performs rendering; Render does not need a GPU. Lighting is art direction independent of the physical simulation clock. The detailed station is native orbitable geometry, not a generated background. The 3D asset-pipeline skill informed the reference-led geometry and explicit provenance approach; no GPU image-to-3D reconstruction was used.

Detailed GLB may be imported locally for orbitable visual inspection. Such imports are centred, not georeferenced. Existing geographic selection markers and synthetic routes are hidden for imported geometry, and no imported mesh becomes a verified plant asset. The supplied buildingSMART Duplex MEP model is an independent reference, not a Yinchuan heat station. The standalone `/engineering` viewer retains its richer review tools.

## Numerical optimisation and replay

The deployed engine is native Node.js (`server/physics-node.mjs`, `server/twin-node.mjs`) in a worker thread. Hydraulic branch flows use the exact positive solution of the same quadratic equations; transport uses FIFO water packets; thermal states use exact piecewise-linear integration. All five scenarios and all five three-hour comparison trajectories are regression-tested against the retained Python engine's deterministic oracle. Python is optional offline validation infrastructure only.

`POST /api/optimise {"objective":"balanced"}` searches ten normalised control variables: supply temperature, pump frequency and three valves, in two successive 90-minute blocks. `comfort` and `energy` are alternative illustrative weight sets. Search is bounded coordinate pattern search at two mesh sizes, with at most 42 evaluations including fresh verification. It is not a global optimiser or the frozen research P6 MPC.

Each candidate uses 36 five-minute nonlinear substeps. The minimum includes the initial state. The verifier separately reruns the chosen schedule and checks the demonstration temperature floor, numerical residual and pressure ceiling. A feasible result does not imply all buildings reach comfort. Constraints are demonstrator values, not a commissioned site's operating envelope. Model uncertainty and unmodelled pipe losses remain limitations.

Plans carry a hash of scenario, revision, model version and schedule; opaque approval tokens are session-bound, revision-bound and expire after five minutes. Applying a plan revalidates it, advances only the next 30 simulated minutes, and invalidates tokens. No field write endpoint exists. Re-optimisation is operator-triggered.

`POST /api/replay` returns up to 48 full saved snapshots. Forecast traces contain complete physical snapshots so the displayed timestamp, building temperature, plant controls, weather and branch values describe the same frame. Replays and forecasts disable new agent runs and simulator approval until the operator returns to current simulation.

## Agent workflows

`POST /api/investigation` accepts `role` (`diagnostic` or `optimisation`), canonical `assetId`, current `revision`, `mode:"simulation"`, a question, optional objective and optional `equipmentId` for ST01. Equipment identity and parent context are validated before a provider call. It uses the same operator access-code header as the older AI endpoint. The server constructs world context from the authored asset registry and physical state, including mechanical-model limitations; the client cannot supply invented telemetry as context.

Each run obtains numerical diagnosis; optimisation runs additionally compute the numerical plan before the language-model stage. Distinct role instructions and tool permissions use pinned `deepseek/deepseek-v4-flash-0731` through OpenRouter. At most four provider rounds and eight LLM tool calls are allowed. The existing service-wide concurrency/hourly request budget also applies. Tools cannot execute scripts, browse arbitrary URLs or actuate equipment. Scene targets are generated from validated asset identities, not executable model output. Results retain original asset/revision and never automatically hijack a later selection.

Final prose is qualitative, with a lexical numerical-claim guard; this is not a general fact checker. Exact evidence remains accessible in tool-result cards. Observations, rules, synthetic injected faults and hypotheses must remain distinguishable. Runs are operator-triggered, not background agents polling an LLM on every frame. Jobs are synchronous bounded requests; durable queues, cancellation and streamed progress are not yet implemented.

## Read-only observation gateway

Configure `TELEMETRY_INGEST_TOKEN` as a server secret, separate from `AI_ACCESS_TOKEN` and `OPENROUTER_API_KEY`.

The gateway posts `/api/telemetry/ingest` with `Content-Type: application/json` and `X-Telemetry-Token`. Example body (replace the timestamp with the actual recent measurement time):

```json
{
  "siteId": "yinchuan-reference",
  "observations": [{
    "assetId": "B10", "metric": "indoorC", "value": 20.1,
    "unit": "degC", "timestamp": "2026-09-13T00:00:00+08:00",
    "quality": "good", "source": "operator-configured gateway"
  }]
}
```

Valid metrics are indoor/supply/return temperature (`degC`), flow (`m3/h`), pressure (`kPa`) and pump frequency (`Hz`), restricted by asset kind. Valid quality values are `good`, `suspect`, `bad`. Batches contain 1–50 measurements and must fit the service's 12,000-byte JSON limit. Times need an explicit timezone, may be at most 30 seconds in the future and at most 24 hours old. Duplicate/out-of-order tags, invalid units and invalid ranges reject the whole batch. Read using `POST /api/telemetry` with `X-AI-Access-Code`; the UI polls every ten seconds only while the authenticated connection panel is open. Values become stale after two minutes.

This is a generic HTTPS observation interface, not a supplied MQTT/OPC UA/Modbus connector. Gateway owners must establish actual tag mappings and units. Reception is not verification of field origin or quality. Measurements are shown separately, never silently used to initialise or calibrate the simulator. There is no real-site connection supplied with this repository.

All latest readings, sessions, plans and histories are in memory and disappear on restart. This is single-instance demonstrator infrastructure. Production requires operator-approved data sharing, authentication/RBAC, durable time-series and audit storage, process isolation, telemetry adapters, model calibration, commissioning, monitoring and recovery procedures. Field actuation remains out of scope until independently designed and approved.

## Validation

- TypeScript/Vite production build passed.
- 62 P0 invariants, 13 Python physical/replay/optimiser tests and expanded Node HTTP/agent/telemetry tests passed (see test output for current count).
- Source-model invariants cover 926 BIM mesh identities, 1,362 public benchmark pipe edges and GLB import guards.
- `npm run test:immersive` exercises actual browser selection/orbit, optimisation, forecast, simulator approval/expiry, replay, contextual BIM, agent UI wiring, export and mobile layout. Its UI provider response is explicitly mocked.
- One separate live DeepSeek diagnostic run succeeded: run `dd7c9c9f-255e-46fb-939f-64be95d30844`, pinned model, 66,675 reported tokens. It inspected world context, received ramp-limit rejections for two counterfactuals, then executed valid simulations and returned a non-withheld explanation. No field actuation occurred. This demonstrates integration, not diagnostic accuracy on site data.
- Local Docker daemon was unavailable. The runtime asset-copy dependency is included in the Dockerfile, but a local container build was not validated.

For deployment, use the **native Node Render Web Service** definition: build `npm ci && npm run build`, start `npm start`, Node 24.14.1, health `/api/health`. The optional Docker image is now Node-only too. Set the pinned model explicitly in an existing service's environment; changing a Blueprint file does not guarantee existing overrides are replaced. Verify health, configuration, numerical optimisation and operator-protected AI after deployment.

Shanghai mixed heating/cooling and Shenzhen cooling/ice storage remain future equipment-model profiles. Their UI labels are informational; this release does not run a heating model under a cooling label.
