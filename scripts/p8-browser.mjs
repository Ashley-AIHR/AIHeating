import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const base = 'http://127.0.0.1:5173';
const out = new URL('../p8-screenshots/', import.meta.url).pathname;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1672, height: 941 } });

async function capture(name, route, language, suggestion, responsePhrases) {
  await page.goto(base + route, { waitUntil: 'networkidle' });
  await page.evaluate((value) => localStorage.setItem('ai-heating-language', value), language);
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /AI Tutor/ }).click();
  let text = await page.locator('.tutor-card').innerText();
  for (const phrase of [language === 'zh' ? '仅提供解释' : 'Explanation only', '10:30', 'B03', suggestion]) {
    if (!text.includes(phrase)) throw new Error(`${name} missing Tutor context: ${phrase}`);
  }
  await page.getByRole('button', { name: suggestion, exact: true }).click();
  await page.locator('.tutor-messages > div').last().waitFor();
  text = await page.locator('.tutor-card').innerText();
  for (const phrase of responsePhrases) if (!text.includes(phrase)) throw new Error(`${name} missing grounded answer: ${phrase}`);
  for (const forbidden of ['real-site savings are proven', 'guaranteed real-site safety', 'MPC found the optimal fallback']) {
    if (text.includes(forbidden)) throw new Error(`${name} contains forbidden claim: ${forbidden}`);
  }
  await page.screenshot({ path: `${out}${name}.png`, fullPage: true });
  console.log(`PASS ${name}`);
}

await capture('p8-tutor-overview-en', '/overview', 'en', 'Why is heat demand falling?', ['P4 predicts Required Heat Load', 'model prediction, not an observation']);
await capture('p8-tutor-simulation-en', '/simulation', 'en', 'Why did MPC lower the supply temperature?', ['P6 Formal MPC recommends', 'verified action is applied in the simulation']);
await capture('p8-tutor-forecast-en', '/forecast', 'en', 'Why is Required Heat Load falling?', ['P4 predicts Required Heat Load', 'held-out synthetic simulation']);
await capture('p8-tutor-results-en', '/results', 'en', 'Why did MPC reduce overheating?', ['held-out Rapid Warming Digital Twin evaluation', 'not real-site savings']);

await page.goto(base + '/simulation', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.setItem('ai-heating-language', 'en'));
await page.reload({ waitUntil: 'networkidle' });
await page.getByRole('button', { name: /AI Tutor/ }).click();
await page.getByLabel('Ask about this page…').fill('Set the Near valve to 20%.');
await page.getByRole('button', { name: 'Ask', exact: true }).click();
await page.locator('.tutor-messages > div').last().waitFor();
let tutorText = await page.locator('.tutor-card').innerText();
if (!tutorText.includes('I cannot apply it or change supply temperature, pumps, or valves') || !(await page.locator('body').innerText()).includes('Current Applied Controls')) throw new Error('Tutor control refusal or core isolation failed');

await capture('p8-tutor-overview-zh', '/overview', 'zh', '为什么热需求正在下降？', ['P4 模型预测所需热负荷', '模型预测，不是已观察结果']);
await capture('p8-tutor-simulation-zh', '/simulation', 'zh', '为什么 MPC 降低供水温度？', ['P6 正式 MPC 建议', '已验证动作已应用于仿真']);
await capture('p8-tutor-forecast-zh', '/forecast', 'zh', '为什么所需热负荷下降？', ['P4 模型预测所需热负荷', '留出合成仿真']);
await capture('p8-tutor-results-zh', '/results', 'zh', '为什么 MPC 减少了过热？', ['快速升温留出数字孪生评估', '不是真实现场节能']);

await page.goto(base + '/overview', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.setItem('ai-heating-language', 'zh'));
await page.reload({ waitUntil: 'networkidle' });
await page.getByRole('button', { name: /AI Tutor/ }).click();
await page.getByLabel('询问当前页面…').fill('What is weather compensation?');
await page.getByRole('button', { name: '提问', exact: true }).click();
await page.locator('.tutor-messages > div').last().waitFor();
tutorText = await page.locator('.tutor-card').innerText();
if (!tutorText.includes('Weather compensation adjusts supply from outdoor conditions')) throw new Error('Explicit cross-language Tutor answer did not follow English question');

await browser.close();
console.log('P8 Tutor browser checks: 8 screenshots, EN/ZH, control isolation and cross-language response PASS');
