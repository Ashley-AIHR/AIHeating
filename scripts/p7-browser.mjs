import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const base = 'http://127.0.0.1:5173';
const out = new URL('../p7-screenshots/', import.meta.url).pathname;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1672, height: 941 } });

const forbidden = ['Production MPC', 'Autonomous Production Control', 'Real-world Savings', 'Guaranteed Real-site Safety'];
async function capture(name, route, required) {
  await page.goto(base + route, { waitUntil: 'networkidle' });
  const text = await page.locator('body').innerText();
  for (const phrase of required) {
    if (!text.includes(phrase)) throw new Error(`${name} missing: ${phrase}`);
  }
  for (const phrase of forbidden) {
    if (text.includes(phrase)) throw new Error(`${name} exposes forbidden claim: ${phrase}`);
  }
  if (!text.includes('10:30')) throw new Error(`${name} missing aligned decision time`);
  await page.screenshot({ path: `${out}${name}.png`, fullPage: true });
  console.log(`PASS ${name}`);
}

await page.goto(base + '/overview', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.setItem('ai-heating-language', 'en'));
await capture('p7-overview-en', '/overview', [
  'NOW', 'FORECAST', 'PREDICT', 'OPTIMISE', 'VERIFY', 'P4 Predictor v1',
  'P5 Thermal Model v1', 'Formal MPC v1', 'Full-day Simulation Result',
]);
await capture('p7-forecast-en', '/forecast', [
  'Required heat-load prediction', 'P4 Predictor v1', 'LightGBM',
  'Building thermal prediction', 'P5 Thermal Model v1', '+0.5h', '+1h', '+2h', '+3h', '+6h',
]);
await capture('p7-simulation-en', '/simulation', [
  'Current Applied Controls', 'Next MPC Recommendation', 'MPC Optimal',
  'Verified in Digital Twin', 'Normal Verified', 'APPLIED', 'Predicted',
  'Optimised', 'Verified', 'Applied', 'Realised',
]);
await page.getByText('Engineering / Validation status evidence', { exact: true }).click();
let text = await page.locator('body').innerText();
for (const phrase of ['Solver Limit Reached', 'Verified Fallback Active', 'Constraint Infeasible', 'Safety Not Guaranteed', 'Minimum indoor temperature cannot be guaranteed']) {
  if (!text.includes(phrase)) throw new Error(`engineering status missing: ${phrase}`);
}
await page.getByRole('button', { name: 'AI Advisory' }).first().click();
text = await page.locator('body').innerText();
if (!text.includes('NOT_APPLIED') || !text.includes('Recommended · not applied')) throw new Error('Advisory auto-applied or is ambiguous');
await page.getByRole('button', { name: 'Traditional Weather Compensation' }).first().click();
text = await page.locator('body').innerText();
if (!text.includes('NOT_APPLIED') || !text.includes('Comparison recommendation · not applied')) throw new Error('Traditional incorrectly applies MPC');
await page.getByRole('button', { name: 'AI Optimised' }).first().click();
text = await page.locator('body').innerText();
if (!text.includes('APPLIED') || !text.includes('Current Applied Controls')) throw new Error('Verified optimised action did not auto-apply');
await capture('p7-results-en', '/results', [
  'Traditional', 'Preview v0', 'Formal MPC v1', 'Canonical full-day comparison',
  'Heat Consumption', 'Pump Electricity', 'Severe Overheating >25°C',
  'Fallback Count', 'Solver Status Summary', 'Held-out simulation evaluation',
]);
await capture('p7-settings-en', '/settings', [
  'Accepted Provider Configuration', 'P4 Predictor v1', 'P5 Thermal Model v1',
  'Formal MPC v1', 'Prediction and MPC Horizons', '+0.5h', '3 hours',
  '30 minutes', 'Lower prediction bound >=18°C', 'Read-only frozen engineering configuration',
]);

await page.evaluate(() => localStorage.setItem('ai-heating-language', 'zh'));
await capture('p7-overview-zh', '/overview', [
  '当前', '天气预测', '负荷预测', '优化', '验证', 'P4 Predictor v1', 'P5 Thermal Model v1', 'Formal MPC v1',
]);
await capture('p7-forecast-zh', '/forecast', [
  '所需热负荷预测', '楼栋热状态预测', 'P4 Predictor v1', 'P5 Thermal Model v1', '+0.5h', '+6h',
]);
await capture('p7-simulation-zh', '/simulation', [
  '当前已应用控制', '下一条 MPC 建议', 'MPC 最优', '已在数字孪生中验证',
  '正常且已验证', 'APPLIED', '预测', '优化', '验证', '应用', '实现结果',
]);
await page.getByText('工程 / 验证状态证据', { exact: true }).click();
text = await page.locator('body').innerText();
for (const phrase of ['达到求解器上限', '已验证回退已激活', '约束不可行', '无法保证安全', '无法保证最低室内温度']) {
  if (!text.includes(phrase)) throw new Error(`ZH engineering status missing: ${phrase}`);
}
await page.getByRole('button', { name: 'AI 辅助建议' }).first().click();
text = await page.locator('body').innerText();
if (!text.includes('NOT_APPLIED') || !text.includes('建议 · 未应用')) throw new Error('ZH Advisory auto-applied or is ambiguous');
await page.getByRole('button', { name: '传统气候补偿' }).first().click();
text = await page.locator('body').innerText();
if (!text.includes('NOT_APPLIED') || !text.includes('对比建议 · 未应用')) throw new Error('ZH Traditional incorrectly applies MPC');
await page.getByRole('button', { name: 'AI 优化控制' }).first().click();
text = await page.locator('body').innerText();
if (!text.includes('APPLIED') || !text.includes('当前已应用控制')) throw new Error('ZH verified optimised action did not auto-apply');
await capture('p7-results-zh', '/results', [
  'Traditional', '预览 v0', '正式 MPC v1', '规范全天对比', '热耗', '泵耗电', '严重过热 >25°C', '回退次数', '求解器状态汇总',
]);
await capture('p7-settings-zh', '/settings', [
  '已验收 Provider 配置', 'P4 Predictor v1', 'P5 Thermal Model v1', 'Formal MPC v1',
  '预测与 MPC 时域', '+0.5h', '3 小时', '30 分钟', 'Lower prediction bound >=18°C', '只读冻结工程配置',
]);

await browser.close();
console.log('P7 browser checks: 10 screenshots, EN/ZH semantics PASS');
