import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
const base = process.env.BASE_URL || "http://127.0.0.1:3100",
  out = process.env.SCREENSHOT_DIR || "../outputs";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
});
const page = await browser.newPage({
  viewport: { width: 1680, height: 1080 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto(base + "/engineering");
  await page
    .getByRole("status")
    .filter({ hasText: "926 mesh objects" })
    .waitFor({ timeout: 60000 });
  await page.locator(".eng-canvas canvas").waitFor();
  await page.screenshot({
    path: out + "/engineering-mechanical-orbit.png",
    fullPage: true,
  });
  const before = await page.locator(".eng-camera-readout").textContent();
  await page.locator("canvas").focus();
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(220);
  assert.notEqual(
    await page.locator(".eng-camera-readout").textContent(),
    before,
    "Keyboard must orbit actual camera",
  );
  const rect = await page.locator("canvas").boundingBox();
  await page.mouse.move(
    rect.x + rect.width * 0.55,
    rect.y + rect.height * 0.55,
  );
  await page.mouse.down();
  await page.mouse.move(
    rect.x + rect.width * 0.75,
    rect.y + rect.height * 0.45,
    { steps: 12 },
  );
  await page.mouse.up();
  await page.waitForTimeout(300);
  assert.notEqual(
    await page.locator(".eng-camera-readout").textContent(),
    before,
    "Pointer must orbit actual camera",
  );
  await page.getByRole("button", { name: "Fit all", exact: false }).click();
  await page
    .getByRole("textbox", { name: "Search assets" })
    .fill("Inline Pump");
  await page.locator(".eng-asset-list button").first().click();
  await page.getByText("Telemetry: not mapped", { exact: true }).waitFor();
  assert.match(
    await page.locator(".eng-inspector-content").textContent(),
    /IfcFlowMovingDevice/,
  );
  await page.getByRole("button", { name: "Focus", exact: false }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Isolate", exact: false }).click();
  await page.screenshot({
    path: out + "/engineering-pump-inspection.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Hide asset", exact: true }).click();
  await page
    .getByText("This asset is hidden from the viewport.", { exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Show asset", exact: true }).click();
  await page.getByRole("combobox", { name: "Section axis" }).selectOption("x");
  await page.getByRole("slider", { name: "Section position" }).fill("35");
  assert.match(await page.locator(".eng-section output").textContent(), /35%/);
  await page
    .getByRole("combobox", { name: "Section axis" })
    .selectOption("none");
  await page.getByRole("button", { name: "↔ Measure", exact: true }).click();
  const canvas = await page.locator("canvas").boundingBox();
  // Exercise real raycasting against the visible focused component (no mocked measurements).
  for (const [x, y] of [
    [0.48, 0.5],
    [0.52, 0.5],
    [0.5, 0.48],
    [0.5, 0.52],
    [0.45, 0.55],
    [0.55, 0.45],
  ])
    await page.mouse.click(
      canvas.x + canvas.width * x,
      canvas.y + canvas.height * y,
    );
  assert.ok(
    (await page.locator(".eng-analysis ol li").count()) > 0,
    "Picking mesh surfaces must create a measurement",
  );
  await page.getByRole("button", { name: "↔ Measure", exact: true }).click();
  await page
    .getByRole("button", { name: "Save current viewpoint", exact: false })
    .click();
  assert.equal(
    await page.getByRole("button", { name: "View 1", exact: false }).count(),
    1,
  );
  await page
    .getByRole("button", { name: "Review notes", exact: false })
    .click();
  await page
    .locator(".eng-note textarea")
    .fill(
      "Verify maintenance access against approved equipment documentation.",
    );
  await page
    .getByRole("button", { name: "Add review note", exact: true })
    .click();
  const downloadEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export review", exact: false })
    .click();
  const downloaded = await downloadEvent,
    report = JSON.parse(await readFile(await downloaded.path(), "utf8"));
  await downloaded.saveAs(out + "/engineering-review-example.json");
  assert.equal(report.mode, "bim");
  assert.equal(report.measurements.length > 0, true);
  assert.equal(report.issues.length, 1);
  assert.equal(report.source.sha256.length, 64);
  assert.ok(
    report.measurements.every(
      (m) => m.distance > 0 && Number.isFinite(m.distance),
    ),
  );
  await page
    .getByRole("button", { name: "District topology", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "topology glyphs" })
    .waitFor();
  await page.getByRole("textbox", { name: "Search assets" }).fill("P1s");
  await page.locator(".eng-asset-list button").first().click();
  await page
    .getByRole("button", { name: "Trace shortest source path", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Test outage of this pipe", exact: true })
    .click();
  assert.match(await page.locator(".eng-outages").textContent(), /P1s/);
  await page
    .getByText("Disconnected: S0, S1, S2, S3, S4", { exact: true })
    .waitFor();
  await page.screenshot({
    path: out + "/engineering-network-outage.png",
    fullPage: true,
  });
  await page.getByRole("textbox", { name: "Search assets" }).fill("S0");
  await page.getByRole("button", { name: /^Inspect S0:/ }).click();
  await page.getByText("Graph connection lost", { exact: true }).waitFor();
  await page.getByRole("textbox", { name: "Search assets" }).fill("P1s");
  await page.locator(".eng-asset-list button").first().click();
  await page
    .getByRole("button", { name: "Restore this edge", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Sources & scope", exact: true })
    .click();
  await page
    .getByRole("heading", {
      name: "Provenance & engineering limits",
      exact: true,
    })
    .waitFor();
  assert.match(
    await page.locator(".eng-dialog").textContent(),
    /Explicit IFC port connections in source: 0/,
  );
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "Mobile viewport must not overflow",
  );
  await page.screenshot({
    path: out + "/engineering-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1680, height: 1080 });
  await page
    .locator("input[type=file]")
    .setInputFiles("public/engineering-assets/duplex-mep.glb");
  await page
    .getByRole("status")
    .filter({ hasText: "926 mesh objects" })
    .waitFor({ timeout: 60000 });
  assert.match(
    await page.locator(".eng-titlebar").textContent(),
    /local import/,
  );
  await page.getByRole("textbox", { name: "Search assets" }).fill("");
  await page.locator(".eng-asset-list button").first().click();
  await page
    .getByText("Local GLB · scale not independently verified", { exact: true })
    .waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "Engineering browser regression passed: actual orbit, IFC selection, focus/isolation, sectioning, real surface measurement, viewpoint/note export, topology analysis, mobile and local GLB import.",
  );
} catch (error) {
  console.error("Browser errors:", errors);
  console.error((await page.locator("body").innerText()).slice(0, 6000));
  await page.screenshot({
    path: out + "/engineering-test-failure.png",
    fullPage: true,
  });
  throw error;
} finally {
  await browser.close();
}
