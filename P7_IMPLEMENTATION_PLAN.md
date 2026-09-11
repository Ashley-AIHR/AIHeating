# P7 Implementation Plan

Status before coding: P6 gates 40/40, P6 regression PASS, P6 registry errors none, P2/P1A freeze errors before/after none.

## Frozen boundary

P7 will not edit P1A physics, P2/P3/P4/P5/P6 models, configurations, registries, benchmark results or canonical scenario definitions. Their current SHA-256 identities will be checked before and after integration.

## Minimal implementation

1. Generate one immutable P7 runtime payload from accepted P4/P5/P6 artifacts; frontend code will only format it.
2. Add one typed P7 provider module exposing simulation, load prediction, thermal prediction, optimisation, results, scenario and application-state seams from that shared payload.
3. Replace the active Preview UI path with Formal MPC v1 while retaining Preview only as a labelled historical comparator.
4. Add one reusable status component and explicit optimisation, verification, fallback, safety and application states.
5. Preserve the existing Overview, Forecast, Simulation, Results and Settings structure, modes and EN/ZH navigation.
6. Add provider/state invariant tests, EN/ZH browser tests and screenshots, then run the full P7→P0 regression.

No new algorithm, tuning, training, calibration, customer-editable engineering constant, production claim or P8 work is in scope.
