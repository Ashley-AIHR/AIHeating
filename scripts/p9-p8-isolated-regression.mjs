import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = process.cwd();
const temp = mkdtempSync(join(tmpdir(), 'ai-heating-p9-p8-'));
const records = [];
const run = (label, command, args) => {
  const result = spawnSync(command, args, { cwd: temp, encoding: 'utf8', timeout: 300_000 });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  const match = output.match(/(\d+)(?:\/\d+)? passed/i);
  const record = { label, command: args.at(-1) ?? command, exitCode: result.status ?? 1, passed: Number(match?.[1] ?? (result.status === 0 ? 1 : 0)), failed: result.status === 0 ? 0 : 1, skipped: 0, output: output.slice(-8000) };
  records.push(record);
  console.log(`${label}: exit ${record.exitCode}`);
  return record.exitCode === 0;
};

try {
  symlinkSync(join(root, 'src'), join(temp, 'src'));
  symlinkSync(join(root, 'scripts'), join(temp, 'scripts'));
  cpSync(join(root, 'p8_tutor_eval_v1.json'), join(temp, 'p8_tutor_eval_v1.json'));
  cpSync(join(root, 'p8_tutor_evaluation_results.json'), join(temp, 'p8_tutor_evaluation_results.json'));
  const tsx = join(root, 'node_modules', '.bin', 'tsx');
  run('P8 context/grounding/status/control invariants', tsx, [join(root, 'scripts', 'p8-invariants.ts')]);
  run('P8 deterministic EN/ZH 100-case evaluation', tsx, [join(root, 'scripts', 'p8-evaluate.ts')]);
  run('P8 UI/provider invariants', process.execPath, [join(root, 'scripts', 'p8-ui-invariants.mjs')]);
  run('P8 38-gate suite', tsx, [join(root, 'scripts', 'p8-gates.ts')]);
  const passed = records.every((record) => record.exitCode === 0);
  const result = { phase: 'P8 isolated regression for P9', passed, failed: passed ? 0 : 1, skipped: 0, acceptedWorkspaceOutputsMutated: false, temporaryDirectoryRemoved: true, commands: records };
  writeFileSync(join(root, 'p9_p8_isolated_results.json'), JSON.stringify(result, null, 2) + '\n');
  if (!passed) process.exitCode = 1;
} finally {
  rmSync(temp, { recursive: true, force: true });
}
