import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const inherited = execFileSync(process.execPath, ['scripts/verify-p0-p7-integrity.mjs'], { encoding: 'utf8' }).trim();
const manifest = JSON.parse(readFileSync('p9_p8_accepted_hashes.json', 'utf8'));
const errors = [];
for (const [path, expected] of Object.entries(manifest.files)) {
  try {
    const actual = createHash('sha256').update(readFileSync(path)).digest('hex');
    if (actual !== expected) errors.push(path);
  } catch {
    errors.push(`${path}:missing`);
  }
}
assert.ok(inherited.startsWith('P0-P7 integrity: PASS'));
assert.deepEqual(errors, [], `P8 accepted boundary changed: ${errors.join(', ')}`);
console.log('P0-P8 integrity: PASS (registered P0-P7 plus hash-bound P8 Tutor/UI/evaluation boundary)');
