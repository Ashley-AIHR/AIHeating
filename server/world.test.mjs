import { test } from "node:test";
import assert from "node:assert/strict";
import { ObservationStore, worldContext, site } from "./world.mjs";
const now = Date.now();
const observation = () => ({
  assetId: "B10",
  metric: "indoorC",
  value: 20,
  unit: "degC",
  timestamp: new Date(now).toISOString(),
  quality: "good",
  source: "test gateway",
});
test("world selection resolves the physical branch and rejects unknown assets", () => {
  const w = worldContext({ revision: 1, time: "test", assumptions: [] }, "B10");
  assert(w.relatedAssets.some((a) => a.id === "far"));
  assert(!w.relatedAssets.some((a) => a.id === "near"));
  assert.throws(() => worldContext({}, "B99"));
});
test("telemetry validates units, identities, freshness and duplicate ordering atomically", () => {
  const s = new ObservationStore();
  assert.equal(s.snapshot(now).status, "disconnected");
  const batch = { siteId: site.id, observations: [observation()] };
  assert.equal(s.ingest(batch, now).accepted, 1);
  assert.equal(s.snapshot(now).status, "receiving");
  assert.equal(s.snapshot(now + 130000).status, "stale");
  assert.throws(() => s.ingest(batch, now));
  for (const change of [
    { unit: "F" },
    { assetId: "unknown" },
    { value: Infinity },
    { quality: "live" },
    { timestamp: "yesterday" },
    { timestamp: new Date(now + 90000).toISOString() },
    { metric: "pumpHz", unit: "Hz" },
  ]) {
    assert.throws(() =>
      new ObservationStore().ingest(
        { ...batch, observations: [{ ...observation(), ...change }] },
        now,
      ),
    );
  }
  const clean = new ObservationStore();
  assert.throws(() =>
    clean.ingest(
      {
        ...batch,
        observations: [observation(), { ...observation(), assetId: "bad" }],
      },
      now,
    ),
  );
  assert.equal(clean.snapshot().observations.length, 0);
});
