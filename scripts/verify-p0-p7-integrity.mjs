import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const inherited = execFileSync(process.execPath, ['scripts/verify-p0-p6-integrity.mjs'], { encoding: 'utf8' }).trim();
const manifest = JSON.parse(readFileSync('p8_p7_accepted_hashes.json', 'utf8'));
const errors = [];
for (const [name, expected] of Object.entries(manifest.files)) {
  const actual = createHash('sha256').update(readFileSync(name)).digest('hex');
  if (actual !== expected) errors.push(name);
}
assert.ok(inherited.startsWith('P0-P6 integrity: PASS'));
assert.deepEqual(errors, [], `P7 accepted boundary changed: ${errors.join(', ')}`);
console.log('P0-P7 integrity: PASS (registered P0-P6 plus hash-bound P7 provider/state/Gate boundary)');
