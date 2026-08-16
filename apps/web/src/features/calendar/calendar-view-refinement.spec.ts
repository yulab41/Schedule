import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

describe('formal calendar view refinement', () => {
  it('keeps the week view as a seven-column calendar surface with content-driven height', () => {
    const weekGrid = readSource('./WeekGrid.vue');
    const calendarView = readSource('../../views/calendar/CalendarView.vue');

    expect(weekGrid).toContain('const weekCardHeight = computed(() =>');
    expect(weekGrid).toContain('weekCardHeight}px');
    expect(weekGrid).toContain('class="weekday-row"');
    expect(weekGrid).toContain('class="day-cell"');
    expect(weekGrid).toContain('contact-mode="hidden"');
    expect(weekGrid).toContain('compact-shift-badge');
    expect(weekGrid).toMatch(/\.week-row\s*{[^}]*gap:\s*1px/s);
    expect(weekGrid).toMatch(/\.day-cell\s*{[^}]*border:\s*0;[^}]*border-radius:\s*0;/s);
    expect(calendarView).toContain('class="week-calendar-card"');
    expect(calendarView).toContain('getWeekBusinessMonths(weekStart.value)');
    expect(calendarView).not.toContain('syncMonthToWeek');
    expect(calendarView).toMatch(
      /<section v-if="viewMode === 'week'" class="week-calendar-card">[\s\S]*class="week-navigation"[\s\S]*<WeekGrid/s,
    );
    expect(weekGrid).toMatch(
      /@media \(max-width: 640px\)[\s\S]*?\.week-row\s*{[^}]*grid-template-columns:\s*repeat\(7,\s*minmax\(0,\s*1fr\)\)/s,
    );
    expect(weekGrid).not.toMatch(
      /@media \(max-width: 640px\)[\s\S]*?\.week-row\s*{[^}]*grid-template-columns:\s*1fr/s,
    );
  });

  it('selects a week day and renders the existing detail track below it', () => {
    const weekGrid = readSource('./WeekGrid.vue');
    const calendarView = readSource('../../views/calendar/CalendarView.vue');

    expect(weekGrid).toContain("(event: 'select-date', businessDate: string)");
    expect(weekGrid).toContain('@click="selectDate(date)"');
    expect(calendarView).toContain('@select-date="selectedDate = $event"');
    expect(calendarView).toContain("viewMode === 'month' || viewMode === 'week'");
    expect(calendarView).toContain('selectedDate !== undefined');
    expect(calendarView).toContain("viewMode.value !== 'week' || selectedDate.value === undefined");
    expect(calendarView).toContain('selectedDate.value = weekStart.value;');
  });

  it('keeps week selection inside rounded corners and marks today only on its date number', () => {
    const weekGrid = readSource('./WeekGrid.vue');

    expect(weekGrid).toMatch(
      /\.week-row \.day-cell:first-child\s*{[^}]*border-bottom-left-radius:\s*calc\(var\(--ui-radius-large\) - 1px\);/s,
    );
    expect(weekGrid).toMatch(
      /\.week-row \.day-cell:last-child\s*{[^}]*border-bottom-right-radius:\s*calc\(var\(--ui-radius-large\) - 1px\);/s,
    );
    expect(weekGrid).not.toMatch(/\.day-cell\.is-today\s*{[^}]*box-shadow:/s);
    expect(weekGrid).toMatch(/\.is-today \.day-number\s*{[^}]*background:/s);
  });

  it('adds frozen month controls to the list view', () => {
    const calendarView = readSource('../../views/calendar/CalendarView.vue');
    const listGrid = readSource('./ListGrid.vue');
    const dutyCell = readSource('./DutyCell.vue');

    expect(calendarView).toContain('class="list-sticky-toolbar"');
    expect(calendarView).toContain('aria-label="上一月"');
    expect(calendarView).toContain('aria-label="定位到今天"');
    expect(calendarView).toContain('aria-label="下一月"');
    expect(listGrid).toContain('contact-mode="button"');
    expect(listGrid).toContain('show-details');
    expect(listGrid).toContain('{{ day.assignments.length }} 班');
    expect(listGrid).toContain("'is-today': day.isToday");
    expect(dutyCell).toContain('class="duty-details"');
    expect(dutyCell).toContain('formatShiftTimeRange(props.assignment)');
    expect(dutyCell).toMatch(/\.change-marker-list\s*{[^}]*display:\s*contents;/s);
    expect(dutyCell).toMatch(
      /\.duty-cell\.contact-button \.change-marker-list\s*{[^}]*display:\s*inline-flex;/s,
    );
    expect(calendarView).toContain('月份工具栏固定 · 已按日期排序');
    expect(calendarView).toContain("今天 · {{ todayBusinessDate.slice(5).replace('-', '/') }}");
  });

  it('keeps the locator transparent without a persistent click state', () => {
    const calendarView = readSource('../../views/calendar/CalendarView.vue');

    expect(calendarView).toContain('class="calendar-locator"');
    expect(calendarView).toContain('class="locator-crosshair-center"');
    expect(calendarView).toMatch(
      /\.calendar-locator\s*{[^}]*background:\s*transparent;[^}]*border:\s*0;[^}]*box-shadow:\s*none;/s,
    );
    expect(calendarView).not.toMatch(/\.calendar-locator:active/);
    expect(calendarView).not.toContain('is-pulsing');
  });
});
