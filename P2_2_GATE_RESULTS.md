# P2.2 — Gate and Regression Results

**Diagnostic validation: 17 PASS, 0 FAIL, 0 SKIPPED. Decision: Path C. No baseline promotion.**

A passing diagnostic Gate means the requested result is established and checked, not that the fixture is hard-feasible at both conditions. F7 passes because the −10°C answer is explicitly negative with supporting proof.

## F1–F17

| Gate | Requirement | Actual evidence | Threshold / acceptance check | Result |
| --- | --- | --- | --- | --- |
| F1 | Legal envelope coverage | 8,250 coarse points/case; endpoints covered; 0.5°C/1 Hz/5pp refinement; independent seeds 7/23. | whole legal box; 8250 grid points/case and global bounded search | PASS |
| F2 | Accepted coupled solver backs candidate flows | 233,702 evaluations; 175,644 distinct coupled hydraulic calls; max residual 1.171085e−12. | nonzero actual solver calls; normalized residual <1e-8; no manual candidate flows | PASS |
| F3 | All accepted witnesses/settings obey bounds | 16 selected best points independently replayed; all evaluations validate equipment bounds. | Controls validation on every evaluation | PASS |
| F4 | Exact thermal-equilibrium substitution | Max absolute heat-balance residual 3.637979e−11 W. | absolute residual <1e-6 W | PASS |
| F5 | No coarse-grid-only infeasibility claim | 16 objective classifications agree across stages; every negative has a complete interval exclusion. 16/32 DE runs reached their generation cap. | stage conclusions agree; every negative conclusion has a conservative interval certificate, not an optimizer success claim | PASS |
| F6 | Whole-system 18–25°C result at -5°C | Legal witness: 56.5°C, 30 Hz, 20/50/75% valves; indoor 18.302245–24.702527°C. | explicit witness or certified impossibility | PASS |
| F7 | Whole-system 18–25°C result at -10°C | Near interval exclusion proves no hard-feasible point; best found violation 0.583716°C. | explicit witness or certified impossibility | PASS |
| F8 | Whole-system 20–22°C independent result | Both cases lack all-building comfort feasibility; best found violations 2.085637/2.921046°C, with zone exclusion proofs. | two explicit independently optimized results | PASS |
| F9 | Independent zone-level feasibility | 12 independent zone/case/band results; Near cold hard conflict; Near/Far narrow comfort conflicts. | 3 zones × 2 cases × 2 bands; coupled solver still used | PASS |
| F10 | Zone design-load share arithmetic | 133,416 / 158,525 / 178,070 W; total 470,011 W; normalized-share arithmetic residual 0. | normalized sums, no solar | PASS |
| F11 | Same commissioning implementation, different target only | Same commission(), 45 Hz, 85% anchor, 5pp rounding; shadow 35/55/85%; original physical flows rechecked. | same function/45Hz/85% anchor/5pp rounding; original physical hydraulics rechecked | PASS |
| F12 | All accepted physical profiles/equations unchanged | 170 historical files unchanged; current, search and shadow parameter hashes match. | all hashes unchanged; same physical-fixture-v1.1 | PASS |
| F13 | Traditional policy remains unchanged | Only isolated shadow identity and fixed-valve configuration differ; original source/config files unchanged. | no curve/rate/interval/mode changes | PASS |
| F14 | Two stable reproducible shadow runs | Two exact 288-frame CSV/summary replays; zero solver failures; conservation assertions enabled. | 288 frames/case, zero solver failures, exact replay; engine enforces conservation | PASS |
| F15 | Full accepted P1A tests and Gates | 84 tests and 32 original Gates pass on v1.1 inputs; unchanged assertions/thresholds. | 84 tests, 32 Gates, no failures | PASS |
| F16 | Full accepted P2 tests and Gates | 34 tests and 20 original Gates pass on v1.1 candidate inputs; unchanged assertions/thresholds. | 34 tests, 20 Gates, no failures | PASS |
| F17 | P0 typecheck/test/build | Typecheck exit 0; tests 62 passed/0 failed/0 skipped; production build exit 0. | all three commands exit 0; frozen source unchanged | PASS |

The search samples the entire legal box; finite samples alone do not exhaust a continuum. Negative conclusions additionally use monotone interval exclusion covering a conservative superset of legal zone flows. This proves nonexistence of zero violation, not the exact positive global optimum. The generation-cap stop flags are disclosed, not relabelled convergence.

## Actual runner commands

From `/Users/yl/Documents/Codex/Heat`:

```sh
physical_core/.venv/bin/python physical_core/scripts/run_p2_2_static_search.py
physical_core/.venv/bin/python physical_core/scripts/run_p2_2_shadow.py
physical_core/.venv/bin/python physical_core/scripts/run_p2_2_gates.py
```

