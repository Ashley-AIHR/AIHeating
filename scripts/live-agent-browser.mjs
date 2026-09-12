// REAL browser + provider regression. Requires explicit opt-in for paid calls.
import assert from "node:assert/strict";
import { chromium } from "playwright";
if (process.env.LIVE_AI_TEST !== "1")
  throw Error("Set LIVE_AI_TEST=1 to authorise live provider tests");
const base = process.env.BASE_URL || "http://127.0.0.1:3128";
const browser = await chromium.launch({
  args: process.platform === "darwin" ? ["--use-angle=metal"] : [],
});
const page = await browser.newPage({ viewport: { width: 1680, height: 1050 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const state = async () =>
  (await page.request.post(base + "/api/state", { data: {} })).json();
const idle = () =>
  page.locator(".status-toast").waitFor({ state: "hidden", timeout: 255000 });
try {
  await page.goto(base);
  await page.locator(".city-scene canvas").waitFor();
  await idle();
  await page
    .getByRole("button", { name: "Quality: cinematic", exact: true })
    .click();
  for (const city of (process.env.TEST_CITIES || "yinchuan,shanghai").split(
    ",",
  )) {
    await page
      .getByRole("combobox", { name: "City district" })
      .selectOption(city);
    await idle();
    const before = await state(),
      started = Date.now();
    const response = page.waitForResponse(
      (r) => r.url().endsWith("/api/investigation"),
      { timeout: 255000 },
    );
    await page
      .getByRole("button", { name: "✧ Run agent mission", exact: true })
      .click();
    const stream = await response;
    assert.equal(stream.status(), 200);
    const packets = (await stream.text())
      .split("\n")
      .filter(Boolean)
      .map(JSON.parse);
    const result = packets.find((p) => p.type === "result")?.result;
    assert(result, JSON.stringify(packets.find((p) => p.type === "error")));
    console.log({
      city,
      seconds: Math.round((Date.now() - started) / 1000),
      runId: result.runId,
      status: result.completionStatus,
      withheld: result.narrativeWithheld,
      warning: result.warning,
      tools: result.trace.map((t) => t.tool),
    });
    assert.equal(result.completionStatus, "complete");
    assert.equal(result.narrativeWithheld, false);
    assert(packets.filter((p) => p.event?.kind === "text").length > 0);
    assert(
      result.optimisation?.recommendation,
      "Default UI mission must prepare a plan for imbalance",
    );
    await page.locator(".mission-status.ready").waitFor();
    assert.match(
      await page.locator(".agent-result").textContent(),
      /COMPLETED/,
    );
    assert.match(
      await page.locator(".mission-events").textContent(),
      /Public report complete/,
    );
    assert.equal((await state()).revision, before.revision);
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
    await page.locator(".mission-status.applied").waitFor();
    const after = await state(),
      expected = result.optimisation.recommendation.trace[0].state;
    assert.equal(after.revision, before.revision + 1);
    for (const key of ["flowM3h", "heatKwh", "supplyC", "pumpHz"])
      assert.equal(after[key], expected[key]);
    await page.screenshot({
      path: `${process.env.SCREENSHOT_DIR || "../outputs"}/live-agent-${city}.png`,
    });
    console.log({ city, browserApply: "passed", predictionMatched: true });
  }
  // Also exercise the separate diagnostic button against the changed scene.
  const response = page.waitForResponse(
    (r) => r.url().endsWith("/api/investigation"),
    { timeout: 255000 },
  );
  await page
    .getByRole("button", { name: "Run diagnostic agent", exact: true })
    .click();
  const packets = (await (await response).text())
    .split("\n")
    .filter(Boolean)
    .map(JSON.parse);
  const diagnostic = packets.find((p) => p.type === "result")?.result;
  assert.equal(diagnostic?.completionStatus, "complete", diagnostic?.warning);
  assert.equal(diagnostic.narrativeWithheld, false);
  await idle();
  assert.match(
    await page.locator(".mission-status").textContent(),
    /Diagnostic investigation complete/,
  );
  console.log({
    diagnosticRunId: diagnostic.runId,
    status: diagnostic.completionStatus,
  });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: real default UI missions, streamed explanations, verified simulator applications and diagnostic button. No route mocks.",
  );
} finally {
  await browser.close();
}
