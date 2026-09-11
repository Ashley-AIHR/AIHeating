import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = process.cwd();
const temp = mkdtempSync(join(tmpdir(), 'ai-heating-p9-clean-'));
const copy = (path) => cpSync(join(root, path), join(temp, path), { recursive: true });
const records = [];
const run = (label, command, args, timeout = 600_000) => {
  const result = spawnSync(command, args, { cwd: temp, encoding: 'utf8', timeout });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  const record = { label, command: [command, ...args].join(' '), exitCode: result.status ?? 1, passed: result.status === 0 ? 1 : 0, failed: result.status === 0 ? 0 : 1, skipped: 0, output: output.slice(-4000) };
  records.push(record);
  console.log(`${label}: exit ${record.exitCode}`);
  return record.exitCode === 0;
};

try {
  for (const path of ['package.json', 'package-lock.json', 'index.html', 'tsconfig.json', 'src']) copy(path);
  copy('p8_domain_knowledge_v1.json');
  copy('P0_FUTURE_API_SEAMS.md');
  mkdirSync(join(temp, 'scripts'));
  copy('scripts/p0-invariants.ts');
  const install = run('Clean exact-lockfile dependency install', 'npm', ['ci', '--offline', '--ignore-scripts']);
  const tests = install && run('Clean P0 core tests', 'npm', ['run', 'test']);
  const build = install && run('Clean production build', 'npm', ['run', 'build']);
  const artifact = existsSync(join(temp, 'dist', 'index.html'));
  const passed = install && tests && build && artifact;
  const result = { phase: 'P9 clean frontend environment', passed, failed: passed ? 0 : 1, skipped: 0, temporaryDirectoryRemoved: true, exactLockfile: true, offlineInstall: true, buildArtifactPresent: artifact, commands: records };
  writeFileSync(join(root, 'p9_clean_env_results.json'), JSON.stringify(result, null, 2) + '\n');
  if (!passed) process.exitCode = 1;
} finally {
  rmSync(temp, { recursive: true, force: true });
}
