// Explicit test-only preload; production never imports this file.
if (
  process.env.NODE_ENV !== "test" ||
  process.env.OPENROUTER_API_KEY !== "stream-test-key"
)
  throw Error("Streaming fixture requires the isolated test environment");
const realFetch = globalThis.fetch;
const encode = (value) =>
  new TextEncoder().encode(
    `data: ${typeof value === "string" ? value : JSON.stringify(value)}\n\n`,
  );
globalThis.fetch = async (url, options = {}) => {
  if (String(url) !== "https://openrouter.ai/api/v1/chat/completions")
    return realFetch(url, options);
  const payload = JSON.parse(options.body),
    brief = payload.messages[1].content;
  const chinese = payload.messages[0].content.includes("Simplified Chinese");
  const first =
    !!payload.tools && !payload.messages.some((m) => m.role === "tool");
  const tool = payload.tools?.some(
    (t) => t.function.name === "optimise_network",
  )
    ? "optimise_network"
    : "inspect_world";
  const packets = first
    ? [
        {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: "fixture-call",
                    function: {
                      name: tool,
                      arguments:
                        tool === "optimise_network"
                          ? '{"objective":"comfort"}'
                          : "{}",
                    },
                  },
                ],
              },
            },
          ],
        },
        { choices: [{ delta: {}, finish_reason: "tool_calls" }] },
        "[DONE]",
      ]
    : [
        {
          choices: [
            {
              delta: {
                reasoning: "PRIVATE_NOT_FOR_UI",
                content: chinese ? "远端支路" : "The far branch ",
              },
            },
          ],
        },
        { choices: [{ delta: { content: chinese ? "需要进行水力平衡。" : "needs careful balancing. " } }] },
        {
          choices: [
            {
              delta: {
                content: chinese ? "应用方案前，请检查物理模型依据。" : "Review the physical evidence before applying a plan.",
              },
            },
          ],
        },
        ...(brief.includes("stream-test-partial")
          ? [{ error: { message: "synthetic upstream interruption" } }]
          : [{ choices: [{ delta: {}, finish_reason: "stop" }] }, "[DONE]"]),
      ];
  let timer, abort;
  const body = new ReadableStream({
    start(controller) {
      let index = 0;
      abort = () => {
        clearInterval(timer);
        controller.error(options.signal.reason);
      };
      if (options.signal.aborted) {
        abort();
        return;
      }
      options.signal.addEventListener("abort", abort, { once: true });
      timer = setInterval(
        () => {
          controller.enqueue(encode(packets[index++]));
          if (index === packets.length) {
            clearInterval(timer);
            options.signal.removeEventListener("abort", abort);
            controller.close();
          }
        },
        first ? 20 : 650,
      );
    },
    cancel() {
      clearInterval(timer);
      options.signal.removeEventListener("abort", abort);
    },
  });
  return new Response(body, {
    headers: { "content-type": "text/event-stream" },
  });
};
