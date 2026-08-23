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
    expect(template).toContain('style="{{shellHeaderStyle}}"');
    expect(template).not.toContain('style="top:{{shellHeaderHeight}}px"');
    expect(template).toContain('id="workbench-content-top"');
    expect(template).toContain('scroll-y="{{viewMode !== \'list\'}}"');
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
    expect(template).toContain('class="selected-date-details"');
    expect(template).toContain('class="detail-heading"');
    expect(template).toContain('class="duty-group-grid"');
    expect(template).toContain('class="shift-detail-card"');
    expect(template).toContain('class="shift-card-heading"');
    expect(template).toContain('class="grouped-staff-list"');
    expect(template).toContain('class="staff-duty-row"');
    expect(template).toContain('class="staff-name-button"');
    expect(template).toContain('class="duty-status is-{{row.status}}"');
    expect(template).toContain('class="phone-split-actions"');
    expect(template).toContain('class="event-action"');
    expect(template).toContain('当日暂无符合当前筛选条件的排班。');
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
    expect(template).toContain('class="list-panel-scroll"');
    expect(template).toContain('scroll-into-view="{{listScrollTarget}}"');
    expect(template).not.toContain('月份工具栏固定 · 已按日期排序');
    expect(template).toContain('class="week-duty-name"');
    expect(template).toContain('class="week-shift-badge"');
    expect(template).toContain('class="list-day-card');
    expect(template).toContain('class="list-duty-details"');
    expect(template).toContain('class="list-call-action"');
    expect(template).toContain('>工作台</text>');
    expect(template).toContain("filterDropdownDirection === 'up'");
    expect(pageStyles).toMatch(/\.view-controls\s*{[^}]*position:\s*relative;/s);
    expect(pageStyles).not.toMatch(/\.view-controls\s*{[^}]*position:\s*sticky;/s);
    expect(pageStyles).toMatch(/\.workbench-content\.is-list-mode\s*{[^}]*height:\s*100%;/s);
    expect(pageStyles).toMatch(/\.list-panel-scroll\s*{[^}]*height:\s*100%;/s);
    expect(pageStyles).toMatch(
      /\.list-swiper\s*{[^}]*overflow:\s*hidden;[^}]*background:\s*var\(--ui-color-background\);/s,
    );
    expect(pageStyles).toMatch(
      /\.list-calendar-heading\s*{[^}]*position:\s*relative;[^}]*z-index:\s*1;/s,
    );
    expect(pageStyles).toMatch(/\.list-calendar-heading\s*{[^}]*box-shadow:\s*none;/s);
    expect(pageStyles).toMatch(/\.filter-sheet\s*{[^}]*height:\s*468px;/s);
    expect(pageStyles).toMatch(/\.filter-select-options\s*{[^}]*position:\s*absolute;/s);
    expect(pageStyles).toContain('.filter-select-options.is-up');
    expect(pageStyles).toContain('.filter-select-options.is-down');
    expect(pageSource).toContain('getMenuButtonBoundingClientRect');
    expect(pageSource).toContain('statusBarHeight');
    expect(pageSource).toContain('resolveFilterDropdownDirection');
    expect(monthStyles).toMatch(
      /\.month-step\.is-pressed,[\s\S]*?\.locate-button\.is-pressed\s*{[^}]*border-radius:\s*12px;[^}]*transform:\s*scale\(0\.9\);/s,
    );
    expect(pageStyles).toMatch(
      /\.calendar-step\.is-pressed,[\s\S]*?\.calendar-locator\.is-pressed\s*{[^}]*border-radius:\s*12px;[^}]*transform:\s*scale\(0\.9\);/s,
    );
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
    expect(view.weekPanels[1].days.at(-2)?.duties).toEqual([
      expect.objectContaining({
        markers: ['换', '补', '加'],
        name: '李医生',
        shiftAbbreviation: '全',
      }),
    ]);
    expect(view.listPanels[1].days).toHaveLength(1);
    expect(view.listPanels[1].days[0]).toEqual(
      expect.objectContaining({
        dateLabel: '08-22',
        dutyCountLabel: '1 班',
        isWeekend: true,
        weekday: '周六',
      }),
    );
    expect(view.listPanels[1].days[0]?.duties[0]).toEqual(
      expect.objectContaining({
        details: '全天班 · 00:00–00:00 · 一线',
        markers: ['换', '补', '加'],
        name: '李医生',
      }),
    );
    expect(view.selectedDetails).toHaveLength(1);
    expect(view.selectedDetails[0]).toEqual(
      expect.objectContaining({
        shiftAbbreviation: '全',
        shiftName: '全天班',
        timeRange: '00:00–00:00',
      }),
    );
    expect(view.selectedDetails[0]?.rows[0]).toEqual(
      expect.objectContaining({
        name: '李医生',
        role: '一线',
        status: 'changed',
        statusLabel: '有变更',
      }),
    );
    expect(view.selectedDetails[0]?.rows[0]?.markerDetails).toEqual([
      { badge: '换', key: 'swap', label: '换班' },
      { badge: '替', key: 'leave-cover', label: '请假替班' },
      { badge: '加', key: 'overtime', label: '加班' },
    ]);
    expect(view.selectedDetails[0]?.rows[0]?.phoneOptions).toEqual([]);
    expect(view.selectedLabel).toBe('8月22日 周六');

    const contactView = createWorkbenchViewModel(
      {
        ...calendarApiGoldenResponse,
        assignments: [
          {
            ...calendarApiGoldenResponse.assignments[0],
            actualMemberName: '张医生',
            actualMembershipId: 'membership-1',
          },
        ],
      },
      holidayApiGoldenResponse,
      '2026-08-22',
      '2026-08',
      '2026-08-17',
    );
    expect(contactView.selectedDetails[0]?.rows[0]?.phoneOptions).toEqual([
      { label: '短号', number: '61234' },
      { label: '手机', number: '13800138000' },
    ]);

    const groupedView = createWorkbenchViewModel(
      {
        ...calendarApiGoldenResponse,
        assignments: [
          calendarApiGoldenResponse.assignments[0],
          { ...calendarApiGoldenResponse.assignments[0], id: 'assignment-2', slotPosition: 2 },
        ],
      },
      holidayApiGoldenResponse,
      '2026-08-22',
      '2026-08',
      '2026-08-17',
    );
    expect(groupedView.selectedDetails).toHaveLength(1);
    expect(groupedView.selectedDetails[0]?.rows).toHaveLength(2);
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
    expect(hidden.listPanels[1].days).toHaveLength(0);

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
    expect(visible.listPanels[1].days).toHaveLength(1);
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
