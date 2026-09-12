# Heatpilot / AIHeating

A **dark, integrated spatial heating-operations demonstrator** for a Yinchuan-oriented residential secondary network. One persistent district workspace connects orbitable geographic context, asset selection, alarms, physical-model inspection, replay, forecast, DeepSeek V4 Flash diagnostic/optimisation workflows and operator-approved simulator changes.

The default route is an authored winter-city vision inspired by Yinchuan: detailed modular residential architecture, landscaped streets and a cutaway blue-and-steel energy centre, all orbitable within one connected workspace. B01–B12 are coherent simulated thermal loads. The geometry is design imagery made into real interactive geometry, not a surveyed estate. The optional public 926-component BIM remains an unlinked engineering tool, not the visual goal. A read-only authenticated observation gateway accepts validated measurements but does not assimilate them into the simulator.

The standalone engineering tools are preserved at **/engineering** (including the independent OpenDHN benchmark), image-backed reference design at **/reference**, earlier procedural scene at **/operations-classic**, and frozen research dashboard at **/legacy**. Shanghai and Shenzhen are documented alternative energy-system profiles, not enabled aliases of the heating engine. No physical plant control is connected.

## Run locally

Requirements: **Node.js 24.14.1 or newer** and a modern WebGL-capable browser. The deployed service is entirely Node.js, including physical simulation and optimisation in a worker thread. Python and IfcOpenShell are only optional offline research/reproduction tools.

```sh
npm ci
npm run build
npm start
```

Open **http://localhost:3000**. The public HTTP listener binds to 0.0.0.0 and uses PORT, defaulting to 3000. No Python subprocess is launched.

For frontend development, leave npm start running and run npm run dev in a second terminal. Vite proxies /api to port 3000. `npm run preview` is retained as a production-service compatibility alias for older Render services; it starts the Node API and static client, not the Vite preview server.

## Enable the AI copilot

Create an untracked .env file using .env.example as the template, or set environment variables in the deployment environment:

| Variable | Purpose |
|---|---|
| OPENROUTER_API_KEY | Provider key, server only |
| OPENROUTER_MODEL | Tool-capable model; default deepseek/deepseek-v4-flash-0731 (pinned DeepSeek V4 Flash release) |
| TELEMETRY_INGEST_TOKEN | Separate gateway secret; permits read-only measurement ingestion, never actuator writes |
| AI_ACCESS_TOKEN | A separate, strong operator access code protecting paid requests |
| PORT | HTTP listener port |

Enter **AI_ACCESS_TOKEN**, not the provider key, in the browser's AI copilot access-code field. The operator code is held in component memory, not localStorage or exported evidence. Never prefix secrets with VITE_. Never put secrets in render.yaml, source files, URLs or Git remotes. Rotate credentials that have been posted in a chat or other shared location.

Existing `.env` or Render environment values override the default. To migrate an existing deployment, explicitly set `OPENROUTER_MODEL=deepseek/deepseek-v4-flash-0731` and restart/redeploy. A bounded live DeepSeek diagnostic tool-call test passed on 13 September 2026; provider availability and routing can change. The earlier Gemini validation record is historical. See `docs/integrated-system.md` for delivered capabilities, validation and remaining field-commissioning requirements; `docs/immersive-agents.md` retains the broader architecture direction.

Without AI configuration, the physical twin, rule-based investigations, scenario comparisons and evidence export still work. The UI clearly reports that AI is unavailable; it does not substitute a fabricated AI answer. Provider questions and synthetic tool results leave the server for OpenRouter and the selected model provider. Do not enter confidential plant or resident data.

## Deploy to Render

Use a **Node.js Web Service**, not a Static Site or Vite preview server.

1. Connect this repository and select the branch containing this upgrade.
2. Choose **Node** as the service language/runtime; set NODE_VERSION to **24.14.1**.
3. Build Command: **npm ci && npm run build**. Start Command: **npm start**.
4. Set OPENROUTER_API_KEY and AI_ACCESS_TOKEN as secret environment variables. Set OPENROUTER_MODEL if using a different tool-capable model.
5. Set the health-check path to **/api/health**. Render supplies PORT automatically.
6. Deploy and verify the twin, one +30 min step, the scenario comparison and the AI access-code protection.

