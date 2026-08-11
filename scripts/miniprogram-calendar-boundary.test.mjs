import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const miniprogramRoot = path.join(repositoryRoot, 'apps', 'miniprogram');

function readText(relativePath) {
  return readFileSync(path.join(miniprogramRoot, relativePath), 'utf8');
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
    const calendarDevFixture = readText('features/calendar/calendar-dev-fixture.ts');
    const config = readText('config/index.ts');
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
    expect(page).toContain('createCalendarDevFixtureDependencies');
    expect(page).toContain('isUsingCalendarDevFixture');
    expect(calendarDevFixture).toContain("envVersion === 'develop'");
    expect(calendarDevFixture).not.toContain('wx.');
    expect(config).toContain('calendarFixtureInDevtools: true');
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
    expect(assignmentRowWxml).not.toMatch(/assignment\.roleName|assignment\.timeRange/gu);
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
    expect(page.match(/listEvents\(/gu) ?? []).toHaveLength(1);
    expect(page).not.toContain('activeSheet');
    expect(page).not.toContain('openRoute');
    expect(pageWxml).not.toContain('<details');
  });
});
