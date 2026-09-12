import { chromium } from "playwright";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
const base = "http://127.0.0.1:3129";
const server = spawn(
  process.execPath,
  ["--import", "./scripts/provider-stream-fixture.mjs", "server/index.mjs"],
  {
    env: {
      ...process.env,
      PORT: "3129",
      NODE_ENV: "test",
      OPENROUTER_API_KEY: "stream-test-key",
      OPENROUTER_MODEL: "deepseek/deepseek-v4-flash-0731",
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
    await delay(50);
  }
  browser = await chromium.launch({
    args: process.platform === "darwin" ? ["--use-angle=metal"] : [],
  });
  const page = await browser.newPage({
      viewport: { width: 1680, height: 1050 },
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const idle = () =>
    page.locator(".status-toast").waitFor({ state: "hidden", timeout: 60000 });
  const state = async () =>
    (await page.request.post(base + "/api/state", { data: {} })).json();
  await page.goto(base);
  await page.locator(".city-scene canvas").waitFor();
  await idle();
  const canvas = await page.locator(".city-scene canvas").elementHandle(),
    before = await state();
  await page
    .getByRole("button", { name: "Quality: cinematic", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Interface language", exact: true })
    .selectOption("zh-CN");
  assert.equal(await page.locator("html").getAttribute("lang"), "zh-CN");
  assert.equal(
    await canvas.evaluate((n) => n.isConnected),
    true,
    "Switch must not rebuild the 3D canvas",
  );
  assert.equal((await state()).revision, before.revision);
  await page
    .getByRole("heading", { name: "让城市，冷热有衡。", exact: true })
    .waitFor();
  assert.match(
    await page.getByRole("textbox", { name: "诊断任务描述" }).inputValue(),
    /物理依据/,
  );
  assert.match(
    await page.locator(".city-scene canvas").getAttribute("aria-label"),
    /拖动旋转/,
  );
  await page.getByRole("button", { name: "告警", exact: true }).click();
  assert.match(
    await page.locator(".finding").first().textContent(),
    /支路流量/,
  );
  await page.getByRole("button", { name: "⚙ 操作 B10", exact: true }).click();
  await page
    .getByRole("slider", { name: "目标 阀门开度", exact: true })
    .fill("45");
  await page.getByRole("button", { name: "测试手动变更", exact: true }).click();
  await idle();
  assert.match(
    await page.locator(".command-verdict").textContent(),
    /模型检查通过/,
  );
  await page.getByRole("button", { name: "关闭三维控制", exact: true }).click();
  await page.getByRole("button", { name: "智能体", exact: true }).click();
  const pending = page.waitForResponse((r) =>
    r.url().endsWith("/api/investigation"),
  );
  await page
    .getByRole("button", { name: "✧ 运行智能体任务", exact: true })
    .click();
  const response = await pending;
  assert.equal(response.request().postDataJSON().locale, "zh-CN");
  const result = (await response.text())
    .split("\n")
    .filter(Boolean)
    .map(JSON.parse)
    .find((p) => p.type === "result").result;
  assert.equal(result.locale, "zh-CN");
  assert.match(result.answer, /远端支路/);
  await page.locator(".mission-status.ready").waitFor();
  assert.match(
    await page.locator(".mission-events").textContent(),
    /求解并验证控制计划/,
  );
  await page
    .getByRole("button", { name: "将首个 30 分钟方案应用于仿真", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "确认仿真变更？", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "仅应用于仿真", exact: true }).click();
  await idle();
  assert.equal((await state()).revision, before.revision + 1);
  await page.screenshot({ path: "../outputs/i18n-chinese-workspace.png" });
  await page
    .getByRole("combobox", { name: "界面语言", exact: true })
    .selectOption("en");
  assert.equal(await page.locator(".narrative").getAttribute("lang"), "zh-CN");
  assert.match(await page.locator(".narrative").textContent(), /远端支路/);
  await page
    .getByRole("textbox", { name: "Investigation brief" })
    .fill("Keep my custom operator request.");
  await page
    .getByRole("combobox", { name: "Interface language", exact: true })
    .selectOption("zh-CN");
  assert.equal(
    await page.getByRole("textbox", { name: "诊断任务描述" }).inputValue(),
    "Keep my custom operator request.",
  );
  await page.reload();
  await idle();
  assert.equal(await page.locator("html").getAttribute("lang"), "zh-CN");
  await page
    .getByRole("combobox", { name: "城市片区", exact: true })
    .selectOption("shanghai");
  await idle();
  assert.equal((await state()).cityId, "shanghai");
  await page.getByRole("button", { name: "⚙ 能源中心", exact: true }).click();
  await page
    .getByRole("heading", { name: "走进能源中心。", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "依据", exact: true }).click();
  await page
    .getByRole("button", { name: "打开公共 BIM 资料库 ↗", exact: true })
    .click();
  await page.getByRole("dialog", { name: "BIM 工作室", exact: true }).waitFor();
  await page.getByRole("button", { name: "返回片区 ×", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  const selector = await page
    .getByRole("combobox", { name: "界面语言" })
    .boundingBox();
  assert(
    selector.x >= 0 && selector.x + selector.width <= 390,
    "Language switch must fit mobile header",
  );
  await page.screenshot({ path: "../outputs/i18n-chinese-mobile.png" });
  await page.getByRole("combobox", { name: "界面语言" }).selectOption("en");
  assert.equal(await page.locator("html").getAttribute("lang"), "en-GB");
  assert.deepEqual(errors, []);
  console.log(
    "PASS: bilingual UI, persistent locale, live scene labels, immutable physical state, manual controls, Chinese streamed agent, verified application, original report language, custom brief, Shanghai, BIM and mobile switch. Provider fixture only.",
  );
} finally {
  await browser?.close();
  server.kill();
}
