# Phase 2 Implementation Plan

## Accepted interfaces and protection

Reuse `SimulationEngine.step(Weather, Controls)`, validated `Controls`/`LIMITS`, synthetic `Parameters`, nonlinear `solve_hydraulics`, independent `DelayLine` inventories, and `Frame` thermal/energy diagnostics. Preserve all P1A modules/tests, parameters and reports byte-for-byte; preimplementation hashes are captured in `p2_accepted_p1a_manifest.json`. P0 domain/UI/seams remain frozen. Existing `scenarios.py` is a module, so new scenarios go in `p2_scenarios.py`, not an incompatible replacement package.

Reviewed SPEC v1.2 baseline/equipment sections, accepted P1A architecture/results, P0 seams, and the supplied end-to-end requirement/test plan. The detailed P2 prompt's 72/96h burn-in supersedes the earlier plan's suggested 24–48h. No physics conflict identified.

## Controller architecture and curves

Add `control/traditional.py`: immutable config and serializable state; current elapsed timestamp, current outdoor temperature, state and config only. Piecewise linear supply/pump breakpoints exactly as recommended initially: outdoor −15/−10/−5/0/5/10°C; supply 58/55/51/47/43/40°C; pump 48/46/44/42/38/34 Hz. Clamp outside breakpoint domain to endpoints. Raw and applied targets remain separate. Recalculate only at 1800-second boundaries, move at most 2°C/2 Hz, hold between boundaries. Fixed valve fractions never move at runtime. No scene name, solar, indoor state, load or future input enters controller code.

## One-time commissioning

Add `control/commissioning.py`. Use accepted static zone heated-area shares at 45 Hz. Fix the most resistive branch at 85% opening to retain valve headroom; derive other branch resistances from equal design ΔP and target share ratios, then round openings to practical 5-percentage-point increments. Verify the result with the actual coupled solver and report before/after normalized share error. This is a one-time static engineering calculation, not runtime feedback or optimization. The most restrictive branch is selected from static resistance, not a scenario identifier.

## Adequacy and tuning boundary

First run only Normal Winter and Cold Wave with recommended curves. Define normal adequacy before measurement: ≥95% building-time compliance, finite/stable physical states and no malfunction; comfort/overheating/min/max are disclosed, not optimized into narrow bands. If insufficient, one documented engineering revision to cold-weather supply breakpoints may be evaluated using only those two permitted scenarios. No tuning to Rapid Warming, Sunny Winter or Hydraulic Imbalance. If adequate operation is not achievable without accepted-physics changes, report the issue rather than alter physics.

## Warm-up and scenario state

Use deterministic repeated daily prehistory for each scenario, same controller and physical steps, for 72h. Normal uses its own daily cycle; stress cases use a documented benign pre-event cycle matching their starting weather. Compare Normal 72 vs 96h endpoint temperatures (<0.2°C unchanged); select 96h if necessary and also check 96 vs 120h to substantiate the fallback. Compare flow, return, delivered supply and packet inventories.

Initialize the existing engine's public elapsed-state coordinate at −warmup_seconds, so normal stepping ends exactly at evaluation time 0 (Jan 15 08:00). Negative prehistory timestamps represent earlier dates; no physics clock algorithm changes. Preserve cumulative energies and subtract evaluation-start offsets for official metrics. Export all dynamic state: clock/dt/controls, temperatures, previous hydraulic flows, exact ordered FIFO packets and delivery/flow diagnostics, cumulative energies, controller raw/applied targets and last/next boundary, version and parameter/config hashes. Reload via a P2 state adapter into unmodified P1A; test full-run forks and first-frame identity.

## Five scenarios

Exactly five explicit, versioned 24h families, all deterministic, no random seed: Normal Winter (−8 to −2°C, moderate solar); Cold Wave (−5 to −14°C); Rapid Warming (−8 to +5°C, solar peak 480 W/m²); Sunny Winter (−6 to 0°C, strong solar); Hydraulic Imbalance (normal weather, Far pipe resistance ×2 during evaluation with unchanged commissioned valves). The hydraulic disturbance occurs at the evaluation boundary after common healthy-network warm-up; no indoor state or flow is overwritten. Export manifests and physical overrides.

## Runner and metrics

Add `benchmark/runner.py`, `state.py`, `metrics.py`, plus export/gate scripts. At each 5-minute step feed current-time weather to the controller at a 30-minute boundary; physics receives the same current-time sample held for that interval. No midpoint future sample enters the controller. Support 10/15-minute physical steps without changing the 30-minute interval.

Metrics: endpoint building-time fractions (equally weighted buildings, dt-weighted time) at ≥18, 20–22 inclusive, >23, >25, <18°C; minimum/maximum; lower-order-statistic P10/P50/P90 compatible with P0; summary percentiles over pooled evaluation building-time samples. Heat/pump energy integrate frame-average W×dt with SI conversions. Excess delivered heat=max(0,actual−instantaneous required), integrated and labeled diagnostically, never called savings. Optional hydraulic index=1−0.5Σ|actual zone share−static target share|, dt-weighted across evaluation, explicitly a synthetic metric.

## Tests and Gates

Implement tests before/together with code: G2.1–G2.2 curve monotonicity; G2.3–G2.4 bounds/rates/fixed valves and hold interval; G2.5–G2.6 future/indoor/AI independence; G2.7–G2.8 warm-up exclusion/convergence; G2.9 adequacy; G2.10–G2.12 cold/warm/solar causality; G2.13 physical resistance disturbance; G2.14 stability/conservation; G2.15 repeated serialized runs; G2.16–G2.17 state restoration; G2.18 full accepted P1A tests + 32 Gates; G2.19 P0 checks; G2.20 source/dependency audit. No threshold weakening. Generate measured Markdown/JSON Gate evidence.

## Freeze and regression

Only after adequacy, fairness review and all 20 Gates pass, publish local immutable config JSON and freeze manifest with controller/config/code hashes, accepted physics/parameters, commissioning, scenarios, metrics/warm-up versions, initial states, summaries/CSVs and test results. Validate hashes after writing; refuse to overwrite a different existing freeze. Test tamper detection and config/state round trips. Run pytest P2, P1A regression, P1A Gate functions, P0 typecheck/test/build with actual command logs. No new dependency is required. Export five small scenario CSVs and six engineering plots per scenario, then final engineering/fairness reports. Stop before P3.
