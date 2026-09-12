import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  outageImpact,
  reachable,
  shortestRoute,
  substationId,
  validateGlb,
  type Network,
  type BimModel,
} from "../src/engineering/model";

const network = JSON.parse(
  readFileSync("public/engineering-assets/opendhn.json", "utf8"),
) as Network;
const bim = JSON.parse(
  readFileSync("public/engineering-assets/duplex-mep.json", "utf8"),
) as BimModel;
const glb = readFileSync("public/engineering-assets/duplex-mep.glb");
const gltf = validateGlb(
  glb.buffer.slice(
    glb.byteOffset,
    glb.byteOffset + glb.byteLength,
  ) as ArrayBuffer,
);
assert.equal(gltf.nodes.length, bim.assets.length);
assert.deepEqual(
  gltf.nodes
    .map((n: { extras: { assetId: string } }) => n.extras.assetId)
    .sort(),
  bim.assets.map((a) => a.id).sort(),
);
assert.equal(new Set(bim.assets.map((a) => a.id)).size, bim.assets.length);
assert.equal(bim.quality.converted, 926);
assert.equal(bim.quality.failed, 0);
assert.equal(bim.units, "metres");
assert.equal(bim.connections.length, 0);
for (const a of bim.assets) {
  assert.ok(a.bounds.flat().every(Number.isFinite));
  assert.ok(a.triangles > 0);
  for (let i = 0; i < 3; i++) assert.ok(a.bounds[1][i] >= a.bounds[0][i]);
}
const ids = new Set(network.nodes.map((n) => n.id));
assert.equal(ids.size, network.nodes.length);
for (const p of network.pipes) {
  assert.ok(ids.has(p.from) && ids.has(p.to));
  assert.ok(p.length > 0 && p.diameter > 0 && p.insulation >= 0);
}
assert.equal(network.substations.length, 150);
for (const s of network.substations)
  assert.ok(ids.has(s.inlet_node) && ids.has(s.outlet_node));
assert.equal(substationId(network.substations[0]), "S0");
assert.deepEqual(outageImpact(network, new Set()), []);
const allRemoved = new Set(network.pipes.map((p) => p.id));
assert.equal(outageImpact(network, allRemoved).length, 150);
assert.ok(reachable(network, true).size > network.substations.length);
for (const p of network.pipes.filter((p) => p.supply).slice(0, 10)) {
  const route = shortestRoute(network, p.id);
  assert.ok(route.pipes.includes(p.id));
  assert.ok(route.length >= p.length);
  assert.equal(new Set(route.pipes).size, route.pipes.length);
}
// A loop tolerates one lost edge; the second edge disconnects exactly one terminal.
const fixture = {
  ...network,
  nodes: [],
  plants: [{ hs_id: "HS", outlet_node: "a", inlet_node: "r" }],
  substations: [{ id: "S", inlet_node: "c", outlet_node: "t" }],
  pipes: [
    { id: "ac", from: "a", to: "c", supply: true, length: 3 },
    { id: "ab", from: "a", to: "b", supply: true, length: 1 },
    { id: "bc", from: "b", to: "c", supply: true, length: 1 },
    { id: "rt", from: "r", to: "t", supply: false, length: 2 },
  ].map((p) => ({ ...p, diameter: 0.1, insulation: 0.03, roughnessMm: 0.04 })),
} as Network;
assert.deepEqual(outageImpact(fixture, new Set(["ac"])), []);
assert.deepEqual(outageImpact(fixture, new Set(["ac", "bc"])), ["S"]);
assert.deepEqual(outageImpact(fixture, new Set(["rt"])), ["S"]);
assert.deepEqual(outageImpact(fixture, new Set(["unknown"])), []);
assert.throws(() => validateGlb(new ArrayBuffer(5)), /valid binary/);
function smallGlb(json: unknown) {
  const encoded = Buffer.from(JSON.stringify(json));
  const padded = Buffer.concat([
      encoded,
      Buffer.alloc((4 - (encoded.length % 4)) % 4, 32),
    ]),
    result = Buffer.alloc(20 + padded.length);
  result.writeUInt32LE(0x46546c67, 0);
  result.writeUInt32LE(2, 4);
  result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12);
  result.writeUInt32LE(0x4e4f534a, 16);
  padded.copy(result, 20);
  return result.buffer.slice(
    result.byteOffset,
    result.byteOffset + result.byteLength,
  ) as ArrayBuffer;
}
assert.throws(
  () =>
    validateGlb(
      smallGlb({ buffers: [{ uri: "https://example.org/private-data" }] }),
    ),
  /External resources/,
);
assert.throws(
  () =>
    validateGlb(
      smallGlb({ extensionsRequired: ["KHR_draco_mesh_compression"] }),
    ),
  /uncompressed/,
);
assert.ok(
  validateGlb(
    smallGlb({
      asset: { version: "2.0" },
      buffers: [{ uri: "data:application/octet-stream;base64,AA==" }],
    }),
  ),
);
console.log(
  `Engineering invariants passed: ${bim.assets.length} source meshes, ${network.pipes.length} validated pipe records, network loops/outages/paths and GLB import guards.`,
);
