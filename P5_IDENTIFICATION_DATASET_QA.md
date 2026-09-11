# P5 Identification Dataset QA

## Result

All 31 site histories were accepted on their first deterministic design. No design was discarded, resampled or backed off. The minimum indoor temperature was 19.2024°C, so the predefined `<18°C` backoff was not invoked.

| Check | Measured | Result |
|---|---:|---|
| Development / validation / test / base sites | 20 / 5 / 5 / 1 | PASS |
| Persistent physical parameter hashes | 31 unique for 31 sites | PASS |
| Attempted designs | 31, all recorded and accepted | PASS |
| Hashed data files | 93 | PASS |
| Maximum conservation residual | 1.564e-13 | PASS |
| Maximum mass residual | 2.512e-16 | PASS |
| Solver failures / nonfinite histories | 0 / 0 | PASS |
| Maximum supply step | 2.0°C / 30 min | PASS |
| Maximum pump step | 2.0 Hz / 30 min | PASS |
| Maximum valve step | 5.0 pp / 30 min | PASS |
| Canonical IDs in calibration | none | PASS |

The calibration/evaluation windows are days 1–4 and 5–6 for every site. Site IDs are disjoint across development, validation and TEST. Truth and observable views are physically separated; observable headers contain no class-F fields. Every manifest hash reproduces its shard. P5-D1 through P5-D10 pass.
