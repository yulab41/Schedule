// Desktop CSS geometry with synthetic content; not native or physical-device acceptance.
/* global document, getComputedStyle, window */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const mini = fileURLToPath(new URL('../', import.meta.url));
const root = path.resolve(mini, '../..');
const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {
  cwd: root,
  encoding: 'utf8',
}).trim();
const output = path.join(path.dirname(common), 'runtime/audit/calendar-bottom-directory-20261001');
const read = (file) => readFileSync(path.join(mini, 'src', file), 'utf8');
const styles = (file) =>
  read(file)
    .replace(/@import[^;]+;/gu, '')
    .replace(/^page\s*\{/gmu, 'body {');
const tokens = readFileSync(path.join(root, 'packages/ui-tokens/src/tokens.wxss'), 'utf8').replace(
  /^page\s*\{/u,
  ':root {',
);
const cases = ['workbench/index', 'guest/guest'].flatMap((surface) =>
  [320, 390].flatMap((width) => [0, 24].map((safeBottom) => ({ surface, width, safeBottom }))),
);
const measurements = [];
const failures = [];

execFileSync('git', ['check-ignore', output], { cwd: path.dirname(common) });
mkdirSync(output, { recursive: true });
const executablePath = [
  process.env['SMOKE_BROWSER_PATH'],
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find((file) => file && existsSync(file));
assert.ok(executablePath, 'A local browser is required for desktop CSS geometry');
const browser = await chromium.launchPersistentContext(
  path.join(output, 'footer-browser-profile'),
  {
    executablePath,
    headless: true,
    env: { ...process.env, TEMP: output, TMP: output },
  },
);
const page = await browser.newPage();
try {
  for (const input of cases) {
    assert.match(read(`pages/${input.surface}.wxml`), /class="list-panel-content"/u);
    if (input.surface.startsWith('guest')) {
      assert.ok(read('pages/guest/guest.wxss').includes("@import '../workbench/index.wxss'"));
    }
    const navHeight = 70 + input.safeBottom;
    const dutyCount = input.surface.startsWith('guest') ? 1 : 8;
    const rows = Array.from(
      { length: dutyCount },
      () =>
        '<div class="list-duty-item"><div class="list-duty-copy"><div class="list-duty-name">值班人员</div><div class="list-duty-details">全天班 · 08:00–08:00</div></div><div class="list-call-action" role="button" aria-label="拨号">☎</div></div>',
    ).join('');
    const cards = Array.from(
      { length: 7 },
      (_, index) =>
        `<div class="list-day-slot"><div class="list-day-card"><div class="list-day-heading">10-${index + 1}</div>${rows}</div></div>`,
    ).join('');
    await page.setViewportSize({ width: input.width, height: 844 });
    await page.setContent(`<style>${tokens}${styles('pages/workbench/index.wxss')}${styles(`pages/${input.surface}.wxss`)}
      body{margin:0;font-family:Arial,sans-serif}
      .fixture-workspace{position:absolute;top:144px;height:${844 - 144 - navHeight}px;width:100%}
      .fixture-swiper-item{height:100%}.list-panel-scroll{overflow-y:auto;overflow-x:hidden}
      .bottom-nav{height:${navHeight}px}
      </style><div class="fixture-workspace"><div class="workbench-content is-list-mode"><div class="workbench-view-anchor"><div class="list-calendar"><div class="list-calendar-heading">2026年10月</div><div class="list-scroll-boundary"></div><div class="list-swiper"><div class="fixture-swiper-item"><div class="list-panel-scroll"><div class="list-panel-content">${cards}</div></div></div></div></div></div></div></div><div class="bottom-nav">日历 通讯录 换班 我的 更多</div>`);
    const geometry = await page.evaluate(() => {
      const scroll = document.querySelector('.list-panel-scroll');
      scroll.scrollTop = scroll.scrollHeight;
      const finalCard = [...document.querySelectorAll('.list-day-card')].at(-1);
      const finalAction = [...document.querySelectorAll('.list-call-action')].at(-1);
      const navTop = document.querySelector('.bottom-nav').getBoundingClientRect().top;
      return {
        gap: navTop - finalCard.getBoundingClientRect().bottom,
        actionBottom: finalAction.getBoundingClientRect().bottom,
        navTop,
        cardGap: Number.parseFloat(
          getComputedStyle(document.querySelector('.list-day-slot')).paddingTop,
        ),
        overflowing: scroll.scrollHeight > scroll.clientHeight,
        horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
      };
    });
    measurements.push({ ...input, ...geometry, evidence: 'desktop CSS geometry' });
    await page.screenshot({
      path: path.join(
        output,
        `footer-${input.surface.split('/')[0]}-${input.width}-${input.safeBottom}.png`,
      ),
    });
    try {
      assert.equal(geometry.overflowing, true);
      assert.equal(geometry.horizontalOverflow, false);
      assert.ok(
        Math.abs(geometry.gap - geometry.cardGap) < 0.5,
        `gap=${geometry.gap}; cardGap=${geometry.cardGap}`,
      );
      assert.ok(geometry.gap >= 8);
      assert.ok(geometry.actionBottom < geometry.navTop);
    } catch (error) {
      failures.push(
        new Error(`${input.surface}/${input.width}/${input.safeBottom}: ${error.message}`),
      );
    }
  }
} finally {
  writeFileSync(path.join(output, 'footer-geometry.json'), JSON.stringify(measurements, null, 2));
  await browser.close();
}
assert.equal(failures.length, 0, failures.map((error) => error.message).join('\n'));
console.log(
  JSON.stringify({
    ok: true,
    evidence: 'desktop CSS geometry only',
    scenarios: measurements.length,
    output,
  }),
);
