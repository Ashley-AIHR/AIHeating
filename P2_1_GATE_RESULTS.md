# P2.1 Gate and Regression Results

**Numerical/regression checks PASS; fixture corrective acceptance FAIL.** Do not confuse a physically consistent model with a resolved control-authority problem.

## Allocation Gates

| Gate | Requirement | Measured | Threshold | Result |
| --- | --- | --- | --- | --- |
| GFA1 | Zone mass conservation | {"allFiveFrames":1440,"maxRelativeResidual":1.4338946509806438e-16} | <1e-6 | PASS |
| GFA2 | Design-load proportionality | {"maxAbsoluteShareResidual":5.551115123125783e-17} | <1e-14 | PASS |
| GFA3 | Same-area insulation differentiation | {"high":"B02","low":"B03","areaM2":980,"internalGainW":2940,"highWeightW":24402,"lowWeightW":51744} | B03 load/share > B02, otherwise same design area/internal gains | PASS |
| GFA4 | No benchmark-derived weights | {"imports":["dataclasses","parameters"],"generationArguments":["static profile"],"sourceHash":"9b442074d15c2291d5966282766ad7edbe5b81616478921d152ddc3c543f4070","noBenchmarkOrIO":true} | static profile/constants only | PASS |
| GFA5 | Determinism | {"firstWeights":{"B01":29880,"B02":24402,"B03":51744,"B04":27390,"B05":41030,"B06":39165,"B07":34316,"B08":44014,"B09":47520,"B10":39165,"B11":48490,"B12":42895},"repeatWeights":{"B01":29880,"B02":24402,"B03":51744,"B04":27390,"B05":41030,"B06":39165,"B07":34316,"B08":44014,"B09":47520,"B10":39165,"B11":48490,"B12":42895},"sha256":"e1bf16be21ef3980e8baaa1128d56ae54ec8720479c61cd2998af580904f22b5"} | exact equality | PASS |

## Accepted P1A Gates on v1.1

| Gate | Description | Result |
| --- | --- | --- |
| H1 | Station volumetric mass balance | PASS |
| H2 | Nonlinear equations converge at all four operating points | PASS |
| H3 | Fixed-frequency coupled Near valve opening (fixture-specific) | PASS |
| H4 | Reverse coupling | PASS |
| H5 | Pump frequency causality | PASS |
| D1 | Nominal +5°C transport step and delay ordering | PASS |
| D2 | Flow-dependent Far transport delay | PASS |
| D3 | FIFO volume/enthalpy under changing flow, long step, zero flow | PASS |
| R1 | Nonnegative radiator heat | PASS |
| R2 | Heating return bounded by indoor and supply | PASS |
| R3 | Radiator water-side energy balance | PASS |
| R4 | Zero and near-zero flow stability | PASS |
| T1 | Colder outdoor increases envelope loss and required load | PASS |
| T2 | Solar reduces required load | PASS |
| T3 | Delivered supply temperature increases emitter heat | PASS |
| T4 | Emitter monotone flow response to UA limit | PASS |
| T5 | Insulation reduces steady envelope loss | PASS |
| T6 | Physical window input increases loss and lowers temperature tendency | PASS |
| C1 | Station and zone-to-building mass balance | PASS |
| C3 | Flow-weighted station delivered water heat equals emitters | PASS |
| C4 | Source input minus delivered heat equals pipe storage | PASS |
| C5 | Exact 1R1C energy storage equals net gains/losses | PASS |
| C2 | Every zone water heat equals allocated building emitter heat | PASS |
| I1 | Transport response precedes gradual indoor response | PASS |
| N1 | 24h numerical stability | PASS |
| N2 | 5 vs 10 min smooth-forcing consistency | PASS |
| N3 | Deterministic repeatability | PASS |
| N4 | 15-minute stability | PASS |
| E1 | Early parameter/equipment/rate validation | PASS |
| E2 | Physical step and control interval are independent | PASS |
| S1 | Solver nonconvergence is explicit, no invented flow | PASS |
| P1 | Frozen SimulationFrameResponse and imported P0 types | PASS |

32 passed, 0 failed, 0 skipped. Full actual inputs, measurements and unchanged thresholds: `p2_1_p1a_gate_results.json`.

## Accepted P2 Gates on v1.1

| Gate | Description | Result |
| --- | --- | --- |
| G2.1 | Weather compensation monotonicity | PASS |
| G2.2 | Pump policy monotonicity | PASS |
| G2.3 | Absolute equipment bounds | PASS |
| G2.4 | Rate limits, 30-minute interval and fixed runtime valves | PASS |
| G2.5 | No future-weather leakage | PASS |
| G2.6 | No indoor/prediction/AI feedback | PASS |
| G2.7 | Warm-up excluded from official metrics | PASS |
| G2.8 | Warm-up convergence and documented fallback | PASS |
| G2.9 | Normal Winter adequacy | PASS |
| G2.10 | Cold-wave causality | PASS |
| G2.11 | Rapid-warming causality | PASS |
| G2.12 | Solar cannot influence conventional actions | PASS |
| G2.13 | Imbalance is a physical resistance disturbance | PASS |
| G2.14 | Five 24-hour evaluations remain physically stable | PASS |
| G2.15 | Reproducibility from identical serialized evaluation state | PASS |
| G2.16 | Controller state serialization | PASS |
| G2.17 | Common physical initial-state export | PASS |
| G2.18 | Complete accepted P1A regression and immutable physics | PASS |
| G2.19 | Frozen P0 regression | PASS |
| G2.20 | No forbidden controller dependencies or scenario branches | PASS |

