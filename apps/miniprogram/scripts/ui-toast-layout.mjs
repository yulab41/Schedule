// Desktop CSS geometry evidence only. This does not emulate native root-portal or Skyline.
/* global document, getComputedStyle, innerWidth -- Used only inside browser evaluate callbacks. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright-core';

const miniRoot = fileURLToPath(new URL('../', import.meta.url));
const root = path.resolve(miniRoot, '../..');
const artifacts = path.join(root, 'runtime/audit/mini-ui-20260905001548-d');
execFileSync('git', ['check-ignore', artifacts], { cwd: root, stdio: 'pipe' });
mkdirSync(artifacts, { recursive: true });
const executablePath = [
  process.env['SMOKE_BROWSER_PATH'],
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find((candidate) => candidate && existsSync(candidate));
assert.ok(executablePath, 'Reuse an installed browser via SMOKE_BROWSER_PATH; do not install one.');
const read = (file) => readFileSync(path.join(miniRoot, 'src', file), 'utf8');
const styles = read('components/ui/ui-toast/index.wxss');
const tokens = readFileSync(path.join(root, 'packages/ui-tokens/src/tokens.css'), 'utf8');
// Translate only the small visual template; component properties/lifetimes are tested by simulate.
const toast = read('components/ui/ui-toast/index.wxml')
  .replace(/wx:if="[^"]*"/gu, '')
  .replace(/\{\{isVisible \? 'is-visible' : ''\}\}/gu, '')
  .replace(/\{\{safeTopOffset\}\}/gu, '112')
  .replace(/\{\{displayTone\}\}/gu, 'success')
  .replace(/\{\{displayTitle\}\}/gu, '操作完成')
  .replace(
    /\{\{displayMessage\}\}/gu,
    '已开启自动接受换班。后续换班申请将按当前设置处理，请查看申请状态。',
  )
  .replace(/\{\{[^}]*\}\}/gu, '')
  .replace(
    /<(\/?)(view|text)\b/gu,
    (_, slash, tag) => `<${slash}${tag === 'view' ? 'div' : 'span'}`,
  );
const context = await chromium.launchPersistentContext(path.join(artifacts, 'browser-profile'), {
  executablePath,
  headless: true,
  env: { ...process.env, TEMP: artifacts, TMP: artifacts },
});
const results = [];
try {
  const page = await context.newPage();
  for (const [width, height, large, reduced] of [
    [320, 760, false, false],
    [390, 844, false, false],
    [414, 896, false, false],
    [393, 873, false, false],
    [320, 760, true, false],
    [844, 390, false, false],
    [390, 844, false, true],
  ]) {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
    await page.setContent(`<style>${tokens}\n${styles}
      body { margin: 0; background: var(--ui-color-background); }
      main { margin: 150px 12px 0; height: 340px; overflow: hidden; transform: translateY(1px); }
      #body-content { padding: 16px; height: 240px; background: white; }
      #sheet { position: fixed; z-index: 400; inset: 50% 0 0; background: white; }
      #action { position: fixed; left: 12px; right: 12px; top: 112px; height: 100px; }
      ${large ? ':root { --ui-font-size-sm: 22px; }' : ''}
      </style><button id="action">底层操作</button><main><div id="body-content">换班管理</div>${toast}</main><div id="sheet">Sheet</div>`);
    // Model root-portal's documented reparenting; native portal support is a static contract only.
    await page.evaluate(() => document.body.append(document.querySelector('.ui-toast__layer')));
    const geometry = () => page.locator('#body-content').boundingBox();
    const before = await geometry();
    await page.locator('.ui-toast__layer').evaluate((node) => node.classList.add('is-visible'));
    await page.waitForFunction(
      () => getComputedStyle(document.querySelector('.ui-toast__layer')).opacity === '1',
    );
    const during = await geometry();
    const metrics = await page.locator('.ui-toast__layer').evaluate((node) => {
      const card = node.querySelector('.ui-toast');
      const message = node.querySelector('.ui-toast__message');
      const rect = card.getBoundingClientRect();
      const messageStyle = getComputedStyle(message);
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        messageHeight: message.getBoundingClientRect().height,
        lineHeight: parseFloat(messageStyle.lineHeight),
        z: Number(getComputedStyle(node).zIndex),
        overflow: document.documentElement.scrollWidth > innerWidth,
        pointer: getComputedStyle(node).pointerEvents,
        transition: getComputedStyle(node).transitionDuration,
        passthrough: document.elementFromPoint(rect.left + 10, rect.top + 10)?.id,
      };
    });
    assert.deepEqual(during, before);
    assert.ok(metrics.left >= 0 && metrics.right <= width);
    assert.equal(metrics.top, 112);
    assert.ok(metrics.messageHeight <= metrics.lineHeight * 2 + 0.1);
    assert.ok(metrics.z > 400);
    assert.equal(metrics.overflow, false);
    assert.equal(metrics.pointer, 'none');
    assert.equal(metrics.passthrough, 'action');
    if (reduced) assert.equal(metrics.transition, '0s');
    if (width === 390 && !reduced)
      await page.screenshot({ path: path.join(artifacts, 'toast-390.png') });
    await page.locator('.ui-toast__message').evaluate((node) => {
      node.textContent = '第二条操作已完成';
    });
    assert.deepEqual(await geometry(), before);
    await page.locator('.ui-toast__layer').evaluate((node) => node.classList.remove('is-visible'));
    await page.waitForFunction(
      () => getComputedStyle(document.querySelector('.ui-toast__layer')).opacity === '0',
    );
    assert.deepEqual(await geometry(), before);
    results.push({ width, height, large, reduced, body: before, ...metrics });
  }
  console.log(
    JSON.stringify(
      { evidence: 'desktop CSS geometry; native portal not measured', results },
      null,
      2,
    ),
  );
} finally {
  await context.close();
}
