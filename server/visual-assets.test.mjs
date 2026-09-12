import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const root = new URL("../public/visual-models/", import.meta.url);
test("professional visual assets match recorded checksums and use self-contained GLB textures", () => {
  const manifest = JSON.parse(readFileSync(new URL("manifest.json", root)));
  assert.equal(manifest.licence, "CC0-1.0");
  for (const asset of manifest.files) {
    const bytes = readFileSync(new URL(asset.file, root));
    assert.equal(bytes.length, asset.bytes);
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      asset.sha256,
      asset.file,
    );
    if (!asset.file.endsWith(".glb")) continue;
    assert.equal(bytes.toString("utf8", 0, 4), "glTF");
    assert.equal(bytes.readUInt32LE(4), 2);
    const doc = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
    assert(doc.meshes.length > 0);
    assert(doc.images.length > 0);
    assert(
      doc.images.every(
        (image) => Number.isInteger(image.bufferView) && !image.uri,
      ),
    );
    assert(doc.buffers.every((buffer) => !buffer.uri));
    if (asset.file === "apartment-facade-kit.glb")
      assert(doc.nodes.some((n) => n.name === "window_centered_large_03"));
  }
});
