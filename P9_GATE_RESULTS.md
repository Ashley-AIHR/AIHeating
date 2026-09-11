# P9 Gate Results

## Decision

All **33/33** required P9 gates pass; **0 failed, 0 skipped**. The release has non-blocking, explicitly documented limitations and is not production closed-loop ready.

| Group | Passed | Failed | Skipped | Evidence |
|---|---:|---:|---:|---|
| Freeze P9-F1…F6 | 6 | 0 | 0 | P0–P8 integrity and 171-artifact release manifest before/after; exact registries |
| Runtime P9-R1…R6 | 6 | 0 | 0 | active route/source audit, provider tests, five-run replay |
| Safety/status P9-S1…S7 | 7 | 0 | 0 | P7/P9 invariants and EN/ZH browser branches |
| Customer claims P9-C1…C6 | 6 | 0 | 0 | active-copy scan and customer claims review |
| Release P9-L1…L8 | 8 | 0 | 0 | TypeScript, frontend/build, inherited regression, browsers, clean environment, acceptance matrix |

## Regression evidence

- P9 core gates: 31/31; guided replay: 5/5 identical.
- P9 browser: 82/82 semantic/accessibility checks, EN/ZH, three modes, three state branches; 0 blocking failures.
- P8 isolated: 37 context/grounding/safety, 100 bilingual evaluation, 15 UI/provider, 38 Tutor gates; all pass without mutating P8 artifacts.
- P7: 36 integration/state and 23 UI/provider invariants; EN/ZH browser pass.
- P6/P5/P4/P3: 5/10/11/7 tests; P4 provider 20 and alignment 15; all pass.
- Physical Fixture/P2 adequacy: 5; P2 controller/canonical: 34; P1A: 84; all pass.
- P0: TypeScript pass, 62 invariants, production build pass.
- Clean temporary frontend: exact-lockfile offline install, P0 tests and production build all exit 0.

## Non-blocking observations

The 900×800 viewport records horizontal overflow (1186px content width) on all five routes. The customer-demo 1672×941 and common-laptop 1366×768 viewports pass. Synthetic-only evidence, deterministic Tutor, deferred live runtime, P5 limitations, P6 solver-limit fallback/valve-chatter follow-up and lack of production logging/interlocks remain accepted limitations.
