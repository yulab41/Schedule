/* global document, getComputedStyle */

import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { describe, expect, it } from 'vitest';
import { calendarWeekPanelHeight } from '../src/components/calendar/calendar-week-model.ts';
import {
  previewWeekModel,
  previewWeekPanels,
} from '../src/subpackages/scheduling/components/schedule-calendar-preview/model.ts';

const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');

describe('weekly calendar regression', () => {
  it('keeps the original home week grid, height rule, and corner selection in the page', () => {
    const view = read('pages/workbench/index.wxml');
    const page = read('pages/workbench/index.ts');
    const style = read('pages/workbench/index.wxss');
    expect(view).toContain('<view class="week-day-grid">');
    expect(view).not.toContain('<calendar-week-panel');
    expect(page).toContain('Math.max(112, (view.weekPanels[1]?.height ?? 112) + 20)');
    expect(style).toMatch(/\.week-day:first-child\s*\{[^}]*border-bottom-left-radius: 17px/su);
    expect(style).toMatch(/\.week-day:last-child\s*\{[^}]*border-bottom-right-radius: 17px/su);
    expect(style).toMatch(/\.week-day\.is-selected::after\s*\{[^}]*border-radius: inherit/su);
  });

  it('measures the preview panel from actual lines without extra bottom space per person', () => {
    const groups = Array.from({ length: 6 }, (_, index) => ({
      duties: [{ name: `长姓名${index}`, markers: [] }],
    }));
    expect(calendarWeekPanelHeight([{ shiftGroups: groups }], 2)).toBe(392);
  });

  it('uses the actual narrow viewport only at 340px and below', () => {
    const assignments = Array.from({ length: 6 }, (_, index) => ({
      businessDate: '2026-09-24',
      plannedMemberName: '三字名',
      shiftTypeId: `shift-${index}`,
      shiftTypeAbbreviation: `S${index}`,
      shiftTypeName: `S${index}班`,
      slotPosition: index,
    }));
    const height = (viewportWidth) =>
      previewWeekPanels(assignments, '2026-09-21', '', 1, false, [], {
        viewportWidth,
      }).gridHeight;
    expect(height(390)).toBe(296);
    expect(height(320)).toBe(392);
  });

  it('keeps old preview assignments gray while preserving colored proposed shifts', () => {
    const base = {
      businessDate: '2026-09-24',
      plannedMemberName: '测试成员',
      shiftTypeId: 'a',
      shiftTypeAbbreviation: 'A',
      shiftTypeName: 'A班',
      shiftTypeColor: '#2368aa',
      slotPosition: 1,
    };
    const week = previewWeekModel(
      [
        { ...base, state: 'normal' },
        { ...base, shiftTypeId: 'b', state: 'added' },
      ],
      '2026-09-21',
      '',
    );
    const day = week.days.find((item) => item.businessDate === base.businessDate);
    expect(day.isPast).toBe(false);
    expect(day.shiftGroups[0].duties[0].comparisonClass).toBe('is-existing-comparison');
    expect(day.shiftGroups[1].duties[0].comparisonClass).toBe('');
  });

  it('rounds both bottom cells and their blue selection frame in preview/backfill', () => {
    const style = read('components/calendar/calendar-week-panel/index.wxss');
    expect(style).toMatch(/\.week-day:first-child\s*\{[^}]*border-bottom-left-radius: 17px/su);
    expect(style).toMatch(/\.week-day:last-child\s*\{[^}]*border-bottom-right-radius: 17px/su);
    expect(style).toMatch(/\.week-day\.is-selected::after\s*\{[^}]*border-radius: inherit/su);
    expect(style).toMatch(/\.week-day\.is-future\s*\{[^}]*background: #fafbfd/su);
  });
});

describe.runIf(!!process.env.SCHEDULE_WEEK_GEOMETRY)('weekly preview browser geometry', () => {
  it('fits six grouped shifts at 390px and 320px with rounded selected corners', async () => {
    const css = read('components/calendar/calendar-week-panel/index.wxss').replace(
      /@import[^;]+;/gu,
      '',
    );
    const browser = await chromium.launch({
      executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
      headless: true,
    });
    try {
      for (const [viewportWidth, panelWidth] of [
        [390, 330],
        [320, 272],
      ]) {
        const page = await browser.newPage({ viewport: { width: viewportWidth, height: 844 } });
        const height = calendarWeekPanelHeight(
          [{ shiftGroups: Array.from({ length: 6 }, () => ({ duties: [{ name: '三字名' }] })) }],
          viewportWidth <= 340 ? 2 : 3,
        );
        const groups = Array.from(
          { length: 6 },
          () =>
            '<div class="week-shift-group"><div class="week-group-title"><span class="week-shift-badge">A</span></div><div class="week-duty-item"><span class="week-duty-name">三字名</span></div></div>',
        ).join('');
        const days = Array.from(
          { length: 7 },
          (_, index) =>
            `<div class="week-day ${index === 0 || index === 6 ? 'is-selected' : ''}"><div class="week-day-content"><div class="week-date-line"><span class="day-number">24</span></div>${index === 3 ? groups : ''}</div></div>`,
        ).join('');
        await page.setContent(
          `<style>:root{--ui-color-border:#d5dbe3;--ui-color-surface:#fff;--ui-color-text-secondary:#64748b;--ui-color-primary:#0866cb}body{margin:0;font-family:'Microsoft YaHei',sans-serif}${css}</style><div class="week-day-grid" style="width:${panelWidth}px;height:${height}px">${days}</div>`,
        );
        const geometry = await page.evaluate(() => {
          const cells = [...document.querySelectorAll('.week-day')];
          const busy = cells[3];
          return {
            overflow: busy.scrollHeight - busy.clientHeight,
            bottomGap:
              busy.getBoundingClientRect().bottom -
              busy.querySelector('.week-day-content').getBoundingClientRect().bottom,
            firstRadius: getComputedStyle(cells[0]).borderBottomLeftRadius,
            lastRadius: getComputedStyle(cells[6]).borderBottomRightRadius,
            groupCount: busy.querySelectorAll('.week-shift-group').length,
          };
        });
        expect(geometry.overflow).toBeLessThanOrEqual(1);
        expect(geometry.bottomGap).toBeGreaterThanOrEqual(7);
        expect(geometry.bottomGap).toBeLessThanOrEqual(10);
        expect(geometry.firstRadius).toBe('17px');
        expect(geometry.lastRadius).toBe('17px');
        expect(geometry.groupCount).toBe(6);
        await page.close();
      }
    } finally {
      await browser.close();
    }
  }, 30000);
});
