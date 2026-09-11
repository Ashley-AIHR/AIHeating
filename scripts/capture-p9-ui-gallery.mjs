import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const base = 'http://127.0.0.1:5173';
const out = new URL('../p9-ui-gallery/', import.meta.url).pathname;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1672, height: 941 } });

async function openAndCapture(name, route, language = 'en') {
  await page.goto(base + route, { waitUntil: 'networkidle' });
  await page.evaluate((value) => localStorage.setItem('ai-heating-language', value), language);
  await page.reload({ waitUntil: 'networkidle' });
  await page.screenshot({ path: `${out}${name}.png`, fullPage: true });
  console.log(`Captured ${name}`);
}

await openAndCapture('01-overview-en', '/overview');
await openAndCapture('02-simulation-en', '/simulation');
await page.getByText('Engineering / Validation status evidence', { exact: true }).click();
await page.screenshot({ path: `${out}02-simulation-status-en.png`, fullPage: true });
await openAndCapture('03-forecast-en', '/forecast');
await openAndCapture('04-results-en', '/results');
await openAndCapture('05-settings-en', '/settings');
await openAndCapture('06-overview-zh', '/overview', 'zh');
await openAndCapture('07-ai-tutor-en', '/overview');
await page.getByRole('button', { name: /AI Tutor/ }).click();
await page.screenshot({ path: `${out}07-ai-tutor-en.png`, fullPage: true });

await browser.close();
console.log('P9 UI gallery: 7 page/surface screenshots captured');