The supplied render.yaml describes the same service as a Render Blueprint and generates the separate AI_ACCESS_TOKEN. Read that generated value from the Render environment settings when an authorised operator needs it. Never commit it.

**Existing services:** change an old npm run preview start command to npm start. A Git push does not necessarily update dashboard settings. If the existing service uses Docker, create a native Node service or follow Render's supported runtime-migration workflow. The optional Dockerfile also uses Node only. See [Render's Node deployment documentation](https://render.com/docs/deploy-node-express-app).

State is in memory: refresh within an active session preserves it, but inactivity expiry, service restarts and deployments clear it. The current design is single-instance; horizontal scaling needs external session storage and worker coordination. Free-tier cold starts or resource limits may affect responsiveness. The browser renders the 3D locally; Render does not need a GPU.

## What is implemented

- Persistent dark operations workspace around an authored winter-city 3D scene, detailed mechanical plant, animated heating routes, thermal overlays, orbit/pan/zoom and connected-asset selection. The source OSM extract remains research context, not the current scene geometry.
- Unified inspection, alarms, agents, optimisation, source evidence and data-connection tools; BIM opens in context without changing the selected district asset or timeline.
- Immutable per-session replay snapshots and complete per-building forecast frames, including forecast weather, plant settings and branch state.
- Bounded two-block numerical pattern-search optimisation over the nonlinear engine, fresh verification rollout, plan hashes and five-minute expiring approval tokens. Only the next 30-minute simulator step can be applied; no global optimality claim.
- DeepSeek diagnostic and optimisation workflows with authoritative world context, allowlisted numerical tools, recorded tool evidence and validated scene-focus targets. No LLM actuator, and numerical tools remain available without AI.
- Authenticated measurement ingestion with asset/metric/unit/time/quality checks, atomic batch rejection and stale-data reporting. Separate from simulation; latest-value memory storage only.
- Desktop/mobile browser workflow tests, mocked provider orchestration tests, physical optimiser/replay tests and an opt-in live provider smoke test.

- Imported IFC-to-GLB geometry with persistent GlobalIds, source property sets, class filtering, full orbit/pan/zoom, focus, visibility and isolation.
- X/Y/Z section planes, real raycast surface measurements, saved viewpoints, source-bound review notes and JSON review export. Measurements describe tessellated geometry, not certified clearances.
- OpenDHN pipe inspection, source-length-weighted path tracing and multi-edge outage connectivity screening; no invented elevation, valve states, live flow or temperatures.
- Local self-contained GLB import, up to 50 MiB, with external URI/compression guards. Source files are parsed in the browser, not uploaded.
- Linked District and Mechanical reference imagery, twelve building hotspots, five mechanical asset groups, temperature/flow/identity overlays, zoom/pan and keyboard-accessible asset selection.
- Shared simulation clock and building context across views; station-to-branch navigation; individual heat exchangers and cabinets explicitly labelled as unmodelled reference geometry.
- Responsive light/navy operator workspace, actual simulated history, interventions, AI investigation and evidence export. The previous Three.js scene is preserved at /operations-classic.
- Five synthetic scenarios: hydraulic imbalance, sunrise demand drop, cold front, sensor bias and local ventilation loss.
- Existing P1A nonlinear hydraulic/thermal engine; 5-minute physical substeps and 30-minute operator steps.
- Five-candidate, three-hour what-if comparison with explicit model-floor rejection and bounded control changes.
- Session-bound, revision-bound approval tokens; re-verification before a simulated change; rollback on failed substeps.
- Server-side OpenRouter tool loop: inspect, diagnose, compare, simulate and read curated research. No actuator tool.
- Application-generated numeric evidence cards. AI prose is qualitative; a limited numeric-claim guard withholds problematic prose. This is not a general hallucination-proofing mechanism.
- Diagnostic queue, operator event log, evidence export, source register and preserved legacy dashboard.

## Engineering limits

The default mechanical view is a public MEP coordination model, not fabrication CAD and not the generated image reconstructed as geometry. Its source has no explicit IFC port connections: the inspector reports this rather than inferring hydraulic connectivity. OpenDHN provides anonymised plan coordinates with zero elevations; rendered cylinders are selectable topology glyphs with exaggerated widths. It is kept separate from the Chinese synthetic model. See [Orbitable engineering workspace](docs/orbitable-engineering.md) for attribution, reproduction and validation.

All site imagery, classic geometry and telemetry are synthetic. Neither scene is a surveyed GIS/BIM model. The default imagery is raster artwork, with illustrative asset anchors and pipe colours. Zoom does not expose new geometry. Branch parameters determine transport delay; displayed pipe lengths do not. Mechanical equipment is not independently simulated: pump and header readings are aggregate station-boundary values. See [Reference workspace implementation and asset provenance](docs/reference-workspace.md).

There are twelve aggregate buildings, not apartment-level observations. Supply transport is adiabatic; return delay and pipe heat loss are not modelled. Heat kWh refers to integrated heat delivered to buildings, not purchased station energy. The model is not field-calibrated, and prediction uncertainty is not quantified.

The 18°C floor and 20–23°C comfort band are demonstration settings, not a national legal-compliance determination. Passing a trajectory floor does not mean all buildings have reached comfort. The five-candidate search is not the original P6 MPC. Sensor bias and ventilation faults are known scenario inputs, not trained machine-learning detections.

The source register is curated, not live web retrieval. The model cannot control devices. Real deployment needs approved data integration, calibrated models, permissions, durable auditing, independent protective controls and site-specific operating criteria.

## Architecture

| Layer | Implementation |
|---|---|
| Default engineering workspace | src/engineering/EngineeringWorkspace.tsx and engineering.css |
| Orbitable engineering viewport | src/engineering/EngineeringScene.tsx; Three.js/OrbitControls/GLTFLoader |
| Graph analysis and import validation | src/engineering/model.ts |
| Public engineering assets | public/engineering-assets; credited IFC-derived GLB/metadata and OpenDHN graph |
| Image-backed simulation workspace | src/operations/TwinWorkspace.tsx and workspace.css at /reference |
| Reference imagery and hotspots | src/operations/ReferenceScene.tsx and assets/*.png |
| Preserved classic workspace | src/operations/OperationsApp.tsx and operations.css at /operations-classic |
| Classic 3D scene | src/operations/DistrictScene.tsx; lazily loaded Three.js |
| HTTP and AI boundary | server/index.mjs; built-in Node HTTP server |
| Numeric result presentation | server/agent-evidence.mjs |
| Stateful simulation adapter | server/twin.py; JSON-lines worker protocol |
| Existing physical model | physical_core/src/ai_heating_core |
| Curated research | server/sources.json and docs/industrial-research-2026.md |
| Original UI | src/App.tsx; loaded only at /legacy |

The server has same-origin checks, HttpOnly cookies, bounded requests and worker queues, and a process-local limit of twenty AI investigations per hour with two concurrent provider requests. These are demo protections, not a production access-management or abuse-prevention system. Put durable identity and rate limiting in front of a wider rollout, and set an independent provider spending limit.

## Verification

```sh
npm run build
npm test
npm run test:operations
npm run test:engineering
physical_core/.venv/bin/python -m unittest discover -s server -p 'test_*.py' -v
```

Browser verification, with npm start running:

```sh
npx playwright install chromium
BASE_URL=http://127.0.0.1:3000 npm run test:workspace
BASE_URL=http://127.0.0.1:3000 npm run test:engineering:browser
```

Set SCREENSHOT_DIR to choose the screenshot directory. PLAYWRIGHT_CHROMIUM_EXECUTABLE can point to an existing compatible Chromium executable. BASE_URL defaults to http://127.0.0.1:3100 to support an isolated test service. The browser suite checks both reference views, selection, layers, zoom, stepping, scenarios, comparison, approval, sensor diagnostics, source links, evidence export, mobile layout, image failure and preserved routes. It does not make paid AI calls.

The following is an **opt-in paid integration check** using the secrets in a local .env file:

```sh
node scripts/operations-ai-smoke.mjs
```

It checks access-code rejection, real provider tool calls, faithful numeric result fields and unchanged simulation state. It prints synthetic evidence, never credentials.

The full original physics suite additionally needs pytest, matplotlib and cvxpy installed in the virtual environment. Run it from physical_core with python -m pytest tests -q. Existing npm run test:p7 and npm run test:p8 commands preserve their original replay/evaluation scope; they do not validate the new live AI agent.

## Research

Read [Agentic decision support for Chinese residential district heating](docs/industrial-research-2026.md) for the industrial scenario, 2026 research context, product priorities, evidence limits and a staged route to a real pilot.
