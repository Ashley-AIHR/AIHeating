import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
test("HTTP streams public text and executed tools before completion, retains interrupted results and releases cancelled sessions", async () => {
  const base = "http://127.0.0.1:3126";
  const child = spawn(
    process.execPath,
    ["--import", "./scripts/provider-stream-fixture.mjs", "server/index.mjs"],
    {
      env: {
        ...process.env,
        PORT: "3126",
        NODE_ENV: "test",
        OPENROUTER_API_KEY: "stream-test-key",
        AI_ACCESS_TOKEN: "",
      },
      stdio: "ignore",
    },
  );
  try {
    for (let i = 0; i < 60; i++) {
      try {
        if ((await fetch(base + "/api/health")).ok) break;
      } catch {}
      await delay(50);
    }
    let cookie = "";
    const post = async (route, data, signal) => {
      const response = await fetch(base + "/api/" + route, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify(data),
        signal,
      });
      cookie = response.headers.get("set-cookie")?.split(";")[0] || cookie;
      return response;
    };
    const state = await (await post("state", {})).json();
    // Stale requests are rejected before stream headers and paid-request accounting.
    for (let i = 0; i < 21; i++) {
      const stale = await post("investigation", {
        revision: state.revision + 1,
        stream: true,
        question: "Check this stale view",
      });
      assert.equal(stale.status, 409);
      const failure = await stale.json();
      assert.equal(failure.code, "CONTEXT_CHANGED");
      assert.equal(failure.snapshot.contextId, state.contextId);
    }
    for (const partial of [false, true]) {
      const res = await post("investigation", {
        role: "optimisation",
        revision: state.revision + 10,
        contextId: "previous-server-session",
        syncCurrent: true,
        cityId: state.cityId,
        scenario: state.scenario,
        stream: true,
        question: partial ? "stream-test-partial" : "Test the physical branch",
      });
      assert.equal(res.headers.get("content-type"), "application/x-ndjson");
      let buffer = "",
        result,
        context,
        sawText = false,
        sawTool = false;
      for await (const bytes of res.body) {
        buffer += new TextDecoder().decode(bytes);
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines.filter(Boolean)) {
          const item = JSON.parse(line);
          if (item.type === "context") {
            context = item.snapshot;
            assert(item.rebased);
          }
          if (item.type === "event") {
            assert.equal(
              context?.revision,
              state.revision,
              "Authoritative scene context must arrive before any tool or provider activity",
            );
            if (item.event.kind === "text") {
              assert(!result);
              sawText = true;
            }
            if (item.event.tool === "optimise_network" && item.event.result)
              sawTool = true;
            assert(!JSON.stringify(item).includes("PRIVATE_NOT_FOR_UI"));
          }
          if (item.type === "result") result = item.result;
        }
      }
      assert(sawText && sawTool);
      assert.equal(result.completionStatus, partial ? "partial" : "complete");
      assert.match(result.answer, /far branch/);
      assert(result.optimisation.recommendation.candidateId);
      assert.equal(
        (await (await post("state", {})).json()).revision,
        state.revision,
      );
    }
    const controller = new AbortController();
    const res = await post(
      "investigation",
      {
        role: "diagnostic",
        revision: state.revision,
        stream: true,
        question: "Cancellation test",
      },
      controller.signal,
    );
    const reader = res.body.getReader();
    await reader.read();
    controller.abort();
    await reader.cancel().catch(() => {});
    let unlocked = false;
    for (let i = 0; i < 40; i++) {
      if ((await post("state", {})).status === 200) {
        unlocked = true;
        break;
      }
      await delay(25);
    }
    assert(unlocked, "Cancellation must release the session lock");
  } finally {
    child.kill();
  }
});
