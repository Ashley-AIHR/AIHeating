import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { investigate } from "./immersive-agent.mjs";
import { dispatch } from "./twin-node.mjs";
import { guardNarrative } from "./agent-evidence.mjs";
const tool = (id, name = "inspect_world", args = {}) => ({
  id,
  type: "function",
  function: { name, arguments: JSON.stringify(args) },
});
const response = (message) => ({
  choices: [
    { message, finish_reason: message.tool_calls ? "tool_calls" : "stop" },
  ],
});
function run(complete, extra = {}) {
  const session = randomUUID(),
    state = dispatch(session, "snapshot");
  return investigate({
    session,
    args: { revision: state.revision, role: "optimisation", ...extra },
    rpc: async (id, method, args) => dispatch(id, method, args),
    model: "test",
    complete,
  });
}
test("tool budget exhaustion always transitions into a separate tool-free report", async () => {
  let calls = 0;
  const result = await run(async (payload) => {
    calls++;
    assert.equal(payload.reasoning.enabled, false);
    if (payload.tools)
      return response({
        role: "assistant",
        tool_calls: [
          tool(`${calls}-a`),
          tool(`${calls}-b`),
          tool(`${calls}-c`),
        ],
      });
    assert.equal(payload.tool_choice, undefined);
    assert(
      !payload.messages.some((m) => ["assistant", "tool"].includes(m.role)),
    );
    return response({
      content:
        "The evidence was inspected. No control plan was prepared. This remains a synthetic model.",
    });
  });
  assert.equal(calls, 4); // Three tool rounds reach eight executions, then report.
  assert.equal(result.trace.length, 9); // Initial diagnostic plus eight calls.
  assert.equal(result.completionStatus, "complete");
  assert.equal(result.optimisation, null);
  assert(
    result.events.some(
      (e) => e.tool === "agent_report" && e.status === "completed",
    ),
  );
});
test("a plan produced on the fourth tool turn still receives a public report", async () => {
  let calls = 0;
  const result = await run(async (payload) => {
    calls++;
    if (payload.tools)
      return response({
        role: "assistant",
        tool_calls: [
          tool(
            String(calls),
            calls === 4 ? "optimise_network" : "inspect_world",
          ),
        ],
      });
    return response({
      content:
        "A verified simulator plan is ready for review. No controls have been applied.",
    });
  });
  assert.equal(calls, 5);
  assert(result.optimisation.recommendation);
  assert.equal(result.completionStatus, "complete");
});
test("empty or numeric reports are repaired without repeating numerical tools", async () => {
  for (const invalid of ["", "The minimum is 99 degrees."]) {
    let calls = 0;
    const result = await run(async (payload) => {
      calls++;
      if (payload.tools)
        return response({
          role: "assistant",
          tool_calls: [tool("plan", "optimise_network")],
        });
      return response({
        content:
          calls === 2
            ? invalid
            : "Review the verified simulator plan and its numerical evidence. No field actuation occurred.",
      });
    });
    assert.equal(calls, 3);
    assert.equal(
      result.trace.filter((t) => t.tool === "optimise_network").length,
      1,
    );
    assert.equal(result.completionStatus, "complete");
    assert.equal(result.narrativeWithheld, false);
  }
});
test("tool-shaped report output cannot execute tools or become a completed mission", async () => {
  const result = await run(async (payload) =>
    payload.tools
      ? response({
          role: "assistant",
          tool_calls: [tool("plan", "optimise_network")],
        })
      : response({
          content: "Call another tool",
          tool_calls: [tool("forbidden", "optimise_network")],
        }),
  );
  assert.equal(
    result.trace.filter((t) => t.tool === "optimise_network").length,
    1,
  );
  assert.equal(result.completionStatus, "partial");
});
test("tool schema and error feedback expose authoritative current ramp ranges", async () => {
  let calls = 0;
  const result = await run(async (payload) => {
    calls++;
    if (calls === 1) {
      const controls = payload.tools.find(
        (t) => t.function.name === "simulate_controls",
      ).function.parameters.properties;
      const context = JSON.parse(payload.messages[1].content);
      assert.equal(controls.supplyC.minimum, context.context.state.supplyC - 2);
      assert.equal(controls.pumpHz.maximum, context.context.state.pumpHz + 2);
      assert.match(controls.valvesPct.description, /far/);
      return response({
        role: "assistant",
        tool_calls: [tool("bad", "simulate_controls", { supplyC: 99 })],
      });
    }
    assert(JSON.parse(payload.messages.at(-1).content).controlEnvelope);
    return response({
      content:
        "The counterfactual exceeded the permitted ramp. Review the numerical control limits.",
    });
  });
  assert(result.trace.some((t) => t.result.error));
});
test("known engineering IDs are not numerical claims, while actual measurements remain guarded", () => {
  assert.equal(
    guardNarrative("Inspect ST01 and P-03.", ["ST01", "P-03"])
      .narrativeWithheld,
    false,
  );
  assert.equal(
    guardNarrative("ST01 is at 99 degrees.", ["ST01"]).narrativeWithheld,
    true,
  );
  assert.equal(guardNarrative("P-99", ["P-03"]).narrativeWithheld, true);
});

test("a successful counterfactual leads to a plan-or-stop decision, never another experiment loop", async () => {
  let calls = 0;
  const result = await run(async (payload) => {
    calls++;
    if (calls === 1)
      return response({
        role: "assistant",
        tool_calls: [tool("experiment", "simulate_controls")],
      });
    if (calls === 2) {
      assert.deepEqual(
        payload.tools.map((t) => t.function.name),
        ["optimise_network", "finish_without_plan"],
      );
      assert.equal(payload.tool_choice, "required");
      return response({
        role: "assistant",
        tool_calls: [
          tool("stop", "finish_without_plan", {
            reason: "Check the suspect sensor before changing controls.",
          }),
        ],
      });
    }
    assert.equal(payload.tools, undefined);
    return response({
      content:
        "The agent recommends a sensor check before any intervention. No plan was prepared.",
    });
  });
  assert.equal(calls, 3);
  assert.equal(result.optimisation, null);
  assert.equal(result.completionStatus, "complete");
  assert(result.trace.some((t) => t.result.decision === "no_intervention"));
});
