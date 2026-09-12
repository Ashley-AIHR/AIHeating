import { chromium } from "playwright";
import { mkdir, readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const out = process.env.SCREENSHOT_DIR || "../outputs";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
});
const page = await browser.newPage({
  viewport: { width: 1512, height: 1120 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error" && !m.text().includes("favicon"))
    errors.push(m.text());
});
await page.goto("http://127.0.0.1:3000");
await page
  .getByRole("heading", { name: "Every building. One connected network." })
  .waitFor();
await page.locator(".district-scene canvas").waitFor();
await page.waitForTimeout(1200);
await page.screenshot({ path: out + "/heatpilot-desktop.png", fullPage: true });
assert.equal(await page.locator("button.building-label").count(), 12);
await page.locator(".asset-strip button").first().click();
await page.getByRole("heading", { name: "Building 01", exact: true }).waitFor();
await page.getByRole("button", { name: "Flow", exact: true }).click();
await page.waitForTimeout(100);
assert.match(
  await page.locator("button.building-label").first().textContent(),
  /m³\/h/,
);
await page.getByRole("button", { name: "Top view", exact: false }).click();
await page.getByRole("button", { name: "Reset view", exact: true }).click();
await page.getByRole("button", { name: "Thermal", exact: true }).click();
await page.getByRole("button", { name: "+30 min", exact: true }).click();
await page.waitForFunction(() =>
  document.querySelector(".session-bar")?.textContent.includes("rev 2"),
);
await page.getByRole("button", { name: "Scenario lab", exact: true }).click();
await page.getByRole("button", { name: "Run comparison", exact: true }).click();
await page.locator("table tbody tr").first().waitFor();
assert.equal(await page.locator("table tbody tr").count(), 5);
await page.screenshot({
  path: out + "/heatpilot-scenario-lab.png",
  fullPage: true,
});
await page
  .getByRole("button", { name: "Review & apply", exact: false })
  .click();
await page
  .getByRole("button", { name: "Confirm simulated change", exact: true })
  .click();
await page
  .getByRole("status")
  .filter({ hasText: "Verified controls applied" })
  .waitFor();
await page.locator("#scenario").selectOption("sensor");
await page.waitForFunction(() =>
  document.querySelector(".busy-line")?.textContent.includes("Paused"),
);
await page.getByRole("button", { name: "Digital twin", exact: true }).click();
await page.locator(".asset-strip button").nth(9).click();
await page.getByText("Suspect synthetic reading", { exact: true }).waitFor();
await page.getByRole("button", { name: "Sensors", exact: true }).click();
await page.waitForTimeout(100);
assert.match(
  await page.locator("button.building-label").nth(9).textContent(),
  /suspect/,
);
await page
  .getByRole("button", { name: "Investigate this building", exact: false })
  .click();
await page
  .getByRole("heading", { name: "Temperature measurement disagreement" })
  .waitFor();
await page
  .getByRole("button", { name: "Research & evidence", exact: true })
  .click();
assert.equal(await page.locator(".source-list article").count(), 9);
await page.getByRole("button", { name: "Digital twin", exact: true }).click();
await page.getByRole("button", { name: "Asset details", exact: true }).click();
await page.locator("#scenario").selectOption("imbalance");
await page.waitForFunction(() =>
  document.querySelector(".busy-line")?.textContent.includes("Paused"),
);
await page.waitForTimeout(100);
assert.match(
  await page.locator("button.building-label").nth(9).textContent(),
  /simulated/,
  "Reset refreshes labels even when revisions repeat",
);
await page.getByRole("button", { name: "Thermal", exact: true }).click();
if (process.env.RUN_LIVE_AI === "1") {
  process.loadEnvFile(".env");
  await page.getByRole("button", { name: "AI copilot", exact: true }).click();
  await page.locator("#access-code").fill(process.env.AI_ACCESS_TOKEN);
  await page
    .locator("#agent-question")
    .fill(
      "Inspect the current state and compare interventions for the cold far zone. Explain the trade-off and what to check on site.",
    );
  await page
    .getByRole("button", { name: "Run AI investigation", exact: true })
    .click();
  await page.locator(".authoritative-evidence").waitFor({ timeout: 150000 });
  await page
    .getByText("Lowest over entire trajectory", { exact: true })
    .first()
    .waitFor();
  assert.match(
    await page.locator(".authoritative-evidence").innerText(),
    /18\.62/,
  );
  assert.match(
    await page.locator(".authoritative-evidence").innerText(),
    /18\.80/,
  );
  await page
    .locator(".agent-panel")
    .screenshot({ path: out + "/heatpilot-ai-evidence.png" });
  await page
    .getByRole("button", { name: "Asset details", exact: true })
    .click();
}
const downloadPromise = page.waitForEvent("download");
await page
  .getByRole("button", { name: "Export evidence", exact: true })
  .click();
const download = await downloadPromise;
const exported = JSON.parse(await readFile(await download.path(), "utf8"));
assert.equal(exported.twin.buildings.length, 12);
assert(
  !JSON.stringify(exported).includes("sk-or-v1-"),
  "Export never contains provider credentials",
);
assert(!Object.hasOwn(exported, "accessCode"));
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(700);
assert(
  await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  "No horizontal mobile overflow",
);
await page.screenshot({ path: out + "/heatpilot-mobile.png", fullPage: true });
await page
  .locator(".district-scene canvas")
  .evaluate((canvas) =>
    canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true })),
  );
await page
  .getByText("3D rendering is unavailable on this device.", { exact: true })
  .waitFor();
await page.locator(".asset-strip button").first().click();
await page.getByRole("heading", { name: "Building 01", exact: true }).waitFor();
await page.goto("http://127.0.0.1:3000/legacy");
await page.waitForTimeout(500);
assert(
  (await page.locator("body").innerText()).length > 500,
  "Legacy dashboard is preserved",
);
await browser.close();
assert.deepEqual(errors, []);
console.log(
  "Browser checks passed: 3D, selection, layers, camera, stepping, scenarios, comparison, approval, sensor diagnosis, sources, mobile, legacy.",
);
