// Explicit opt-in: real OpenRouter calls, no response fixtures or route mocks.
import assert from "node:assert/strict";
import { chromium } from "playwright";
if (process.env.LIVE_AI_TEST !== "1")
  throw Error("Set LIVE_AI_TEST=1 to authorise paid provider calls");
const base = process.env.BASE_URL || "http://127.0.0.1:3128";
const browser = await chromium.launch({
  args: process.platform === "darwin" ? ["--use-angle=metal"] : [],
});
const page = await browser.newPage({ viewport: { width: 1680, height: 1050 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const idle = () =>
  page.locator(".status-toast").waitFor({ state: "hidden", timeout: 255000 });
const state = async () =>
  (await page.request.post(base + "/api/state", { data: {} })).json();
const read = async (response) => {
  assert.equal(response.status(), 200);
  const packets = (await response.text())
    .split("\n")
    .filter(Boolean)
    .map(JSON.parse);
  const result = packets.find((p) => p.type === "result")?.result;
  assert(result, JSON.stringify(packets.find((p) => p.type === "error")));
  console.log({
    locale: result.locale,
    runId: result.runId,
    status: result.completionStatus,
    withheld: result.narrativeWithheld,
    warning: result.warning,
    tools: result.trace.map((t) => t.tool),
    answer: result.answer,
  });
  assert.equal(result.completionStatus, "complete");
  assert.equal(result.narrativeWithheld, false);
  assert(packets.some((p) => p.event?.kind === "text"));
  return result;
};
try {
  await page.goto(base);
  await page.locator(".city-scene canvas").waitFor();
  await idle();
  await page
    .getByRole("button", { name: "Quality: cinematic", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "City district" })
    .selectOption("shanghai");
  await idle();
  await page
    .getByRole("combobox", { name: "Interface language" })
    .selectOption("zh-CN");
  const before = await state(),
    pending = page.waitForResponse(
      (r) => r.url().endsWith("/api/investigation"),
      { timeout: 255000 },
    );
  await page
    .getByRole("button", { name: "✧ 运行智能体任务", exact: true })
    .click();
  const cn = await read(await pending);
  assert.equal(cn.locale, "zh-CN");
  assert.match(cn.answer, /[\u3400-\u9fff]/u);
  assert(cn.optimisation?.recommendation);
  await page.locator(".mission-status.ready").waitFor();
  await page.locator(".agent-live-output").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "../outputs/live-agent-chinese.png" });
  await page
    .getByRole("button", { name: "将首个 30 分钟方案应用于仿真", exact: true })
    .click();
  await page.getByRole("button", { name: "仅应用于仿真", exact: true }).click();
  await idle();
  const after = await state();
  assert.equal(after.revision, before.revision + 1);
  assert.equal(
    after.flowM3h,
    cn.optimisation.recommendation.trace[0].state.flowM3h,
  );
  await page.getByRole("combobox", { name: "界面语言" }).selectOption("en");
  assert.equal(await page.locator(".narrative").getAttribute("lang"), "zh-CN");
  const pendingEn = page.waitForResponse(
    (r) => r.url().endsWith("/api/investigation"),
    { timeout: 255000 },
  );
  await page
    .getByRole("button", { name: "Run diagnostic agent", exact: true })
    .click();
  const enResponse = await pendingEn;
  assert.equal(enResponse.status(), 200);
  assert.equal(enResponse.request().postDataJSON().locale, "en");
  await idle();
  assert.match(
    await page.locator(".agent-result > .eyebrow").textContent(),
    /COMPLETED/,
  );
  assert.equal(await page.locator(".narrative").getAttribute("lang"), "en-GB");
  const enAnswer = await page.locator(".narrative").textContent();
  assert.match(enAnswer, /[A-Za-z]{4}/);
  assert(!/withheld|incomplete/i.test(enAnswer));
  console.log({
    locale: "en",
    status: "complete",
    answer: enAnswer,
    verification: "rendered browser result",
  });
  assert.equal((await state()).revision, after.revision);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: real Chinese optimisation/report/application and English diagnostic streaming through the browser; locale switches preserve state and report language.",
  );
} finally {
  await browser.close();
}
