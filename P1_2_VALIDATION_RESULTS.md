# P1.2 Validation Results

Sizing: 7/7 PASS. P1A: 32/32 PASS. P2: 20/20 PASS.

Historical preservation ledger: 170 files checked; changed: `[]`.

## Actual commands

| Check | Exit | Passed | Failed | Skipped | Command |
| --- | ---: | ---: | ---: | ---: | --- |
| P1.2 tests | 0 | 4 | 0 | 0 | `/Users/yl/Documents/Codex/Heat/physical_core/.venv/bin/python3 -m pytest physical_core/tests/test_physical_fixture_v1_2.py -q` |
| P2 tests | 0 | 34 | 0 | 0 | `/Users/yl/Documents/Codex/Heat/physical_core/.venv/bin/python3 /Users/yl/Documents/Codex/Heat/physical_core/scripts/run_p1_2_regression.py p2` |
| P1A tests | 0 | 84 | 0 | 0 | `/Users/yl/Documents/Codex/Heat/physical_core/.venv/bin/python3 /Users/yl/Documents/Codex/Heat/physical_core/scripts/run_p1_2_regression.py p1a` |
| P0 typecheck | 0 | None | 0 | 0 | `npx tsc --noEmit` |
| P0 tests | 0 | 62 | 0 | 0 | `npm run test` |
| P0 build | 0 | None | 0 | 0 | `npm run build` |

No accepted threshold was weakened and no baseline freeze manifest was created.
