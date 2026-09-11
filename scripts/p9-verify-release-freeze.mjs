import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync('P9_RELEASE_FREEZE_MANIFEST.json', 'utf8'));
const errors = [];
for (const artifact of manifest.artifacts) {
  try {
    const actual = createHash('sha256').update(readFileSync(artifact.path)).digest('hex');
    if (actual !== artifact.sha256) errors.push(`${artifact.path}:hash`);
    if (artifact.mutable !== false) errors.push(`${artifact.path}:mutable`);
    if (!Array.isArray(artifact.upstreamDependencies)) errors.push(`${artifact.path}:dependencies`);
  } catch {
    errors.push(`${artifact.path}:missing`);
  }
}
assert.equal(manifest.artifactCount, manifest.artifacts.length);
assert.deepEqual(errors, [], `Release freeze errors: ${errors.join(', ')}`);
console.log(`P9 release freeze: PASS (${manifest.artifactCount} immutable artifacts, ${manifest.releaseIdentity})`);
