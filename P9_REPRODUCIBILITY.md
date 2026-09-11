# P9 Reproducibility

Run from the repository root. Commands use relative paths and exact lockfiles/registries; no release command depends on a developer-local absolute path.

## Install and freeze verification

```bash
npm ci
uv sync --project physical_core
uv run --project physical_core --with-requirements physical_core/p6-requirements.txt python -c "import cvxpy, lightgbm, sklearn"
node scripts/verify-p0-p8-integrity.mjs
node scripts/p9-verify-release-freeze.mjs
```

## P1A and P2

```bash
uv run --project physical_core python physical_core/scripts/run_p1_2_regression.py p1a
uv run --project physical_core python physical_core/scripts/run_p1_2_regression.py p2
uv run --project physical_core python -m pytest physical_core/tests/test_physical_fixture_v1_2.py physical_core/tests/test_p2_final_scenario_adequacy.py -q
```

## P3

```bash
uv run --project physical_core --with-requirements physical_core/p6-requirements.txt python -m pytest physical_core/tests/test_p3_dataset.py -q
```

The integrity verifier checks the P3 generation manifest and all five canonical holdout manifest hashes. Do not regenerate canonical evidence for release verification.

## P4

```bash
uv run --project physical_core --with-requirements physical_core/p6-requirements.txt python -m pytest physical_core/tests/test_p4.py -q
npx tsx scripts/p4-invariants.ts
npm run test:p4-alignment
```

## P5

```bash
uv run --project physical_core --with-requirements physical_core/p6-requirements.txt python -m pytest physical_core/tests/test_p5.py -q
```

## P6

```bash
uv run --project physical_core --with-requirements physical_core/p6-requirements.txt python -m pytest physical_core/tests/test_p6.py -q
```

## P7 and P8

```bash
npx tsx scripts/p7-invariants.ts
node scripts/p7-ui-invariants.mjs
npx tsx scripts/p7-gates.ts
npx tsx scripts/p8-invariants.ts
npx tsx scripts/p8-evaluate.ts
node scripts/p8-ui-invariants.mjs
npx tsx scripts/p8-gates.ts
node scripts/p8-browser-with-server.mjs
```

## P9 and frontend

```bash
npx tsx scripts/p9-invariants.ts
npx tsx scripts/p9-guided-replay.ts
node scripts/p9-browser-with-server.mjs
node scripts/p9-clean-env.mjs
npx tsc --noEmit
npm run test
npm run build
node scripts/run-p9-regression.mjs
node scripts/verify-p0-p8-integrity.mjs
node scripts/p9-verify-release-freeze.mjs
```

Browser validation uses Playwright’s pinned package and the installed Chromium runtime. If the browser binary is absent, install the matching runtime with `npx playwright install chromium`; that is an environment prerequisite, not a release dependency.

## Outputs

`p9_regression_results.json`, `p9_guided_replay_results.json`, `p9_browser_results.json`, `p9_clean_env_results.json` and `p9_gate_results.json` record command, exit code, pass/fail/skip and any reason. The build output is `dist/`; the source-set identity is pinned in `p9_release_registry.json`.
