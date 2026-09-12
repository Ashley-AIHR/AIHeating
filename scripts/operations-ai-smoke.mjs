// Opt-in integration check: makes a paid, bounded request using local server secrets.
// No provider keys or operator access codes are printed or written into the evidence.
import assert from "node:assert/strict";
process.loadEnvFile(".env");
const base = "http://127.0.0.1:3000/api/";
const init = await fetch(base + "state", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: "{}",
});
const cookie = init.headers.get("set-cookie").split(";")[0];
const before = await init.json();
const headers = {
  "Content-Type": "application/json",
  Cookie: cookie,
  "X-AI-Access-Code": process.env.AI_ACCESS_TOKEN,
};
const wrong = await fetch(base + "agent", {
  method: "POST",
  headers: { ...headers, "X-AI-Access-Code": "incorrect" },
  body: JSON.stringify({ question: "Inspect the network." }),
});
assert.equal(wrong.status, 401);
const response = await fetch(base + "agent", {
  method: "POST",
  headers,
  body: JSON.stringify({
    buildingId: "B10",
    question:
      "Inspect the current network and compare interventions for cold far-zone buildings. Give the preferred candidate and exact three-hour heat energy, pump energy and minimum temperature from your tools. State the main limitation. Do not apply controls.",
  }),
});
const result = await response.json();
if (!response.ok) throw new Error(result.error);
assert(
  result.trace.some((t) => t.tool === "compare_interventions"),
  "Live provider must invoke a numerical comparison",
);
assert(result.answer.length > 50);
assert.equal(result.evidence.kind, "comparison");
const candidate = result.trace.find((t) => t.tool === "compare_interventions")
  .result.recommendation;
assert.equal(result.evidence.rows[0].minimumC, candidate.minimumC);
assert.equal(result.evidence.rows[0].endMinimumC, candidate.endMinimumC);
assert.equal(
  result.narrativeWithheld,
  false,
  "Provider should follow qualitative explanation contract",
);
const after = await (
  await fetch(base + "state", { method: "POST", headers, body: "{}" })
).json();
assert.equal(
  after.revision,
  before.revision,
  "AI cannot mutate simulation controls",
);
console.log(
  JSON.stringify(
    {
      model: result.model,
      tools: result.trace.map((t) => t.tool),
      tokens: result.totalTokens,
      answer: result.answer,
      evidence: result.evidence,
      unchangedRevision: after.revision,
    },
    null,
    2,
  ),
);
