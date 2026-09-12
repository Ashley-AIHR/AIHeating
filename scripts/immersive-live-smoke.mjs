// Explicit opt-in: this makes one paid agent request, bounded by the server's tool/token limits.
if (process.env.RUN_LIVE_AI !== "1")
  throw new Error("Set RUN_LIVE_AI=1 to authorise this paid integration test");
import fs from "node:fs";
if (fs.existsSync(".env")) process.loadEnvFile(".env");
const base = process.env.BASE_URL || "http://127.0.0.1:3103";
if (!process.env.AI_ACCESS_TOKEN)
  throw new Error("Operator code is not configured");
const config = await (await fetch(base + "/api/config")).json();
if (config.model !== "deepseek/deepseek-v4-flash-0731")
  throw new Error("Server is not using the requested pinned model");
const stateResponse = await fetch(base + "/api/state", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: "{}",
});
const state = await stateResponse.json(),
  cookie = stateResponse.headers.get("set-cookie")?.split(";")[0];
const response = await fetch(base + "/api/investigation", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Cookie: cookie,
    "X-AI-Access-Code": process.env.AI_ACCESS_TOKEN,
  },
  body: JSON.stringify({
    role: "diagnostic",
    assetId: "B10",
    revision: state.revision,
    mode: "simulation",
    question:
      "Investigate why this building is cold. Use the physical tools to test a bounded alternative before drawing conclusions. Keep final prose qualitative; the UI displays numerical evidence.",
  }),
  signal: AbortSignal.timeout(150000),
});
const result = await response.json();
if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
console.log(
  JSON.stringify(
    {
      model: result.model,
      role: result.role,
      runId: result.runId,
      revision: result.revision,
      tools: result.trace.map((t) => ({
        name: t.tool,
        error: t.result?.error || null,
      })),
      totalTokens: result.totalTokens,
      narrativeWithheld: result.narrativeWithheld,
      answerPresent: !!result.answer?.trim(),
      fieldActuation: false,
    },
    null,
    2,
  ),
);
if (result.trace.length < 2 || result.narrativeWithheld) process.exitCode = 1;
