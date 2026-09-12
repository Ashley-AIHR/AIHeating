// Asset acquisition only. Sources are CC0; never run during Render deployment.
import { execFileSync } from "node:child_process";
import { mkdirSync, existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
const root = resolve("../work/visual-sources");
const proxy = process.env.ASSET_DOWNLOAD_PROXY;
const curl = [
  "--fail",
  "--silent",
  "--show-error",
  "--retry",
  "2",
  "--connect-timeout",
  "15",
  "--max-time",
  "240",
  ...(proxy ? ["--proxy", proxy] : []),
];
for (const id of process.argv.slice(2)) {
  if (!/^[a-z0-9_]+$/.test(id)) throw Error("Invalid asset id");
  const meta = JSON.parse(
    execFileSync("curl", [...curl, `https://api.polyhaven.com/files/${id}`]),
  );
  const asset = meta.gltf?.["1k"]?.gltf;
  if (!asset) throw Error("No glTF source");
  for (const [name, file] of [
    [`${id}.gltf`, asset],
    ...Object.entries(asset.include),
  ]) {
    const path = resolve(root, id, name);
    if (
      !path.startsWith(root + "/") ||
      !file.url.startsWith("https://dl.polyhaven.org/")
    )
      throw Error("Unexpected source");
    mkdirSync(dirname(path), { recursive: true });
    if (!existsSync(path))
      execFileSync("curl", [...curl, file.url, "--output", path]);
    const hash = createHash("md5").update(readFileSync(path)).digest("hex");
    if (hash !== file.md5) throw Error(`Checksum mismatch: ${name}`);
  }
  console.log(
    `Verified ${id}: ${Object.keys(asset.include).length + 1} source files`,
  );
}
