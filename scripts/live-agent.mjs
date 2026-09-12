// Opt-in integration check: REAL provider calls, isolated simulator cookie.
// No field controls. Never run automatically in CI or with transport fixtures.
import assert from "node:assert/strict";
if (process.env.LIVE_AI_TEST !== "1")
  throw Error("Set LIVE_AI_TEST=1 to authorise paid provider calls");
const base = process.env.BASE_URL || "http://127.0.0.1:3128";
const config = await (await fetch(base + "/api/config")).json();
assert(config.aiConfigured, "Live provider must be configured");
assert(
  !config.accessCodeRequired,
  "Use an authorised operator test environment",
);
console.log({
  base,
  release: config.release,
  model: config.model,
  transport: "LIVE, no mocks",
});
for (const cityId of (process.env.TEST_CITIES || "yinchuan,shanghai").split(
  ",",
)) {
  let cookie = "";
  const post = async (route, data) => {
    const res = await fetch(base + "/api/" + route, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(255000),
    });
    if (res.headers.get("set-cookie"))
      cookie = res.headers.get("set-cookie").split(";")[0];
    return res;
  };
  const state = await (
    await post("reset", { cityId, scenario: "imbalance" })
  ).json();
  const started = Date.now();
  const res = await post("investigation", {
    role: "optimisation",
    assetId: "B10",
    objective: "balanced",
    question:
      process.env.TEST_QUESTION ||
      "Investigate the selected asset using physical evidence. Test an alternative explanation and prepare a verified simulator intervention if appropriate.",
    revision: state.revision,
    contextId: state.contextId,
    cityId,
    scenario: state.scenario,
    syncCurrent: true,
    mode: "simulation",
    stream: true,
  });
  assert.equal(
    res.status,
    200,
    await (res.ok ? Promise.resolve("") : res.text()),
  );
  let buffer = "",
    result,
    textChunks = 0,
    contextSeen = false;
  const decoder = new TextDecoder();
  for await (const bytes of res.body) {
    buffer += decoder.decode(bytes, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const line of lines.filter(Boolean)) {
      const item = JSON.parse(line),
        seconds = Math.round((Date.now() - started) / 1000);
      if (item.type === "context") contextSeen = true;
      if (item.type === "error") throw Error(item.error);
      if (item.type === "event") {
        assert(contextSeen, "Scene must arrive before provider activity");
        const e = item.event;
        if (e.kind === "text") {
          textChunks++;
          continue;
        }
        console.log({
          cityId,
          seconds,
          tool: e.tool,
          status: e.status,
          round: e.round,
          finish: e.finishReason,
          message: e.message,
          error: e.result?.error,
        });
      }
      if (item.type === "result") result = item.result;
    }
  }
  assert(result, "Stream must finish with a result");
  console.log({
    cityId,
    seconds: Math.round((Date.now() - started) / 1000),
    textChunks,
    runId: result.runId,
    status: result.completionStatus,
    warning: result.warning,
    narrativeWithheld: result.narrativeWithheld,
    answer: result.answer,
    tools: result.trace.map((t) => t.tool),
    plan: !!result.optimisation?.recommendation,
  });
  assert.equal(result.completionStatus, "complete");
  assert.equal(result.narrativeWithheld, false);
  assert(textChunks > 0, "Public answer must actually stream");
  assert(
    result.optimisation?.recommendation,
    "Default imbalance must produce a plan",
  );
  assert(result.optimisation.verification.passed);
  assert.equal(
    (await (await post("state", {})).json()).revision,
    state.revision,
    "Investigation must not actuate",
  );
  if (process.env.TEST_APPLY === "1") {
    const plan = result.optimisation.recommendation;
    const appliedResponse = await post("apply", {
      candidateId: plan.candidateId,
    });
    const after = await appliedResponse.json();
    assert.equal(appliedResponse.status, 200, after.error);
    assert.equal(after.revision, state.revision + 1);
    assert.equal(after.elapsedMinutes, state.elapsedMinutes + 30);
    const expected = plan.trace[0].state;
    for (const key of ["supplyC", "pumpHz", "heatKwh", "flowM3h"])
      assert.equal(
        after[key],
        expected[key],
        `Applied ${key} must match verified prediction`,
      );
    console.log({
      cityId,
      applied: "isolated simulator only",
      revision: after.revision,
      predictionMatched: true,
    });
  }
}
console.log(
  "PASS: live streamed provider, executed numerical tools, usable report and verified plan.",
);
