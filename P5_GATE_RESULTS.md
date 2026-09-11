# P5 Gate Results

## Outcome

All 32 predeclared P5 gates pass: P5-I1–I10, P5-C1–C12 and P5-D1–D10. No gate was relaxed after TEST.

| Group | Passed | Failed | Skipped |
|---|---:|---:|---:|
| Identifiability P5-I1–I10 | 10 | 0 | 0 |
| Calibration/prediction P5-C1–C12 | 12 | 0 | 0 |
| Identification dataset P5-D1–D10 | 10 | 0 | 0 |
| Total | 32 | 0 | 0 |

Key measured margins are: selected Jacobian rank 2/2, condition number 8.581, H/C correlation 0.402; deterministic repeated parameter delta 0; 3h/6h Oracle MAE `0.0090/0.0144°C`; worst-building 3h/6h MAE `0.0142/0.0235°C`; transport-aligned 3h MAE `0.0090°C` versus intentionally wrong same-time station-supply `0.0204°C`; and all seven physical counterfactuals passing.

## Regression evidence

| Command | Exit | Passed | Failed | Skipped |
|---|---:|---:|---:|---:|
| `python -m pytest physical_core/tests/test_p5.py -q` | 0 | 10 | 0 | 0 |
| `python physical_core/scripts/run_p5_identifiability.py` | 0 | gate artifact | 0 | 0 |
| `python physical_core/scripts/run_p5_calibration.py` | 0 | 32 gates | 0 | 0 |
| `npx tsx scripts/p4-invariants.ts` | 0 | 20 | 0 | 0 |
| `python physical_core/scripts/run_p4_gates.py` | 0 | 32 | 0 | 0 |
| `python -m pytest physical_core/tests/test_p4.py -q` | 0 | 11 | 0 | 0 |
| `python -m pytest physical_core/tests/test_p3_dataset.py -q` | 0 | 7 | 0 | 0 |
| accepted v1.2 P2 regression | 0 | 34 | 0 | 0 |
| accepted v1.2 P1A regression | 0 | 84 | 0 | 0 |
| `npx tsc --noEmit` | 0 | N/A | 0 | 0 |
| `npm run test` | 0 | 62 | 0 | 0 |
| `npm run build` | 0 | N/A | 0 | 0 |

P2 freeze verification before and after has zero errors. P3 integrity errors, P2 integrity errors and P4 artifact hash errors are all empty. The inherited P4→P0 regression passes. One browser/UI run is explicitly skipped because P5 made no UI-visible change. Exact commands, exit codes, outputs and counts are stored in `p5_regression_results.json`; exact per-gate measurements are stored in `p5_gate_results.json`.

## Non-blocking limitations

Calibration and uncertainty remain synthetic; representative indoor sensors and configured flow shares are assumed; UA/solar/internal gains remain priors; TEST has zero underheat positives; 6h forecast intervals are mildly conservative; return transport remains deferred because it has no dependency path to indoor prediction. None violates a P5 gate.
