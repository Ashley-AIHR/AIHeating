import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
const base = "http://127.0.0.1:3099";
let server;
before(async () => {
  server = spawn(process.execPath, ["server/index.mjs"], {
    env: {
      ...process.env,
      PORT: "3099",
      OPENROUTER_API_KEY: "",
      OPENROUTER_MODEL: "",
      AI_ACCESS_TOKEN: "",
      NODE_ENV: "test",
    },
    stdio: "ignore",
  });
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(base + "/api/health")).ok) return;
    } catch {}
    await delay(100);
  }
  throw new Error("Test server did not start");
});
after(() => server?.kill());
function client() {
  let cookie = "";
  return async (route, args = {}, headers = {}) => {
    const r = await fetch(base + "/api/" + route, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        ...headers,
      },
      body: JSON.stringify(args),
    });
    cookie = r.headers.get("set-cookie")?.split(";")[0] || cookie;
    return {
      status: r.status,
      value: await r.json(),
      cookie,
      headers: r.headers,
    };
  };
}
test("static production app and legacy route are served, internal files are not", async () => {
  for (const route of ["/", "/legacy"]) {
    const r = await fetch(base + route);
    assert.equal(r.status, 200);
    assert.match(await r.text(), /Heatpilot/);
    assert.match(
      r.headers.get("content-security-policy"),
      /frame-ancestors 'none'/,
    );
  }
  for (const route of [
    "/.env",
    "/server/index.mjs",
    "/physical_core/src/ai_heating_core/contracts.py",
  ])
    assert.equal((await fetch(base + route)).status, 404);
});
test("configuration exposes capabilities, not secrets", async () => {
  const value = await (await fetch(base + "/api/config")).json();
  assert.equal(value.aiConfigured, false);
  assert.equal(value.model, "deepseek/deepseek-v4-flash-0731");
  assert.equal(value.sources.length, 9);
  assert(!JSON.stringify(value).includes("sk-or-"));
});
test("two browsers have isolated state with http-only cookies", async () => {
  const a = client(),
    b = client();
  const x = await a("state"),
    y = await b("state");
  assert.notEqual(x.cookie, y.cookie);
  assert.match(x.headers.get("set-cookie"), /HttpOnly/);
  await a("advance");
  const before = await b("state");
  assert.equal(before.value.revision, 1);
  assert.equal((await a("state")).value.revision, 2);
});
test("comparison requires explicit, current-session approval", async () => {
  const a = client();
  const state = await a("state");
  const c = await a("compare");
  assert.equal(c.status, 200);
  assert.equal(c.value.candidates.length, 5);
  assert.equal((await a("state")).value.revision, state.value.revision);
  assert.equal((await a("apply", { candidateId: "invented" })).status, 400);
  const applied = await a("apply", {
    candidateId: c.value.recommendation.candidateId,
  });
  assert.equal(applied.status, 200);
  assert.equal(applied.value.revision, 2);
  assert.equal(
    (await a("apply", { candidateId: c.value.recommendation.candidateId }))
      .status,
    400,
  );
});
test("cross-origin writes, invalid scenario and unknown endpoints are rejected", async () => {
  const a = client();
  assert.equal(
    (await a("advance", {}, { Origin: "https://evil.example" })).status,
    403,
  );
  assert.equal((await a("reset", { scenario: "invented" })).status, 400);
  assert.equal((await a("actuate", {})).status, 404);
  assert.equal((await fetch(base + "/api/advance")).status, 405);
});
test("missing AI configuration fails explicitly, numerical diagnosis remains available", async () => {
  const a = client();
  const r = await a("agent", { question: "Diagnose the network." });
  assert.equal(r.status, 503);
  assert.match(r.value.error, /not configured/);
  assert.equal((await a("diagnose")).status, 200);
});