20 passed, 0 failed, 0 skipped. Full measured evidence: `p2_1_p2_gate_results.json`. G2.9 is the original ≥95% compliance/solver adequacy test, not a new severe-overheat acceptance test.

## How the unchanged suites use v1.1

`run_p2_1_regression.py` rebinds only parameter factories in process memory before pytest collection; source files and assertions remain unchanged. For the legacy P2 Gate function, its config/scenario input providers are rebound to the explicit candidate config/scenarios because it has no argument-based injection seam. Child pytest invocations use the same fixture wrapper. The physical `step`, hydraulics, transport, NTU and 1R1C functions, controller, metrics and Gate thresholds are never replaced. The untouched historical/default suite is also run separately. Components with independent fixture-free inputs (e.g. zero-flow NTU/transport tests) retain those test inputs. Versioned parameter/scenario identity is checked in candidate diagnostics and exports, not by pretending the old tests' textual config IDs were new releases.

## Actual commands and outputs

### New fixture tests

`/Users/yl/Documents/Codex/Heat/physical_core/.venv/bin/python -m pytest physical_core/tests/test_physical_fixture_v1_1.py -q`

Exit 0; passed 9; failed 0; skipped 0.

```text
.........                                                                [100%]
9 passed in 0.15s
```

### Historical/default full Python regression

`/Users/yl/Documents/Codex/Heat/physical_core/.venv/bin/python -m pytest physical_core/tests -q`

Exit 0; passed 127; failed 0; skipped 0.

```text
........................................................................ [ 56%]
.......................................................                  [100%]
127 passed in 3.12s
```

### P1A Gates with v1.1 fixture

`/Users/yl/Documents/Codex/Heat/physical_core/.venv/bin/python physical_core/scripts/run_p2_1_regression.py gates-p1a`

Exit 0; passed 32; failed 0; skipped 0.

```text
P1A Gates under v1.1: 32 passed, 0 failed, 0 skipped
```

### P2 Gates with v1.1 fixture and nested regressions

`/Users/yl/Documents/Codex/Heat/physical_core/.venv/bin/python physical_core/scripts/run_p2_1_regression.py gates-p2`

Exit 0; passed 20; failed 0; skipped 0.

```text
P2 tests: exit 0; {'passed': 34, 'failed': 0, 'skipped': 0}
P1A tests: exit 0; {'passed': 84, 'failed': 0, 'skipped': 0}
P0 typecheck: exit 0; {'passed': 0, 'failed': 0, 'skipped': 0}
P0 tests: exit 0; {'passed': 62, 'failed': 0, 'skipped': 0}
P0 build: exit 0; {'passed': 0, 'failed': 0, 'skipped': 0}
P2 Gates under v1.1: 20 passed, 0 failed, 0 skipped
```

### P2 tests

`/Users/yl/Documents/Codex/Heat/physical_core/.venv/bin/python /Users/yl/Documents/Codex/Heat/physical_core/scripts/run_p2_1_regression.py p2`

Exit 0; passed 34; failed 0; skipped 0.

```text
Fixture override: physical-fixture-v1.1; assertions/thresholds unchanged
..................................                                       [100%]
34 passed in 2.69s
```

### P1A tests

`/Users/yl/Documents/Codex/Heat/physical_core/.venv/bin/python /Users/yl/Documents/Codex/Heat/physical_core/scripts/run_p2_1_regression.py p1a`

Exit 0; passed 84; failed 0; skipped 0.

```text
Fixture override: physical-fixture-v1.1; assertions/thresholds unchanged
........................................................................ [ 85%]
............                                                             [100%]
84 passed in 0.35s
```

### P0 typecheck

`npx tsc --noEmit`

Exit 0; passed N/A; failed 0; skipped 0.

```text
(no output)
```

### P0 tests

`npm run test`

Exit 0; passed 62; failed 0; skipped 0.

```text
> ai-heating-optimisation-digital-twin@0.1.0 test
> tsx scripts/p0-invariants.ts

P0 invariant tests: 62 passed, 0 failed, 0 skipped
```

### P0 build

`npm run build`

Exit 0; passed N/A; failed 0; skipped 0.

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

✓ built in 50ms
```

## Engineering review expectations (separate from legacy Gates)

| Expectation | Measured | Assessment |
| --- | --- | --- |
| Normal compliance ≥95% | 100% | PASS |
| No new underheating population | Normal 0%; all stress underheating no worse | PASS |
| Design-load proportionality / deterministic generation | GFA1–GFA5 all pass | PASS |
| Severe overheating materially decreases | 25% → 25%; same B01/B02/B04 all day | NOT RESOLVED |
| Temperature spread materially improves | 10.2697 → 8.9674°C (12.68% narrower) | PARTIAL improvement |
| Persistent structural pattern reduced or explained | Unreduced; explained by NTU/UA and empty Near interval | EXPLAINED, not resolved |
| Candidate baseline promotion | Normal comfort 0%; Near interval empty | FAIL / EXTERNAL REVIEW HOLD |

All 99 captured v1.0 historical file hashes remain unchanged; existing freeze verification reports no errors. No technical threshold was reduced and no acceptance success is inferred from passing regression alone.

