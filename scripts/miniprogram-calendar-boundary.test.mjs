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
    expect(wxml).toContain('viewModel.');
    expect(wxml).toContain('calendar-grid');
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
    expect(wxml).not.toMatch(/enhanced=|show-scrollbar=/gu);
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
    expect(assignmentRowWxml).not.toMatch(
      /assignment\.roleName|assignment\.timeRange|assignment\.phoneActions/gu,
    );
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
});
