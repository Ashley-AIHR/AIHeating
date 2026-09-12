import type { Twin } from "../operations/types";

export type MissionEvent = {
  tool: string;
  status: "running" | "completed" | "failed";
  at: string;
};
export type Mission = {
  phase: "investigating" | "ready" | "applied" | "blocked" | "failed";
  origin: "llm" | "numerical";
  before: Twin;
  after?: Twin;
  baseline?: Twin;
  predicted?: Twin;
  assetId: string;
  affected: string[];
  events: MissionEvent[];
  message: string;
};
export const toolNames: Record<string, string> = {
  agent_decision: "Agent selecting the next investigation step",
  inspect_world: "Tracing the connected network",
  diagnose_building: "Checking thermal and hydraulic evidence",
  simulate_controls: "Testing an alternative in the physical model",
  optimise_network: "Solving and verifying the control schedule",
};

// The stream contains executed tool activity, never model chain-of-thought.
export async function streamInvestigation<T>(
  args: unknown,
  code: string,
  onEvent: (event: MissionEvent) => void,
): Promise<T> {
  const res = await fetch("/api/investigation", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-AI-Access-Code": code },
    body: JSON.stringify({ ...(args as object), stream: true }),
    signal: AbortSignal.timeout(150000),
  });
  if (!res.ok)
    throw new Error((await res.json()).error || "Investigation failed");
  if (!res.body) throw new Error("Investigation stream unavailable");
  const reader = res.body.getReader(),
    decoder = new TextDecoder();
  let buffer = "",
    result: T | undefined;
  const consume = (line: string) => {
    if (!line.trim()) return;
    const item = JSON.parse(line);
    if (item.type === "error") throw new Error(item.error);
    if (item.type === "event") onEvent(item.event);
    if (item.type === "result") result = item.result;
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      lines.forEach(consume);
      if (done) break;
    }
    consume(buffer);
    if (!result) throw new Error("Investigation interrupted before completion");
    return result;
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
