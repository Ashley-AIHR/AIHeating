import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { engineeringEvidence } from "./engineering-review.mjs";
import { worldContext } from "./world.mjs";
import { investigate } from "./immersive-agent.mjs";
const model = JSON.parse(
  readFileSync(
    new URL("../public/engineering-assets/duplex-mep.json", import.meta.url),
    "utf8",
  ),
);
const snapshot = {
  cityId: "shanghai",
  revision: 4,
  time: "2025-01-15T08:30:00+08:00",
  assumptions: ["synthetic"],
  limits: {},
  buildings: [],
};
const context = worldContext(snapshot, "B10");
const review = {
  source: "public-bim",
  sourceHash: model.sourceSha256,
  componentId: model.assets[0].id,
  measurements: [{ a: [0, 0, 0], b: [3, 4, 0], distance: 999 }],
  notes: ["Check maintenance access"],
};
test("BIM evidence resolves source identity and recomputes distance without inventing bindings", () => {
  const result = engineeringEvidence(review, context);
  assert.equal(result.measurements[0].distance, 5);
  assert.equal(result.component.kind, model.assets[0].kind);
  assert.equal(result.selectedSimulationAsset, "B10");
  assert.equal(result.cityId, "shanghai");
  assert(result.heatSupplyChain.some((a) => a.id === "far"));
  assert.match(result.authority, /No component-to-instrument binding/);
  assert.equal(result.component.pressureKpa, undefined);
});
test("BIM evidence rejects forged source, unknown components and malformed observations", () => {
  for (const invalid of [
    { source: "live" },
    { sourceHash: "0".repeat(64) },
    { componentId: "not-an-asset" },
    { measurements: [{ a: [NaN, 0, 0], b: [0, 0, 0] }] },
    { notes: ["x".repeat(2001)] },
  ])
    assert.throws(
      () => engineeringEvidence({ ...review, ...invalid }, context),
      /Invalid engineering/,
    );
  assert.equal(engineeringEvidence(undefined, context), null);
  assert.match(
    engineeringEvidence({ ...review, source: "local-glb" }, context).component
      .provenance,
    /has not inspected/,
  );
});
test("Engineering review reaches decision prompt, streamed evidence and final reporting, without actuation", async () => {
  const events = [],
    prompts = [],
    methods = [];
  const result = await investigate({
    session: "studio-test",
    args: {
      role: "diagnostic",
      assetId: "B10",
      revision: 4,
      engineeringReview: review,
    },
    model: "fixture",
    onEvent: (e) => events.push(e),
    rpc: async (_session, method) => {
      methods.push(method);
      return method === "snapshot" ? snapshot : { findings: [] };
    },
    complete: async (payload) => {
      prompts.push(JSON.stringify(payload.messages));
      return {
        choices: [
          {
            message: {
              role: "assistant",
              content:
                "Review the reference assembly independently; test the selected circuit using simulated physical evidence.",
            },
          },
        ],
        usage: { total_tokens: 1 },
      };
    },
  });
  assert(prompts.every((p) => p.includes("Check maintenance access")));
  assert(
    events.some(
      (e) =>
        e.tool === "inspect_engineering_review" && e.status === "completed",
    ),
  );
  assert(result.trace.some((e) => e.tool === "inspect_engineering_review"));
  assert(!methods.includes("apply"));
  assert.equal(result.completionStatus, "complete");
});
