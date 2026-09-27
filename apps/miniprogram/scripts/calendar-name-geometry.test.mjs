/* global getComputedStyle, document */
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { describe, expect, it } from 'vitest';
import { createCalendarNameLayout } from '../src/components/calendar/calendar-name-layout.ts';

const read = (file) => readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
const css = (file) => read(file).replace(/@import[^;]+;/gu, '');

describe.runIf(!!process.env.SCHEDULE_CALENDAR_FIT_GEOMETRY)('calendar browser geometry', () => {
  it('derives the cached widths from the actual page and dialog CSS, including the dialog cap', async () => {
    const browser = await chromium.launch({
      executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
      headless: true,
    });
    try {
      for (const width of [320, 360, 390, 393, 768]) {
        const page = await browser.newPage({ viewport: { width, height: 844 } });
        const fixtures = {
          page: '<div class="workbench-content"><div id="card"></div></div>',
          preview:
            '<div class="manual-page-content"><div class="preview-calendar-card"><div id="card"></div></div></div>',
          dialog:
            '<div class="release-dialog-layer"><div class="release-dialog is-calendar-preview"><div id="card"></div></div></div>',
          backfill: `<div class="backfill-page ${width <= 340 ? 'is-compact' : ''}"><div class="page-content"><div id="card"></div></div></div>`,
        };
        for (const [layout, markup] of Object.entries(fixtures)) {
          await page.setContent(
            `<style>:root{--ui-spacing-md:16px;--ui-color-border:#ddd}body{margin:0}${css('pages/workbench/index.wxss')}${css(layout === 'backfill' ? 'subpackages/scheduling/pages/backfill/index.wxss' : 'subpackages/scheduling/pages/manual/index.wxss')}#card{height:10px}</style>${markup}`,
          );
          const card = await page.locator('#card').boundingBox();
          expect(card.width, `${layout}/${width}`).toBeCloseTo(
            createCalendarNameLayout(layout, layout === 'dialog', width).cardWidth,
            1,
          );
        }
        await page.close();
      }
    } finally {
      await browser.close();
    }
  }, 15000);
  it('shares one container scale across all names, clipping only overflow without row measurements', async () => {
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
          'compact-week',
          'list',
        ]) {
          const compact = mode.startsWith('compact');
          const duties = mode === 'duties' || mode === 'compact';
          const weekly = mode.includes('week');
          const month = !weekly && mode !== 'list';
          const metrics = createCalendarNameLayout(
            compact ? 'dialog' : mode === 'preview-week' ? 'preview' : 'page',
            compact,
            width,
          );
          const source = month
            ? 'components/calendar/calendar-cell/index.wxss'
            : mode.endsWith('-week')
              ? 'components/calendar/calendar-week-panel/index.wxss'
              : 'pages/workbench/index.wxss';
          let standardFont;
          const cases = ['短名', '测试名', '四字测试', '很长的测试姓名', 'Alexandra W. Test'].map(
            (name) => ({ name }),
          );
          if (duties) cases.push({ name: '测试名', abbreviation: 'NP' });
          for (const { name, abbreviation } of cases) {
            const nameClass = month ? 'month-person' : weekly ? 'week-duty-name' : 'list-duty-name';
            const badgeClass = month
              ? 'change-mark'
              : weekly
                ? 'week-change-badge'
                : 'list-change-badge';
            const nameText = `<text class="${nameClass} calendar-name-text">${name}</text>`;
            const badges = duties
              ? `<text class="duty-abbreviation">${abbreviation || (name.length <= 3 ? 'N' : 'NP')}</text>`
              : `<text class="${badgeClass}">换</text>${month || name.length <= 3 ? '' : `<text class="${badgeClass}">假</text>`}`;
            const count =
              mode === 'month' && name === '很长的测试姓名'
                ? '<text class="month-person-count">+12</text>'
                : '';
            const wrap = (body) =>
              `<div class="calendar-name-line ${month ? 'is-centered' : ''}">${body}</div>`;
            const content = weekly
              ? `<div class="week-duty-item">${wrap(nameText)}<div class="week-duty-badges">${wrap(badges)}</div></div>`
              : `<div class="${month ? 'month-duty-line' : 'list-duty-name-line'}">${wrap(nameText + count + badges)}</div>`;
            const containerWidth = mode === 'list' ? width - 110 : (metrics.cardWidth - 2) / 7;
            const containerClass = month
              ? `calendar-cell ${compact ? 'is-compact' : ''} ${duties ? 'has-duties' : ''}`
              : weekly
                ? 'week-day'
                : '';
            await page.setContent(
              `<style>:root{--ui-font-weight-semibold:600;--ui-font-weight-strong:700;--ui-color-text-primary:#202830;--ui-color-primary:#0866cb;--ui-color-surface:#fff}body{margin:0;font-family:'Microsoft YaHei',sans-serif}${css('styles/calendar-name-line.wxss')}${css(source)}</style><div class="${compact && weekly ? 'is-compact' : ''}" style="${metrics.style};width:${containerWidth}px;${month ? 'border-right:1px solid;box-sizing:border-box' : ''}"><div class="${containerClass}" style="width:100%">${weekly ? '<div class="week-shift-group">' : ''}${content}${weekly ? '</div>' : ''}</div></div>`,
            );
            const typography = await page.locator('.calendar-name-text').evaluate((node) => {
              const style = getComputedStyle(node),
                range = document.createRange();
              range.selectNodeContents(node);
              return {
                font: parseFloat(style.fontSize),
                width: node.getBoundingClientRect().width,
                natural: range.getBoundingClientRect().width,
                overflow: style.textOverflow,
                text: node.textContent,
              };
            });
            standardFont ??= typography.font;
            expect(typography.font).toBe(standardFont);
            expect(typography.width).toBeLessThanOrEqual(3 * typography.font + 0.1);
            expect(typography.overflow).toBe('ellipsis');
            expect(typography.text).toBe(name);
            if (name.length <= 3)
              expect(
                typography.natural,
                `${width}/${mode}/${name}/${abbreviation || ''}`,
              ).toBeLessThanOrEqual(typography.width + 0.1);
            else expect(typography.natural).toBeGreaterThan(typography.width);
            for (const row of await page.locator('.calendar-name-line').all()) {
              const bounds = await row.evaluate((node) => {
                const viewport = node.getBoundingClientRect();
                const rects = [...node.children].map((child) => child.getBoundingClientRect());
                return {
                  left: rects[0].left - viewport.left,
                  right: rects.at(-1).right - viewport.right,
                  overlap: rects.some((r, i) => i > 0 && r.left < rects[i - 1].right),
                  oneLine: rects.every(
                    (r) => Math.abs((r.top + r.bottom - rects[0].top - rects[0].bottom) / 2) < 0.6,
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
          }
        }
        await page.close();
      }
    } finally {
      await browser.close();
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
