import { chromium } from "playwright";
import assert from "node:assert/strict";
const base = process.env.BASE_URL || "http://127.0.0.1:3103";
const out = process.env.SCREENSHOT_DIR || "../outputs";
const browser = await chromium.launch({
  args: process.platform === "darwin" ? ["--use-angle=metal"] : [],
});
const page = await browser.newPage({ viewport: { width: 1680, height: 1050 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const state = async () =>
  (await page.request.post(base + "/api/state", { data: {} })).json();
const idle = () =>
  page.getByRole("status").waitFor({ state: "hidden", timeout: 60000 });
try {
  await page.goto(base);
  await page.locator(".city-scene canvas").waitFor();
  await page
    .getByRole("button", { name: "Quality: cinematic", exact: true })
    .click();
  await idle();
  const initial = await state();
  await page
    .getByRole("button", { name: "⚙ Operate B10", exact: true })
    .click();
  await page
    .getByRole("slider", { name: "Requested valve opening", exact: true })
    .fill("45");
  await page
    .getByRole("button", { name: "Test manual change", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Apply command · +30 min", exact: true })
    .waitFor();
  await page.locator(".command-verdict.passed").waitFor();
  assert.equal((await state()).revision, initial.revision);
  await page.screenshot({ path: out + "/direct-valve-control.png" });
  await page
    .getByRole("button", { name: "Apply command · +30 min", exact: true })
    .click();
  await page.waitForFunction(() =>
    document.querySelector(".context-line")?.textContent.includes("Revision 2"),
  );
  const manualState = await state();
  assert.equal(manualState.zones[2].valvePct, 45);
  assert.equal(manualState.elapsedMinutes, initial.elapsedMinutes + 30);
  await page
    .getByRole("button", { name: "Close 3D control", exact: true })
    .click();
  const before = await state();
  await page
    .getByRole("button", { name: "Explore with numerical solver", exact: true })
    .click();
  await page.locator(".mission-status.ready").waitFor();
  await page
    .getByRole("button", { name: "Pause prediction", exact: true })
    .click();
  assert.equal((await state()).revision, before.revision);
  await page.getByRole("slider", { name: "Timeline sample" }).fill("5");
  await page.locator('.city-scene[data-comparison="true"]').waitFor();
  const intervention = await page
    .locator('.city-labels button[data-asset="B10"]')
    .textContent();
  await page
    .getByRole("button", { name: "Continue unchanged", exact: true })
    .click();
  await page.getByRole("slider", { name: "Timeline sample" }).fill("5");
  const unchanged = await page
    .locator('.city-labels button[data-asset="B10"]')
    .textContent();
  assert.notEqual(
    intervention,
    unchanged,
    "The futures must change actual 3D asset readings",
  );
  await page
    .getByRole("button", { name: "With intervention", exact: true })
    .click();
  await page.getByRole("slider", { name: "Timeline sample" }).fill("5");
  await page.locator(".mission-comparison").scrollIntoViewIfNeeded();
  await page.screenshot({ path: out + "/agent-mission-two-futures.png" });
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
  await page.getByLabel("Measured simulation outcome").waitFor();
  const after = await state();
  assert.equal(after.revision, before.revision + 1);
  assert.notEqual(after.flowM3h, before.flowM3h);
  await page.getByLabel("Measured simulation outcome").scrollIntoViewIfNeeded();
  await page.screenshot({ path: out + "/agent-mission-applied.png" });

  // Only the provider transport is mocked. Every plan and applied state uses the real Node solver.
  await page.route("**/api/config", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      json: { ...(await response.json()), aiConfigured: true },
    });
  });
  let paidRequests = 0;
  await page.route("**/api/investigation", async (route) => {
    paidRequests++;
    const args = route.request().postDataJSON();
    const response = await page.request.post(base + "/api/optimise", {
      data: { objective: args.objective },
    });
    const optimisation = await response.json();
    assert.equal(optimisation.revision, args.revision);
    const messages = [
      {
        type: "event",
        event: {
          tool: "optimise_network",
          status: "running",
          at: new Date().toISOString(),
        },
      },
      {
        type: "event",
        event: {
          tool: "optimise_network",
          status: "completed",
          at: new Date().toISOString(),
        },
      },
      {
        type: "result",
        result: {
          runId: `mock-${paidRequests}`,
          role: "optimisation",
          assetId: args.assetId,
          revision: args.revision,
          model: "UI-test-double",
          answer:
            "Transport mock; the physics and controls are real simulation results.",
          totalTokens: 0,
          trace: [],
          optimisation,
          sceneActions: [
            { type: "highlight", assetIds: ["ST01", "far", "B10", "B99"] },
          ],
        },
      },
    ];
    await route.fulfill({
      contentType: "application/x-ndjson",
      body: messages.map((v) => JSON.stringify(v)).join("\n") + "\n",
    });
  });
  await page.reload();
  await idle();
  await page
    .getByRole("button", { name: "Quality: cinematic", exact: true })
    .click();
  const operatorCode = page.getByLabel("Operator access code", { exact: true });
  if (await operatorCode.count()) await operatorCode.fill("mock-only");
  const loopBefore = await state();
  await page
    .getByRole("button", { name: "Run 3 agent control cycles", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      document.querySelector(".mission-status.applied") &&
      ![...document.querySelectorAll("button")].some((b) =>
        b.textContent.includes("Stop further cycles"),
      ),
    { timeout: 60000 },
  );
  assert.equal(paidRequests, 3);
  assert.equal((await state()).revision, loopBefore.revision + 3);
  // Stopping before an application must prevent it, including after a provider response.
  const stopBefore = await state();
  await page
    .getByRole("button", { name: "Run 3 agent control cycles", exact: true })
    .click();
  await page.locator(".mission-status.ready").waitFor();
  await page.getByRole("button", { name: /Stop further cycles/ }).click();
  await page.waitForTimeout(3000);
  assert.equal((await state()).revision, stopBefore.revision);
  await page
    .getByRole("button", { name: "Current simulation", exact: true })
    .click();
  await page.getByRole("button", { name: "+30 min", exact: true }).click();
  await idle();
  assert(
    await page
      .getByRole("button", {
        name: "Apply first 30 min to simulation",
        exact: true,
      })
      .isDisabled(),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: out + "/agent-mission-mobile.png",
    fullPage: true,
  });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: physical scene comparison, unchanged preview state, verified application, measured response, three bounded autonomous cycles, stop, stale plan rejection, mobile. Provider transport mocked; solver and state transitions real.",
  );
} finally {
  await browser.close();
}
