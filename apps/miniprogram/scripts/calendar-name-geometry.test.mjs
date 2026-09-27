/* global getComputedStyle */
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { describe, expect, it, vi } from 'vitest';

const read = (file) => readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
const css = (file) => read(file).replace(/@import[^;]+;/gu, '');

describe.runIf(!!process.env.SCHEDULE_CALENDAR_FIT_GEOMETRY)('calendar browser geometry', () => {
  it('fits complete text and badges at narrow widths without changing the week row arrangement', async () => {
    let definition;
    vi.stubGlobal('Component', (value) => {
      definition = value;
    });
    vi.stubGlobal('wx', {
      nextTick: (callback) => callback(),
      getWindowInfo: () => ({ windowWidth: 390 }),
    });
    await import('../src/components/calendar/calendar-fit-line/index.ts');
    const browser = await chromium.launch({
      executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
      headless: true,
    });
    try {
      for (const width of [320, 360, 390, 393]) {
        const page = await browser.newPage({ viewport: { width, height: 844 } });
        for (const mode of [
          'month',
          'duties',
          'compact',
          'compact-person',
          'week',
          'preview-week',
          'list',
        ]) {
          const compact = mode.startsWith('compact');
          const duties = mode === 'duties' || mode === 'compact';
          const month = mode === 'month' || duties || compact;
          const wrap = (body) =>
            `<div class="fit-host"><div class="fit-viewport ${month ? 'is-centered' : ''}"><div class="fit-reference"></div><div class="fit-measure"><div class="fit-content">${body}</div></div></div></div>`;
          const weekly = mode.includes('week');
          const source = month
            ? 'components/calendar/calendar-cell/index.wxss'
            : mode === 'preview-week'
              ? 'components/calendar/calendar-week-panel/index.wxss'
              : 'pages/workbench/index.wxss';
          const names = ['短名', '测试名', '四字测试', '很长的测试姓名', 'Alexandra W. Test'];
          for (const name of names) {
            const nameClass = month ? 'month-person' : weekly ? 'week-duty-name' : 'list-duty-name';
            const badgeClass = month
              ? 'change-mark'
              : weekly
                ? 'week-change-badge'
                : 'list-change-badge';
            const nameText = `<span class="${nameClass}">${name}</span>`;
            const badges = duties
              ? `<span class="duty-abbreviation">${name.length <= 3 ? 'N' : 'NP'}</span>`
              : `<span class="${badgeClass}">换</span>${name === '测试名' ? '' : `<span class="${badgeClass}">假</span>`}`;
            const count =
              mode === 'month' && name === '很长的测试姓名'
                ? '<span class="month-person-count">+12</span>'
                : '';
            const content = weekly
              ? `<div class="week-duty-item">${wrap(nameText)}<div class="week-duty-badges">${wrap(badges)}</div></div>`
              : `<div class="${month ? 'month-duty-line' : 'list-duty-name-line'}">${wrap(nameText + count + badges)}</div>`;
            const containerWidth =
              mode === 'list'
                ? width - 110
                : (width - (compact || mode === 'preview-week' ? 60 : 26)) / 7;
            const containerClass = month
              ? `calendar-cell ${compact ? 'is-compact' : ''} ${duties ? 'has-duties' : ''}`
              : weekly
                ? 'week-day'
                : '';
            await page.setContent(
              `<style>:root{--ui-font-weight-semibold:600;--ui-font-weight-strong:700;--ui-color-text-primary:#202830;--ui-color-primary:#0866cb;--ui-color-surface:#fff}body{margin:0;font-family:'Microsoft YaHei',sans-serif}${css(source)}${css('components/calendar/calendar-fit-line/index.wxss')}.fit-host{display:block;width:100%;min-width:0}</style><div style="width:${containerWidth}px"><div class="${containerClass}" style="width:100%">${weekly ? '<div class="week-shift-group">' : ''}${content}${weekly ? '</div>' : ''}</div></div>`,
            );
            const rows = await page.locator('.fit-host').all();
            for (const row of rows) {
              let measurement;
              const query = {
                in() {
                  return this;
                },
                select() {
                  return this;
                },
                boundingClientRect() {
                  return this;
                },
                exec(callback) {
                  measurement = Promise.all([
                    row.locator('.fit-viewport').boundingBox(),
                    row.locator('.fit-measure').boundingBox(),
                    row.locator('.fit-reference').boundingBox(),
                  ]).then(callback);
                },
              };
              const instance = {
                data: { ...definition.data },
                properties: {
                  active: true,
                  maxScale: month ? 1.18 : 1,
                  layout: `${width}:${mode}:${rows.indexOf(row)}`,
                  contentKey: name,
                  referenceName:
                    (weekly && rows.indexOf(row) === 0) ||
                    (month && (name === '测试名' || (duties && name === '短名')))
                      ? name
                      : '',
                },
                getPageId: () => 'geometry',
                groupSetData: (callback) => callback(),
                createSelectorQuery: () => query,
                setData(patch) {
                  Object.assign(this.data, patch);
                },
              };
              definition.lifetimes.ready.call(instance);
              await measurement;
              if (width >= 390 && mode === 'month' && name === '测试名')
                expect(instance.data.fitScale).toBeGreaterThan(1);
              await row.locator('.fit-content').evaluate((node, scale) => {
                node.style.transform = `scale(${scale})`;
              }, instance.data.fitScale);
              await row.locator('.fit-viewport').evaluate((node, height) => {
                node.style.minHeight = `${height}px`;
              }, instance.data.fitHeight);
              const bounds = await row.evaluate((node) => {
                const viewport = node.querySelector('.fit-viewport').getBoundingClientRect();
                const content = node.querySelector('.fit-content');
                const rects = [...content.children].map((child) => child.getBoundingClientRect());
                return {
                  left: rects[0].left - viewport.left,
                  right: rects.at(-1).right - viewport.right,
                  overlap: rects.some((r, index) => index > 0 && r.left < rects[index - 1].right),
                  oneLine: rects.every(
                    (r) =>
                      Math.abs((r.top + r.bottom) / 2 - (rects[0].top + rects[0].bottom) / 2) < 0.6,
                  ),
                };
              });
              expect(bounds.left, `${width}/${mode}/${name}`).toBeGreaterThanOrEqual(-0.1);
              expect(bounds.right, `${width}/${mode}/${name}`).toBeLessThanOrEqual(0.1);
              expect(bounds.overlap).toBe(false);
              expect(bounds.oneLine).toBe(true);
              if (month) expect(Math.abs(bounds.left + bounds.right)).toBeLessThan(0.1);
            }
            if (weekly) {
              const nameBox = await page.locator('.week-duty-name').boundingBox();
              const badgesBox = await page.locator('.week-duty-badges').boundingBox();
              expect(badgesBox.y).toBeGreaterThanOrEqual(nameBox.y + nameBox.height);
            }
            expect(await page.locator(`.${nameClass}`).textContent()).toBe(name);
          }
        }
        await page.close();
      }
    } finally {
      await browser.close();
      vi.unstubAllGlobals();
    }
  }, 60000);

  it('aligns the sliding indicator to all tabs and settles on the last rapid selection', async () => {
    const browser = await chromium.launch({
      executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
      headless: true,
    });
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await page.setContent(
        `<style>:root{--ui-radius-small:10px;--ui-font-size-sm:12px;--ui-color-surface:#fff}${css('pages/workbench/index.wxss')}body{margin:0}.view-switch{display:inline-flex}</style><div class="view-switch is-month"><div class="view-switch-indicator"></div><div class="view-tab">月</div><div class="view-tab">周</div><div class="view-tab">列表</div></div>`,
      );
      for (const mode of ['month', 'week', 'list']) {
        await page.locator('.view-switch').evaluate((node, next) => {
          node.className = `view-switch is-${next}`;
        }, mode);
        await expect
          .poll(async () => {
            const indicator = await page.locator('.view-switch-indicator').boundingBox();
            const tab = await page
              .locator('.view-tab')
              .nth(['month', 'week', 'list'].indexOf(mode))
              .boundingBox();
            return Math.abs(indicator.x - tab.x) + Math.abs(indicator.width - tab.width);
          })
          .toBeLessThan(0.1);
        if (mode !== 'week') {
          const gaps = await page.locator('.view-switch').evaluate((node, side) => {
            const inner = node.querySelector('.view-switch-indicator');
            const outerBox = node.getBoundingClientRect(),
              innerBox = inner.getBoundingClientRect();
            return {
              top: innerBox.top - outerBox.top,
              bottom: outerBox.bottom - innerBox.bottom,
              side:
                side === 'month' ? innerBox.left - outerBox.left : outerBox.right - innerBox.right,
              corner:
                parseFloat(getComputedStyle(node).borderRadius) -
                parseFloat(getComputedStyle(inner).borderRadius),
            };
          }, mode);
          expect(gaps.top).toBeCloseTo(gaps.bottom, 1);
          expect(gaps.top).toBeCloseTo(gaps.side, 1);
          expect(gaps.top).toBeCloseTo(gaps.corner, 1);
        }
      }
      await page.locator('.view-switch').evaluate((node) => {
        node.className = 'view-switch is-week';
        node.className = 'view-switch is-month';
      });
      await expect
        .poll(async () => {
          const indicator = await page.locator('.view-switch-indicator').boundingBox();
          const tab = await page.locator('.view-tab').first().boundingBox();
          return Math.abs(indicator.x - tab.x);
        })
        .toBeLessThan(0.1);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      expect(
        await page
          .locator('.view-switch-indicator')
          .evaluate((node) => getComputedStyle(node).transitionDuration),
      ).toBe('0s');
    } finally {
      await browser.close();
    }
  }, 15000);
});
