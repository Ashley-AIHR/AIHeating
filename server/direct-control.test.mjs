import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { dispatch } from "./twin-node.mjs";

test("manual valve preview is non-mutating; approved command changes only mapped valve and preserves the control boundary", () => {
  const id = randomUUID(),
    before = dispatch(id, "snapshot");
  const preview = dispatch(id, "control_preview", {
    revision: before.revision,
    assetId: "far",
    control: "valvePct",
    value: 45,
  });
  assert(preview.verified && preview.candidateId);
  assert.deepEqual(dispatch(id, "snapshot"), before);
  const after = dispatch(id, "apply", { candidateId: preview.candidateId });
  assert.equal(after.elapsedMinutes, before.elapsedMinutes + 30);
  assert.equal(after.zones[2].valvePct, 45);
  assert.equal(after.zones[0].valvePct, before.zones[0].valvePct);
  assert.equal(after.pumpHz, before.pumpHz);
  assert.notEqual(after.flowM3h, before.flowM3h);
  assert.equal(after.flowM3h, preview.firstStep.flowM3h);
  assert(after.events.at(-1).title.includes("Manual command"));
  assert.throws(
    () => dispatch(id, "apply", { candidateId: preview.candidateId }),
    /expired/,
  );
  assert.doesNotThrow(
    () => dispatch(id, "optimise"),
    "An operator must be able to hand the changed state back to AI planning",
  );
});
test("manual controls reject stale revisions, unknown bindings, non-finite values and excess ramps atomically", () => {
  const id = randomUUID(),
    before = dispatch(id, "snapshot");
  for (const args of [
    { revision: 999, assetId: "far", control: "valvePct", value: 40 },
    { revision: before.revision, assetId: "B10", control: "pumpHz", value: 47 },
    {
      revision: before.revision,
      assetId: "ST01",
      control: "pumpHz",
      value: NaN,
    },
    {
      revision: before.revision,
      assetId: "far",
      control: "valvePct",
      value: 100,
    },
  ]) {
    assert.throws(() => dispatch(id, "control_preview", args));
    assert.deepEqual(dispatch(id, "snapshot"), before);
  }
});
test("infeasible manual control is visibly rejected and has no application token", () => {
  const id = randomUUID();
  let before = dispatch(id, "reset", { scenario: "cold" });
  for (const [control, value] of [
    ...[50, 48, 46, 44, 42, 40].map((v) => ["supplyC", v]),
    ...[43, 41].map((v) => ["pumpHz", v]),
  ]) {
    const preview = dispatch(id, "control_preview", {
      revision: before.revision,
      assetId: "ST01",
      control,
      value,
    });
    assert(preview.verified);
    before = dispatch(id, "apply", { candidateId: preview.candidateId });
  }
  const p = dispatch(id, "control_preview", {
    revision: before.revision,
    assetId: "ST01",
    control: "pumpHz",
    value: 39,
  });
  assert.equal(p.verified, false);
  assert.equal(p.candidateId, null);
  assert.match(p.reason, /blocked/i);
  assert.deepEqual(dispatch(id, "snapshot"), before);
});
