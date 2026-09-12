# Heatpilot / AIHeating

A 3D, physics-backed research twin for **Chinese residential district heating with a secondary network**. Includes a server-side OpenRouter investigation agent, bounded numerical comparisons and explicit operator approval for simulation changes.

This is a synthetic research prototype, not a live SCADA system or an autonomous plant controller. The original frozen research dashboard remains available at **/legacy**.

## Run locally

Requirements: Node.js 24.14.1 or newer, Python 3.12, and a WebGL-capable browser for the 3D view. The asset list and numerical tools remain usable if WebGL is unavailable.

```sh
npm ci
python3.12 -m venv physical_core/.venv
physical_core/.venv/bin/python -m pip install -r server/requirements.txt
npm run build
npm start
```

Open **http://localhost:3000**. The server automatically uses physical_core/.venv/bin/python if present. Set PYTHON_BIN to override. The public HTTP listener binds to 0.0.0.0 and uses PORT, defaulting to 3000.

For frontend development, leave npm start running and run npm run dev in a second terminal. Vite proxies /api to port 3000. Do not deploy the Vite development or preview server as the operations backend.

## Enable the AI copilot

Create an untracked .env file using .env.example as the template, or set environment variables in the deployment environment:

| Variable | Purpose |
|---|---|
| OPENROUTER_API_KEY | Provider key, server only |
| OPENROUTER_MODEL | Tool-capable model; default google/gemini-2.5-flash |
| AI_ACCESS_TOKEN | A separate, strong operator access code protecting paid requests |
| PYTHON_BIN | Optional Python executable override |
| PORT | HTTP listener port |

Enter **AI_ACCESS_TOKEN**, not the provider key, in the browser's AI copilot access-code field. The operator code is held in component memory, not localStorage or exported evidence. Never prefix secrets with VITE_. Never put secrets in render.yaml, source files, URLs or Git remotes. Rotate credentials that have been posted in a chat or other shared location.

Without AI configuration, the physical twin, rule-based investigations, scenario comparisons and evidence export still work. The UI clearly reports that AI is unavailable; it does not substitute a fabricated AI answer. Provider questions and synthetic tool results leave the server for OpenRouter and the selected model provider. Do not enter confidential plant or resident data.

## Deploy to Render

Use a **Docker Web Service**, not a Static Site or the former Node/Vite-preview service.

1. Connect this repository and select the branch containing this upgrade.
2. Choose **Docker** as the service language/runtime. Dockerfile path: **./Dockerfile**; context: repository root.
3. Leave Docker Command blank: the image already runs **node server/index.mjs**. If a Docker command override is required, that is the command to enter.
4. Set OPENROUTER_API_KEY and AI_ACCESS_TOKEN as secret environment variables. Set OPENROUTER_MODEL if using a different tool-capable model.
5. Set the health-check path to **/api/health**. Render supplies PORT automatically.
6. Deploy and verify the twin, one +30 min step, the scenario comparison and the AI access-code protection.

The supplied render.yaml describes the same service as a Render Blueprint and generates the separate AI_ACCESS_TOKEN. Read that generated value from the Render environment settings when an authorised operator needs it. Never commit it.

**Migration warning:** the former deployment used npm run preview. This upgrade also needs the Python worker. Do not assume a Git push changes an existing service's runtime or dashboard command. Configure a Docker service for the upgrade, validate it, then migrate the public hostname using Render's supported workflow. Keep the old deployment available until the new one passes its checks. See [Render's Docker documentation](https://render.com/docs/docker).

The Dockerfile builds the client with Node and runs a non-root Node/Python service. The image excludes .env, .git, local dependencies and generated work. State is in memory: refresh within an active session preserves it, but inactivity expiry, service restarts and deployments clear it. The current design is single-instance; horizontal scaling needs external session storage and worker coordination. Free-tier cold starts or resource limits may affect responsiveness.

## What is implemented

- Selectable Three.js estate with thermal, flow and sensor layers, camera controls and a keyboard-accessible building list.
- Five synthetic scenarios: hydraulic imbalance, sunrise demand drop, cold front, sensor bias and local ventilation loss.
- Existing P1A nonlinear hydraulic/thermal engine; 5-minute physical substeps and 30-minute operator steps.
- Five-candidate, three-hour what-if comparison with explicit model-floor rejection and bounded control changes.
- Session-bound, revision-bound approval tokens; re-verification before a simulated change; rollback on failed substeps.
- Server-side OpenRouter tool loop: inspect, diagnose, compare, simulate and read curated research. No actuator tool.
- Application-generated numeric evidence cards. AI prose is qualitative; a limited numeric-claim guard withholds problematic prose. This is not a general hallucination-proofing mechanism.
- Diagnostic queue, operator event log, evidence export, source register and preserved legacy dashboard.

## Engineering limits

All site geometry and telemetry are synthetic. The scene is not a surveyed GIS/BIM model. Branch parameters determine transport delay; the displayed pipe lengths do not. Animated particles convey flow direction and relative branch flow, not calibrated travel time.

There are twelve aggregate buildings, not apartment-level observations. Supply transport is adiabatic; return delay and pipe heat loss are not modelled. Heat kWh refers to integrated heat delivered to buildings, not purchased station energy. The model is not field-calibrated, and prediction uncertainty is not quantified.

The 18°C floor and 20–23°C comfort band are demonstration settings, not a national legal-compliance determination. Passing a trajectory floor does not mean all buildings have reached comfort. The five-candidate search is not the original P6 MPC. Sensor bias and ventilation faults are known scenario inputs, not trained machine-learning detections.

The source register is curated, not live web retrieval. The model cannot control devices. Real deployment needs approved data integration, calibrated models, permissions, durable auditing, independent protective controls and site-specific operating criteria.

## Architecture

| Layer | Implementation |
|---|---|
| Operations UI | src/operations/OperationsApp.tsx and operations.css |
| 3D scene | src/operations/DistrictScene.tsx; lazily loaded Three.js |
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
physical_core/.venv/bin/python -m unittest discover -s server -p 'test_*.py' -v
```

Browser verification, with npm start running:

```sh
npx playwright install chromium
node scripts/operations-browser.mjs
```

Set SCREENSHOT_DIR to choose the screenshot directory. PLAYWRIGHT_CHROMIUM_EXECUTABLE can point to an existing compatible Chromium executable. The browser suite checks selection, layers, camera changes, stepping, scenarios, comparison, approval, sensor diagnostics, source links, mobile layout and legacy loading.

The following is an **opt-in paid integration check** using the secrets in a local .env file:

```sh
node scripts/operations-ai-smoke.mjs
```

It checks access-code rejection, real provider tool calls, faithful numeric result fields and unchanged simulation state. It prints synthetic evidence, never credentials.

The full original physics suite additionally needs pytest, matplotlib and cvxpy installed in the virtual environment. Run it from physical_core with python -m pytest tests -q. Existing npm run test:p7 and npm run test:p8 commands preserve their original replay/evaluation scope; they do not validate the new live AI agent.

## Research

Read [Agentic decision support for Chinese residential district heating](docs/industrial-research-2026.md) for the industrial scenario, 2026 research context, product priorities, evidence limits and a staged route to a real pilot.
