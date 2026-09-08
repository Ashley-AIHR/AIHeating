# P0.3 Final Acceptance

P0.3 completed as a focused frontend consistency patch. Phase 1A has not started.

## Fixed items

- Removed the Overview page’s independent current-time display; the shared header is the only current simulation-time display.
- Added Forecast target-time derivation from forecastAsOf plus horizon.
- Changed endpoint distribution title to use the Forecast target time.
- Removed the duplicated Secondary Heating Network label inside the Network Map SVG.
- Added localized five-state Thermal State legend using the same building colors.
- Replaced the Simulation page’s Forecast subtitle with Simulation-specific copy.

## Canonical time confirmation

The single current-time source remains App state simulationTime, initialized and reset to 08:00. Forecast receives forecastAsOf from that state. Overview has no independent timestamp; any page-level time is rendered from simulationTime. No App component references scenario.currentTime or contains a static 10:00 current-time literal.

## Forecast target-time confirmation

getForecastTargetTime is domain-owned:

- 08:00 + 6 hours = 14:00
- 10:00 + 6 hours = 16:00
- 08:00 + 24 hours = +1d 08:00
- 08:00 + 48 hours = +2d 08:00

The 6-hour Forecast screenshot shows Forecast as of 08:00 and Predicted Indoor Temperature Distribution at Forecast Target · 14:00.

## Network Map label and legend confirmation

The SVG now shows only Primary Network and Heating Substation near the station. The component title remains outside the SVG. The compact legend retains Supply (Hot) and Return (Cold), and adds Cold, Cool, Comfort, Warm, and Overheated with temperature ranges. English and Chinese labels are dictionary-backed.

Estimated Transport Delay remains visible as a structured Near / Mid / Far group.

## Simulation subtitle confirmation

English uses: Explore the digital twin playback and see how heating controls affect the secondary network.

Chinese uses: 通过数字孪生回放观察供热控制对二次网和建筑状态的影响。

The Simulation page no longer reuses Forecast description copy.

## Final screenshots

- [Overview — Chinese](/Users/yl/Documents/Codex/Heat/p0-screenshots/p0.3-overview-zh.png)
- [Forecast — English — Next 6 Hours](/Users/yl/Documents/Codex/Heat/p0-screenshots/p0.3-forecast-6h-en.png)
- [Simulation — English — AI Optimised](/Users/yl/Documents/Codex/Heat/p0-screenshots/p0.3-simulation-optimised-en.png)

All were captured at the same 1672 × 941 desktop viewport. Runtime assertions confirmed the target timestamp, Thermal State legend, corrected subtitle, MPC Active, Auto-applied, and absence of Apply in Optimised mode.

## Regression and validation results

- npx tsc --noEmit — exit code 0; no diagnostics.
- npm run test — exit code 0; 62 passed, 0 failed, 0 skipped.
- npm run build — exit code 0; TypeScript build and Vite production build succeeded, 19 modules transformed.
- node scripts/capture-p0.mjs — exit code 0; 3 final P0.3 screenshots captured.

## Remaining non-blocking issues

P0 remains fixture-backed and intentionally has no physical simulation, prediction, MPC, backend, real equipment control, or AI Tutor. Pixel-perfect parity is not claimed. These are intentional P0 boundaries, not blockers.

## Final self-assessment

No blocking issues identified. Existing P0 frozen behaviors were preserved, including canonical 08:00 initialization, endpoint risk semantics, control-mode behavior, equipment limits, timestep contracts, API seam separation, and EN/ZH parity.

P0 Acceptance: PASS WITH NON-BLOCKING ISSUES
