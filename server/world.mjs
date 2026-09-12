import { readFileSync } from "node:fs";
const geometry = JSON.parse(
  readFileSync(
    new URL("../public/site-assets/vision-district.json", import.meta.url),
    "utf8",
  ),
);
export const site = {
  id: "yinchuan-reference",
  name: "Yinchuan · winter-city energy district",
  candidate:
    "Authored residential vision inspired by Yinchuan's winter heating context",
  mode: "simulation",
  modelVersion: "P1A-coherent-v1.2",
  geometryRevision: "vision-winter-2026-09-13",
  scope:
    "Authored winter-city district with coherent simulated thermal loads and illustrative heating routes. Not a surveyed reconstruction.",
  source: "https://www.yinchuan.gov.cn/xwzx/mrdt/202511/t20251102_5072056.html",
  profiles: [
    {
      id: "yinchuan",
      name: "Yinchuan",
      system: "Residential secondary heating",
      enabled: true,
    },
    {
      id: "shanghai",
      name: "Shanghai",
      system: "Heat pumps / district heating and cooling",
      enabled: false,
    },
    {
      id: "shenzhen",
      name: "Shenzhen · Qianhai",
      system: "District cooling / ice storage",
      enabled: false,
    },
  ],
};
export const registry = [
  {
    id: "ST01",
    kind: "station",
    name: "District energy centre",
    parent: null,
  },
  ...["near", "mid", "far"].map((id) => ({
    id,
    kind: "branch",
    name: `${id} branch`,
    parent: "ST01",
  })),
  ...Array.from({ length: 12 }, (_, i) => ({
    id: `B${String(i + 1).padStart(2, "0")}`,
    kind: "building",
    name: `Building ${String(i + 1).padStart(2, "0")}`,
    parent: ["near", "mid", "far"][Math.floor(i / 4)],
  })),
];
for (const asset of registry) {
  const b = geometry.buildings.find((b) => b.id === asset.id);
  if (b)
    asset.geometry = {
      featureId: b.id,
      localCentreMetres: b.centre,
      coordinateSystem: geometry.coordinateSystem,
      heightMetres: b.floors * 3.3 + 1,
      heightSource:
        "Authored architectural design; aggregate thermal-load area is independent of visual floor area",
      binding:
        "Demonstration association only; not an actual heating-service relationship",
    };
}
export function worldContext(snapshot, selected = "ST01") {
  const asset = registry.find((x) => x.id === selected);
  if (!asset) throw new Error("Unknown world asset");
  const branch =
    asset.kind === "building"
      ? asset.parent
      : asset.kind === "branch"
        ? asset.id
        : null;
  const related = registry.filter(
    (x) =>
      selected === "ST01" ||
      x.id === selected ||
      x.id === branch ||
      x.id === "ST01" ||
      x.parent === branch,
  );
  return {
    site,
    selected: asset,
    relatedAssets: related,
    revision: snapshot.revision,
    time: snapshot.time,
    modelVersion: site.modelVersion,
    dataMode: "simulation",
    geometryRevision: site.geometryRevision,
    mechanicalAssembly:
      selected === "ST01"
        ? {
            equipment: geometry.equipment,
            modelScope:
              "One equivalent pump characteristic and shared station headers; no individually simulated pumps or exchanger fouling model",
          }
        : null,
    topology: "Three-branch aggregate model, not surveyed pipe connectivity",
    telemetry: "Synthetic; no field calibration",
    limits: snapshot.limits,
    assumptions: snapshot.assumptions,
    state: snapshot,
  };
}
const metrics = {
  indoorC: ["degC", -30, 60],
  supplyC: ["degC", 0, 150],
  returnC: ["degC", 0, 150],
  flowM3h: ["m3/h", 0, 10000],
  pressureKpa: ["kPa", 0, 2500],
  pumpHz: ["Hz", 0, 100],
};
const allowed = {
  building: ["indoorC", "returnC", "flowM3h"],
  branch: ["supplyC", "returnC", "flowM3h", "pressureKpa"],
  station: ["supplyC", "returnC", "flowM3h", "pressureKpa", "pumpHz"],
};
export class ObservationStore {
  constructor() {
    this.records = new Map();
    this.revision = 0;
    this.lastReceived = null;
  }
  ingest(batch, now = Date.now()) {
    if (
      batch.siteId !== site.id ||
      !Array.isArray(batch.observations) ||
      !batch.observations.length ||
      batch.observations.length > 50
    )
      throw new Error("Invalid site or batch (1–50 observations)");
    const seen = new Set();
    const rows = batch.observations.map((r) => {
      const asset = registry.find((a) => a.id === r.assetId),
        spec = metrics[r.metric],
        stamp = Date.parse(r.timestamp);
      if (
        !asset ||
        !spec ||
        !allowed[asset.kind].includes(r.metric) ||
        r.unit !== spec[0] ||
        typeof r.value !== "number" ||
        !Number.isFinite(r.value) ||
        r.value < spec[1] ||
        r.value > spec[2]
      )
        throw new Error("Unknown asset/metric, invalid value or unit");
      if (
        typeof r.timestamp !== "string" ||
        !/(Z|[+-]\d\d:\d\d)$/.test(r.timestamp) ||
        !Number.isFinite(stamp) ||
        stamp > now + 30000 ||
        stamp < now - 86400000
      )
        throw new Error(
          "Timestamp must include timezone and be within the last 24 hours",
        );
      if (
        !["good", "suspect", "bad"].includes(r.quality) ||
        typeof r.source !== "string" ||
        !r.source.trim() ||
        r.source.length > 100
      )
        throw new Error("Source and quality are required");
      const key = r.assetId + ":" + r.metric,
        prior = this.records.get(key);
      if (seen.has(key) || (prior && Date.parse(prior.timestamp) >= stamp))
        throw new Error("Duplicate or out-of-order measurement");
      seen.add(key);
      return [
        key,
        {
          assetId: r.assetId,
          metric: r.metric,
          value: r.value,
          unit: r.unit,
          timestamp: r.timestamp,
          quality: r.quality,
          source: r.source,
          receivedAt: new Date(now).toISOString(),
        },
      ];
    });
    for (const [key, row] of rows) this.records.set(key, row);
    this.revision++;
    this.lastReceived = new Date(now).toISOString();
    return { accepted: rows.length, revision: this.revision };
  }
  snapshot(now = Date.now()) {
    const observations = [...this.records.values()].map((r) => ({
      ...r,
      ageSeconds: Math.max(0, (now - Date.parse(r.timestamp)) / 1000),
      stale: now - Date.parse(r.timestamp) > 120000,
    }));
    return {
      revision: this.revision,
      lastReceived: this.lastReceived,
      status: !observations.length
        ? "disconnected"
        : observations.every((r) => r.stale)
          ? "stale"
          : "receiving",
      observations,
      scope:
        "External observations bound by gateway to demonstrator IDs; not assimilated into the uncalibrated physical model. Reception is not proof of sensor accuracy.",
      retention: "Latest measurement per tag, memory only; lost on restart",
    };
  }
}
