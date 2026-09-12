import test from "node:test";
import assert from "node:assert/strict";
import { streamCompletion } from "./provider-stream.mjs";
import { investigate } from "./immersive-agent.mjs";
import { dispatch } from "./twin-node.mjs";
import { compactEvidence } from "./agent-context.mjs";
import { randomUUID } from "node:crypto";
const event = (data) => `data: ${JSON.stringify(data)}\r\n\r\n`;
const chunk = (delta, finish_reason = null) => ({
  choices: [{ delta, finish_reason }],
});
function provider(text) {
  return async (_url, options) => {
    assert.equal(JSON.parse(options.body).stream, true);
    const bytes = new TextEncoder().encode(text);
    return new Response(
      new ReadableStream({
        start(c) {
          for (const byte of bytes) c.enqueue(new Uint8Array([byte]));
          c.close();
        },
      }),
      { headers: { "content-type": "text/event-stream" } },
    );
  };
}
test("SSE handles split UTF-8/CRLF, comments, public text, usage and excludes private reasoning", async () => {
  const deltas = [];
  const result = await streamCompletion(
    {},
    {
      fetchImpl: provider(
        ": OPENROUTER PROCESSING\r\n\r\n" +
          event(chunk({ reasoning: "private", content: "上海" })) +
          event(chunk({ content: " branch" }, "stop")) +
          event({ choices: [], usage: { total_tokens: 42 } }) +
          "data: [DONE]\r\n\r\n",
      ),
      onDelta: (d) => deltas.push(d),
    },
  );
  assert.equal(result.choices[0].message.content, "上海 branch");
  assert.equal(result.usage.total_tokens, 42);
  assert.equal(deltas.map((d) => d.text).join(""), "上海 branch");
  assert(!JSON.stringify(deltas).includes("private"));
});
test("fragmented parallel tool arguments are reconstructed only after completion", async () => {
  const result = await streamCompletion(
    {},
    {
      fetchImpl: provider(
        event(
          chunk({
            tool_calls: [
              {
                index: 0,
                id: "tool-a",
                function: { name: "simulate_controls", arguments: '{"pump' },
              },
            ],
          }),
        ) +
          event(
            chunk(
              {
                tool_calls: [{ index: 0, function: { arguments: 'Hz":42}' } }],
              },
              "tool_calls",
            ),
          ) +
          "data: [DONE]\r\n\r\n",
      ),
    },
  );
  assert.equal(
    result.choices[0].message.tool_calls[0].function.arguments,
    '{"pumpHz":42}',
  );
});
test("stream truncation, midstream errors and incomplete tools fail closed", async () => {
  for (const text of [
    event(chunk({ content: "partial" })),
    event({ error: { message: "internal provider information" } }),
    event(
      chunk(
        {
          tool_calls: [
            {
              index: 0,
              id: "t",
              function: { name: "simulate_controls", arguments: "{}" },
            },
          ],
        },
        "length",
      ),
    ) + "data: [DONE]\r\n\r\n",
  ])
    await assert.rejects(streamCompletion({}, { fetchImpl: provider(text) }));
});
test("provider idle deadline and operator cancellation abort upstream fetch", async () => {
  const never = (_url, { signal }) =>
    new Promise((resolve, reject) => {
      if (signal.aborted) reject(signal.reason);
      else
        signal.addEventListener("abort", () => reject(signal.reason), {
          once: true,
        });
    });
  await assert.rejects(
    streamCompletion({}, { fetchImpl: never, idleMs: 15, totalMs: 100 }),
    /stopped sending/,
  );
  const controller = new AbortController();
  const promise = streamCompletion(
    {},
    { fetchImpl: never, signal: controller.signal },
  );
  controller.abort(new Error("operator stopped"));
  await assert.rejects(promise, /operator stopped/);
});
test("timeout after successful optimisation preserves verified plan and tool evidence without actuation", async () => {
  const id = randomUUID(),
    state = dispatch(id, "snapshot"),
    events = [];
  let count = 0;
  const result = await investigate({
    session: id,
    args: { role: "optimisation", revision: state.revision },
    model: "test",
    rpc: async (id, method, args) => dispatch(id, method, args),
    onEvent: (e) => events.push(e),
    complete: async (_payload, { onDelta }) => {
      if (count++)
        throw new Error("AI provider stopped sending data for too long");
      onDelta({ kind: "text", text: "Testing the network." });
      return {
        choices: [
          {
            message: {
              role: "assistant",
              tool_calls: [
                {
                  id: "p",
                  function: {
                    name: "optimise_network",
                    arguments: '{"objective":"comfort"}',
                  },
                },
              ],
            },
          },
        ],
      };
    },
  });
  assert.equal(result.completionStatus, "partial");
  assert(result.optimisation.recommendation.candidateId);
  assert(result.trace.some((t) => t.tool === "optimise_network"));
  assert(events.some((e) => e.arguments?.objective === "comfort"));
  assert(events.some((e) => e.kind === "text"));
  assert.equal(dispatch(id, "snapshot").revision, state.revision);
  assert(
    JSON.stringify(compactEvidence(result.optimisation)).length <
      JSON.stringify(result.optimisation).length / 2,
  );
});
test("empty public output receives one final-answer retry and never loops indefinitely", async () => {
  const id = randomUUID(),
    state = dispatch(id, "snapshot");
  let calls = 0;
  const result = await investigate({
    session: id,
    args: { revision: state.revision },
    model: "test",
    rpc: async (id, method, args) => dispatch(id, method, args),
    complete: async (payload) => {
      calls++;
      if (calls === 2) {
        assert.equal(payload.tool_choice, "none");
        assert.equal(payload.reasoning.enabled, false);
      }
      return {
        choices: [{ message: { content: "" }, finish_reason: "length" }],
      };
    },
  });
  assert.equal(calls, 2);
  assert.equal(result.completionStatus, "partial");
  assert(result.diagnosis);
});
