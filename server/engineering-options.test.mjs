import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { dispatch, newSession, optimise } from "./twin-node.mjs";
import { investigate } from "./immersive-agent.mjs";
const goal = {
  metric: "temperature",
  scope: "asset",
  assetId: "B10",
  target: 21,
  deadlineMinutes: 120,
  minC: 18,
  maxC: 23,
  allowShared: true,
};
const create = () => {
  const id = randomUUID();
  const state = dispatch(id, "reset", {
    cityId: "beijing",
    scenario: "imbalance",
  });
  return { id, state };
};
const study = (id, state) =>
  dispatch(id, "engineering_study", {
    goal,
    revision: state.revision,
    contextId: state.contextId,
  });
test("shared permission enables coordinated branches and six ramp-bounded stages", () => {
  const s = newSession("imbalance", "beijing"),
    r = optimise(s, { goal });
  assert.equal(r.bestAttempt.schedule.length, 6);
  let previous = s.engine.controls;
  for (const [i, c] of r.bestAttempt.schedule.entries()) {
    assert.equal(c.minute, i * 30);
    assert(Math.abs(c.supplyC - previous.supplyC) <= 2.000001);
    assert(Math.abs(c.pumpHz - previous.pumpHz) <= 2.000001);
    c.valvesPct.forEach((v, j) =>
      assert(Math.abs(v - previous.valvesPct[j]) <= 10.000001),
    );
    previous = c;
  }
  assert.notEqual(r.bestAttempt.schedule[0].valvesPct[0], 78);
});
test("engineering alternatives preserve original state, expose energy costs and never issue operating tokens", () => {
  const { id, state } = create(),
    r = study(id, state);
  assert.equal(r.preferredId, "emitters-3");
  assert.deepEqual(dispatch(id, "snapshot"), state);
  for (const row of r.rows) {
    assert.equal(row.optimisation.recommendation, null);
    assert.equal(row.optimisation.bestAttempt.candidateId, undefined);
    assert(row.optimisation.verification.maxResidual < 1e-7);
  }
  const best = r.rows.at(-1);
  assert(best.passed && best.goalResult.guardrailsMet);
  assert(best.auxiliaryKwh > 100 && best.auxiliaryKwh <= 60 * 2);
  assert.equal(r.rows.find((v) => v.id === "auxiliary-40").passed, false);
  assert(r.storedHeatIncreaseKwh > 0);
});
test("modified model follows fixed deadline with real steps and original can be recovered", () => {
  const { id, state } = create(),
    r = study(id, state);
  let next = dispatch(id, "engineering_open", {
    studyId: r.studyId,
    optionId: r.preferredId,
  });
  assert.notEqual(next.contextId, state.contextId);
  assert.equal(next.engineering.remainingMinutes, 90);
  assert(
    next.buildings.find((b) => b.id === "B10").modelC >
      state.buildings.find((b) => b.id === "B10").modelC,
  );
  assert(next.buildings.find((b) => b.id === "B01").localValvePct < 100);
  for (const remaining of [60, 30, 0]) {
    const step = dispatch(id, "engineering_step", { revision: next.revision });
    assert(step.applied);
    next = step.state;
    assert.equal(next.engineering.remainingMinutes, remaining);
  }
  assert(
    Math.abs(next.buildings.find((b) => b.id === "B10").modelC - 21) < 0.3,
  );
  assert(next.buildings.every((b) => b.modelC >= 18 && b.modelC <= 23));
  assert.throws(
    () => dispatch(id, "engineering_step", { revision: next.revision }),
    /deadline/,
  );
  const restored = dispatch(id, "engineering_restore", {
    revision: next.revision,
  });
  assert.deepEqual(restored.buildings, state.buildings);
  assert.equal(restored.elapsedMinutes, state.elapsedMinutes);
  assert.equal(restored.engineering, null);
});
test("cross-session, stale studies, unavailable valves and failed alternatives are rejected", () => {
  const { id, state } = create(),
    r = study(id, state),
    other = create();
  assert.throws(() =>
    dispatch(other.id, "engineering_open", {
      studyId: r.studyId,
      optionId: r.preferredId,
    }),
  );
  assert.throws(() =>
    dispatch(id, "engineering_valve", {
      revision: state.revision,
      assetId: "B10",
      value: 10,
    }),
  );
  assert.throws(() =>
    dispatch(id, "engineering_open", {
      studyId: r.studyId,
      optionId: "emitters",
    }),
  );
  dispatch(id, "advance");
  assert.throws(() =>
    dispatch(id, "engineering_open", {
      studyId: r.studyId,
      optionId: r.preferredId,
    }),
  );
});
test("manual local valve changes coupled physical flow only within the engineering scenario", () => {
  const { id, state } = create(),
    r = study(id, state);
  const next = dispatch(id, "engineering_open", {
    studyId: r.studyId,
    optionId: r.preferredId,
  });
  const after = dispatch(id, "engineering_valve", {
    revision: next.revision,
    assetId: "B10",
    value: 10,
  });
  assert.notEqual(
    after.buildings.find((b) => b.id === "B10").flowM3h,
    next.buildings.find((b) => b.id === "B10").flowM3h,
  );
  assert.equal(after.engineering.remainingMinutes, 60);
  assert.equal(after.engineering.design.manualValves.B10, 10);
  assert.throws(() =>
    dispatch(id, "engineering_valve", {
      revision: after.revision,
      assetId: "B10",
      value: -10,
    }),
  );
});
test("agent automatically exposes engineering evidence after a failed operating goal without applying it", async () => {
  const { id, state } = create();
  let round = 0;
  const run = await investigate({
    session: id,
    args: {
      role: "optimisation",
      assetId: "B10",
      revision: state.revision,
      goal,
    },
    model: "fixture",
    rpc: async (...args) => dispatch(...args),
    complete: async () => ({
      choices: [
        {
          message:
            round++ === 0
              ? {
                  tool_calls: [
                    {
                      id: "solve",
                      type: "function",
                      function: { name: "optimise_network", arguments: "{}" },
                    },
                  ],
                }
              : {
                  content:
                    "The existing operating plan misses the target. Review the modified engineering alternative and its electrical requirements before opening a separate simulation.",
                },
        },
      ],
    }),
  });
  assert.equal(run.engineeringStudy.preferredId, "emitters-3");
  assert(run.trace.some((t) => t.tool === "compare_engineering_options"));
  assert.deepEqual(dispatch(id, "snapshot"), state);
});
