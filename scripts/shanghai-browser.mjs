import { chromium } from "playwright";
import assert from "node:assert/strict";
const base = process.env.BASE_URL || "http://127.0.0.1:3103";
const browser = await chromium.launch({
  args: process.platform === "darwin" ? ["--use-angle=metal"] : [],
});
const page = await browser.newPage({ viewport: { width: 1680, height: 1050 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const state = async () =>
  (await page.request.post(base + "/api/state", { data: {} })).json();
const idle = () =>
  page.locator(".status-toast").waitFor({ state: "hidden", timeout: 60000 });
try {
  await page.goto(base);
  await page.locator(".city-scene canvas").waitFor();
  await idle();
  await page
    .getByRole("combobox", { name: "City district" })
    .selectOption("shanghai");
  await idle();
  await page.locator('.city-scene[data-city="shanghai"] canvas').waitFor();
  const first = await state();
  assert.equal(first.cityId, "shanghai");
  assert.equal(first.supplyC, 44);
  assert.match(await page.locator(".world-title").textContent(), /SHANGHAI/);
  await page.screenshot({ path: "../outputs/shanghai-district.png" });
  await page
    .getByRole("button", { name: "Quality: cinematic", exact: true })
    .click();
  await page
    .getByRole("button", { name: "⚙ Operate B10", exact: true })
    .click();
  await page
    .getByRole("slider", { name: "Requested valve opening", exact: true })
    .fill("45");
  await page
    .getByRole("button", { name: "Test manual change", exact: true })
    .click();
  await page.locator(".command-verdict.passed").waitFor();
  await page
    .getByRole("button", { name: "Apply command · +30 min", exact: true })
    .click();
  await idle();
  assert.equal((await state()).zones[2].valvePct, 45);
  await page
    .getByRole("button", { name: "Close 3D control", exact: true })
    .click();
  await page
    .getByRole("button", { name: "⚙ Energy centre", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Select P-02 in 3D", exact: true })
    .click();
  await page.screenshot({ path: "../outputs/shanghai-mechanical.png" });
  await page.getByRole("button", { name: "Evidence", exact: true }).click();
  assert.match(
    await page.locator(".ops-dock").textContent(),
    /Shanghai heat-pump field study/,
  );
  assert(
    !(await page.locator(".ops-dock").textContent()).includes(
      "Research extract:",
    ),
  );
  await page
    .getByRole("combobox", { name: "Simulation scenario" })
    .selectOption("cold");
  await idle();
  assert.equal((await state()).cityId, "shanghai");
  assert.equal((await state()).outdoorC, 0);
  await page
    .getByRole("combobox", { name: "City district" })
    .selectOption("yinchuan");
  await idle();
  await page.locator('.city-scene[data-city="yinchuan"] canvas').waitFor();
  assert.equal((await state()).outdoorC, -14);
  await page
    .getByRole("combobox", { name: "City district" })
    .selectOption("shanghai");
  await idle();
  await page.setViewportSize({ width: 1024, height: 768 });
  assert(
    await page.getByRole("combobox", { name: "City district" }).isVisible(),
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: city selection, 3D state, manual application, mechanical view, evidence isolation, scenarios, return switch and compact selector",
  );
} finally {
  await browser.close();
}
