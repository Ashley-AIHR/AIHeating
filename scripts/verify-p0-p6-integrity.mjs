import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const read = async (name) => JSON.parse(await readFile(new URL(`../${name}`, import.meta.url)));
const digest = async (name) => createHash('sha256').update(await readFile(new URL(`../${name}`, import.meta.url))).digest('hex');
const errors = [];
const verifyGroup = async (label, group) => {
  for (const [name, expected] of Object.entries(group)) {
    try {
      const actual = await digest(name);
      if (actual !== expected) errors.push(`${label}:${name}`);
    } catch {
      errors.push(`${label}:${name}:missing`);
    }
  }
};

const p2 = await read('P2_BASELINE_FREEZE_MANIFEST_v1.2.json');
await verifyGroup('P1A', p2.acceptedP1AFileHashes);
await verifyGroup('P1.2/P2', p2.artifactFileHashes);
assert.equal(p2.physicalFixtureVersion, 'physical-fixture-v1.2');
assert.equal(p2.controllerVersion, 'traditional-v1.2');
assert.equal(p2.scenarioDefinitions.hydraulic_imbalance.farPipeResistanceMultiplier, 2);
assert.deepEqual(p2.commissionedValveFractions, [0.35, 0.55, 0.85]);

const p4 = await read('p4_model_registry.json');
await verifyGroup('P4', p4.artifactHashes);
const p5 = await read('p5_model_registry.json');
await verifyGroup('P5', {
  [p5.calibrationArtifact]: p5.calibrationArtifactHash,
  'p5_canonical_holdout_results.json': p5.canonicalResultsHash,
  'p5_identifiability_results.json': p5.identifiabilityResultsHash,
  'p5_identification_manifest.json': p5.identificationManifestHash,
  'p5_prediction_results.json': p5.predictionResultsHash,
});
const p6 = await read('p6_model_registry.json');
for (const group of ['configurationHashes', 'sourceHashes', 'resultHashes']) await verifyGroup(`P6/${group}`, p6[group]);
await verifyGroup('P6/P1A dependency', p6.dependencies.P1A.acceptedFileHashes);
await verifyGroup('P6/dependency registries', {
  [p6.dependencies.P1A.freezeManifest]: p6.dependencies.P1A.freezeManifestHash,
  [p6.dependencies.P3.generationManifest]: p6.dependencies.P3.generationManifestHash,
  [p6.dependencies.P4.registry]: p6.dependencies.P4.registryHash,
  [p6.dependencies.P5.registry]: p6.dependencies.P5.registryHash,
});
await verifyGroup('P6/P3 canonical manifests', p6.dependencies.P3.canonicalManifestHashes);

const gateFiles = [
  'p1a_gate_results.json', 'p1_2_sizing_gate_results.json', 'p2_gate_results.json',
  'p3_gate_results.json', 'p4_gate_results.json', 'p5_gate_results.json', 'p6_gate_results.json',
];
for (const name of gateFiles) {
  const result = await read(name);
  const failed = result.failed ?? result.gates.filter((gate) => !['PASS', true].includes(gate.status ?? gate.passed)).length;
  if (failed !== 0) errors.push(`gate:${name}`);
}

assert.deepEqual(errors, [], `Frozen artifact integrity errors: ${errors.join(', ')}`);
console.log('P0-P6 integrity: PASS (all registered hashes and accepted gate results verified)');
