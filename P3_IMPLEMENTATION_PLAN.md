# P3 Implementation Plan

## Frozen boundary

Verify `P2_BASELINE_FREEZE_MANIFEST_v1.2.json` before pilot and official generation. Treat the accepted fixture, physics, Traditional controller, commissioned valves, five canonical scenarios, warm-up mechanics, metrics, and P0 contracts as read-only inputs.

## Dataset factory

1. Derive coherent parameter sets from `physical-fixture-v1.2` with deterministic per-episode seeds.
2. Create explicit exogenous variants of the five frozen scenario families without forcing physical responses.
3. Run the accepted engine with `traditional-v1.2` and a single measured global warm-up policy.
4. Write per-episode, per-table deterministic gzip CSV shards plus content-addressed manifests.
5. Generate separated synthetic forecasts and future-truth label tables.
6. Validate schemas, time grids, targets, physical residuals, bounds, split identities, canonical isolation, and replay.

## Execution gate

Generate 15 pilot episodes and run A1–A15. Continue to the fixed 505-episode population only if every A gate passes. Record a generation failure immediately; never silently replace a failed descriptor. Finish with B1–B14, leakage audit, statistics, regressions, and reports. No P4/P5 model or controller work is in scope.
