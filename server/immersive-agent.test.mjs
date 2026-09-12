import { test } from "node:test";
import assert from "node:assert/strict";
import { investigate } from "./immersive-agent.mjs";
const snapshot = {
  revision: 4,
  time: "2025-01-15T08:30:00+08:00",
  assumptions: ["synthetic"],
  limits: {},
  buildings: [],
};
test("diagnostic agent executes bounded tools and ties scene actions to original context", async () => {
  const methods = [];
  let rounds = 0;
  const r = await investigate({
    session: "s",
    args: {
      role: "diagnostic",
      assetId: "B10",
      revision: 4,
      question: "Investigate",
    },
    model: "test-model",
    rpc: async (s, m) => {
      methods.push(m);
      return m === "snapshot" ? snapshot : { findings: [] };
    },
    complete: async () => ({
      choices: [
        {
          message:
            rounds++ === 0
              ? {
                  role: "assistant",
                  tool_calls: [
                    {
                      id: "a",
                      type: "function",
                      function: { name: "inspect_world", arguments: "{}" },
                    },
                    {
                      id: "b",
                      type: "function",
                      function: { name: "actuate_pump", arguments: "{}" },
                    },
                  ],
                }
              : {
                  role: "assistant",
                  content: "The branch requires a reference measurement.",
                },
        },
      ],
      usage: { total_tokens: 10 },
    }),
  });
  assert.equal(r.assetId, "B10");
  assert.equal(r.revision, 4);
  assert.equal(r.totalTokens, 20);
  assert(r.trace.some((t) => t.result.error === "Tool not permitted"));
  assert(!methods.includes("apply"));
  assert.deepEqual(r.sceneActions[0].assetIds, ["B10"]);
});
test("stale/replay context is rejected before any paid completion", async () => {
  for (const args of [
    { revision: 3 },
    { revision: 4, mode: "replay" },
    { revision: 4, assetId: "B99" },
  ]) {
    await assert.rejects(() =>
      investigate({
        session: "s",
        args,
        model: "test",
        rpc: async () => snapshot,
        complete: async () => {
          assert.fail("must not call provider");
        },
      }),
    );
  }
});
test("optimisation agent uses actual optimiser tool output, not invented plans", async () => {
  let solved = 0;
  const result = {
    recommendation: { planHash: "proof" },
    verification: { passed: true },
  };
  const r = await investigate({
    session: "s",
    args: { role: "optimisation", revision: 4 },
    model: "test",
    rpc: async (s, m) =>
      m === "snapshot" ? snapshot : m === "optimise" ? (solved++, result) : {},
    complete: async () => ({
      choices: [
        {
          message: { content: "Review the computed evidence before approval." },
        },
      ],
    }),
  });
  assert.equal(solved, 1);
  assert.equal(r.optimisation, result);
});
