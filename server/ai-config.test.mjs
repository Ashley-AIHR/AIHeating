import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

for (const password of ["", "optional-test-password"])
  test(`OpenRouter-only configuration with optional password ${password ? "enabled" : "absent"}`, async () => {
    const port = password ? 3122 : 3121,
      base = `http://127.0.0.1:${port}`;
    const server = spawn(process.execPath, ["server/index.mjs"], {
      env: {
        ...process.env,
        PORT: String(port),
        OPENROUTER_API_KEY: "explicit-nonfunctional-test-key",
        AI_ACCESS_TOKEN: password,
      },
      stdio: "ignore",
    });
    try {
      let ready = false;
      for (let i = 0; i < 60; i++) {
        try {
          if ((await fetch(base + "/api/health")).ok) {
            ready = true;
            break;
          }
        } catch {}
        await delay(100);
      }
      assert(ready);
      const config = await (await fetch(base + "/api/config")).json();
      assert.equal(config.aiConfigured, true);
      assert.equal(config.accessCodeRequired, !!password);
      assert(
        !JSON.stringify(config).includes("explicit-nonfunctional-test-key"),
      );
      const headers = { "Content-Type": "application/json" };
      // Invalid brief stops before any provider request; this checks the authentication path only.
      const request = () =>
        fetch(base + "/api/investigation", {
          method: "POST",
          headers,
          body: JSON.stringify({ question: "x" }),
        });
      assert.equal((await request()).status, password ? 401 : 400);
      if (password) {
        headers["X-AI-Access-Code"] = password;
        assert.equal((await request()).status, 400);
      }
      assert.equal(
        (
          await fetch(base + "/api/telemetry", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}",
          })
        ).status,
        401,
        "Observation privacy remains protected",
      );
    } finally {
      server.kill();
    }
  });
