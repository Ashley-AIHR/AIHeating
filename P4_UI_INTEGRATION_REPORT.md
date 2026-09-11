# P4 UI Integration Report

The existing P0 application was extended, not redesigned. `src/p4-provider.ts` is the stable adapter over the generated P4 payload.

- Overview shows NOW → FORECAST → PREDICT → OPTIMISE → VERIFY and a one-click Rapid Warming entry.
- Forecast shows provider-backed issued weather, formal 1h/2h/3h/6h load predictions, intervals and recommended controls.
- Simulation retains the P0 `traditional | advisory | optimised` enum semantics while the visible optimised label and recommendation are the provider-backed Predictive Preview.
- Results shows the same provider-backed canonical Rapid Warming and test model evidence.
- Overview, Forecast and Results use the same simulation/forecast time `2025-01-15 10:30 +08:00`; forecast targets come from the same issued forecast.
- EN/ZH keys remain complete. Visible copy says Simulation Environment and Preview Optimiser v0—not final MPC—and makes no production, autonomous-control or real-site-savings claim.

Verification: TypeScript/build passed, P0 invariants passed 62/62, and P4 UI/provider invariants passed 20/20. Runtime screenshots are recorded with the final regression evidence.

