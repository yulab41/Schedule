// Desktop CSS geometry only; this is not WeChat DevTools or physical-device acceptance.
/* global document, window */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const mini = fileURLToPath(new URL('../', import.meta.url));
const root = path.resolve(mini, '../..');
const output = path.join(root, 'runtime/audit/manual-template-layout');
execFileSync('git', ['check-ignore', output], { cwd: root });
mkdirSync(output, { recursive: true });
const read = (file) => readFileSync(path.join(mini, 'src', file), 'utf8');
const css = (file) =>
  read(file)
    .replace(/@import[^;]+;/gu, '')
    .replace(/^page\s*\{/gmu, 'body {')
    .replace(/\bview\b/gu, 'div')
    .replace(/\btext\b(?=\s*[:{,.>])/gu, 'span')
    .replace(/\bimage\b/gu, 'img');
const tokens = readFileSync(path.join(root, 'packages/ui-tokens/src/tokens.wxss'), 'utf8').replace(
  /^page\s*\{/u,
  ':root {',
);
const executablePath = [
  process.env['SMOKE_BROWSER_PATH'],
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find((file) => file && existsSync(file));
assert.ok(executablePath);
const browser = await chromium.launchPersistentContext(path.join(output, 'browser-profile'), {
  headless: true,
  executablePath,
  env: { ...process.env, TEMP: output, TMP: output },
});
const page = await browser.newPage();
const field = (label, value) =>
  `<div class="workflow-picker-root"><div class="workflow-picker-trigger is-field"><div class="workflow-picker-trigger-copy"><span class="workflow-picker-field-label">${label}</span><span class="workflow-picker-trigger-value">${value}</span></div><div class="workflow-picker-chevron">⌄</div></div></div>`;
const controls = [
  ['template-field', field('排班模板', '新建模板')],
  ['role-field', field('排班岗位', '一线')],
  ['date-field', field('开始日期', '2026-12-31')],
  ['date-field', field('结束日期', '2027-01-29')],
  ['cycle-field field-control', '<span>周期天数</span><span class="field-value">7 天</span>'],
  ['members-field', field('值班人员', '6 人')],
]
  .map(([className, content]) => `<div class="${className}">${content}</div>`)
  .join('');
const results = [];
try {
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.setContent(
      `<style>${tokens}${css('subpackages/scheduling/pages/manual/index.wxss')}${css('components/ui/ui-selector/index.wxss')}body{margin:0;height:auto;overflow:auto}</style><div class="manual-page-content"><div class="section-card template-context"><div class="field-grid">${controls}</div></div></div>`,
    );
    const geometry = await page.evaluate(() => {
      const rects = [...document.querySelector('.field-grid').children].map((node) => {
        const rect = node.getBoundingClientRect();
        return { height: rect.height, left: rect.left, top: rect.top, width: rect.width };
      });
      return {
        overflow: document.documentElement.scrollWidth > window.innerWidth,
        rects,
      };
    });
    assert.equal(geometry.rects.length, 6);
    for (let index = 0; index < 6; index += 2) {
      const left = geometry.rects[index];
      const right = geometry.rects[index + 1];
      assert.equal(left.top, right.top);
      assert.ok(Math.abs(left.width - right.width) <= 0.02);
      assert.ok(right.left > left.left);
    }
    assert.equal(new Set(geometry.rects.map((rect) => rect.top)).size, 3);
    assert.ok(geometry.rects.every((rect) => rect.height === 58));
    assert.equal(geometry.overflow, false);
    await page.screenshot({
      path: path.join(output, `manual-template-${width}.png`),
      fullPage: true,
    });
    results.push({ width, ...geometry });
  }
  writeFileSync(path.join(output, 'geometry.json'), JSON.stringify(results, null, 2));
  console.log(
    JSON.stringify({ evidence: 'desktop CSS geometry only', ok: true, results }, null, 2),
  );
} finally {
  await browser.close();
}
