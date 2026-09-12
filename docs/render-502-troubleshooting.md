# Render 502 recovery

If `/api/config` or `/api/health` returns 502, Render has no application process listening on its assigned port. This is a service startup/configuration failure, before the browser or OpenRouter is involved.

The canonical settings are:

- Runtime: Node
- Node version: 24.14.1
- Build Command: `npm ci && npm run build`
- Start Command: `npm start`
- Health Check Path: `/api/health`

The previous release used `npm run preview`, which launched Vite's preview listener and did not start the API service. This repository now keeps `npm run preview` as a compatibility alias for `npm start`, so an existing service with the old command can recover after rebuilding commit `7b614fd` or later. Render dashboard settings should still be changed to `npm start` because Blueprint changes do not necessarily rewrite an existing service's settings.

After saving settings, trigger a manual deploy from the `main` branch and inspect the deploy log. The expected startup line is `Heatpilot listening on port ...`. Then check `/api/health`, which reports `runtime: node` and `physicalWorker: node:worker_threads`. If the log shows no startup line, the build or start command is still wrong; if it shows the line and health remains unavailable, share the service log's first Node error.
