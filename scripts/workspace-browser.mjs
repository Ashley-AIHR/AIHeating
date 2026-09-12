import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";

const base = process.env.BASE_URL || "http://127.0.0.1:3100";
const out = process.env.SCREENSHOT_DIR || "../outputs";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
});
const page = await browser.newPage({
  viewport: { width: 1680, height: 1180 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const snapshot = () =>
  page.evaluate(async () =>
    (
      await fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      })
    ).json(),
  );
const ready = () =>
  page.getByText("Paused · all readings simulated", { exact: true }).waitFor();
try {
  await page.goto(base + "/reference");
  await ready();
  await page.locator(".tw-scene img").evaluate((img) => img.decode());
  assert.equal(await page.locator(".tw-pin").count(), 12);
  assert.equal(
    await page
      .locator(".tw-scene img")
      .evaluate((img) => img.naturalWidth > 1000),
    true,
  );
  const initial = await snapshot();
  console.log("Initial snapshot:", {
    revision: initial.revision,
    time: initial.time,
    history: initial.history.length,
    zones: initial.zones.map((z) => z.id),
  });
  await page.getByRole("button", { name: "Select B03", exact: true }).click();
  await page
    .locator(".tw-inspector")
    .getByRole("heading", { name: "B03", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Flow", exact: true }).click();
  assert.match(await page.locator(".tw-pin").first().textContent(), /m³\/h/);
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  assert.equal(
    await page.getByRole("status", { name: "Zoom level" }).textContent(),
    "125%",
  );
  await page.locator(".tw-scene").focus();
  await page.keyboard.press("ArrowLeft");
  assert.match(
    await page.locator(".tw-scene-plane").getAttribute("style"),
    /translate\(40px/,
  );
  await page.keyboard.press("Home");
  await page.keyboard.press("+");
  assert.equal(
    await page.getByRole("status", { name: "Zoom level" }).textContent(),
    "125%",
  );
  await page.getByRole("button", { name: "Reset image view" }).click();
  assert.equal(
    await page.getByRole("status", { name: "Zoom level" }).textContent(),
    "100%",
  );
  await page
    .getByRole("button", { name: "Indoor temperature", exact: true })
    .click();
  await page.getByRole("button", { name: "Select B10", exact: true }).click();
  assert.equal(await page.locator('.tw-pin[aria-pressed="true"]').count(), 1);
  await page.screenshot({
    path: out + "/district-workspace.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "HS-01 Inspect station", exact: false })
    .click();
  await page.locator(".tw-scene img").evaluate((img) => img.decode());
  assert.equal(await page.locator(".tw-pin").count(), 5);
  assert.equal(
    (await snapshot()).revision,
    initial.revision,
    "View/layer/asset changes must not mutate simulation",
  );
  await page
    .getByRole("button", {
      name: "Inspect Plate heat exchanger 01",
      exact: true,
    })
    .click();
  await page.getByText("Reference geometry only", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Inspect Secondary circulation", exact: true })
    .click();
  await page.getByText("Station-level simulation", { exact: true }).waitFor();
  await page.screenshot({
    path: out + "/mechanical-workspace.png",
    fullPage: true,
  });
  await page.locator(".tw-branches button").last().click();
  await page
    .locator(".tw-inspector")
    .getByRole("heading", { name: "B10", exact: true })
    .waitFor();
  assert.equal((await snapshot()).revision, initial.revision);
  await page
    .getByRole("button", { name: "Advance +30 min", exact: false })
    .click();
  await ready();
  assert.equal((await snapshot()).elapsedMinutes, initial.elapsedMinutes + 30);
  await page
    .getByRole("button", { name: "Interventions", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Run comparison", exact: true })
    .click();
  await page.locator(".tw-dialog tbody tr").first().waitFor();
  assert.equal(await page.locator(".tw-dialog tbody tr").count(), 5);
  await page.screenshot({
    path: out + "/intervention-workspace.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Review recommended change", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm simulated change", exact: true })
    .click();
  await page
    .locator(".tw-dialog")
    .getByRole("status")
    .filter({ hasText: "Verified controls applied" })
    .waitFor();
  assert.equal((await snapshot()).elapsedMinutes, initial.elapsedMinutes + 60);
  assert.equal(
    await page.locator(".tw-dialog tbody tr").count(),
    0,
    "Applied comparison must be invalidated",
  );
  await page.getByRole("button", { name: "Close panel", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Scenario", exact: true })
    .selectOption("sensor");
  await ready();
  await page.getByText("Suspect synthetic reading", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Investigate B10", exact: false })
    .click();
  await page
    .getByRole("heading", {
      name: "Temperature measurement disagreement",
      exact: true,
    })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Run AI investigation", exact: true })
      .isDisabled(),
    true,
    "No unattended paid provider calls",
  );
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Evidence library", exact: true })
    .click();
  assert.ok((await page.locator(".tw-source-list article").count()) >= 1);
  const downloadEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export simulation evidence", exact: true })
    .click();
  const download = await downloadEvent;
  const evidenceText = await readFile(await download.path(), "utf8");
  const evidence = JSON.parse(evidenceText);
  assert.equal(evidence.twin.scenario, "sensor");
  assert.equal(evidence.selectedBuilding, "B10");
  assert.doesNotMatch(
    evidenceText,
    /sk-or-v1-|github_pat_|AI_ACCESS_TOKEN|OPENROUTER_API_KEY/,
  );
  await page.keyboard.press("Escape");
  await page
    .getByRole("combobox", { name: "Scenario", exact: true })
    .selectOption("imbalance");
  await ready();
  assert.equal(
    await page.getByText("Suspect synthetic reading", { exact: true }).count(),
    0,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page
      .getByRole("navigation", { name: "Workspace navigation" })
      .getByRole("button", { name: "Mechanical plant", exact: true })
      .count(),
    1,
  );
  await page.screenshot({
    path: out + "/district-workspace-mobile.png",
    fullPage: true,
  });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "Mobile layout must not overflow",
  );
  await page.getByRole("button", { name: "Mechanical", exact: true }).click();
  await page.locator(".tw-scene img").evaluate((img) => img.decode());
  await page.screenshot({
    path: out + "/mechanical-workspace-mobile.png",
    fullPage: true,
  });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  // Failure mode: asset data remains reachable even if the large render cannot load.
  const offline = await browser.newPage();
  await offline.route("**/assets/*reference*.png", (route) => route.abort());
  await offline.goto(base + "/reference");
  await offline
    .getByRole("heading", { name: "Reference image unavailable" })
    .waitFor();
  await offline
    .getByRole("button", { name: "Select B01", exact: true })
    .click();
  await offline
    .locator(".tw-inspector")
    .getByRole("heading", { name: "B01", exact: true })
    .waitFor();
  await offline.close();
  await page.goto(base + "/operations-classic");
  await page
    .getByRole("heading", { name: "Every building. One connected network." })
    .waitFor();
  await page.goto(base + "/legacy");
  await page.waitForSelector("#root > *");
  assert.deepEqual(errors, []);
  console.log(
    "Dual-view browser regression: PASS (views, state, layers, zoom, branch navigation, comparison/apply, sensor diagnosis, evidence export, mobile, image failure, preserved routes).",
  );
} catch (error) {
  console.error("Browser errors:", errors);
  console.error("Visible page:", await page.locator("body").innerText());
  await page.screenshot({
    path: out + "/workspace-test-failure.png",
    fullPage: true,
  });
  throw error;
} finally {
  await browser.close();
}
