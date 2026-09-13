import { chromium } from "playwright";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
const base = "http://127.0.0.1:3159";
const server = spawn(
  process.execPath,
  ["--import", "./scripts/provider-stream-fixture.mjs", "server/index.mjs"],
  {
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: "3159",
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
    .locator(".city-scene[data-city=beijing][data-backdrop=city-panorama]")
    .waitFor({ timeout: 60000 });
  await page
    .getByRole("button", { name: "Comfort recovery", exact: true })
    .click();
  const state = async () =>
    (await page.request.post(base + "/api/state", { data: {} })).json();
  const original = await state();
  await page
    .getByRole("button", { name: "✧ Run agent mission", exact: true })
    .click();
  await page
    .locator(".engineering-option.passed")
    .first()
    .waitFor({ timeout: 30000 });
  assert.equal((await state()).revision, original.revision);
  assert(
    (await page
      .getByLabel("Executed mission activity")
      .getByText("Comparing physical engineering alternatives", { exact: true })
      .count()) > 0,
  );
  const winner = page.locator(".engineering-option.passed").last();
  await winner
    .getByRole("button", { name: "Preview this physical trajectory in 3D" })
    .click();
  await page.getByRole("slider", { name: "Timeline sample" }).fill("3");
  assert(
    (await page.locator(".scene-engineering").textContent()).includes(
      "ORIGINAL MODEL UNCHANGED",
    ),
  );
  assert(
    (
      await page.locator(".city-labels button[data-asset=B10]").textContent()
    ).includes("21.0"),
  );
  await winner
    .getByRole("button", { name: "Review modified scenario" })
    .click();
  await page
    .getByRole("button", {
      name: "Open isolated engineering scenario",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Replan and apply next 30 min", exact: true })
    .waitFor();
  let s = await state();
  assert(s.engineering);
  assert.equal(s.engineering.remainingMinutes, 90);
  for (const remaining of [60, 30, 0]) {
    await page
      .getByRole("button", {
        name: "Replan and apply next 30 min",
        exact: true,
      })
      .click();
    await page.waitForFunction(
      (remaining) =>
        document
          .querySelector(".scene-engineering")
          ?.textContent.includes(`· ${remaining} min`),
      remaining,
    );
    s = await state();
    assert.equal(s.engineering.remainingMinutes, remaining);
  }
  assert(Math.abs(s.buildings.find((b) => b.id === "B10").modelC - 21) < 0.3);
  assert(s.buildings.every((b) => b.modelC >= 18 && b.modelC <= 23));
  await page
    .getByRole("button", { name: "Expand to fullscreen", exact: true })
    .click()
    .catch(() => {});
  await page.screenshot({ path: "../work/engineering-completed-en.png" });
  await page
    .getByRole("combobox", { name: "Interface language" })
    .selectOption("zh-CN");
  await page
    .getByRole("button", { name: "返回保留的原场景", exact: true })
    .click();
  await page
    .getByRole("button", { name: "比较工程解决方案", exact: true })
    .waitFor();
  s = await state();
  assert.deepEqual(s.buildings, original.buildings);
  await page
    .getByRole("button", { name: "比较工程解决方案", exact: true })
    .click();
  await page
    .locator(".engineering-option.passed")
    .first()
    .waitFor({ timeout: 30000 });
  await page.locator(".engineering-workbench").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "../work/engineering-alternatives-zh.png" });
  await page.getByRole("combobox", { name: "界面语言" }).selectOption("en");
  await page
    .locator(".engineering-option.passed")
    .last()
    .getByRole("button", { name: "Review modified scenario" })
    .click();
  await page
    .getByRole("button", {
      name: "Open isolated engineering scenario",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Replan and apply next 30 min", exact: true })
    .waitFor();
  const beforeManual = await state();
  await page
    .getByRole("button", { name: "⚙ Operate B10", exact: true })
    .click();
  await page.getByLabel("Local valve opening", { exact: true }).fill("10");
  await page
    .getByRole("button", {
      name: "Verify local valve and simulate 30 min",
      exact: true,
    })
    .click();
  await page.getByLabel("Direct 3D control").waitFor({ state: "hidden" });
  const manual = await state();
  assert.equal(manual.engineering.design.manualValves.B10, 10);
  assert.notEqual(
    manual.buildings.find((b) => b.id === "B10").flowM3h,
    beforeManual.buildings.find((b) => b.id === "B10").flowM3h,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS engineering browser: streamed agent escalation, unchanged original, 3D modified forecast, confirmed fork, four goal-tracked physical steps, original recovery, Chinese catalogue, direct 3D local valve actuation and mobile. Provider fixture, real numerical physics.",
  );
} finally {
  await browser?.close();
  server.kill();
}
