import { chromium } from "playwright";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
const base = "http://127.0.0.1:3148";
const server = spawn(
  process.execPath,
  ["--import", "./scripts/provider-stream-fixture.mjs", "server/index.mjs"],
  {
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: "3148",
      OPENROUTER_API_KEY: "stream-test-key",
      AI_ACCESS_TOKEN: "",
    },
    stdio: "ignore",
  },
);
let browser;
try {
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(base + "/api/health")).ok) break;
    } catch {}
    await delay(100);
  }
  browser = await chromium.launch({
    args: process.platform === "darwin" ? ["--use-angle=metal"] : [],
  });
  const page = await browser.newPage({
      viewport: { width: 1680, height: 1050 },
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  await page
    .getByRole("combobox", { name: "City district" })
    .selectOption("beijing");
  await page
    .locator(
      ".city-scene[data-city=beijing][data-backdrop=city-panorama][data-facades=professional-cc0]",
    )
    .waitFor({ timeout: 60000 });
  const state = async () =>
    (await page.request.post(base + "/api/state", { data: {} })).json();
  await page
    .getByRole("button", { name: "Comfort recovery", exact: true })
    .click();
  assert.equal(
    await page.getByLabel("Goal scope", { exact: true }).inputValue(),
    "asset",
  );
  assert.equal(
    await page.getByLabel("Goal target", { exact: true }).inputValue(),
    "21",
  );
  assert(
    await page
      .getByRole("button", { name: "Run 3 agent control cycles", exact: true })
      .isDisabled(),
  );
  const before = await state();
  await page
    .getByRole("button", { name: "Explore with numerical solver", exact: true })
    .click();
  await page.locator(".goal-outcome.missed").waitFor();
  assert.equal((await state()).revision, before.revision);
  assert.equal(
    await page
      .getByRole("button", {
        name: "Apply first 30 min to simulation",
        exact: true,
      })
      .count(),
    0,
  );
  await page
    .getByRole("button", {
      name: "Preview best tested trajectory · not applicable",
      exact: true,
    })
    .click();
  await page.getByRole("slider", { name: "Timeline sample" }).fill("3");
  const prediction = await page
    .locator(".city-labels button[data-asset=B10]")
    .textContent();
  assert(
    !prediction.includes("18.6°"),
    "The missed-goal preview still displays the actual tested physical trajectory",
  );
  await page.locator(".goal-outcome").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "../outputs/beijing-precise-goal-missed.png" });
  await page
    .getByRole("combobox", { name: "Simulation scenario" })
    .selectOption("warming");
  await page
    .getByRole("button", { name: "Pump efficiency", exact: true })
    .click();
  const start = await state();
  await page
    .getByRole("button", { name: "✧ Run agent mission", exact: true })
    .click();
  await page.locator(".mission-status.ready").waitFor({ timeout: 30000 });
  await page.locator(".goal-outcome.passed").waitFor();
  assert.equal((await state()).revision, start.revision);
  assert(
    (await page
      .getByLabel("Executed mission activity")
      .getByText("Solving and verifying the control schedule", { exact: true })
      .count()) > 0,
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
  await page.getByLabel("Measured simulation outcome").waitFor();
  const after = await state();
  assert.equal(after.revision, start.revision + 1);
  assert.notEqual(after.pumpHz, start.pumpHz);
  await page
    .getByRole("button", { name: "Sensor investigation", exact: true })
    .click();
  assert(
    await page
      .getByRole("button", {
        name: "Explore with numerical solver",
        exact: true,
      })
      .isDisabled(),
  );
  await page
    .getByRole("button", { name: "✧ Run agent mission", exact: true })
    .click();
  await page.locator(".mission-status.blocked").waitFor({ timeout: 30000 });
  assert(
    (await page
      .getByLabel("Executed mission activity")
      .getByText("Comparing sensor and model evidence", { exact: true })
      .count()) > 0,
  );
  assert.equal((await state()).revision, after.revision);
  await page
    .getByRole("combobox", { name: "Interface language" })
    .selectOption("zh-CN");
  await page.getByRole("button", { name: "热量预算", exact: true }).click();
  assert.equal(
    await page.getByLabel("目标值", { exact: true }).inputValue(),
    "8",
  );
  await page.getByRole("button", { name: "全屏展开", exact: true }).click();
  await page.screenshot({ path: "../outputs/beijing-goal-workbench-zh.png" });
  await page.getByRole("button", { name: "还原面板", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: precise building goal, missed-goal 3D preview, streamed goal-constrained solver, verified simulator application, diagnostic-only sensor mission, Chinese/fullscreen/mobile. Provider transport fixture; real numerical engine.",
  );
} finally {
  await browser?.close();
  server.kill();
}
