import { chromium } from "playwright";
import assert from "node:assert/strict";
const base = process.env.BASE_URL || "http://127.0.0.1:3103";
const out = process.env.SCREENSHOT_DIR || "../outputs";
const browser = await chromium.launch({
  args: process.platform === "darwin" ? ["--use-angle=metal"] : [],
});
const page = await browser.newPage({ viewport: { width: 1680, height: 1080 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto(base);
  await page.locator(".city-scene canvas").waitFor();
  // Software-rendered browser regression uses the performance setting; visual QA also captures cinematic mode separately.
  await page
    .getByRole("button", { name: "Quality: cinematic", exact: true })
    .click();
  await page.getByRole("status").waitFor({ state: "hidden" });
  await page.locator(".city-scene canvas").focus();
  await page.keyboard.press("ArrowRight");
  await page
    .getByRole("combobox", { name: "Selected asset" })
    .selectOption("B09");
  assert.match(await page.locator(".ops-dock h2").textContent(), /Building 09/);
  const selected = page.locator(".city-labels button.active");
  assert.match(await selected.textContent(), /B09/);
  await page.locator(".city-scene canvas").focus();
  await page.keyboard.press("Home");
  await page.screenshot({ path: out + "/integrated-district.png" });
  const timeBefore = await page.locator(".context-line").textContent();
  await page
    .getByRole("button", { name: "⚙ Energy centre", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Select P-02 in 3D", exact: true })
    .click();
  assert.match(
    await page.locator(".equipment-card h3").textContent(),
    /Duty circulation pump/,
  );
  assert.match(
    await page.locator(".city-labels button.active").textContent(),
    /P-02/,
  );
  assert(
    (await page.locator(".context-line").textContent()).endsWith(
      timeBefore.slice(-5),
    ),
    "Spatial navigation must preserve simulation time",
  );
  await page
    .locator('.city-scene[data-camera-settled="true"]')
    .waitFor({ timeout: 60000 });
  await page.screenshot({ path: out + "/vision-mechanical-tested.png" });
  await page.getByRole("button", { name: "◈ District", exact: true }).click();
  await page.getByRole("button", { name: "Optimise", exact: true }).click();
  await page.getByRole("button", { name: "Compute & verify schedule" }).click();
  await page.getByText("MODEL GATES PASSED", { exact: false }).waitFor();
  await page.getByRole("button", { name: "Preview in district" }).click();
  assert.match(await page.locator(".mode-badge").textContent(), /FORECAST/);
  await page.getByRole("slider", { name: "Timeline sample" }).fill("5");
  await page.screenshot({ path: out + "/integrated-optimisation.png" });
  await page
    .getByRole("button", { name: "Current simulation", exact: true })
    .click();
  await page.getByRole("button", { name: "Approve simulator step…" }).click();
  await page.getByRole("button", { name: "Apply to simulation only" }).click();
  await page
    .getByRole("dialog", { name: "Approve simulator change?" })
    .waitFor({ state: "hidden" });
  await page.getByText("Expired context.", { exact: false }).waitFor();
  await page.getByRole("button", { name: "Replay", exact: true }).click();
  await page.getByRole("slider", { name: "Timeline sample" }).fill("0");
  assert.match(await page.locator(".mode-badge").textContent(), /REPLAY/);
  await page
    .getByRole("button", { name: "BIM reference ↗", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "926 mesh objects" })
    .waitFor({ timeout: 60000 });
  const bimBox = await page.locator(".bim-canvas canvas").boundingBox();
  assert(bimBox.height > 200);
  await page.screenshot({ path: out + "/integrated-bim.png" });
  await page.getByRole("button", { name: "Return to district ×" }).click();
  assert.match(await page.locator(".mode-badge").textContent(), /REPLAY/);
  await page
    .getByRole("button", { name: "Current simulation", exact: true })
    .click();
  await page.getByRole("button", { name: "Agents", exact: true }).click();
  await page.getByText("DeepSeek V4 Flash", { exact: true }).waitFor();
  // A labelled transport mock checks UI wiring only; this is not evidence of a live model call.
  await page.route("**/api/investigation", async (route) => {
    const a = route.request().postDataJSON();
    await route.fulfill({
      json: {
        runId: "browser-mock",
        role: a.role,
        model: "mock",
        revision: a.revision,
        assetId: a.assetId,
        answer: "Mocked browser wiring test — inspect source evidence.",
        totalTokens: 0,
        trace: [{ tool: "inspect_world", result: { mode: "mock" } }],
        optimisation: null,
      },
    });
  });
  const input = page.getByLabel("Operator access code");
  await input.fill("mock-only");
  if (
    await page
      .getByRole("button", { name: "Run diagnostic agent", exact: true })
      .isEnabled()
  ) {
    await page
      .getByRole("button", { name: "Run diagnostic agent", exact: true })
      .click();
    await page
      .getByText("Mocked browser wiring test", { exact: false })
      .waitFor();
  }
  await page.getByRole("button", { name: "Evidence", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export world evidence" }).click();
  const file = await download;
  await file.saveAs(out + "/integrated-world-evidence.json");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Assets", exact: true }).click();
  await page.screenshot({
    path: out + "/integrated-mobile.png",
    fullPage: true,
  });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    "Mobile must not overflow horizontally",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: integrated selection, orbit, optimisation, preview, approval, expiry, replay, contextual BIM, agent UI, export and mobile. Provider response mocked for UI only.",
  );
} finally {
  await browser.close();
}
