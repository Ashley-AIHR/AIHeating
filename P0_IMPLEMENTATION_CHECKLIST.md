# P0.1 Implementation Checklist

## Scope guard

- [x] SPEC v1.2 and four prototype images reviewed; SPEC/domain correctness takes priority over pixel fidelity.
- [x] Rapid Daytime Warming remains a static fixture: one substation, 12 radiator buildings, three zones, Jan 15 2025, −2°C baseline and 6-hour rise to 4.5°C.
- [x] No backend, physical solver, RC/2R2C runtime, transport solver, production MPC, PLC/DCS, real window detection, or AI Tutor was started.

## P0.1 corrections

- [x] Forecast 6/24/48 horizon selectors drive all Forecast surfaces through domain selectors.
- [x] Canonical 6-hour values are 2.18 MW required, 2.48 MW planned, and derived 0.30 MW avoidable oversupply.
- [x] All 12 buildings render in the Forecast table.
- [x] EN/ZH dictionaries are parity-tested; navigation, page copy, charts, legends, tables, warnings, events, settings and accessibility labels use localized keys.
- [x] Reset restores frame 0, 08:00, paused state, canonical network/building state, B03 selection, 6-hour context, no Advisory apply, and a clean reset event.
- [x] Traditional = comparison only; Advisory = manual Apply; Optimised = automatic apply with no Apply button.
- [x] Model Performance is explicitly heat-load prediction taxonomy; RC/2R2C is not presented as a model-comparison result.
- [x] Simulation Environment / fixture boundary is visible across routes.

## Validation

- [x] `npm run build` — TypeScript/Vite production build succeeded.
- [x] `npm run test` — 20 passed, 0 failed, 0 skipped.
- [x] `node scripts/capture-p0.mjs` — 9 screenshots captured; horizon, reset, and control-mode assertions passed.
- [x] Screenshot set includes Overview/Simulation/Forecast/Results English, Overview/Simulation Chinese, and Traditional/Advisory/Optimised Simulation modes.

No Phase 1A work was started. Stop for external review.
