import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

describe('formal calendar view refinement', () => {
  it('keeps the week view as a seven-column rail with content-driven height', () => {
    const weekGrid = readSource('./WeekGrid.vue');

    expect(weekGrid).toContain('const weekCardHeight = computed(() =>');
    expect(weekGrid).toContain('weekCardHeight}px');
    expect(weekGrid).toContain('class="day-cell"');
    expect(weekGrid).toContain('contact-mode="hidden"');
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

  it('adds frozen month controls to the list view', () => {
    const calendarView = readSource('../../views/calendar/CalendarView.vue');
    const listGrid = readSource('./ListGrid.vue');

    expect(calendarView).toContain('class="list-sticky-toolbar"');
    expect(calendarView).toContain('aria-label="上一月"');
    expect(calendarView).toContain('aria-label="定位到今天"');
    expect(calendarView).toContain('aria-label="下一月"');
    expect(listGrid).toContain('contact-mode="button"');
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
