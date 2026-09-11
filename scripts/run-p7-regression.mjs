import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const python = ['uv', 'run', '--offline', '--project', 'physical_core', '--with', 'cvxpy', '--with', 'osqp', '--with', 'lightgbm', '--with', 'scikit-learn', 'python'];
const run = (label, command, args, timeout = 1_800_000) => {
  const result = spawnSync(command, args, {
    cwd: process.cwd(), encoding: 'utf8', timeout,
    env: { ...process.env, UV_CACHE_DIR: '/tmp/heat-uv-cache' },
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  const count = (word) => Number(output.match(new RegExp(`(\\d+) ${word}`))?.[1] ?? 0);
  const record = { label, command: [command, ...args].join(' '), exitCode: result.status ?? 1, passed: count('passed'), failed: count('failed'), skipped: count('skipped'), output: output.slice(-12000) };
  console.log(`${label}: exit ${record.exitCode}; ${record.passed} passed, ${record.failed} failed, ${record.skipped} skipped`);
  return record;
};

const integrityBefore = run('P0-P6 registered artifact integrity before', 'node', ['scripts/verify-p0-p6-integrity.mjs']);
const commands = [
  run('P7 integration scenarios', 'npx', ['tsx', 'scripts/p7-invariants.ts']),
  run('P7 UI/provider invariants', 'node', ['scripts/p7-ui-invariants.mjs']),
  run('P7 22-gate suite', 'npx', ['tsx', 'scripts/p7-gates.ts']),
  run('P7 EN/ZH browser tests', 'node', ['scripts/p7-browser-with-server.mjs']),
  run('P6 tests', python[0], [...python.slice(1), '-m', 'pytest', 'physical_core/tests/test_p6.py', '-q']),
  run('P5 tests', python[0], [...python.slice(1), '-m', 'pytest', 'physical_core/tests/test_p5.py', '-q']),
  run('P4 model/leakage/Preview tests', python[0], [...python.slice(1), '-m', 'pytest', 'physical_core/tests/test_p4.py', '-q']),
  run('P4 UI/provider invariants', 'npx', ['tsx', 'scripts/p4-invariants.ts']),
  run('P4 UI alignment', 'npm', ['run', 'test:p4-alignment']),
  run('P3 dataset tests', python[0], [...python.slice(1), '-m', 'pytest', 'physical_core/tests/test_p3_dataset.py', '-q']),
  run('Physical Fixture v1.2 tests', 'physical_core/.venv/bin/python', ['-m', 'pytest', 'physical_core/tests/test_physical_fixture_v1_2.py', 'physical_core/tests/test_p2_final_scenario_adequacy.py', '-q']),
  run('P2 Traditional v1.2 accepted regression', 'physical_core/.venv/bin/python', ['physical_core/scripts/run_p1_2_regression.py', 'p2']),
  run('P1A accepted regression under fixture v1.2', 'physical_core/.venv/bin/python', ['physical_core/scripts/run_p1_2_regression.py', 'p1a']),
  run('P0 TypeScript typecheck', 'npx', ['tsc', '--noEmit']),
  run('P0 invariant tests', 'npm', ['run', 'test']),
  run('P0 production build', 'npm', ['run', 'build']),
];
const integrityAfter = run('P0-P6 registered artifact integrity after', 'node', ['scripts/verify-p0-p6-integrity.mjs']);
const gateResults = JSON.parse(readFileSync('p7_gate_results.json', 'utf8'));
const screenshotCount = commands.find((item) => item.label.includes('browser'))?.output.match(/PASS p7-/g)?.length ?? 0;
const passed = integrityBefore.exitCode === 0 && integrityAfter.exitCode === 0 && commands.every((item) => item.exitCode === 0) && gateResults.failed === 0 && screenshotCount === 10;
const result = {
  phase: 'P7 regression', generatedAt: new Date().toISOString(), passed,
  commands, P7Gates: { passed: gateResults.passed, failed: gateResults.failed, skipped: gateResults.skipped },
  browser: { languages: ['en', 'zh'], pages: ['Overview', 'Forecast', 'Simulation', 'Results', 'Settings'], screenshots: screenshotCount, skipped: 0 },
  integrityBefore: integrityBefore.output.trim(), integrityAfter: integrityAfter.output.trim(),
  frozenArtifactChanges: passed ? [] : ['See command output and integrity results'],
};
writeFileSync('p7_regression_results.json', JSON.stringify(result, null, 2) + '\n');
console.log(`P7 full regression: ${passed ? 'PASS' : 'FAIL'}`);
if (!passed) process.exitCode = 1;
