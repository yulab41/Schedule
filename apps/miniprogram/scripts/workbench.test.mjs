import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  createMonthRing,
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

    const identityPage = readSource('pages/identity/index.ts');
    const identityTemplate = readSource('pages/identity/index.wxml');
    expect(identityPage).toContain('wx.reLaunch');
    expect(identityPage).toContain("url: '/pages/workbench/index'");
    expect(identityTemplate).toContain('进入工作台');
    expect(identityTemplate).not.toContain('身份已确认');
  });

  it('omits the Mini-only period and cache summary above the Web-matched controls', () => {
    const template = readSource('pages/workbench/index.wxml');

    expect(template).not.toContain('24 小时缓存');
    expect(template).not.toContain('class="period-row"');
    expect(template).not.toContain('class="cache-note"');
  });

  it('keeps month change markers inline immediately after the assignee like mobile Web', () => {
    const cellTemplate = readSource('components/calendar/calendar-cell/index.wxml');
    const cellStyles = readSource('components/calendar/calendar-cell/index.wxss');

    expect(cellTemplate).toMatch(
      /class="month-duty-line"[\s\S]*class="month-person"[\s\S]*class="change-mark"/s,
    );
    expect(cellStyles).toMatch(
      /\.month-duty-line\s*{[^}]*display:\s*flex;[^}]*align-items:\s*center;[^}]*gap:\s*2px;/s,
    );
    expect(cellStyles).not.toMatch(/\.change-mark\s*{[^}]*position:\s*absolute;/s);
  });

  it('releases month, week and list navigation press backgrounds after 60ms', () => {
    const template = readSource('pages/workbench/index.wxml');
    const monthTemplate = readSource('components/calendar/calendar-month/index.wxml');

    expect(monthTemplate.match(/hover-start-time="0"/g)).toHaveLength(3);
    expect(monthTemplate.match(/hover-stay-time="60"/g)).toHaveLength(3);
    expect(template.match(/hover-start-time="0"/g)).toHaveLength(6);
    expect(template.match(/hover-stay-time="60"/g)).toHaveLength(6);
  });

  it('starts month, week and list cards on the same compact 8px rhythm', () => {
    const pageStyles = readSource('pages/workbench/index.wxss');

    expect(pageStyles).toMatch(
      /\.workbench-view-anchor\s*{[^}]*box-sizing:\s*border-box;[^}]*padding-top:\s*8px;/s,
    );
    expect(pageStyles).not.toContain('.workbench-view-anchor.is-month-mode');
    expect(pageStyles).not.toMatch(
      /\.selected-date-details,\s*\.week-calendar,\s*\.list-calendar\s*{[^}]*margin-top:/s,
    );
  });

  it('uses the production Web history SVG for event actions', () => {
    const template = readSource('pages/workbench/index.wxml');
    const pageStyles = readSource('pages/workbench/index.wxss');
    const historyIcon = readSource('assets/icons/ui-history.svg');

    expect(
      template.match(/class="event-history-icon"[\s\S]*?src="\/assets\/icons\/ui-history\.svg"/g),
    ).toHaveLength(2);
    expect(template).not.toContain('class="history-icon"');
    expect(pageStyles).toMatch(/\.event-history-icon\s*{[^}]*width:\s*16px;[^}]*height:\s*16px;/s);
    expect(pageStyles).not.toContain('.history-icon::before');
    expect(pageStyles).not.toContain('.history-icon::after');
    expect(historyIcon).toContain('viewBox="0 0 24 24"');
    expect(historyIcon).toContain('M2.552 13C3.0517 17.7767');
  });

  it('explains unavailable group tools instead of failing silently', () => {
    const pageSource = readSource('pages/workbench/index.ts');

    expect(pageSource).toContain('当前群组尚未准备好，请刷新后重试。');
    expect(pageSource).toContain('当前账号无权访问此工具。');
    expect(pageSource).toContain('页面暂时无法打开，请稍后重试。');
    expect(pageSource).toContain('fail: () =>');
  });

  it('uses one Web-matched date label formatter without an intermediate legacy label', () => {
    const pageSource = readSource('pages/workbench/index.ts');
    const modelSource = readSource('features/workbench/workbench-model.ts');

    expect(modelSource).toContain('export function formatDateLabel');
    expect(pageSource).toMatch(/import\s*\{[\s\S]*?formatDateLabel,[\s\S]*?\}\s*from/s);
    expect(pageSource).not.toMatch(/\nfunction formatDateLabel\(/u);
    expect(pageSource).not.toContain(' · 星期');
  });

  it('places the list clipping line at the full-width card edge and keeps its floor flush', () => {
    const template = readSource('pages/workbench/index.wxml');
    const pageStyles = readSource('pages/workbench/index.wxss');

    expect(template).toContain('class="list-scroll-boundary"');
    expect(pageStyles).toMatch(
      /\.list-scroll-boundary\s*{[^}]*width:\s*auto;[^}]*height:\s*8px;[^}]*margin:\s*0 -12px;[^}]*background:\s*var\(--ui-color-background\);[^}]*border-bottom:\s*1px solid var\(--ui-color-border\);/s,
    );
    expect(pageStyles).toMatch(
      /\.list-calendar-heading\s*{[^}]*z-index:\s*3;[^}]*min-height:\s*62px;[^}]*padding:\s*4px 6px;[^}]*border-radius:\s*var\(--ui-radius-large\);[^}]*box-shadow:\s*var\(--ui-shadow-card\);/s,
    );
    expect(pageStyles).toMatch(
      /\.list-scroll-boundary\s*{[^}]*z-index:\s*2;[^}]*box-shadow:\s*none;/s,
    );
    expect(pageStyles).toMatch(/\.workbench-content\.is-list-mode\s*{[^}]*padding-bottom:\s*0;/s);
    expect(pageStyles).toMatch(/\.list-day-slot\s*{[^}]*padding-top:\s*8px;/s);
    expect(pageStyles).toMatch(/\.list-day-card\s*{[^}]*margin:\s*0;/s);
    expect(pageStyles).not.toMatch(/\.list-panel-content\s*{[^}]*padding-top:/s);
    expect(pageStyles).not.toContain('.list-day-card:last-child');
    expect(pageStyles).not.toMatch(/\.list-panel-scroll\s*{[^}]*padding:/s);
    expect(template).toContain('class="list-panel-content"');
    expect(template).toMatch(
      /id="list-day-\{\{day\.businessDate\}\}"\s+class="list-day-slot"[\s\S]*?class="list-day-card/s,
    );
    expect(template).toContain(
      "class=\"workbench-scroll {{viewMode === 'list' ? 'is-list-mode' : ''}}\"",
    );
    expect(template).toContain('style="{{workspaceViewportStyle}}"');
    expect(pageStyles).not.toMatch(/\.workbench-scroll\.is-list-mode\s*{[^}]*padding-bottom:/s);
    expect(pageStyles).toMatch(/\.list-calendar\s*{[^}]*overflow:\s*visible;/s);
  });

  it('keeps today prefetched and stages locate target panels before motion starts', () => {
    const pageSource = readSource('pages/workbench/index.ts');

    expect(pageSource).toContain('const requestedMonths = new Set<string>([initialMonth]);');
    expect(pageSource).toContain('function startLocateTransition(');
    expect(pageSource).toContain('month.startProgrammaticShift(delta, targetHeight)');
    expect(pageSource).toMatch(
      /handleMonthChange[\s\S]*?this\.monthRingSlot = event\.detail\.current;[\s\S]*?createViewPatch\(this, period\)/s,
    );
  });

  it('keeps month labels in the ViewModel and removes unreachable legacy workbench CSS', () => {
    const pageSource = readSource('pages/workbench/index.ts');
    const modelSource = readSource('features/workbench/workbench-model.ts');
    const pageStyles = readSource('pages/workbench/index.wxss');

    expect(modelSource).toContain('export function formatMonthLabel');
    expect(pageSource).not.toMatch(/\nfunction formatMonthLabel\(/u);
    for (const legacyClass of [
      'workbench-header',
      'brand-lockup',
      'identity-chip',
      'filter-panel',
      'refresh-indicator',
      'list-row',
      'bell-body',
      'profile-head',
      'nav-calendar-check',
    ]) {
      expect(pageStyles).not.toContain(`.${legacyClass}`);
    }
    expect(Buffer.byteLength(pageStyles.replaceAll('\r\n', '\n'), 'utf8')).toBeLessThan(44_000);
  });

  it('commits loaded data and view changes with one presentation patch', () => {
    const pageSource = readSource('pages/workbench/index.ts');

    expect(pageSource).toContain('...createViewPatch(page),');
    expect(pageSource).not.toMatch(
      /page\.setData\(\{[\s\S]*?state:[\s\S]*?\}\);\s*refreshView\(page\);\s*flushPendingScrollTarget/u,
    );
    expect(pageSource).not.toContain('else refreshView(this);');
  });

  it('queues rapid month and week shifts without stale reads recentering active motion', () => {
    const template = readSource('pages/workbench/index.wxml');
    const pageSource = readSource('pages/workbench/index.ts');
    const monthSource = readSource('components/calendar/calendar-month/index.ts');
    const readMonthsSource = pageSource.slice(
      pageSource.indexOf('async function readMonths('),
      pageSource.indexOf('function refreshView('),
    );
    const periodShiftSource = pageSource.slice(
      pageSource.indexOf('function commitPeriodShift('),
      pageSource.indexOf('function startLocateTransition('),
    );
    const monthFinishSource = monthSource.slice(
      monthSource.indexOf('finishPeriodShift('),
      monthSource.indexOf('continueQueuedShift('),
    );

    expect(monthSource).toContain('_queuedMonthDelta');
    expect(monthSource).toContain('finishPeriodShift');
    expect(monthSource).toContain('continueQueuedShift');
    expect(monthSource).toContain("this.triggerEvent('monthsettled', {");
    expect(monthFinishSource).not.toContain('swiperDuration: 0');
    expect(monthFinishSource).not.toContain('swiperCurrent');
    expect(monthSource).not.toMatch(/panels\(this:\s*CalendarMonthInstance\)/u);
    expect(template).toContain('bind:monthsettled="handleMonthSettled"');
    expect(pageSource).not.toContain('pendingMonthViewPatch');
    expect(pageSource).toContain('handleMonthSettled');
    expect(pageSource).toContain('createMonthRing');
    expect(pageSource).toContain('periodShiftQueue');
    expect(pageSource).toContain('periodShiftCommitPending');
    expect(pageSource).toContain('function continuePeriodShift(');
    expect(pageSource).toContain('async function refreshWorkbenchWindow(');
    expect(pageSource).toContain('month?.finishPeriodShift !== undefined');
    expect(periodShiftSource).not.toContain('loadWorkbench(');
    expect(readMonthsSource).not.toContain('page.monthResources.set(');
    expect(readMonthsSource).not.toContain('page.monthResources.delete(');
  });

  it('rotates logical months into stable physical slots without a recenter step', () => {
    const august = createWorkbenchViewModel(
      calendarApiGoldenResponse,
      holidayApiGoldenResponse,
      '2026-08-22',
      '2026-08',
      '2026-08-17',
    );
    const september = createWorkbenchViewModel(
      calendarApiGoldenResponse,
      holidayApiGoldenResponse,
      '2026-09-22',
      '2026-09',
      '2026-09-21',
    );
    const heights = (panels) => panels.map((panel) => (panel.cells.length / 7) * 54);

    const next = createMonthRing(september.monthPanels, heights(september.monthPanels), 2);
    expect(next.monthPanels.map((panel) => panel.key)).toEqual(['2026-10', '2026-08', '2026-09']);
    expect(next.monthPanels.map((panel) => panel.relative)).toEqual([1, -1, 0]);
    expect(next.monthPanels.map((panel) => panel.slot)).toEqual([0, 1, 2]);
    expect(next.monthPanels[2]?.cells).toBe(september.monthPanels[1]?.cells);
    expect(next.monthPanelHeights[2]).toBe(heights(september.monthPanels)[1]);
    expect(august.monthPanels[1]?.slot).toBe(1);
  });

  it('resets a previous locate animation when switching week or list views', () => {
    const pageSource = readSource('pages/workbench/index.ts');
    const viewChangeSource = pageSource.slice(
      pageSource.indexOf('handleViewChange('),
      pageSource.indexOf('handleFilterToggle('),
    );

    expect(viewChangeSource).toContain('locateIconAnimating: false');
  });

  it('keeps the P4 shell read-only and exposes the confirmed navigation states', () => {
    const template = readSource('pages/workbench/index.wxml');
    const pageSource = readSource('pages/workbench/index.ts');
    const monthTemplate = readSource('components/calendar/calendar-month/index.wxml');
    const cellStyles = readSource('components/calendar/calendar-cell/index.wxss');
    const pageStyles = readSource('pages/workbench/index.wxss');
    const monthStyles = readSource('components/calendar/calendar-month/index.wxss');
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
    expect(template).toContain('/assets/icons/ui-bell.svg');
    expect(template).toContain('/assets/icons/ui-profile.svg');
    expect(template).toContain('/assets/icons/ui-calendar.svg');
    expect(template).toContain('/assets/icons/ui-directory.svg');
    expect(template).toContain('/assets/icons/ui-leave.svg');
    expect(template).toContain('/assets/icons/ui-swap-left.svg');
    expect(template).toContain('/assets/icons/ui-duty.svg');
    expect(template).toContain('/assets/icons/ui-more-primary.svg');
    expect(template).toContain('/assets/icons/ui-locate.svg');
    expect(template).toContain('/assets/icons/ui-chevron-left.svg');
    expect(template).toContain('/assets/icons/ui-chevron-right.svg');
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
    expect(template).toContain('aria-disabled="{{!workflowPanelsMounted}}"');
    expect(template).toContain('bindtap="handleMoreNav"');
    expect(template).toContain('nav-icon nav-directory');
    expect(template).toContain('nav-icon nav-swap');
    expect(template).toContain('nav-icon nav-profile');
    expect(template).toContain('nav-icon nav-more');
    expect(monthTemplate).toContain('is-bottom-row');
    expect(monthTemplate).not.toContain('bindtransition=');
    expect(monthTemplate).toContain('bindchange="handleMonthChangeStart"');
    expect(monthTemplate).toContain('style="height:{{viewportHeight}}px"');
    expect(template).toContain('panel-heights="{{monthPanelHeights}}"');
    expect(pageStyles).toContain('@keyframes click-filter-top');
    expect(pageStyles).toContain('@keyframes click-locate');
    expect(pageStyles).toContain('@keyframes minimal-swap-left');
    expect(pageStyles).toContain('@keyframes minimal-dot');
    expect(pageStyles).toContain('@keyframes filter-sheet-enter');
    expect(monthStyles).toContain('@keyframes click-locate');
    expect(monthTemplate).toContain("{{item.isSelected ? 'is-selected' : ''}}");
    expect(monthStyles).toMatch(
      /\.calendar-cell-slot\.is-selected::after\s*{[^}]*right:\s*-1px;[^}]*bottom:\s*-1px;[^}]*border:\s*2px solid var\(--ui-color-primary\);/s,
    );
    expect(cellStyles).not.toContain('.calendar-cell.is-selected::after');
    expect(pageSource).toContain("? 'offline' : 'ready'");
    expect(pageSource).not.toContain('activeResult.calendar.assignments.length === 0');
    expect(pageSource).toContain('commitPeriodShift');
    expect(pageSource).not.toContain('recenterPeriodSwiper');
    expect(pageSource).toContain('[-2, -1, 0, 1, 2]');
    expect(pageSource).toContain('function applyMonthWindow(');
    expect(template).toContain('class="list-panel-scroll"');
    expect(template).toContain('scroll-into-view="{{listScrollTarget}}"');
    expect(template).not.toContain('月份工具栏固定 · 已按日期排序');
    expect(template).toContain('class="week-duty-name"');
    expect(template).toContain('class="week-shift-badge"');
    expect(template).toContain('class="list-day-card');
    expect(template).toContain('class="list-duty-details"');
    expect(template).toContain('class="list-call-action"');
    expect(template).toContain("activeWorkspace === 'calendar' ? '日历'");
    expect(template).toContain("filterDropdownDirection === 'up'");
    expect(pageStyles).toMatch(/\.view-controls\s*{[^}]*position:\s*relative;/s);
    expect(pageStyles).not.toMatch(/\.view-controls\s*{[^}]*position:\s*sticky;/s);
    expect(pageStyles).toMatch(/\.workbench-content\.is-list-mode\s*{[^}]*height:\s*100%;/s);
    expect(pageStyles).toMatch(/\.list-panel-scroll\s*{[^}]*height:\s*100%;/s);
    expect(pageStyles).toMatch(
      /\.list-swiper\s*{[^}]*overflow:\s*hidden;[^}]*background:\s*var\(--ui-color-background\);/s,
    );
    expect(pageStyles).toMatch(
      /\.list-calendar-heading\s*{[^}]*position:\s*relative;[^}]*z-index:\s*3;/s,
    );
    expect(pageStyles).not.toMatch(/\.list-calendar-heading\s*{[^}]*box-shadow:\s*none;/s);
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

  it('mounts the current-group notification center in the shared swipe-dismiss Sheet', () => {
    const pageConfig = JSON.parse(readSource('pages/workbench/index.json'));
    const template = readSource('pages/workbench/index.wxml');
    const pageSource = readSource('pages/workbench/index.ts');
    const pageStyles = readSource('pages/workbench/index.wxss');

    expect(pageConfig.usingComponents).toMatchObject({
      'notifications-panel': '/subpackages/insights/components/notifications-panel/index',
      'ui-sheet': '/components/ui/ui-sheet/index',
    });
    expect(pageConfig.componentPlaceholder).toMatchObject({
      'notifications-panel': 'view',
    });
    expect(template).toContain('class="notification-dot"');
    expect(template).toContain('notificationUnreadCount > 0');
    expect(template).toContain('visible="{{notificationSheetOpen}}"');
    expect(template).toContain('title="通知中心"');
    expect(template).toContain('swipe-dismiss="{{true}}"');
    expect(template).toContain('embedded="{{true}}"');
    expect(template).toContain('group-id="{{currentGroupId}}"');
    expect(template).toContain('bind:unreadchanged="handleNotificationUnreadChanged"');
    expect(pageSource).not.toContain('通知功能将在后续阶段开放。');
    expect(pageSource).toContain('NOTIFICATION_POLL_INTERVAL_MS = 60_000');
    expect(pageSource).toContain('notificationClient.unreadCount(groupId)');
    expect(pageStyles).toMatch(
      /\.notification-dot\s*\{[^}]*background:\s*var\(--ui-color-danger\);/su,
    );
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

    const mixedAllDayView = createWorkbenchViewModel(
      {
        ...calendarApiGoldenResponse,
        assignments: [
          { ...calendarApiGoldenResponse.assignments[0], shiftTypeAbbreviation: '全天' },
          {
            ...calendarApiGoldenResponse.assignments[0],
            businessDate: '2026-08-23',
            id: 'assignment-2',
            shiftTypeAbbreviation: '全',
          },
        ],
      },
      holidayApiGoldenResponse,
      '2026-08-22',
      '2026-08',
      '2026-08-17',
    );
    expect(
      mixedAllDayView.weekPanels[1]?.days.flatMap((day) =>
        day.duties.map((duty) => duty.shiftAbbreviation),
      ),
    ).toEqual(['全', '全']);

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
