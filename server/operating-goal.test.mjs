import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { newSession, snapshot, optimise, dispatch } from "./twin-node.mjs";
import { operatingGoal, assessGoal } from "./operating-goal.mjs";
import { investigate } from "./immersive-agent.mjs";
const goal = (extra = {}) => ({
  metric: "temperature",
  scope: "asset",
  assetId: "B10",
  target: 21,
  deadlineMinutes: 120,
  minC: 18,
  maxC: 23,
  allowShared: true,
  ...extra,
});
test("goal validation rejects ambiguous scope, unsupported bounds and invented actuation", () => {
  const state = snapshot(newSession());
  for (const change of [
    { scope: "asset", assetId: "ST01" },
    { deadlineMinutes: 0 },
    { target: NaN },
    { minC: 17 },
    { valveId: "B10" },
    { metric: "pumpReduction" },
  ])
    assert.throws(() => operatingGoal(goal(change), state));
  assert.deepEqual(operatingGoal(goal(), state).branchIds, ["far"]);
});
test("individual goal respects shared-control permission and unrelated branch valves", () => {
  const s = newSession("warming", "beijing"),
    before = snapshot(s),
    result = optimise(s, { goal: goal({ allowShared: false, target: 22 }) });
  for (const block of result.bestAttempt.schedule) {
    assert.equal(block.supplyC, s.engine.controls.supplyC);
    assert.equal(block.pumpHz, s.engine.controls.pumpHz);
    assert.deepEqual(
      block.valvesPct.slice(0, 2),
      s.engine.controls.valvesPct.slice(0, 2),
    );
  }
  assert.equal(snapshot(s).revision, before.revision);
});
test("different precise temperature targets drive different numerical schedules", () => {
  const s = newSession("warming", "beijing");
  const cold = optimise(s, { goal: goal({ target: 20 }) });
  const warm = optimise(s, { goal: goal({ target: 23, maxC: 25 }) });
  assert.notDeepEqual(cold.bestAttempt.schedule, warm.bestAttempt.schedule);
  assert(warm.goalResult.achieved > cold.goalResult.achieved);
});
test("missed goals preserve evidence but never receive application authority", () => {
  const r = optimise(newSession("imbalance", "beijing"), { goal: goal() });
  assert.equal(r.verification.passed, false);
  assert.equal(r.recommendation, null);
  assert.equal(r.bestAttempt.candidateId, undefined);
  assert(r.goalResult.achieved < 20);
});
test("feasible district savings use unchanged baseline at the exact deadline", () => {
  const r = optimise(newSession("warming", "beijing"), {
    goal: goal({
      metric: "pumpReduction",
      scope: "district",
      assetId: "ST01",
      target: 8,
      minC: 20,
    }),
  });
  assert(r.recommendation.candidateId);
  assert(r.goalResult.passed);
  const a = r.bestAttempt.goalSamples.find((s) => s.minutes === 120).pumpKwh;
  const b = r.baseline.goalSamples.find((s) => s.minutes === 120).pumpKwh;
  assert.equal(r.goalResult.achieved, ((b - a) / b) * 100);
});
test("comfort gates inspect intermediate and post-deadline samples, not just target averages", () => {
  const g = operatingGoal(
    goal({ target: 21 }),
    snapshot(newSession("warming")),
  );
  const sample = (minutes, t = 21) => ({
    minutes,
    temperatures: Object.fromEntries(
      Object.keys(g.initialTemperatures).map((id) => [
        id,
        id === "B01" ? t : 21,
      ]),
    ),
  });
  const row = {
    goalSamples: [sample(5), sample(120), sample(125, 24), sample(180)],
  };
  const a = assessGoal(g, row, row);
  assert(a.targetMet);
  assert(!a.guardrailsMet);
  assert.deepEqual(a.violatingAssets, ["B01"]);
});
test("LLM cannot replace the operator goal when requesting numerical optimisation", async () => {
  const id = randomUUID(),
    state = dispatch(id, "snapshot"),
    requested = goal();
  let round = 0;
  let passed;
  const run = await investigate({
    session: id,
    args: {
      role: "optimisation",
      task: "comfort",
      assetId: "B10",
      revision: state.revision,
      goal: requested,
    },
    model: "fixture",
    rpc: async (s, m, a) => {
      if (m === "optimise") passed = a.goal;
      return dispatch(s, m, a);
    },
    complete: async () => ({
      choices: [
        {
          message:
            round++ < 2
              ? {
                  tool_calls: [
                    {
                      id: "solve" + round,
                      type: "function",
                      function: {
                        name: "optimise_network",
                        arguments: JSON.stringify(
                          round === 1
                            ? { objective: "energy", goal: { target: 18 } }
                            : { objective: "energy" },
                        ),
                      },
                    },
                  ],
                }
              : {
                  content:
                    "Review the numerical outcome and unmet constraints before taking action.",
                },
        },
      ],
    }),
  });
  assert.deepEqual(passed, requested);
  assert.equal(run.goal.target, 21);
  assert(!run.optimisation.recommendation);
});
test("sensor specialist offers diagnostic tools without control planning", async () => {
  const id = randomUUID(),
    state = dispatch(id, "snapshot");
  let round = 0;
  const run = await investigate({
    session: id,
    args: {
      role: "diagnostic",
      task: "sensor",
      assetId: "B10",
      revision: state.revision,
    },
    model: "fixture",
    rpc: async (...a) => dispatch(...a),
    complete: async (request) => {
      if (round++ === 0) {
        assert(
          !request.tools.some((t) => t.function.name === "optimise_network"),
        );
        assert(
          request.tools.some(
            (t) => t.function.name === "inspect_signal_quality",
          ),
        );
        return {
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    id: "sensor",
                    type: "function",
                    function: {
                      name: "inspect_signal_quality",
                      arguments: "{}",
                    },
                  },
                ],
              },
            },
          ],
        };
      }
      return {
        choices: [
          {
            message: {
              content:
                "Compare the sensor reading against the model estimate; neither is field validation.",
            },
          },
        ],
      };
    },
  });
  assert.equal(run.optimisation, null);
  assert(
    run.trace.some(
      (t) =>
        t.tool === "inspect_signal_quality" ||
        t.name === "inspect_signal_quality",
    ),
  );
  assert.equal(dispatch(id, "snapshot").revision, state.revision);
});
