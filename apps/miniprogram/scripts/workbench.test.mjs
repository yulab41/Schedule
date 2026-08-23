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
    const pageSource = readSource('pages/workbench/index.ts');
    const monthTemplate = readSource('components/calendar/calendar-month/index.wxml');
    const cellStyles = readSource('components/calendar/calendar-cell/index.wxss');
    const pageStyles = readSource('pages/workbench/index.wxss');
    const monthStyles = readSource('components/calendar/calendar-month/index.wxss');
    expect(template).toContain('24 小时缓存');
    expect(template).toContain('月');
    expect(template).toContain('周');
    expect(template).toContain('列表');
    expect(template).toContain('定位到今天');
    expect(template).toContain('筛选排班');
    expect(template).toContain('查看结果');
    expect(template).toContain('清除筛选');
    expect(template).toContain('排班岗位');
    expect(template).toContain('班种');
    expect(template).toContain('成员');
    expect(template).toContain('class="filter-sheet-backdrop"');
    expect(template).toContain('class="filter-sheet');
    expect(template).toContain('class="filter-select-trigger');
    expect(template).toContain("filterOpenField === 'role'");
    expect(template).toContain("filterOpenField === 'shift'");
    expect(template).toContain("filterOpenField === 'member'");
    expect(template).not.toContain('class="filter-chip-list"');
    expect(template).not.toContain('class="member-filter-scroll"');
    expect(template).toContain('bindanimationfinish="handleWeekSwiperFinish"');
    expect(template).toContain('bindanimationfinish="handleListSwiperFinish"');
    expect(template).toContain('scroll-into-view="{{scrollTarget}}"');
    expect(template).toContain('filterIconAnimating');
    expect(template).toContain('locateIconAnimating');
    expect(template).toContain('calendarNavAnimating');
    expect(template).toContain('class="workbench-shell-header"');
    expect(template).toContain('class="group-switcher-trigger');
    expect(template).toContain('class="notification-action');
    expect(template).toContain('class="shell-profile-action');
    expect(template).toContain('/assets/icons/web-bell.svg');
    expect(template).toContain('/assets/icons/web-profile.svg');
    expect(template).toContain('/assets/icons/web-calendar.svg');
    expect(template).toContain('/assets/icons/web-leave.svg');
    expect(template).toContain('/assets/icons/web-swap.svg');
    expect(template).toContain('/assets/icons/web-duty.svg');
    expect(template).toContain('/assets/icons/web-more.svg');
    expect(template).toContain('/assets/icons/web-locate.svg');
    expect(template).toContain('/assets/icons/web-chevron-left.svg');
    expect(template).toContain('/assets/icons/web-chevron-right.svg');
    expect(template).toContain('联系方式仅在群组成员单独同意后显示');
    expect(template).toContain('aria-disabled="true"');
    expect(template).toContain('nav-icon nav-leave');
    expect(template).toContain('nav-icon nav-swap');
    expect(template).toContain('nav-icon nav-adjustment');
    expect(template).toContain('nav-icon nav-more');
    expect(monthTemplate).toContain('is-bottom-row');
    expect(monthTemplate).toContain('bindtransition="handleMonthTransition"');
    expect(monthTemplate).toContain('style="height:{{viewportHeight}}px"');
    expect(template).toContain('panel-heights="{{monthPanelHeights}}"');
    expect(pageStyles).toContain('@keyframes click-filter-top');
    expect(pageStyles).toContain('@keyframes click-locate');
    expect(pageStyles).toContain('@keyframes minimal-swap-left');
    expect(pageStyles).toContain('@keyframes minimal-dot');
    expect(pageStyles).toContain('@keyframes filter-sheet-enter');
    expect(monthStyles).toContain('@keyframes click-locate');
    expect(cellStyles).toMatch(
      /\.calendar-cell\.is-selected::after\s*{[^}]*inset:\s*1px;[^}]*border:\s*2px solid/s,
    );
    expect(pageSource).toContain("? 'offline' : 'ready'");
    expect(pageSource).not.toContain('activeResult.calendar.assignments.length === 0');
    expect(pageSource).toContain('commitPeriodShift');
    expect(pageSource).not.toContain('recenterPeriodSwiper');
    expect(pageSource).toContain('[-2, -1, 0, 1, 2]');
    expect(pageSource).toContain('page.monthResources.delete(loadedMonth)');
    expect(template).not.toContain('<scroll-view class="list-panel-scroll"');
    expect(pageStyles).toMatch(/\.view-controls\s*{[^}]*position:\s*sticky;/s);
    expect(template).not.toContain('class="refresh-indicator"');
    expect(template).not.toContain('正在读取排班…');
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
    expect(view.weekPanels).toHaveLength(3);
    expect(view.listPanels).toHaveLength(3);
    expect(view.monthPanels[1].cells.length % 7).toBe(0);
    expect(view.monthPanels[1].cells.at(-1)?.isBottomRow).toBe(true);
    expect(view.weekPanels[1].days).toHaveLength(7);
    expect(view.weekPanels[1].weekOrdinalLabel).toBe('8月第4周');
    expect(view.weekPanels[1].rangeLabel).toBe('2026年8月17日 – 8月23日');
    expect(view.listPanels[1].rows).toHaveLength(1);
    expect(view.selectedDetails[0]?.name).toBe('李医生');
    expect(view.selectedDetails[0]?.changeLabel).toBe('换班 · 请假补位 · 加班');
  });

  it('renders an already-prefetched adjacent-month assignee without waiting for another read', () => {
    const adjacentAssignment = {
      ...calendarApiGoldenResponse.assignments[0],
      businessDate: '2026-09-01',
      id: 'assignment-adjacent',
    };
    const view = createWorkbenchViewModel(
      {
        ...calendarApiGoldenResponse,
        assignments: [...calendarApiGoldenResponse.assignments, adjacentAssignment],
      },
      holidayApiGoldenResponse,
      '2026-08-22',
      '2026-08',
      '2026-08-17',
    );

    const adjacentCell = view.monthPanels[1].cells.find(
      (cell) => cell.businessDate === '2026-09-01',
    );
    expect(adjacentCell?.isCurrentMonth).toBe(false);
    expect(adjacentCell?.person).toBe('李医生');
  });

  it('matches the Web filter dimensions for changes, roles, shift types and members', () => {
    const hidden = createWorkbenchViewModel(
      calendarApiGoldenResponse,
      holidayApiGoldenResponse,
      '2026-08-22',
      '2026-08',
      '2026-08-17',
      {
        membershipIds: ['membership-1'],
        onlyChanges: false,
        roleIds: [],
        shiftTypeIds: [],
      },
    );
    expect(hidden.listPanels[1].rows).toHaveLength(0);

    const visible = createWorkbenchViewModel(
      calendarApiGoldenResponse,
      holidayApiGoldenResponse,
      '2026-08-22',
      '2026-08',
      '2026-08-17',
      {
        membershipIds: ['membership-2'],
        onlyChanges: true,
        roleIds: ['role-1'],
        shiftTypeIds: ['shift-1'],
      },
    );
    expect(visible.listPanels[1].rows).toHaveLength(1);
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
