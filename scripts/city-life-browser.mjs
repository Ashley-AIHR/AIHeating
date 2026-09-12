import { chromium } from "playwright";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
const base = "http://127.0.0.1:3145";
const server = spawn(process.execPath, ["server/index.mjs"], {
  env: {
    ...process.env,
    PORT: "3145",
    OPENROUTER_API_KEY: "",
    AI_ACCESS_TOKEN: "",
  },
  stdio: "ignore",
});
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
  const p = await browser.newPage({ viewport: { width: 1680, height: 1050 } }),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text().slice(0, 300));
  });
  await p.goto(base);
  const scene = p.locator(".city-scene");
  await p
    .locator(".city-scene[data-camera-settled=true]")
    .waitFor({ timeout: 60000 });
  const state = async () =>
    (await p.request.post(base + "/api/state", { data: {} })).json();
  const before = await state();
  const stamp = () => scene.getAttribute("data-ambient-time");
  const start = await stamp();
  await delay(350);
  assert.notEqual(await stamp(), start);
  assert.equal(
    (await state()).revision,
    before.revision,
    "Street life must not mutate physics",
  );
  assert.equal((await state()).elapsedMinutes, before.elapsedMinutes);
  await p.getByRole("button", { name: "City life: on", exact: true }).click();
  await delay(150);
  const paused = await stamp();
  await delay(300);
  assert.equal(await stamp(), paused);
  await p
    .getByRole("button", { name: "City life: paused", exact: true })
    .click();
  await p.emulateMedia({ reducedMotion: "reduce" });
  await delay(150);
  const reduced = await stamp();
  await delay(300);
  assert.equal(await stamp(), reduced);
  await p.emulateMedia({ reducedMotion: "no-preference" });
  for (const city of ["yinchuan", "shanghai"]) {
    if (city === "shanghai")
      await p
        .getByRole("combobox", { name: "City district" })
        .selectOption(city);
    await p
      .locator(".city-scene[data-city=" + city + "][data-camera-settled=true]")
      .waitFor({ timeout: 60000 });
    assert.match(
      await scene.getAttribute("data-identity"),
      city === "shanghai" ? /river city/ : /mountain and wetland/,
    );
    const canvas = await scene.locator("canvas").elementHandle();
    await p.getByRole("button", { name: "City vision", exact: true }).click();
    const dialog = p.getByRole("dialog", {
      name: "City visual reference",
      exact: true,
    });
    await dialog.locator("img").evaluate((img) => img.decode());
    assert.match(
      await dialog.locator("img").getAttribute("src"),
      new RegExp(city + "-district-vision-v2"),
    );
    assert(
      await dialog.locator("img").evaluate((img) => img.naturalWidth >= 1600),
    );
    await p.screenshot({ path: "../outputs/" + city + "-vision-in-app.png" });
    await p
      .getByRole("button", { name: "Close city reference", exact: true })
      .click();
    assert(await canvas.evaluate((c) => c.isConnected));
    await p.screenshot({ path: "../outputs/" + city + "-living-3d.png" });
  }
  await p
    .getByRole("button", { name: "⚙ Energy centre", exact: true })
    .click();
  await p
    .getByRole("button", { name: "Select P-01 in 3D", exact: true })
    .click();
  await p
    .getByRole("button", { name: "BIM work studio", exact: true })
    .first()
    .click();
  await p
    .getByRole("dialog", { name: "BIM work studio", exact: true })
    .waitFor();
  await p
    .getByRole("button", { name: "Return to district ×", exact: true })
    .click();
  await p
    .getByRole("combobox", { name: "Interface language", exact: true })
    .selectOption("zh-CN");
  await p.getByRole("button", { name: "城市愿景", exact: true }).click();
  await p
    .getByRole("heading", { name: "上海 · 滨江之城", exact: true })
    .waitFor();
  await p.setViewportSize({ width: 390, height: 844 });
  assert(
    await p
      .getByRole("dialog", { name: "城市视觉参考" })
      .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  );
  await p.getByRole("button", { name: "关闭城市参考", exact: true }).click();
  assert(
    await p.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
  const button = await p
    .getByRole("button", { name: "城市愿景", exact: true })
    .boundingBox();
  assert(button.x >= 0 && button.x + button.width <= 390);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: two city identities/images, animated and paused streets, reduced motion, immutable physics, live canvas retained, equipment/BIM access, Chinese and mobile. No provider calls.",
  );
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
