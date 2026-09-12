// OpenRouter SSE transport. Only public assistant content is forwarded; never reasoning.
export async function streamCompletion(
  payload,
  {
    apiKey,
    signal,
    onDelta = () => {},
    fetchImpl = fetch,
    idleMs = 60000,
    totalMs = 120000,
  } = {},
) {
  const controller = new AbortController();
  const abort = () => controller.abort(signal.reason);
  if (signal?.aborted) abort();
  else signal?.addEventListener("abort", abort, { once: true });
  let idle;
  const resetIdle = () => {
    clearTimeout(idle);
    idle = setTimeout(
      () =>
        controller.abort(
          new Error("AI provider stopped sending data for too long"),
        ),
      idleMs,
    );
  };
  const deadline = setTimeout(
    () =>
      controller.abort(
        new Error("AI provider exceeded the response time limit"),
      ),
    totalMs,
  );
  resetIdle();
  let reader;
  try {
    const response = await fetchImpl(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "X-Title": "HeatPilot immersive agents",
        },
        body: JSON.stringify({
          ...payload,
          stream: true,
          stream_options: { include_usage: true },
        }),
        signal: controller.signal,
      },
    );
    if (!response.ok)
      throw new Error(`AI provider returned HTTP ${response.status}`);
    if (
      !response.body ||
      !response.headers.get("content-type")?.includes("text/event-stream")
    )
      throw new Error("AI provider did not return the requested event stream");
    reader = response.body.getReader();
    const decoder = new TextDecoder(),
      calls = new Map();
    let buffer = "",
      content = "",
      finish = null,
      usage = {},
      done = false;
    const consume = (block) => {
      const data = block
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trimStart())
        .join("\n");
      if (!data) return; // SSE keepalive comments.
      if (data === "[DONE]") {
        done = true;
        return;
      }
      const chunk = JSON.parse(data);
      if (chunk.error)
        throw new Error("AI provider reported a streaming error");
      if (chunk.usage) usage = chunk.usage;
      const c = chunk.choices?.[0];
      if (!c) return;
      if (c.error || c.finish_reason === "error")
        throw new Error("AI provider interrupted its response");
      if (c.finish_reason) finish = c.finish_reason;
      const delta = c.delta || {};
      if (typeof delta.content === "string" && delta.content) {
        content += delta.content;
        if (content.length > 100000)
          throw new Error("AI response exceeded the output limit");
        onDelta({ kind: "text", text: delta.content });
      }
      for (const fragment of delta.tool_calls || []) {
        if (
          !Number.isInteger(fragment.index) ||
          fragment.index < 0 ||
          fragment.index > 7
        )
          throw new Error("Invalid streamed tool index");
        const call = calls.get(fragment.index) || {
          id: "",
          type: "function",
          function: { name: "", arguments: "" },
        };
        if (fragment.id) call.id = fragment.id;
        call.function.name += fragment.function?.name || "";
        call.function.arguments += fragment.function?.arguments || "";
        if (call.function.arguments.length > 12000)
          throw new Error("AI tool arguments exceeded the limit");
        calls.set(fragment.index, call);
      }
    };
    while (!done) {
      const item = await reader.read();
      if (item.done) break;
      resetIdle();
      buffer += decoder.decode(item.value, { stream: true });
      // Normalise CRLF only after a complete event so split CR/LF packets survive.
      let match;
      while ((match = /\r?\n\r?\n/.exec(buffer))) {
        consume(buffer.slice(0, match.index).replace(/\r\n/g, "\n"));
        buffer = buffer.slice(match.index + match[0].length);
      }
      if (buffer.length > 200000)
        throw new Error("Malformed provider event stream");
    }
    if (!done && !finish)
      throw new Error(
        "AI provider disconnected before completing the response",
      );
    const tool_calls = [...calls.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, v]) => v);
    if (tool_calls.some((c) => !c.id || !c.function.name))
      throw new Error("Incomplete streamed tool call");
    if (tool_calls.length && finish !== "tool_calls")
      throw new Error("Provider did not complete its tool-call response");
    return {
      choices: [
        {
          finish_reason: finish,
          message: {
            role: "assistant",
            content,
            ...(tool_calls.length ? { tool_calls } : {}),
          },
        },
      ],
      usage,
    };
  } catch (error) {
    if (controller.signal.aborted) throw controller.signal.reason;
    throw error;
  } finally {
    clearTimeout(idle);
    clearTimeout(deadline);
    signal?.removeEventListener("abort", abort);
    await reader?.cancel().catch(() => {});
  }
}
