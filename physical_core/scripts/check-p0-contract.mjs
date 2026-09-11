// Compile a real Python-produced response against the frozen documented seam.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../../', import.meta.url));
const seam = fs.readFileSync(path.join(root, 'P0_FUTURE_API_SEAMS.md'), 'utf8');
const response = seam.match(/interface SimulationFrameResponse \{[\s\S]*?\n\}/)?.[0];
if (!response) throw new Error('Frozen SimulationFrameResponse not found');
const payload = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p1a-contract-'));
const target = path.join(dir, 'frame.ts');
try {
  fs.writeFileSync(target, `import type { WeatherState, HeatingNetworkState, BuildingThermalState } from ${JSON.stringify(path.join(root, 'src/domain'))};\n${response}\nconst frame: SimulationFrameResponse = ${JSON.stringify(payload)};\n`);
  const check = spawnSync(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'),
    '--noEmit', '--strict', '--skipLibCheck', '--target', 'ES2020', '--module', 'ESNext',
    '--moduleResolution', 'Bundler', target], { cwd: dir, encoding: 'utf8' });
  if (check.status !== 0) {
    process.stderr.write(check.stdout + check.stderr + (check.error?.message ?? ''));
    process.exitCode = 1;
  } else console.log('P0 SimulationFrameResponse: TypeScript structural check passed');
} finally {
  fs.rmSync(dir, { recursive: true });
}