Each exited **0**. The first two export diagnostic evidence only. The Gate runner executes the child commands below and calls the original P1A `evaluate_gates()` and P2 `evaluate_p2()` functions without invoking their historical-report-writing mains.

Actual final Gate-runner output:

```text
P2.2 Gates: 17 passed, 0 failed, 0 skipped; Path C; no baseline freeze
```

P1A Gates: **32/32 PASS**, 0 failed/skipped. P2 Gates: **20/20 PASS**, 0 failed/skipped. All original per-Gate measured values and thresholds are preserved under `P1AGates` and `P2Gates` in [p2_2_gate_results.json](p2_2_gate_results.json).

The existing v1.1 fixture-context adapter changes parameter/scenario providers, not test assertions or physical equations. P2 Gate inputs use the area-zone-commissioned v1.1 candidate; F14 separately verifies shadow runs. The existing `run_p2_1_regression.py p1a/p2` entry points only run tests. No historical report is rewritten.

## Actual child command output

### P2.2 tests

Command:

```sh
/Users/yl/Documents/Codex/Heat/physical_core/.venv/bin/python -m pytest physical_core/tests/test_p2_2_analysis.py -q
```

Exit: **0**. Tests passed: **20**; failed: **0**; skipped: **0**.

Captured output:

```text
....................                                                     [100%]
20 passed in 0.16s
```

### P2 tests

Command:

```sh
/Users/yl/Documents/Codex/Heat/physical_core/.venv/bin/python /Users/yl/Documents/Codex/Heat/physical_core/scripts/run_p2_1_regression.py p2
```

Exit: **0**. Tests passed: **34**; failed: **0**; skipped: **0**.

Captured output:

```text
Fixture override: physical-fixture-v1.1; assertions/thresholds unchanged
..................................                                       [100%]
34 passed in 2.79s
```

### P1A tests

Command:

```sh
/Users/yl/Documents/Codex/Heat/physical_core/.venv/bin/python /Users/yl/Documents/Codex/Heat/physical_core/scripts/run_p2_1_regression.py p1a
```

Exit: **0**. Tests passed: **84**; failed: **0**; skipped: **0**.

Captured output:

```text
Fixture override: physical-fixture-v1.1; assertions/thresholds unchanged
........................................................................ [ 85%]
............                                                             [100%]
84 passed in 0.35s
```

### P0 typecheck

Command:

```sh
npx tsc --noEmit
```

Exit: **0**. Tests passed: **N/A (not a test command)**; failed: **0**; skipped: **0**.

Captured stdout/stderr: empty (successful typecheck).

### P0 tests

Command:

```sh
npm run test
```

Exit: **0**. Tests passed: **62**; failed: **0**; skipped: **0**.

Captured output:

```text

> ai-heating-optimisation-digital-twin@0.1.0 test
> tsx scripts/p0-invariants.ts

P0 invariant tests: 62 passed, 0 failed, 0 skipped
```

### P0 build

Command:

```sh
npm run build
```

Exit: **0**. Tests passed: **N/A (not a test command)**; failed: **0**; skipped: **0**.

Captured output:

```text

> ai-heating-optimisation-digital-twin@0.1.0 build
> tsc -b && vite build

vite v8.2.2 building client environment for production...
transforming...
✓ 19 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.47 kB │ gzip:  0.30 kB
dist/assets/index-C2i2aTou.css   17.11 kB │ gzip:  4.67 kB
dist/assets/index-Dx143W9w.js   252.56 kB │ gzip: 78.48 kB

✓ built in 63ms
```

## Test coverage and preservation

The 20 new tests cover exact static equilibrium versus the initialized accepted dynamic engine, bounds, independent band semantics, zone-versus-whole distinctions, a legal −5°C witness, interval exclusion coverage, no false certificate for a feasible zone, hydraulic cache input identity, design-load arithmetic, commissioning reuse and physical input immutability.

Total executed tests: **200 (20 + 84 + 34 + 62), 0 failed, 0 skipped**. Gate counts are separate.

Post-regression historical-file comparison returned `[]`: zero changes across 170 files. The physical-fixture-v1.1 canonical parameter hash remains:

```text
bd4b142e38b7c85a2749c34d129efdfe6f44d4c1f9bd9943cac7b4c7357c0260
```

`p2_2_historical_hashes.json` is an input-preservation ledger, **not a baseline freeze manifest**. P0 source, accepted equations, v1.1 allocation weights, original controller config and historical evidence remain untouched. Existing unrelated working-tree changes are retained.

## Engineering status

Analysis and regression checks pass. P2 baseline remains **HOLD**; P2.1 corrective acceptance is not upgraded. Coherent emitter sizing is only a recommendation for external decision. No UA/R/C, controller, commissioning default, UI, P3, prediction or MPC change is made.

