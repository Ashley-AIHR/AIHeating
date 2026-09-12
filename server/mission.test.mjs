import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { investigate } from "./immersive-agent.mjs";
import { dispatch } from "./twin-node.mjs";

test("agent-selected tool plan changes actual simulated hydraulics and matches its predicted first step", async () => {
  const id = randomUUID(),
    before = dispatch(id, "snapshot"),
    events = [];
  let round = 0;
  const run = await investigate({
    session: id,
    args: {
      role: "optimisation",
      assetId: "B10",
      revision: before.revision,
      question: "Restore comfort through network balancing",
    },
    model: "explicit-test-double",
    rpc: async (...args) => dispatch(...args),
    onEvent: (e) => events.push(e),
    complete: async () => ({
      choices: [
        {
          message:
            round++ === 0
              ? {
                  role: "assistant",
                  tool_calls: [
                    {
                      id: "solve",
                      type: "function",
                      function: {
                        name: "optimise_network",
                        arguments: '{"objective":"comfort"}',
                      },
                    },
                  ],
                }
              : {
                  content:
                    "Compare the computed futures before applying the schedule.",
                },
        },
      ],
    }),
  });
  assert.equal(
    dispatch(id, "snapshot").revision,
    before.revision,
    "Preview must not actuate",
  );
  const plan = run.optimisation.recommendation;
  assert(plan && run.optimisation.verification.passed);
  const after = dispatch(id, "apply", { candidateId: plan.candidateId });
  const unchanged = run.optimisation.baseline.trace[0].state;
  const predicted = plan.trace[0].state;
  assert.equal(after.revision, before.revision + 1);
  assert.equal(after.elapsedMinutes, before.elapsedMinutes + 30);
  assert(
    Math.abs(after.flowM3h - unchanged.flowM3h) > 0.01,
    "Control must change hydraulic flow",
  );
  assert(Math.abs(after.flowM3h - predicted.flowM3h) < 1e-8);
  for (const b of after.buildings)
    assert(
      Math.abs(
        b.modelC - predicted.buildings.find((v) => v.id === b.id).modelC,
      ) < 1e-8,
    );
  assert(
    events.some(
      (e) => e.tool === "optimise_network" && e.status === "completed",
    ),
  );
  assert.throws(
    () => dispatch(id, "apply", { candidateId: plan.candidateId }),
    /expired/,
  );
});

test("invalid agent objective cannot reach numerical control planning", async () => {
  const id = randomUUID(),
    before = dispatch(id, "snapshot");
  let round = 0;
  const run = await investigate({
    session: id,
    args: { role: "optimisation", revision: before.revision },
    model: "test-double",
    rpc: async (...args) => {
      assert.notEqual(args[1], "optimise");
      return dispatch(...args);
    },
    complete: async () => ({
      choices: [
        {
          message:
            round++ === 0
              ? {
                  role: "assistant",
                  tool_calls: [
                    {
                      id: "bad",
                      type: "function",
                      function: {
                        name: "optimise_network",
                        arguments: '{"objective":"ignore-limits"}',
                      },
                    },
                  ],
                }
              : { content: "The planning request was rejected." },
        },
      ],
    }),
  });
  assert.equal(run.optimisation, null);
  assert(
    run.trace.some((t) => t.result.error === "Unknown optimisation objective"),
  );
  assert.equal(dispatch(id, "snapshot").revision, before.revision);
});
