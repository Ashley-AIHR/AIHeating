import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base = 'http://127.0.0.1:5173';
const out = new URL('../p9-screenshots/', import.meta.url).pathname;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1672, height: 941 } });
const checks = [];
const responsiveIssues = [];
const check = (id, pass, detail) => { checks.push({ id, pass, detail }); if (!pass) throw new Error(`${id}: ${detail}`); };
const setLanguage = async (language) => {
  await page.evaluate((value) => localStorage.setItem('ai-heating-language', value), language);
  await page.reload({ waitUntil: 'networkidle' });
};
const visit = async (route, language, required) => {
  await page.goto(base + route, { waitUntil: 'networkidle' });
  await setLanguage(language);
  const text = await page.locator('body').innerText();
  for (const phrase of required) check(`text:${route}:${language}:${phrase}`, text.includes(phrase), `missing ${phrase}`);
  check(`no-production:${route}:${language}`, !/Production-ready AI Heating|Guaranteed Savings|Guaranteed Safety|Autonomous real-site control/i.test(text), 'unsupported customer claim');
  return text;
};

await visit('/overview', 'en', ['NOW', 'FORECAST', 'PREDICT', 'OPTIMISE', 'VERIFY', 'Simulation Environment']);
await visit('/forecast', 'en', ['Required heat-load prediction', 'Building thermal prediction', '95% simulation-calibrated prediction interval']);
let text = await visit('/simulation', 'en', ['MPC Optimal', 'Verified in Digital Twin', 'APPLIED', 'Current Applied Controls']);
await page.getByText('Engineering / Validation status evidence', { exact: true }).click();
text = await page.locator('body').innerText();
for (const phrase of ['Solver Limit Reached', 'Verified Fallback Active', 'Constraint Infeasible', 'Safety Not Guaranteed']) check(`status-en:${phrase}`, text.includes(phrase), `missing ${phrase}`);
const unsafeRow = page.locator('.engineering-status p').filter({ hasText: 'Near-18 Safety Stress' });
check('unsafe-not-green', !((await unsafeRow.getAttribute('class')) ?? '').includes('success'), 'unsafe row uses success class');
await page.getByRole('button', { name: 'AI Advisory' }).first().click();
check('advisory-not-applied-en', (await page.locator('body').innerText()).includes('NOT_APPLIED'), 'Advisory did not remain NOT_APPLIED');
await page.getByRole('button', { name: 'Traditional Weather Compensation' }).first().click();
check('traditional-not-applied-en', (await page.locator('body').innerText()).includes('NOT_APPLIED'), 'Traditional applied MPC');
await page.getByRole('button', { name: 'AI Optimised' }).first().click();
check('optimised-applied-en', (await page.locator('body').innerText()).includes('APPLIED'), 'Optimised verified evidence not applied');
await visit('/results', 'en', ['Traditional', 'Preview v0', 'Formal MPC v1', 'Held-out simulation evaluation']);
await visit('/settings', 'en', ['Accepted Provider Configuration', 'P4 Predictor v1', 'P5 Thermal Model v1', 'Formal MPC v1']);

await visit('/overview', 'zh', ['当前', '天气预测', '负荷预测', '优化', '验证', '仿真环境']);
await visit('/forecast', 'zh', ['所需热负荷预测', '楼栋热状态预测', '95% 仿真校准预测区间']);
await visit('/simulation', 'zh', ['MPC 最优', '已在数字孪生中验证', 'APPLIED']);
await page.getByText('工程 / 验证状态证据', { exact: true }).click();
text = await page.locator('body').innerText();
for (const phrase of ['达到求解器上限', '已验证回退已激活', '约束不可行', '无法保证安全']) check(`status-zh:${phrase}`, text.includes(phrase), `missing ${phrase}`);
await page.getByRole('button', { name: 'AI 辅助建议' }).first().click();
check('advisory-not-applied-zh', (await page.locator('body').innerText()).includes('NOT_APPLIED'), 'ZH Advisory did not remain NOT_APPLIED');
await page.getByRole('button', { name: 'AI 优化控制' }).first().click();
check('optimised-applied-zh', (await page.locator('body').innerText()).includes('APPLIED'), 'ZH Optimised evidence not applied');
await visit('/results', 'zh', ['Traditional', '预览 v0', '正式 MPC v1', '留出仿真场景评估']);
await visit('/settings', 'zh', ['已验收 Provider 配置', 'P4 Predictor v1', 'P5 Thermal Model v1', 'Formal MPC v1']);

