import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const miniprogramRoot = path.join(repositoryRoot, 'apps', 'miniprogram');

function readText(relativePath) {
  return readFileSync(path.join(miniprogramRoot, relativePath), 'utf8');
}

function resolveTypeScriptImport(sourcePath, specifier) {
  if (!specifier.startsWith('.')) {
    return undefined;
  }
  const unresolved = path.resolve(path.dirname(sourcePath), specifier);
  const candidates = [
    unresolved,
    unresolved.replace(/\.js$/u, '.ts'),
    `${unresolved}.ts`,
    path.join(unresolved, 'index.ts'),
  ];
  return candidates.find((candidate) => existsSync(candidate));
}

function collectProductionDependencyGraph(entryRelativePaths) {
  const pending = entryRelativePaths.map((entry) => path.join(miniprogramRoot, entry));
  const visited = new Set();
  const importPattern =
    /(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"](\.[^'"]+)['"]/gu;
  while (pending.length > 0) {
    const sourcePath = pending.pop();
    if (sourcePath === undefined || visited.has(sourcePath)) {
      continue;
    }
    visited.add(sourcePath);
    const source = readFileSync(sourcePath, 'utf8');
    for (const match of source.matchAll(importPattern)) {
      const resolved = resolveTypeScriptImport(sourcePath, match[1]);
      if (resolved !== undefined && resolved.startsWith(miniprogramRoot)) {
        pending.push(resolved);
      }
    }
  }
  return [...visited];
}

function declarationsFor(source, selector) {
  const rules = [...source.matchAll(/([^{}]+)\{([^{}]*)\}/gu)].filter((match) =>
    match[1]
      .split(',')
      .map((value) => value.trim())
      .includes(selector),
  );
  if (rules.length === 0) {
    throw new Error(`expected CSS rule for ${selector}`);
  }
  return rules.map((rule) => rule[2]).join('\n');
}

