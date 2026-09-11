import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const python = ['uv', 'run', '--offline', '--project', 'physical_core', '--with-requirements', 'physical_core/p6-requirements.txt', 'python'];
const run = (label, command, args, timeout = 1_800_000) => {
  const result = spawnSync(command, args, { cwd: process.cwd(), encoding: 'utf8', timeout });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  const count = (word) => Number(output.match(new RegExp(`(\\d+) ${word}`))?.[1] ?? 0);
  const record = { label, command: [command, ...args].join(' '), exitCode: result.status ?? 1, passed: count('passed') || (result.status === 0 ? 1 : 0), failed: count('failed') || (result.status === 0 ? 0 : 1), skipped: count('skipped'), output: output.slice(-12000) };
  console.log(`${label}: exit ${record.exitCode}; ${record.passed} passed, ${record.failed} failed, ${record.skipped} skipped`, { flush: true });
  return record;
};

const integrityBefore = run('P0-P8 accepted integrity before', 'node', ['scripts/verify-p0-p8-integrity.mjs']);
const freezeBefore = run('RC1 release freeze before', 'node', ['scripts/p9-verify-release-freeze.mjs']);
const commands = [
  run('P9 core runtime/status/claims gates', 'npx', ['tsx', 'scripts/p9-invariants.ts']),
  run('P9 five-run deterministic guided replay', 'npx', ['tsx', 'scripts/p9-guided-replay.ts']),
  run('P9 EN/ZH/mode/status/responsive/accessibility browser matrix', 'node', ['scripts/p9-browser-with-server.mjs']),
  run('P9 clean exact-lockfile frontend install/test/build', 'node', ['scripts/p9-clean-env.mjs']),
  run('P8 context/grounding/evaluation/UI/gates in isolated directory', 'node', ['scripts/p9-p8-isolated-regression.mjs']),
  run('P8 EN/ZH Tutor browser validation', 'node', ['scripts/p8-browser-with-server.mjs']),
  run('P7 integration/state semantics', 'npx', ['tsx', 'scripts/p7-invariants.ts']),
  run('P7 cross-page/provider source invariants', 'node', ['scripts/p7-ui-invariants.mjs']),
  run('P7 EN/ZH cross-page/status browser validation', 'node', ['scripts/p7-browser-with-server.mjs']),
  run('P6 unit/linearisation/safety/canonical artifact tests', python[0], [...python.slice(1), '-m', 'pytest', 'physical_core/tests/test_p6.py', '-q']),
  run('P5 identifiability/calibration/prediction/canonical tests', python[0], [...python.slice(1), '-m', 'pytest', 'physical_core/tests/test_p5.py', '-q']),
  run('P4 prediction/leakage/Preview/canonical/artifact tests', python[0], [...python.slice(1), '-m', 'pytest', 'physical_core/tests/test_p4.py', '-q']),
  run('P4 provider invariants', 'npx', ['tsx', 'scripts/p4-invariants.ts']),
  run('P4 UI/data alignment gates', 'npm', ['run', 'test:p4-alignment']),
  run('P3 dataset/integrity/determinism gates', python[0], [...python.slice(1), '-m', 'pytest', 'physical_core/tests/test_p3_dataset.py', '-q']),
  run('Physical Fixture v1.2 and P2 adequacy tests', 'physical_core/.venv/bin/python', ['-m', 'pytest', 'physical_core/tests/test_physical_fixture_v1_2.py', 'physical_core/tests/test_p2_final_scenario_adequacy.py', '-q']),
  run('P2 Traditional v1.2 accepted controller/canonical gates', 'physical_core/.venv/bin/python', ['physical_core/scripts/run_p1_2_regression.py', 'p2']),
  run('P1A accepted physical tests/gates', 'physical_core/.venv/bin/python', ['physical_core/scripts/run_p1_2_regression.py', 'p1a']),
  run('P0 TypeScript check', 'npx', ['tsc', '--noEmit']),
  run('P0 frontend invariants', 'npm', ['run', 'test']),
  run('P0 production build', 'npm', ['run', 'build']),
];
const integrityAfter = run('P0-P8 accepted integrity after', 'node', ['scripts/verify-p0-p8-integrity.mjs']);
const freezeAfter = run('RC1 release freeze after', 'node', ['scripts/p9-verify-release-freeze.mjs']);
const core = JSON.parse(readFileSync('p9_core_gate_results.json', 'utf8'));
const replay = JSON.parse(readFileSync('p9_guided_replay_results.json', 'utf8'));
const browser = JSON.parse(readFileSync('p9_browser_results.json', 'utf8'));
const clean = JSON.parse(readFileSync('p9_clean_env_results.json', 'utf8'));
const p8 = JSON.parse(readFileSync('p9_p8_isolated_results.json', 'utf8'));
const passed = [integrityBefore, freezeBefore, integrityAfter, freezeAfter, ...commands].every((item) => item.exitCode === 0)
  && core.failed === 0 && replay.failed === 0 && replay.identical && browser.failed === 0 && clean.passed && p8.passed;
const result = {
  phase: 'P9 full regression', generatedAt: new Date().toISOString(), passed,
  commands, integrityBefore, freezeBefore, integrityAfter, freezeAfter,
  summary: { coreGates: { passed: core.passed, failed: core.failed, skipped: core.skipped }, guidedReplay: { runs: replay.total, identical: replay.identical, failed: replay.failed }, browser: { passed: browser.passed, failed: browser.failed, skipped: browser.skipped, responsiveIssues: browser.responsiveIssues }, cleanEnvironment: { passed: clean.passed, failed: clean.failed, skipped: clean.skipped }, p8Isolated: { passed: p8.passed, failed: p8.failed, skipped: p8.skipped } },
  acceptedArtifactChanges: passed ? [] : ['See integrity, freeze and command evidence'],
};
writeFileSync('p9_regression_results.json', JSON.stringify(result, null, 2) + '\n');
console.log(`P9 full regression: ${passed ? 'PASS' : 'FAIL'}`);
if (!passed) process.exitCode = 1;
