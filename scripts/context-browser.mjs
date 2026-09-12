import { chromium } from "playwright";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
const base = "http://127.0.0.1:3127";
const server = spawn(
  process.execPath,
  ["--import", "./scripts/provider-stream-fixture.mjs", "server/index.mjs"],
  {
    env: {
      ...process.env,
      PORT: "3127",
      NODE_ENV: "test",
      OPENROUTER_API_KEY: "stream-test-key",
      AI_ACCESS_TOKEN: "",
    },
    stdio: "ignore",
  },
);
let browser;
try {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(base + "/api/health")).ok) break;
    } catch {}
    await delay(50);
  }
  browser = await chromium.launch({
    args: process.platform === "darwin" ? ["--use-angle=metal"] : [],
  });
  const page = await browser.newPage({
    viewport: { width: 1680, height: 1050 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const post = async (route, data = {}) =>
    (await page.request.post(base + "/api/" + route, { data })).json();
  const idle = () => page.locator(".status-toast").waitFor({ state: "hidden" });
  const run = async () => {
    await page
      .getByRole("button", { name: "✧ Run agent mission", exact: true })
      .click();
  };
  await page.goto(base);
  await page.locator(".city-scene canvas").waitFor();
  await idle();
  await page
    .getByRole("button", { name: "Quality: cinematic", exact: true })
    .click();
  const initial = await post("state");
  const advanced = await post("advance"); // Simulates another tab updating shared server state.
  assert.match(
    await page.locator(".context-line").textContent(),
    new RegExp(`Revision ${initial.revision}`),
  );
  await run();
  await page.locator(".mission-status.ready").waitFor();
  assert.match(
    await page.locator(".agent-result h3").first().textContent(),
    new RegExp(`revision ${advanced.revision}`),
  );
  assert.match(
    await page.locator(".mission-events").textContent(),
    /Scene synchronised with the server/,
  );
  await page
    .getByRole("button", { name: "Current simulation", exact: true })
    .click();
  assert.match(
    await page.locator(".context-line").textContent(),
    new RegExp(`Revision ${advanced.revision}`),
  );
  await page
    .getByRole("button", {
      name: "Apply first 30 min to simulation",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Apply to simulation only", exact: true })
    .click();
  await idle();
  assert.equal((await post("state")).revision, advanced.revision + 1);

  await post("reset", { cityId: "shanghai", scenario: "cold" });
  await run();
  await page.locator(".mission-status.failed").waitFor();
  assert.equal(
    await page.getByRole("combobox", { name: "City district" }).inputValue(),
    "shanghai",
  );
  assert.equal(
    await page
      .getByRole("combobox", { name: "Simulation scenario" })
      .inputValue(),
    "cold",
  );
  assert.match(
    await page.locator(".mission-status.failed").textContent(),
    /city or scenario changed/,
  );
  assert.equal(await page.locator(".agent-result").count(), 0);
  await run();
  await page.locator(".agent-result").waitFor();
  await idle();
  assert(!(await page.locator(".mission-status.failed").count()));

  // A lost session cookie creates a new instance; same revision numbers must not mask it.
  await page
    .getByRole("combobox", { name: "City district" })
    .selectOption("yinchuan");
  await idle();
  await page
    .getByRole("combobox", { name: "Simulation scenario" })
    .selectOption("imbalance");
  await idle();
  await page.context().clearCookies();
  const recreated = await post("state");
  await run();
  await page.locator(".mission-status.ready").waitFor();
  assert.match(
    await page.locator(".agent-result h3").first().textContent(),
    new RegExp(`revision ${recreated.revision}`),
  );
  assert.equal((await post("state")).contextId, recreated.contextId);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: stale browser automatically synchronises, mission applies against refreshed baseline, cross-city context pauses and refreshes, retry works, recreated session recovered. Provider fixture; real solver and HTTP locking.",
  );
} finally {
  await browser?.close();
  server.kill();
}