describe('mini-program calendar VM boundary', () => {
  it('renders only view-model fields and keeps Skyline page-level', () => {
    const wxml = readText('pages/calendar/index.wxml');
    const page = readText('pages/calendar/index.ts');
    const config = readText('config/index.ts');
    const projectConfig = readText('project.config.json');
    const wxss = readText('pages/calendar/index.wxss');
    const gridWxss = readText('components/calendar-grid/index.wxss');
    const assignmentRowWxss = readText('components/assignment-row/index.wxss');
    const markerBadgeWxss = readText('components/marker-badge/index.wxss');
    const markerBadgeWxml = readText('components/marker-badge/index.wxml');
    const holidayTagWxss = readText('components/holiday-tag/index.wxss');
    const assignmentRowWxml = readText('components/assignment-row/index.wxml');
    const dateDetailSheetWxml = readText('components/date-detail-sheet/index.wxml');
    const pageJson = readText('pages/calendar/index.json');
    expect(wxml).toContain('viewModel.');
    expect(wxml).toContain('calendar-grid');
    expect(wxml).toContain('calendar-week');
    expect(wxml).toContain('calendar-list');
    expect(wxml).toContain('bindchange="handleSwiperChange"');
    expect(wxml).toContain('monthSlots');
    expect(wxml).toContain('cacheNotice');
    expect(page).toContain('rotateMonthSlots');
    expect(page).toContain('recenterMonthSlots');
    expect(page).toContain('swiperLocked');
    expect(page).toContain('navigationEpoch');
    expect(wxml).toContain('bind:route="handleRouteAction"');
    expect(wxml).not.toMatch(
      /actualMemberName|plannedMemberName|changeMarkers|shiftTypeColor|shiftTypeTextColor|eventId|deduction/gu,
    );
    expect(page).toContain('createCalendarPageController');
    expect(page).toContain('resolveCalendarRouteAction');
    expect(page).toContain('activeRole');
    expect(page).not.toMatch(
      /calendar-(?:dev-fixture|golden-data)|calendarFixture|goldenToday|isUsingCalendarDevFixture|createCalendarDevFixtureDependencies/gu,
    );
    expect(config).not.toMatch(/calendarFixtureInDevtools|mockMode\s*:\s*true/gu);
    expect(projectConfig).toMatch(/"ignoreUploadUnusedFiles"\s*:\s*true/gu);
    expect(page).not.toMatch(/Promise\.all|requestGeneration|lastSuccessfulKey|inFlight/gu);
    expect(readText('pages/calendar/index.json')).toMatch(/"renderer"\s*:\s*"skyline"/u);
    expect(readText('pages/calendar/index.json')).not.toContain('t-calendar');
    expect(wxml).not.toMatch(/<(?!swiper\b)[^>]*\benhanced\s*=/gu);
    expect(wxml).not.toMatch(/show-scrollbar=/gu);
    expect(pageJson).toContain('calendar-week');
    expect(pageJson).toContain('calendar-list');
    expect(wxss).toContain('.calendar-page__toolbar');
    expect(wxss).toContain('flex: 0 0 auto');
    expect(wxss).toContain('margin: 0');
    expect(wxss).toContain('width: 128rpx');
    expect(wxss).toContain('white-space: nowrap');
    expect(wxss).toContain('display: flex');
    expect(wxss).toContain('display: block');
    expect(wxss).not.toMatch(/constant\(|display:\s*grid|place-items|:focus/gu);

    const flexContracts = [
      [wxss, '.calendar-page__toolbar'],
      [wxss, '.calendar-page__filters'],
      [wxss, '.calendar-page__switch-label'],
      [gridWxss, '.calendar-grid__weekday-row'],
      [gridWxss, '.calendar-grid__week'],
      [gridWxss, '.calendar-grid__day-header'],
      [assignmentRowWxss, '.assignment-row__meta'],
      [assignmentRowWxss, '.assignment-row__markers'],
    ];
    for (const [source, selector] of flexContracts) {
      const declarations = declarationsFor(source, selector);
      expect(declarations).toMatch(/display:\s*flex;/u);
      expect(declarations).toMatch(/flex-direction:\s*row;/u);
    }
    expect(declarationsFor(wxss, '.calendar-page__toolbar')).toMatch(/flex-wrap:\s*nowrap;/u);

    expect(wxml).toContain('hover-class="calendar-page__month-action--pressed"');
    expect(wxml).toContain('hover-class="calendar-page__retry--pressed"');
    expect(assignmentRowWxml).toContain('assignment.compactShiftLabel');
    expect(assignmentRowWxml).toContain('assignment.memberName');
    expect(markerBadgeWxml).toContain('catchtap="handleRoute"');
    expect(markerBadgeWxml).not.toContain('<button');
    expect(assignmentRowWxml).toContain('wx:if="{{showDetails}}"');
    expect(assignmentRowWxml).toContain('assignment.roleName');
    expect(assignmentRowWxml).toContain('assignment.timeRange');
    expect(assignmentRowWxml).toContain('showPhones');
    expect(assignmentRowWxml).toContain('assignment.phoneActions');
    expect(dateDetailSheetWxml).toContain('show-phones="{{true}}"');
    expect(declarationsFor(wxss, '.calendar-page__month-action--pressed')).toMatch(
      /opacity:\s*0\.72;/u,
    );
    expect(declarationsFor(wxss, '.calendar-page__retry--pressed')).toMatch(/opacity:\s*0\.72;/u);
    for (const source of [wxss, gridWxss, assignmentRowWxss, markerBadgeWxss, holidayTagWxss]) {
      expect(source).not.toMatch(/:(?!first-child\b|last-child\b)[a-z-]+/gu);
    }
  });

  it('keeps test fixtures and identifying sample data out of the production dependency graph', () => {
    const productionSources = collectProductionDependencyGraph(['pages/calendar/index.ts']);
    const productionRelativePaths = productionSources.map((sourcePath) =>
      path.relative(miniprogramRoot, sourcePath).replaceAll('\\', '/'),
    );
    const productionText = [
      ...productionSources.map((sourcePath) => readFileSync(sourcePath, 'utf8')),
      readText('config/index.ts'),
    ].join('\n');
    const testFixture = readText('features/calendar/calendar-golden-data.ts');

    expect(productionRelativePaths).not.toContain('features/calendar/calendar-dev-fixture.ts');
    expect(productionRelativePaths).not.toContain('features/calendar/calendar-golden-data.ts');
    expect(productionText).not.toMatch(/calendarFixtureInDevtools|calendar-fixture-user/gu);
    expect(productionText).not.toMatch(/(?<!\d)1[3-9]\d{9}(?!\d)/gu);
    expect(productionText).not.toMatch(
      /\b[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}\b/giu,
    );
    expect(testFixture).not.toMatch(/(?<!\d)1[3-9]\d{9}(?!\d)/gu);
    expect(testFixture).not.toMatch(
      /\b[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}\b/giu,
    );
    const fixtureNames = [...testFixture.matchAll(/realName:\s*'([^']+)'/gu)].map(
      ([, realName]) => realName,
    );
    expect(fixtureNames.length).toBeGreaterThan(0);
    expect(fixtureNames.every((realName) => realName?.startsWith('测试成员') === true)).toBe(true);
  });

  it('does not synthesize unsupported marker contract fields', () => {
    expect(readText('features/calendar/calendar-view-model.ts')).not.toMatch(/eventId|deduction/gu);
  });

  it('keeps calendar-cache runtime dependencies within the mini-program bundle', () => {
    const calendarCache = readText('store/calendar-cache.ts');

    expect(calendarCache).not.toContain('../../../packages/contracts/src/');
  });

  it('keeps one keyed detail host and presentation-only detail bodies', () => {
    const page = readText('pages/calendar/index.ts');
    const pageWxml = readText('pages/calendar/index.wxml');
    const pageJson = readText('pages/calendar/index.json');
    const bottomSheet = readText('components/bottom-sheet/index.ts');
    const bottomSheetWxml = readText('components/bottom-sheet/index.wxml');
    const bottomSheetWxss = readText('components/bottom-sheet/index.wxss');
    const dateSheet = readText('components/date-detail-sheet/index.ts');
    const dutySheet = readText('components/duty-detail-sheet/index.ts');
    const eventSheet = readText('components/event-timeline-sheet/index.ts');
    const phoneSheet = readText('components/phone-sheet/index.ts');
    const routeForwarders = [
      readText('components/calendar-grid/index.ts'),
      readText('components/calendar-week/index.ts'),
      readText('components/calendar-list/index.ts'),
      dateSheet,
      dutySheet,
    ];

    expect(pageJson).toContain('bottom-sheet');
    expect(pageJson).toContain('date-detail-sheet');
    expect(pageJson).toContain('duty-detail-sheet');
    expect(pageJson).toContain('event-timeline-sheet');
    expect(pageJson).toContain('phone-sheet');
    expect(pageWxml.match(/<bottom-sheet\b/gu) ?? []).toHaveLength(1);
    const pageShellEnd = pageWxml.indexOf('</page-shell>');
    const bottomSheetStart = pageWxml.indexOf('<bottom-sheet');
    expect(pageShellEnd).toBeGreaterThanOrEqual(0);
    expect(bottomSheetStart).toBeGreaterThan(pageShellEnd);
    expect(pageWxml).toContain('bind:request-close="handleSheetRequestClose"');
    expect(pageWxml).toContain('bind:closed="handleSheetClosed"');
    expect(pageWxml).toContain('bind:dial="handleDial"');
    expect(pageWxml).toContain('bind:copy="handleCopy"');
    for (const tag of [
      'date-detail-sheet',
      'duty-detail-sheet',
      'event-timeline-sheet',
      'phone-sheet',
    ]) {
      expect(pageWxml).toContain(`<${tag}`);
    }
    expect(bottomSheet).toContain('request-close');
    expect(bottomSheet).toContain('closed');
    expect(bottomSheet).toContain('new WeakMap<object, BottomSheetInstanceRuntime>()');
    expect(bottomSheet).not.toMatch(
      /^let (?:transitionTimer|touchStart|touchStartedAt|ownsDrag)\b/gmu,
    );
    expect(bottomSheetWxml).toContain('<slot');
    expect(bottomSheetWxml).toMatch(
      /<scroll-view\b(?=[^>]*\bclass="bottom-sheet__content")(?=[^>]*\bscroll-y\b)[^>]*>/u,
    );
    expect(declarationsFor(bottomSheetWxss, '.bottom-sheet__content')).toMatch(
      /(?:^|\s)height:\s*62vh;/u,
    );
    for (const source of [dateSheet, dutySheet, eventSheet, phoneSheet]) {
      expect(source).not.toContain('bottom-sheet');
      expect(source).not.toContain('wx.');
      expect(source).not.toContain('request-close');
      expect(source).not.toContain("triggerEvent('closed'");
    }
    for (const source of routeForwarders) {
      expect(source).toContain('bubbles: true');
      expect(source).toContain('composed: true');
    }
    expect(phoneSheet).toContain('bubbles: true');
    expect(phoneSheet).toContain('composed: true');
    expect(page).toContain('createEventTimelineController');
    expect(page).toContain('openCalendarSheet');
    expect(page).toContain('completeCalendarSheetClose');
    expect(page).toContain('getCalendarSheetKind');
    expect(page).toContain('getCalendarSheetTitle');
    expect(page).toContain('resetSensitiveCalendarDetails');
    expect(page).toContain('resetCalendarContextData');
    expect(page).toMatch(/onHide\(\): void \{[\s\S]*?resetSensitiveCalendarDetails\(\)/u);
    expect(page).toMatch(/onUnload\(\): void \{[\s\S]*?controller\?\.dispose\(\)/u);
    expect(page).toMatch(/onShow\(\): void \{[\s\S]*?loadMonths\(true\)/u);
    expect(page).not.toMatch(
      /center\.status === 'cached'\s*&&\s*center\.cacheSavedAt !== undefined/u,
    );
    expect(page).toMatch(
      /resetSensitiveCalendarDetails\(\): void \{[\s\S]*?navigationEpoch \+= 1;[\s\S]*?swiperLocked = false/u,
    );
    expect(page).toMatch(
      /resetCalendarContextData\(\): void \{[\s\S]*?createCalendarMonthStateViewModel\(businessMonth, 'loading'\)/u,
    );
    expect(page.match(/listEvents\(/gu) ?? []).toHaveLength(1);
    expect(page).not.toContain('activeSheet');
    expect(page).not.toContain('openRoute');
    expect(pageWxml).not.toContain('<details');
  });

  it('keeps D4 navigation available around data states and uses explicit mobile multi-select', () => {
    const page = readText('pages/calendar/index.ts');
    const pageWxml = readText('pages/calendar/index.wxml');
    const pageJson = readText('pages/calendar/index.json');
    const filterWxml = readText('components/calendar-filter-sheet/index.wxml');
    const filterWxss = readText('components/calendar-filter-sheet/index.wxss');

    expect(pageJson).toContain('calendar-filter-sheet');
    expect(pageWxml).toContain('<calendar-filter-sheet');
    expect(pageWxml).toContain('bind:apply="handleFilterApply"');
    expect(pageWxml).toContain('options-ready="{{true}}"');
    expect(pageWxml).toContain('mode="date"');
    expect(pageWxml).toContain('fields="month"');
    expect(pageWxml).toContain('bindchange="handleMonthChange"');
    expect(pageWxml).toContain('bindtap="handleToday"');
    expect(pageWxml).toContain('bindtap="handleThisWeek"');
    expect(pageWxml).not.toMatch(
      /<picker[\s\S]*?viewModel\.filters\.(?:roles|shiftTypes|members)/gu,
    );
    expect(page).toContain('handleOpenFilter');
    expect(page).toContain('handleFilterApply');
    expect(page).toContain('goCalendarToBusinessMonth');
    expect(page).toContain('goCalendarToToday');
    expect(page).toContain('goCalendarToThisWeek');
    expect(page).not.toContain('parseSelectorPickerIndex');
    expect(page).toMatch(
      /updateNavigation\(next\): void \{[\s\S]*?navigationEpoch \+= 1;\s*this\.swiperLocked = false;\s*const months/u,
    );
    expect(page).toMatch(
      /handleViewModeTap\(event\): void \{[\s\S]*?navigationEpoch \+= 1;\s*this\.swiperLocked = false;\s*const state/u,
    );
    expect(page).toMatch(
      /applySlotUpdate\(update\): void \{[\s\S]*?const updateIsData = isDataViewModel\(update\.viewModel\)[\s\S]*?!updateIsData[\s\S]*?index === 1[\s\S]*?resetSensitiveCalendarDetails\(\)/u,
    );
    expect(page).toMatch(
      /const surfaceFilters = buildCalendarSurfaceFilters\([\s\S]*?presentation\.hasCalendarData[\s\S]*?getFilterOptions\(surfaceFilters, filterSheetKind\)[\s\S]*?getSelectedFilterIds\(surfaceFilters, filterSheetKind\)/u,
    );
    expect(page).toMatch(
      /handleFilterApply\(event\): void \{[\s\S]*?buildCalendarSurfaceFilters\([\s\S]*?getRequiredSurfaceMonths/u,
    );

    const navigation = pageWxml.indexOf('calendar-page__navigation');
    const dataState = pageWxml.indexOf("surface.kind === 'state'");
    expect(navigation).toBeGreaterThanOrEqual(0);
    expect(dataState).toBeGreaterThan(navigation);

    expect(filterWxml).toContain('bindinput="handleSearchInput"');
    expect(filterWxml).toContain('bindtap="handleSelectAll"');
    expect(filterWxml).toContain('bindtap="handleClearSelection"');
    expect(filterWxml).toContain('bindtap="handleApply"');
    expect(filterWxml).toContain('bindtap="handleCancel"');
    expect(filterWxml).toContain('aria-pressed="{{item.isSelected}}"');
    expect(filterWxss).toContain('min-height: var(--v3-touch-min)');
    expect(filterWxss).not.toMatch(/display:\s*grid|:focus/gu);
  });

  it('renders D4 empty states, complete details, and aggregated cache provenance', () => {
    const page = readText('pages/calendar/index.ts');
    const pageWxml = readText('pages/calendar/index.wxml');
    const assignmentRowWxml = readText('components/assignment-row/index.wxml');
    const dateWxml = readText('components/date-detail-sheet/index.wxml');
    const dutyWxml = readText('components/duty-detail-sheet/index.wxml');
    const weekWxml = readText('components/calendar-week/index.wxml');
    const weekWxss = readText('components/calendar-week/index.wxss');
    const listWxml = readText('components/calendar-list/index.wxml');

    expect(pageWxml).toContain('surface.emptyMessage');
    expect(readText('features/calendar/calendar-surface.ts')).toContain('@schedule/calendar-core');
    const coreSurface = readFileSync(
      path.join(repositoryRoot, 'packages', 'calendar-core', 'src', 'calendar-surface.ts'),
      'utf8',
    );
    expect(coreSurface).toContain('本月没有带变动标记的班次');
    expect(coreSurface).toContain('本月暂无已发布排班');
    expect(coreSurface).toContain('本周暂无已发布排班');
    expect(pageWxml).toContain('cacheNotice.savedAtText');
    expect(page).toContain('getCalendarCacheNoticeData');
    expect(page).not.toMatch(
      /const center = nextSlots\[1\]\.viewModel;[\s\S]*?center\.status === 'cached'/u,
    );

    expect(dateWxml).toContain('day.businessDate');
    expect(dateWxml).toContain('day.weekdayLabel');
    expect(dateWxml).not.toContain('星期{{day.weekdayLabel}}');
    expect(dateWxml).toContain('show-details="{{true}}"');
    expect(weekWxml).toContain('day.weekdayLabel');
    expect(weekWxml).toContain("day.isToday ? 'calendar-week__cell--today'");
    expect(weekWxml).toContain("day.isWeekend ? 'calendar-week__cell--weekend'");
    expect(weekWxml).toContain("day.isPast ? 'calendar-week__cell--past'");
    expect(weekWxml).not.toContain('hideShiftBadge="{{day.assignments.length === 1}}"');
    expect(declarationsFor(weekWxss, '.calendar-week__row')).toMatch(/flex-direction:\s*column;/u);
    expect(listWxml).toContain("day.isToday ? 'calendar-list__day--today'");
    expect(listWxml).toContain("day.isWeekend ? 'calendar-list__day--weekend'");
    expect(listWxml).toContain("day.isPast ? 'calendar-list__day--past'");
    expect(listWxml).toContain('今天');
    for (const field of [
      'assignment.roleName',
      'assignment.shiftTypeName',
      'assignment.shiftTypeAbbreviation',
      'assignment.timeRange',
    ]) {
      expect(assignmentRowWxml).toContain(field);
      expect(dutyWxml).toContain(field);
    }
  });
});
