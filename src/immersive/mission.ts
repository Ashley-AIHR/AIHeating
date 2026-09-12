import type { Twin } from "../operations/types";

export type MissionEvent = {
  tool: string;
  status: "running" | "completed" | "failed";
  at: string;
  round?: number;
  kind?: string;
  text?: string;
  message?: string;
  arguments?: Record<string, unknown>;
  result?: unknown;
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
  draft?: string;
  draftRound?: number;
};
export const toolNames: Record<string, string> = {
  context_sync: "Scene synchronised with the server",
  agent_decision: "Agent selecting the next investigation step",
  agent_output: "Agent writing its explanation",
  agent_recovery: "Recovering the public explanation",
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
  signal?: AbortSignal,
  onContext?: (snapshot: Twin, rebased: boolean) => void,
): Promise<T> {
  const res = await fetch("/api/investigation", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-AI-Access-Code": code },
    body: JSON.stringify({ ...(args as object), stream: true }),
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(255000)])
      : AbortSignal.timeout(255000),
  });
  if (!res.ok) {
    const failure = await res.json();
    if (failure.code === "CONTEXT_CHANGED" && failure.snapshot)
      onContext?.(failure.snapshot, true);
    throw new Error(failure.error || "Investigation failed");
  }
  if (!res.body) throw new Error("Investigation stream unavailable");
  const reader = res.body.getReader(),
    decoder = new TextDecoder();
  let buffer = "",
    result: T | undefined;
  const consume = (line: string) => {
    if (!line.trim()) return;
    const item = JSON.parse(line);
    if (item.type === "context") onContext?.(item.snapshot, item.rebased);
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
