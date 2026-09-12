// Reproducible asset download, not a build-time network dependency. Poly Haven assets: CC0.
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const root = new URL("../public/vision-materials/", import.meta.url);
await mkdir(root, { recursive: true });
const manifest = [];
async function download(id, key, name) {
  const response = await fetch(`https://api.polyhaven.com/files/${id}`, {
    headers: { "User-Agent": "Heatpilot-Vision-Asset-Preparation/1.0" },
  });
  if (!response.ok) throw Error(`Metadata ${response.status}`);
  const f = await response.json(),
    file = f[key]?.["1k"]?.jpg || f[key]?.["1k"]?.png;
  if (!file) throw Error(`Missing ${id}/${key}`);
  const res = await fetch(file.url);
  if (!res.ok) throw Error(`Asset ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (createHash("md5").update(bytes).digest("hex") !== file.md5)
    throw Error("Asset checksum mismatch");
  await writeFile(new URL(name, root), bytes);
  manifest.push({
    file: name,
    asset: id,
    map: key,
    url: file.url,
    source: `https://polyhaven.com/a/${id}`,
    licence: "CC0-1.0",
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
  console.log(name, bytes.length);
}
for (const id of [
  "asphalt_02",
  "snow_02",
  "concrete_wall_007",
  "concrete_pavement",
]) {
  const meta = await fetch(`https://api.polyhaven.com/files/${id}`).then((r) =>
    r.json(),
  );
  const diffuse = Object.keys(meta).find((k) => /^(diff|diffuse)$/i.test(k));
  await download(id, diffuse, `${id}-colour.jpg`);
  await download(id, "nor_gl", `${id}-normal.jpg`);
  await download(id, "arm", `${id}-arm.jpg`);
}
await writeFile(
  new URL("manifest.json", root),
  JSON.stringify(manifest, null, 2) + "\n",
);
