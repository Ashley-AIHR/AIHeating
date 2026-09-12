import { chromium } from "playwright";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { readFile } from "node:fs/promises";
const base = process.env.BASE_URL || "http://127.0.0.1:3134";
const server = process.env.BASE_URL
  ? null
  : spawn(
      process.execPath,
      ["--import", "./scripts/provider-stream-fixture.mjs", "server/index.mjs"],
      {
        env: {
          ...process.env,
          PORT: "3134",
          NODE_ENV: "test",
          OPENROUTER_API_KEY: "stream-test-key",
          AI_ACCESS_TOKEN: "",
        },
        stdio: "inherit",
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
    viewport: { width: 1680, height: 1080 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  await page.locator(".city-scene canvas").waitFor();
  await page.locator(".status-toast").waitFor({ state: "hidden" });
  const cityCanvas = await page.locator(".city-scene canvas").elementHandle();
  const state = async () =>
    (await page.request.post(base + "/api/state", { data: {} })).json();
  const before = await state();
  const originalStyle = await page
    .locator(".immersive")
    .evaluate((el) => ({
      font: getComputedStyle(el).fontSize,
      colour: getComputedStyle(el).color,
    }));
  await page
    .getByRole("button", { name: "BIM work studio", exact: true })
    .first()
    .click();
  const studio = page.getByRole("dialog", {
    name: "BIM work studio",
    exact: true,
  });
  await studio
    .getByRole("status")
    .filter({ hasText: "926 mesh objects" })
    .waitFor({ timeout: 60000 });
  assert.equal(new URL(page.url()).pathname, "/");
  assert.equal((await state()).revision, before.revision);
  await studio
    .getByRole("textbox", { name: "Search assets", exact: true })
    .fill("Inline Pump");
  await studio.locator(".eng-asset-list button").first().click();
  const selected = await studio.locator(".eng-id").textContent();
  await studio
    .getByRole("button", { name: "Review notes", exact: false })
    .click();
  await studio
    .locator(".eng-note textarea")
    .fill("Check maintenance access before assuming a pump defect.");
  await studio
    .getByRole("button", { name: "Add review note", exact: true })
    .click();
  await studio.getByRole("button", { name: "Focus", exact: false }).click();
  await studio.getByRole("button", { name: "Isolate", exact: false }).click();
  await studio
    .getByRole("combobox", { name: "Section axis" })
    .selectOption("x");
  await studio.getByRole("slider", { name: "Section position" }).fill("35");
  await studio
    .getByRole("button", { name: "Return to district ×", exact: true })
    .click();
  assert.equal(await cityCanvas.evaluate((el) => el.isConnected), true);
  assert.deepEqual(
    await page
      .locator(".immersive")
      .evaluate((el) => ({
        font: getComputedStyle(el).fontSize,
        colour: getComputedStyle(el).color,
      })),
    originalStyle,
  );
  await page
    .getByRole("button", { name: "BIM work studio", exact: true })
    .first()
    .click();
  assert.equal(
    await studio.getByRole("slider", { name: "Section position" }).inputValue(),
    "35",
  );
  await studio.getByRole("button", { name: "Inspect", exact: true }).click();
  assert.equal(await studio.locator(".eng-id").textContent(), selected);
  await studio
    .getByRole("button", { name: "Reset visibility", exact: true })
    .click();
  await studio
    .getByRole("button", { name: "ST01 · Energy centre", exact: true })
    .click();
  await studio
    .getByRole("navigation", { name: "Heat supply chain" })
    .getByRole("button", { name: "B01", exact: true })
    .click();
  assert.match(await studio.locator(".studio-context").textContent(), /B01/);
  if (!process.env.BASE_URL) {
    const request = page.waitForRequest((r) =>
      r.url().endsWith("/api/investigation"),
    );
    await studio
      .getByRole("button", {
        name: "Investigate with BIM evidence",
        exact: true,
      })
      .click();
    const args = (await request).postDataJSON();
    assert.equal(args.assetId, "B01");
    assert.equal(args.engineeringReview.componentId, selected);
    assert.match(args.engineeringReview.notes[0], /maintenance access/);
    await studio
      .getByText("Validating BIM review and circuit context · completed", {
        exact: true,
      })
      .waitFor();
    await studio
      .locator(".studio-mission summary")
      .filter({ hasText: /ready|Diagnostic complete/ })
      .waitFor({ timeout: 60000 });
    assert(
      (await studio.locator(".studio-agent-report").textContent()).length > 10,
    );
    await studio
      .getByRole("button", {
        name: "Plan supply-chain intervention",
        exact: true,
      })
      .click();
    await studio
      .locator(".studio-mission summary")
      .filter({ hasText: /ready/ })
      .waitFor({ timeout: 60000 });
    await studio
      .getByRole("button", {
        name: "Review mission & simulation plan",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", {
        name: "Apply first 30 min to simulation",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: "Apply to simulation only", exact: true })
      .click();
    await page.locator(".status-toast").waitFor({ state: "hidden" });
    assert.equal((await state()).revision, before.revision + 1);
    assert.notEqual(
      (await state()).flowM3h,
      before.flowM3h,
      "BIM-originated plan must change actual simulator flow",
    );
    await page
      .getByRole("button", { name: "BIM work studio", exact: true })
      .first()
      .click();
  }
  await studio
    .getByRole("combobox", { name: "Interface language", exact: true })
    .selectOption("zh-CN");
  const chinese = page.getByRole("dialog", { name: "BIM 工作室", exact: true });
  await chinese
    .getByRole("heading", { name: "资产台账", exact: true })
    .waitFor();
  await chinese
    .getByRole("button", { name: "结合 BIM 依据诊断", exact: true })
    .waitFor();
  await chinese.evaluate((el) => {
    el.scrollTop = 0;
  });
  await page.screenshot({ path: "../outputs/connected-bim-studio.png" });
  const download = page.waitForEvent("download");
  await chinese
    .getByRole("button", { name: "导出审查记录 ↗", exact: true })
    .click();
  const report = JSON.parse(
    await readFile(await (await download).path(), "utf8"),
  );
  assert.equal(report.issues.length, 1);
  await page.setViewportSize({ width: 390, height: 844 });
  assert(
    await chinese.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    "Studio must not overflow horizontally",
  );
  await chinese.evaluate((el) => {
    el.scrollTop = 0;
  });
  await page.screenshot({ path: "../outputs/connected-bim-studio-mobile.png" });
  await chinese
    .getByRole("button", { name: "在三维中操作所选回路", exact: true })
    .click();
  await page.locator(".direct-control").waitFor();
  assert.equal(await cityCanvas.evaluate((el) => el.isConnected), true);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: integrated studio, real BIM selection, retained review state, shared supply-chain selection, agent review evidence/stream (fixture locally), bilingual controls, export, mobile and return to 3D operations.",
  );
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
}
