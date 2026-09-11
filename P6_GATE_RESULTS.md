# P6 Gate Results

Result: **40 passed, 0 failed, 0 skipped**. The 39 required gates all passed; P6-S6 is an additional evidence gate requiring the near-boundary feasible case to be accepted with an active robust margin.

- Architecture: P6-A1…A6 — 6/6 PASS.
- Linearisation: P6-L1…L7 — 7/7 PASS.
- Optimisation: P6-O1…O10 — 10/10 PASS.
- Safety: P6-S1…S6 — 6/6 PASS.
- Benchmark: P6-B1…B11 — 11/11 PASS.

Regression also passed: P6 unit tests 5/5; P5 gates 32/32; P4 gates 32/32; P3 gates 14/14; P2 gates 20/20; P1A gates 32/32; P0 typecheck, test and build exit 0. P4 alignment invariants passed 15/15. Browser UI tests were skipped because P6 made no UI-visible change. P2/P1A frozen-file errors before and after were empty, and P6 registry hash errors were empty.

Machine evidence: `p6_gate_results.json` and `p6_regression_results.json`.
