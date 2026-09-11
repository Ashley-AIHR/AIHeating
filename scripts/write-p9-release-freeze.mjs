import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const json = (path) => JSON.parse(readFileSync(path, 'utf8'));
const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const entries = new Map();
const add = (path, version, role, dependencies = []) => entries.set(path, { path, version, sha256: sha256(path), role, mutable: false, upstreamDependencies: dependencies });
const addExpected = (path, expected, version, role, dependencies = []) => {
  const actual = sha256(path);
  if (actual !== expected) throw new Error(`Cannot freeze changed artifact ${path}: ${actual} != ${expected}`);
  entries.set(path, { path, version, sha256: expected, role, mutable: false, upstreamDependencies: dependencies });
};

const p2 = json('P2_BASELINE_FREEZE_MANIFEST_v1.2.json');
for (const [path, hash] of Object.entries(p2.acceptedP1AFileHashes)) addExpected(path, hash, 'P1A accepted / physical-fixture-v1.2', 'physical model, test or accepted evidence');
for (const [path, hash] of Object.entries(p2.artifactFileHashes)) addExpected(path, hash, 'physical-fixture-v1.2 / traditional-v1.2', 'physical fixture, baseline, scenario or canonical evidence', ['P2_BASELINE_FREEZE_MANIFEST_v1.2.json']);
add('P2_BASELINE_FREEZE_MANIFEST_v1.2.json', 'p2-baseline-freeze-v1.2', 'P1A/P2 freeze authority');

const p6 = json('p6_model_registry.json');
addExpected('p3_generation_manifest.json', p6.dependencies.P3.generationManifestHash, 'p3-dataset-v1.0', 'dataset generation registry', ['physical-fixture-v1.2', 'traditional-v1.2']);
for (const [path, hash] of Object.entries(p6.dependencies.P3.canonicalManifestHashes)) addExpected(path, hash, 'p3-dataset-v1.0 canonical holdout', 'canonical scenario manifest', ['p3_generation_manifest.json']);

const p4 = json('p4_model_registry.json');
add('p4_model_registry.json', 'p4-model-registry-v1', 'P4 model registry', ['p3_generation_manifest.json']);
for (const [path, hash] of Object.entries(p4.artifactHashes)) addExpected(path, hash, path.includes('selected_p4') ? 'selected-p4-predictor-v1' : 'P4 comparison model', 'P4 pinned model artifact', ['p4_model_registry.json']);

const p5 = json('p5_model_registry.json');
add('p5_model_registry.json', 'p5-model-registry-v1', 'P5 model registry', ['p3_generation_manifest.json']);
for (const [path, hash] of Object.entries({
  [p5.calibrationArtifact]: p5.calibrationArtifactHash,
  'p5_identification_manifest.json': p5.identificationManifestHash,
  'p5_prediction_results.json': p5.predictionResultsHash,
  'p5_canonical_holdout_results.json': p5.canonicalResultsHash,
  'p5_identifiability_results.json': p5.identifiabilityResultsHash,
})) addExpected(path, hash, 'p5-thermal-model-v1', 'P5 calibration, identification or accepted evidence', ['p5_model_registry.json']);

add('p6_model_registry.json', 'p6-model-registry-v1', 'P6 model registry', ['p4_model_registry.json', 'p5_model_registry.json']);
for (const group of ['configurationHashes', 'sourceHashes', 'resultHashes']) {
  for (const [path, hash] of Object.entries(p6[group])) addExpected(path, hash, 'p6-mpc-v1', `P6 ${group}`, ['p6_model_registry.json']);
}

const p7 = json('p8_p7_accepted_hashes.json');
for (const [path, hash] of Object.entries(p7.files)) addExpected(path, hash, 'p7-final-provider-v1', 'P7 provider/state contract or accepted evidence', ['p6_model_registry.json']);
const p8 = json('p9_p8_accepted_hashes.json');
for (const [path, hash] of Object.entries(p8.files)) addExpected(path, hash, 'deterministic-grounded-v1', 'P8 Tutor/UI/evaluation accepted boundary', ['src/p7-runtime-data.json']);

for (const path of ['index.html', 'tsconfig.json', 'src/domain.ts', 'src/chart.ts', 'src/main.tsx', 'src/p4-preview-data.json', 'src/p4-provider.ts', 'src/vite-env.d.ts']) add(path, 'AI-Heating-PoC-RC1', 'frontend source/build input', ['package-lock.json']);
for (const path of [
  'P9_IMPLEMENTATION_PLAN.md', 'P9_RUNTIME_CAPABILITY_MATRIX.md', 'P9_FINAL_ARCHITECTURE.md',
  'P9_DATA_LINEAGE.md', 'P9_MODEL_LINEAGE.md', 'P9_CUSTOMER_CLAIMS_REVIEW.md',
  'P9_CUSTOMER_DEMO_SCRIPT.md', 'P9_CUSTOMER_DEMO_SCRIPT_CN.md', 'P9_TECHNICAL_DEMO_SCRIPT.md',
  'P9_REPRODUCIBILITY.md', 'P9_KNOWN_LIMITATIONS.md', 'P9_REAL_SITE_PILOT_PLAN.md',
  'p9_release_registry.json', 'p9_release_config.json',
]) add(path, 'AI-Heating-PoC-RC1', 'release documentation or configuration', ['p9_release_registry.json']);
for (const path of [
  'scripts/verify-p0-p8-integrity.mjs', 'scripts/p9-invariants.ts', 'scripts/p9-guided-replay.ts',
  'scripts/p9-browser.mjs', 'scripts/p9-browser-with-server.mjs', 'scripts/p9-clean-env.mjs',
  'scripts/p9-p8-isolated-regression.mjs', 'scripts/run-p9-regression.mjs',
  'scripts/write-p9-release-freeze.mjs', 'scripts/p9-verify-release-freeze.mjs',
]) add(path, 'AI-Heating-PoC-RC1', 'release validation harness', ['p9_release_config.json']);

const manifest = {
  manifestVersion: 'p9-release-freeze-manifest-rc1', releaseIdentity: 'AI-Heating-PoC-RC1',
  officialMode: 'Guided Validated Digital Twin Demonstration', hashAlgorithm: 'SHA-256 raw bytes',
  immutabilityPolicy: 'Every listed artifact is immutable for RC1; changes require a new release identity and manifest.',
  selfExclusion: 'This manifest is verified by content entries and is not self-hashed.',
  artifactCount: entries.size, artifacts: [...entries.values()].sort((a, b) => a.path.localeCompare(b.path)),
};
writeFileSync('P9_RELEASE_FREEZE_MANIFEST.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(`P9 release freeze manifest written: ${manifest.artifactCount} immutable artifacts`);
