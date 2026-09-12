import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prepareInvestigation } from "./investigation-context.mjs";
import { dispatch, newSession, snapshot } from "./twin-node.mjs";
import { investigate } from "./immersive-agent.mjs";

test("current-scene investigation rebases to an advanced revision without mutating the simulator", async () => {
  const id = randomUUID(),
    stale = dispatch(id, "snapshot"),
    current = dispatch(id, "advance");
  const args = {
    revision: stale.revision,
    contextId: stale.contextId,
    cityId: stale.cityId,
    scenario: stale.scenario,
    syncCurrent: true,
    role: "diagnostic",
  };
  const prepared = prepareInvestigation(current, args);
  assert(prepared.rebased);
  assert.equal(prepared.args.revision, current.revision);
  const result = await investigate({
    session: id,
    args: prepared.args,
    model: "test",
    rpc: async (id, method, args) => dispatch(id, method, args),
    complete: async ({ messages }) => {
      const context = JSON.parse(messages[1].content).context;
      assert.equal(context.state.revision, current.revision);
      return {
        choices: [
          { message: { content: "Review the current model evidence." } },
        ],
      };
    },
  });
  assert.equal(result.revision, current.revision);
  assert.equal(dispatch(id, "snapshot").revision, current.revision);
});

test("instance identity distinguishes recreated sessions even when their revision numbers match", () => {
  const old = snapshot(newSession()),
    recreated = snapshot(newSession());
  assert.equal(old.revision, recreated.revision);
  assert.notEqual(old.contextId, recreated.contextId);
  assert.throws(
    () =>
      prepareInvestigation(recreated, {
        revision: old.revision,
        contextId: old.contextId,
      }),
    (e) => e.code === "CONTEXT_CHANGED" && e.status === 409,
  );
  assert(
    prepareInvestigation(recreated, { ...old, syncCurrent: true }).rebased,
  );
});

test("city, scenario and replay changes are not silently accepted for a current-scene request", () => {
  const s = snapshot(newSession("cold", "shanghai"));
  for (const patch of [
    { cityId: "yinchuan" },
    { scenario: "warming" },
    { cityId: undefined },
  ]) {
    assert.throws(
      () => prepareInvestigation(s, { ...s, ...patch, syncCurrent: true }),
      (e) => e.status === 409 && e.snapshot.cityId === "shanghai",
    );
  }
  assert.throws(
    () => prepareInvestigation(s, { ...s, mode: "replay", syncCurrent: true }),
    /current simulation/,
  );
  assert.throws(
    () => prepareInvestigation(s, { revision: s.revision + 1 }),
    /state changed/,
  );
});
