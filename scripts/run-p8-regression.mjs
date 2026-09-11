import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const python = ['uv', 'run', '--offline', '--project', 'physical_core', '--with-requirements', 'physical_core/p6-requirements.txt', 'python'];
const run = (label, command, args, timeout = 1_800_000) => {
  const result = spawnSync(command, args, { cwd: process.cwd(), encoding: 'utf8', timeout, env: { ...process.env, UV_CACHE_DIR: '/tmp/heat-p8-uv-cache' } });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  const count = (word) => Number(output.match(new RegExp(`(\\d+) ${word}`))?.[1] ?? 0);
  const record = { label, command: [command, ...args].join(' '), exitCode: result.status ?? 1, passed: count('passed'), failed: count('failed'), skipped: count('skipped'), output: output.slice(-12000) };
  console.log(`${label}: exit ${record.exitCode}; ${record.passed} passed, ${record.failed} failed, ${record.skipped} skipped`);
  return record;
};

const integrityBefore = run('P0-P7 accepted integrity before', 'node', ['scripts/verify-p0-p7-integrity.mjs']);
const commands = [
  run('P8 context/grounding/status/control tests', 'npx', ['tsx', 'scripts/p8-invariants.ts']),
  run('P8 deterministic EN/ZH evaluation', 'npx', ['tsx', 'scripts/p8-evaluate.ts']),
  run('P8 UI/provider invariants', 'node', ['scripts/p8-ui-invariants.mjs']),
  run('P8 38-gate suite', 'npx', ['tsx', 'scripts/p8-gates.ts']),
  run('P8 EN/ZH browser tests', 'node', ['scripts/p8-browser-with-server.mjs']),
  run('P7 integration/state semantics', 'npx', ['tsx', 'scripts/p7-invariants.ts']),
  run('P7 UI/provider invariants', 'node', ['scripts/p7-ui-invariants.mjs']),
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
const integrityAfter = run('P0-P7 accepted integrity after', 'node', ['scripts/verify-p0-p7-integrity.mjs']);
const gateResults = JSON.parse(readFileSync('p8_gate_results.json', 'utf8'));
const evalResults = JSON.parse(readFileSync('p8_tutor_evaluation_results.json', 'utf8'));
const browserOutput = commands.find((item) => item.label.includes('browser'))?.output ?? '';
const screenshotCount = (browserOutput.match(/PASS p8-tutor-/g) ?? []).length;
const passed = integrityBefore.exitCode === 0 && integrityAfter.exitCode === 0 && commands.every((item) => item.exitCode === 0) && gateResults.failed === 0 && evalResults.failed === 0 && screenshotCount === 8;
const result = {
  phase: 'P8 regression', generatedAt: new Date().toISOString(), passed, commands,
  P8Gates: { passed: gateResults.passed, failed: gateResults.failed, skipped: gateResults.skipped },
  tutorEvaluation: { total: evalResults.totalCases, passed: evalResults.passed, failed: evalResults.failed, skipped: evalResults.skipped },
  browser: { languages: ['en', 'zh'], pages: ['Overview', 'Simulation', 'Forecast', 'Results'], screenshots: screenshotCount, skipped: 0 },
  integrityBefore: integrityBefore.output.trim(), integrityAfter: integrityAfter.output.trim(),
  acceptedArtifactChanges: passed ? [] : ['See command output and integrity results'],
};
writeFileSync('p8_regression_results.json', JSON.stringify(result, null, 2) + '\n');
console.log(`P8 full regression: ${passed ? 'PASS' : 'FAIL'}`);
if (!passed) process.exitCode = 1;
