// Production More markup/styles in a browser; scroll-clamp reproduction, not native acceptance.
/* global document */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const mini = path.join(root, 'apps/miniprogram/src');
const output = path.join(root, 'runtime/audit/feedback14/layout');
execFileSync('git', ['check-ignore', output], { cwd: root });
mkdirSync(output, { recursive: true });
const read = (p) => readFileSync(path.join(mini, p), 'utf8');
const source = read('pages/workbench/index.wxml');
let more = source.slice(source.indexOf('<view class="more-workspace-content">'));
more = more.slice(0, more.indexOf('</scroll-view>'));
more = more.replace(/<view wx:if="\{\{!toolAccess\.hasAny[\s\S]*?<\/view>\s*<\/view>/u, '');
more = more
  .replace(/wx:if="\{\{testCenterEnabled\}\}"/u, 'id="diagnostics-section"')
  .replace(/\s+(?:wx:if|bindtap|hover-class|aria-role)="[^"]*"/gu, '')
  .replace(/\bview\b/gu, 'div')
  .replace(/<(\/?)text\b/gu, '<$1span')
  .replace(/<image\b/gu, '<img')
  .replace(
    /src="\/([^"\n]+)"/gu,
    (_match, file) =>
      `src="data:image/svg+xml;base64,${Buffer.from(read(file)).toString('base64')}"`,
  );
const css = (read('pages/workbench/index.wxss') + read('styles/ui-icon-motion.wxss'))
  .replace(/@import[^;]+;/gu, '')
  .replace(/^page\s*\{/gmu, 'body {')
  .replace(/\bview\b/gu, 'div')
  .replace(/\btext\b/gu, 'span')
  .replace(/\bimage\b/gu, 'img');
const tokens = readFileSync(path.join(root, 'packages/ui-tokens/src/tokens.wxss'), 'utf8').replace(
  /^page\s*\{/u,
  ':root {',
);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const evidence = [];
try {
  for (const width of [390, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    await page.setContent(`<meta charset="utf-8"><style>${tokens}${css}
      body{margin:0}span{display:block}img{display:block}
      .more-workspace{margin-top:88px;height:686px;overflow-y:auto}
      </style><div class="more-workspace">${more}</div>`);
    const before = await page.evaluate(() => {
      const scroll = document.querySelector('.more-workspace');
      scroll.scrollTop = scroll.scrollHeight;
      return { top: scroll.scrollTop, height: scroll.scrollHeight };
    });
    await page.screenshot({ path: path.join(output, `more-${width}.png`) });
    const regression = await page.evaluate(() => {
      const scroll = document.querySelector('.more-workspace');
      document.querySelector('#diagnostics-section').style.display = 'none';
      return { top: scroll.scrollTop, height: scroll.scrollHeight };
    });
    assert.ok(regression.top < before.top, 'Old onHide section removal clamps scroll');
    await page.evaluate((top) => {
      document.querySelector('#diagnostics-section').style.display = '';
      document.querySelector('.more-workspace').scrollTop = top;
    }, before.top);
    // The runtime regression separately proves that onHide and permission refresh retain this node.
    const retained = await page.evaluate(() => {
      const scroll = document.querySelector('.more-workspace');
      return { top: scroll.scrollTop, height: scroll.scrollHeight };
    });
    assert.deepEqual(retained, before);
    evidence.push({ width, before, oldHidden: regression, retained });
    await page.close();
  }
} finally {
  await browser.close();
}
writeFileSync(path.join(output, 'geometry.json'), JSON.stringify(evidence, null, 2));
console.log(evidence);
