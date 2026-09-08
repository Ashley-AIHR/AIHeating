import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const base = 'http://127.0.0.1:5173';
const out = new URL('../p0-screenshots/', import.meta.url).pathname;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1672, height: 941 }, deviceScaleFactor: 1 });
async function setLanguage(language) {
  await page.evaluate((value) => localStorage.setItem('ai-heating-language', value), language);
  await page.reload({ waitUntil: 'networkidle' });
}
async function capture(name, route, setup) {
  await page.goto(base + route, { waitUntil: 'networkidle' });
  if (setup) await setup();
  await page.screenshot({ path: out + name + '.png', fullPage: true });
  console.log(name + ': ' + (await page.title()) + ' · ' + (await page.locator('body').innerText().then((text) => text.length)) + ' chars');
}

await capture('p0.3-overview-zh', '/overview', async () => {
  await page.getByRole('button', { name: '中文', exact: true }).click();
  const text = await page.locator('body').innerText();
  if (!text.includes('总览') || !text.includes('仿真环境') || !text.includes('室温状态') || !text.includes('估算输运延迟') || text.includes('10:00')) throw new Error('Chinese Overview P0.3 checks failed');
});
await setLanguage('en');
await capture('p0.3-forecast-6h-en', '/forecast', async () => {
  const text = await page.locator('body').innerText();
  if (!text.includes('Forecast as of 08:00') || !text.includes('08:00') || !text.includes('14:00') || !text.includes('Predicted Indoor Temperature Distribution at Forecast Target · 14:00') || !text.includes('3 / 12') || !text.includes('1 / 12') || !text.includes('Building-Level Forecast (Next 6 Hours)') || !text.includes('B12')) throw new Error('6-hour Forecast P0.3 checks failed');
});
await capture('p0.3-simulation-optimised-en', '/simulation', async () => {
  await page.getByRole('button', { name: 'AI Optimised (MPC)', exact: true }).first().click();
  if (await page.getByRole('button', { name: 'Apply to Simulation', exact: true }).count()) throw new Error('Optimised unexpectedly exposes Apply');
  if (!(await page.getByText('Auto-applied', { exact: true }).count())) throw new Error('Optimised missing automatic control state');
  if (!(await page.getByText(/MPC Active/).count())) throw new Error('Optimised missing MPC status');
  const text = await page.locator('body').innerText();
  if (!text.includes('Explore the digital twin playback') || !text.includes('Thermal State') || !text.includes('Estimated Transport Delay')) throw new Error('Simulation P0.3 checks failed');
});
await browser.close();
