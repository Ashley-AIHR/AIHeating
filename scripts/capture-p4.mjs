import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const base = 'http://127.0.0.1:5173';
const out = new URL('../p4-screenshots/', import.meta.url).pathname;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1672, height: 941 } });

async function capture(name, route, required) {
  await page.goto(base + route, { waitUntil: 'networkidle' });
  const text = await page.locator('body').innerText();
  for (const phrase of required)
    if (!text.includes(phrase)) throw new Error(`${name} missing: ${phrase}`);
  for (const phrase of ['Fixture / mock data', '55.00000000000001', 'selected-p4-predictor-v1'])
    if (text.includes(phrase)) throw new Error(`${name} exposes forbidden text: ${phrase}`);
  if (!text.includes('10:30')) throw new Error(`${name} missing aligned 10:30 time`);
  await page.screenshot({ path: `${out}${name}.png`, fullPage: true });
  console.log(`${name}: ${text.length} chars`);
}

await page.goto(base + '/overview', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.setItem('ai-heating-language', 'en'));
await page.reload({ waitUntil: 'networkidle' });
await capture('p4-overview-en', '/overview', [
  'NOW', 'FORECAST', 'PREDICT', 'OPTIMISE', 'VERIFY',
  '+2h', 'Full-day Simulation Result', 'Start Predictive Preview', 'not final MPC',
]);
await page.getByRole('button', { name: /Start Predictive Preview/ }).click();
if (!page.url().endsWith('/simulation')) throw new Error('guided entry did not navigate to Simulation');
await capture('p4-simulation-en', '/simulation', [
  'Simulation Engine Decision Snapshot', 'physical-fixture-v1.2',
  'Applied in Simulation', 'Current Applied Controls', 'No real equipment control',
]);
await page.getByRole('button', { name: 'AI Advisory' }).first().click();
let simulationText = await page.locator('body').innerText();
if (!simulationText.includes('Recommended · not applied') || !simulationText.includes('50.2 °C'))
  throw new Error('AI Advisory state is not explicitly recommended/not applied');
await page.getByRole('button', { name: 'Traditional Weather Compensation' }).first().click();
simulationText = await page.locator('body').innerText();
if (!simulationText.includes('Comparison recommendation · not applied'))
  throw new Error('Traditional state is not explicitly comparison-only');
await page.getByRole('button', { name: 'Predictive Preview' }).first().click();
simulationText = await page.locator('body').innerText();
if (!simulationText.includes('Current Applied Controls') || !simulationText.includes('48.2 °C'))
  throw new Error('Predictive Preview applied controls do not reflect the recommendation');
await capture('p4-forecast-en', '/forecast', [
  'Forecast as of 10:30', '+1h', '+2h', '+3h', '+6h',
  '95% simulation-calibrated prediction interval', 'future actual weather is hidden',
  'Selected P4 Predictor v1', 'LightGBM',
]);
await capture('p4-results-en', '/results', [
  'Traditional Control vs Predictive Preview', 'Canonical full-day comparison',
  '10:30 Decision Snapshot Distribution', 'Held-out simulation evaluation',
  'synthetic Digital Twin scenarios', 'Simulation result',
]);
await capture('p4-settings-en', '/settings', [
  'Simulation Configuration', 'Synthetic PoC / Digital Twin Configuration',
  'Prediction horizons', 'Forecast display windows', 'Safety hard constraint',
  'flow-dependent', 'No real equipment control',
]);

await page.evaluate(() => localStorage.setItem('ai-heating-language', 'zh'));
await capture('p4-overview-zh', '/overview', [
  '当前', '天气预测', '负荷预测', '优化', '验证', '全天仿真结果',
]);
await capture('p4-simulation-zh', '/simulation', [
  '仿真引擎决策快照', '当前已应用控制', '已应用于仿真', '不控制真实设备',
]);
await capture('p4-forecast-zh', '/forecast', [
  '+1h', '+2h', '+3h', '+6h', 'Selected P4 Predictor v1', 'LightGBM',
]);
await capture('p4-results-zh', '/results', [
  '传统控制 vs 预测优化预览', '规范全天对比', '10:30 决策快照分布',
  '留出仿真场景评估', '合成数字孪生场景',
]);
await capture('p4-settings-zh', '/settings', [
  '仿真配置', '合成 PoC / 数字孪生配置', '负荷预测时域',
  '天气预测展示窗口', '安全硬约束', '流量相关',
]);
await browser.close();