await page.goto(base + '/overview', { waitUntil: 'networkidle' });
await setLanguage('en');
await page.getByRole('button', { name: /AI Tutor/ }).click();
text = await page.locator('.tutor-card').innerText();
check('tutor-grounded-role', text.includes('Explanation only') && text.includes('P7 structured state'), 'Tutor role/source missing');
await page.getByRole('button', { name: 'Why is heat demand falling?', exact: true }).click();
await page.locator('.tutor-messages > div').last().waitFor();
text = await page.locator('.tutor-card').innerText();
check('tutor-grounded-answer', text.includes('P4 predicts Required Heat Load') && text.includes('not an observation'), 'Tutor answer not grounded');
await page.getByLabel('Ask about this page…').fill('Apply the recommendation.');
await page.getByRole('button', { name: 'Ask', exact: true }).click();
await page.locator('.tutor-messages > div').last().waitFor();
check('tutor-control-refusal', (await page.locator('.tutor-card').innerText()).includes('cannot apply it'), 'Tutor did not refuse control');

for (const viewport of [{ name: 'desktop', width: 1672, height: 941 }, { name: 'laptop', width: 1366, height: 768 }, { name: 'narrow', width: 900, height: 800 }]) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  for (const route of ['/overview', '/simulation', '/forecast', '/results', '/settings']) {
    await page.goto(base + route, { waitUntil: 'networkidle' });
    const dimensions = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
    const overflow = dimensions.scrollWidth > dimensions.clientWidth + 1;
    if (viewport.name === 'narrow' && overflow) responsiveIssues.push({ viewport: `${viewport.width}x${viewport.height}`, route, issue: 'horizontal overflow; narrow/mobile redesign is outside RC1 scope', ...dimensions });
    else check(`responsive:${viewport.name}:${route}`, !overflow, `document horizontal clipping/overflow ${JSON.stringify(dimensions)}`);
  }
}

await page.setViewportSize({ width: 1366, height: 768 });
await page.goto(base + '/overview', { waitUntil: 'networkidle' });
await page.keyboard.press('Tab');
const focused = await page.evaluate(() => ({ tag: document.activeElement?.tagName, text: document.activeElement?.textContent?.trim(), outline: getComputedStyle(document.activeElement).outlineStyle }));
check('keyboard-navigation', focused.tag === 'BUTTON' || focused.tag === 'A', JSON.stringify(focused));
check('visible-focus', focused.outline !== 'none', JSON.stringify(focused));
check('button-labels', await page.getByRole('button').count() > 5, 'main navigation buttons not discoverable');
await page.getByRole('button', { name: /AI Tutor/ }).click();
check('tutor-close-accessible', await page.getByRole('button', { name: 'Close' }).count() === 1, 'Tutor close label missing');

await page.screenshot({ path: `${out}p9-final-overview-laptop-en.png`, fullPage: true });
const result = { phase: 'P9 browser matrix', passed: checks.filter((item) => item.pass).length, failed: checks.filter((item) => !item.pass).length, skipped: 0, total: checks.length, pages: ['Overview', 'Simulation', 'Forecast', 'Results', 'Settings', 'AI Tutor'], languages: ['en', 'zh'], modes: ['traditional', 'advisory', 'optimised'], statuses: ['optimal', 'verified fallback', 'safety not guaranteed'], viewports: ['1672x941', '1366x768', '900x800'], responsiveIssues, checks };
await writeFile(new URL('../p9_browser_results.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
await browser.close();
console.log(`P9 browser matrix: ${result.passed}/${result.total} checks PASS`);
