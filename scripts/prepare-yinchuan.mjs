// Deterministic conversion of a downloaded OSM extract; never invent footprint geometry.
import fs from "node:fs";
import crypto from "node:crypto";
const source = process.argv[2];
if (!source)
  throw new Error("Usage: node scripts/prepare-yinchuan.mjs source.json");
const bytes = fs.readFileSync(source),
  data = JSON.parse(bytes);
const origin = [106.26, 38.445];
const point = (p) => [
  (p.lon - origin[0]) * 111320 * Math.cos((origin[1] * Math.PI) / 180),
  -(p.lat - origin[1]) * 111320,
];
const buildings = data.elements
  .filter((x) => x.tags?.building && x.geometry?.length >= 4)
  .map((x) => {
    const polygon = x.geometry.map(point);
    const centre = polygon
      .slice(0, -1)
      .reduce(
        (a, p) => [
          a[0] + p[0] / (polygon.length - 1),
          a[1] + p[1] / (polygon.length - 1),
        ],
        [0, 0],
      );
    const height =
      Number.parseFloat(x.tags.height) ||
      Number.parseFloat(x.tags["building:levels"]) * 3 ||
      18;
    return {
      id: `osm-way-${x.id}`,
      polygon,
      centre,
      height,
      heightSource: x.tags.height
        ? "OSM height"
        : x.tags["building:levels"]
          ? "OSM levels × assumed 3 m"
          : "assumed 18 m",
      tags: x.tags,
    };
  })
  .sort((a, b) => a.centre[1] - b.centre[1] || a.centre[0] - b.centre[0]);
buildings.slice(0, 12).forEach((x, i) => {
  x.demoAssetId = `B${String(i + 1).padStart(2, "0")}`;
});
const output = {
  origin,
  crs: "WGS84 source; local equirectangular metres for display only",
  source: "OpenStreetMap contributors",
  licence: "ODbL 1.0",
  url: "https://www.openstreetmap.org/copyright",
  extractTimestamp: data.osm3s.timestamp_osm_base,
  sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
  scope:
    "Yinchuan urban context near Baofuqiao; not a verified estate boundary. Heights may be assumed. B01–B12 bindings and heating routes are synthetic, not OSM utility data.",
  buildings,
  roads: data.elements
    .filter((x) => x.tags?.highway && x.geometry)
    .map((x) => ({
      id: `osm-way-${x.id}`,
      kind: x.tags.highway,
      name: x.tags.name || "",
      points: x.geometry.map(point),
    })),
};
fs.mkdirSync("public/site-assets", { recursive: true });
fs.writeFileSync("public/site-assets/yinchuan.json", JSON.stringify(output));
console.log(
  `${buildings.length} source footprints, ${output.roads.length} road ways; 12 explicit demonstration bindings`,
);
