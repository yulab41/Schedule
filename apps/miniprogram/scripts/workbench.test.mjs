import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  createWorkbenchViewModel,
  getTodayBusinessDate,
  getHorizontalSwipeDelta,
  sanitizeCalendarForCache,
} from '../src/features/workbench/workbench-model.ts';
import { calendarApiGoldenResponse, holidayApiGoldenResponse } from '@schedule/client-core/testing';

const appRoot = process.cwd();

function readSource(relativePath) {
  return readFileSync(path.join(appRoot, 'src', relativePath), 'utf8');
}

describe('P4 native workbench', () => {
  it('registers the authenticated workbench route after identity', () => {
    const appJson = JSON.parse(readSource('app.json'));
    expect(appJson.pages).toContain('pages/workbench/index');

    const identityPage = readSource('pages/identity/index.wxml');
    expect(identityPage).toContain('url="/pages/workbench/index"');
    expect(identityPage).toContain('进入排班台');
  });

  it('keeps the P4 shell read-only and exposes the confirmed navigation states', () => {
    const template = readSource('pages/workbench/index.wxml');
    const monthTemplate = readSource('components/calendar/calendar-month/index.wxml');
    const pageStyles = readSource('pages/workbench/index.wxss');
    const monthStyles = readSource('components/calendar/calendar-month/index.wxss');
    expect(template).toContain('24 小时缓存');
    expect(template).toContain('月');
    expect(template).toContain('周');
    expect(template).toContain('列表');
    expect(template).toContain('定位到今天');
    expect(template).toContain('筛选排班');
    expect(template).toContain('完成');
    expect(template).toContain('bindtouchstart="handleSwipeStart"');
    expect(template).toContain('bindtouchend="handleWeekSwipeEnd"');
    expect(template).toContain('bindtouchend="handleListSwipeEnd"');
    expect(template).toContain('scroll-into-view="{{scrollTarget}}"');
    expect(template).toContain('filterIconAnimating');
    expect(template).toContain('locateIconAnimating');
    expect(template).toContain('calendarNavAnimating');
    expect(template).toContain('联系方式仅在群组成员单独同意后显示');
    expect(template).toContain('aria-disabled="true"');
    expect(template).toContain('nav-icon nav-leave');
    expect(template).toContain('nav-icon nav-swap');
    expect(template).toContain('nav-icon nav-adjustment');
    expect(template).toContain('nav-icon nav-more');
    expect(monthTemplate).toContain('is-bottom-row');
    expect(pageStyles).toContain('@keyframes click-filter-top');
    expect(pageStyles).toContain('@keyframes click-locate');
    expect(monthStyles).toContain('@keyframes click-locate');
    expect(template).not.toMatch(/bindtap="(save|publish|submit|create|delete|approve)/u);
  });

  it('maps the real calendar read model into month, week and list data', () => {
    const view = createWorkbenchViewModel(
      calendarApiGoldenResponse,
      holidayApiGoldenResponse,
      '2026-08-22',
      '2026-08',
      '2026-08-17',
    );

    expect(view.monthPanels).toHaveLength(3);
    expect(view.monthPanels[1].cells.length % 7).toBe(0);
    expect(view.monthPanels[1].cells.at(-1)?.isBottomRow).toBe(true);
    expect(view.weekDays).toHaveLength(7);
    expect(view.listRows).toHaveLength(1);
    expect(view.selectedDetails[0]?.name).toBe('李医生');
    expect(view.selectedDetails[0]?.changeLabel).toBe('换班 · 请假补位 · 加班');
  });

  it('keeps today and month navigation in China-standard business dates', () => {
    expect(getTodayBusinessDate(new Date('2026-08-23T00:30:00.000Z'))).toBe('2026-08-23');
    expect(getTodayBusinessDate(new Date('2026-08-22T16:30:00.000Z'))).toBe('2026-08-23');
  });

  it('only turns a predominantly horizontal gesture into one adjacent period', () => {
    expect(getHorizontalSwipeDelta(-80, 8)).toBe(1);
    expect(getHorizontalSwipeDelta(80, 8)).toBe(-1);
    expect(getHorizontalSwipeDelta(-80, 90)).toBe(0);
    expect(getHorizontalSwipeDelta(-20, 4)).toBe(0);
  });

  it('removes full mobile phones before persisting a 24-hour read cache', () => {
    const cached = sanitizeCalendarForCache(calendarApiGoldenResponse);
    expect(cached.members[0]).not.toHaveProperty('mobilePhone');
    expect(cached.members[0]?.shortPhone).toBe('61234');
    expect(cached.assignments).toEqual(calendarApiGoldenResponse.assignments);
  });
});
