import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const base = process.env.BASE_URL || "http://127.0.0.1:3104",
  out = process.env.SCREENSHOT_DIR || "../outputs";
const browser = await chromium.launch({
  args: process.platform === "darwin" ? ["--use-angle=metal"] : [],
});
const page = await browser.newPage({ viewport: { width: 1720, height: 1080 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text().slice(0, 300));
});
try {
  await page.goto(base);
  await page
    .locator(".city-scene[data-camera-settled=true]")
    .waitFor({ timeout: 60000 });
  await page.waitForLoadState("networkidle");
  const gpu = await page.locator(".city-scene canvas").evaluate((c) => {
    const gl = c.getContext("webgl2"),
      d = gl.getExtension("WEBGL_debug_renderer_info");
    return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : "unavailable";
  });
  await page.screenshot({ path: out + "/vision-district.png" });
  const metrics = await page.locator(".scene-metrics").boundingBox();
  assert(metrics.height < 120, "Wide-screen metrics must not cover the city");
  await page
    .getByRole("button", { name: "⚙ Energy centre", exact: true })
    .click();
  await page.waitForTimeout(1500);
  await page
    .locator(".city-scene[data-camera-settled=true]")
    .waitFor({ timeout: 60000 });
  await page
    .getByRole("button", { name: "Select P-01 in 3D", exact: true })
    .click();
  assert.match(
    await page.locator(".equipment-card h3").textContent(),
    /Duty circulation/,
  );
  await page.waitForTimeout(200);
  await page.screenshot({ path: out + "/vision-mechanical.png" });
  await page
    .getByRole("button", { name: "☀ Winter daylight", exact: true })
    .click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: out + "/vision-mechanical-blue-hour.png" });
  await page.getByRole("button", { name: "◈ District", exact: true }).click();
  await page.waitForTimeout(1800);
  await page
    .locator(".city-scene[data-camera-settled=true]")
    .waitFor({ timeout: 60000 });
  await page.screenshot({ path: out + "/vision-district-blue-hour.png" });
  const stats = await page
    .locator(".city-scene")
    .evaluate((e) => ({ ...e.dataset }));
  await page
    .getByRole("button", { name: "Quality: cinematic", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    "No mobile overflow",
  );
  const switchBox = await page.locator(".view-switch").boundingBox();
  assert(switchBox.x >= 54 && switchBox.x + switchBox.width <= 390);
  await page.screenshot({ path: out + "/vision-mobile.png", fullPage: true });
  await page
    .getByRole("button", { name: "⚙ Energy centre", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Select HX-B in 3D", exact: true })
    .click();
  assert.match(
    await page.locator(".equipment-card .eyebrow").textContent(),
    /HX-B/,
  );
  assert.deepEqual(errors, []);
  const report = {
    result: "passed",
    gpu,
    stats,
    checks: [
      "cinematic daylight and blue hour",
      "shared 3D component selection",
      "wide-screen overlay bounds",
      "mobile overflow and view controls",
      "mobile mechanical inspection",
    ],
    errors,
  };
  await writeFile(
    out + "/vision-browser-validation.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(report);
} finally {
  await browser.close();
}
