import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { buildMonthDisplayGrid } from '../../features/calendar/month-grid-presentation.js';

function readSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

const selectedDateDetails = readSource('../../features/calendar/SelectedDateDutyDetails.vue');
const ui2MonthCalendar = readSource('../../stories/ui2/Ui2MonthCalendar.vue');

describe('mobile calendar Storybook 2 parity', () => {
  it('builds six complete weeks with labelled adjacent-month dates', () => {
    const weeks = buildMonthDisplayGrid('2026-08');
    const cells = weeks.flat();

    expect(weeks).toHaveLength(6);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(cells[0]).toEqual({ businessDate: '2026-07-27', isOutsideMonth: true });
    expect(cells[5]).toEqual({ businessDate: '2026-08-01', isOutsideMonth: false });
    expect(cells.at(-1)).toEqual({ businessDate: '2026-09-06', isOutsideMonth: true });
  });

  it('uses only the weeks needed while keeping every displayed week complete', () => {
    const weeks = buildMonthDisplayGrid('2026-09');
    const cells = weeks.flat();

    expect(weeks).toHaveLength(5);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(cells[0]).toEqual({ businessDate: '2026-08-31', isOutsideMonth: true });
    expect(cells[1]).toEqual({ businessDate: '2026-09-01', isOutsideMonth: false });
    expect(cells.at(-1)).toEqual({ businessDate: '2026-10-04', isOutsideMonth: true });
  });

  it('uses the Storybook segmented toolbar and filter metrics', () => {
    const calendarView = readSource('./CalendarView.vue');

    expect(calendarView).toContain('class="view-mode-switch"');
    expect(calendarView).toContain('role="tablist"');
    expect(calendarView).toContain('class="view-mode-button"');
    expect(calendarView).toContain('class="mobile-filter-trigger"');
    expect(calendarView).toMatch(
      /\.view-mode-switch\s*{[^}]*padding:\s*3px;[^}]*background:\s*#e8edf3;[^}]*border-radius:\s*var\(--ui-radius-medium\);/s,
    );
    expect(calendarView).toMatch(
      /\.view-mode-button\s*{[^}]*min-height:\s*44px;[^}]*font-size:\s*13px;/s,
    );
    expect(calendarView).toMatch(
      /\.mobile-filter-trigger\s*{[^}]*min-height:\s*44px;[^}]*border-radius:\s*var\(--ui-radius-medium\);[^}]*font-size:\s*13px;/s,
    );
  });

  it('fixes mobile month cells to the Storybook square ratio and fills the weekday rail', () => {
    const monthGrid = readSource('../../features/calendar/MonthGrid.vue');

    expect(monthGrid).toContain("'is-outside-month': cell.isOutsideMonth");
    expect(monthGrid).toContain(':disabled="cell.isOutsideMonth"');
    expect(monthGrid).toMatch(
      /@media \(max-width: 640px\)[\s\S]*?\.weekday-row\s*{[^}]*height:\s*28px;[^}]*background:\s*#f8fafc;/s,
    );
    expect(monthGrid).toMatch(
      /@media \(max-width: 640px\)[\s\S]*?\.day-cell\s*{[^}]*aspect-ratio:\s*1\s*\/\s*1;[^}]*min-height:\s*0;/s,
    );
  });

  it('fades adjacent-month weekday and weekend dates together', () => {
    const monthGrid = readSource('../../features/calendar/MonthGrid.vue');
    const desktopStyles = monthGrid.slice(
      monthGrid.indexOf('<style scoped>'),
      monthGrid.indexOf('@media (max-width: 640px)'),
    );

    expect(desktopStyles).toMatch(
      /\.day-cell\.is-outside-month \.day-number,\s*\.month-grid\.invert-past-colors \.day-cell\.is-outside-month \.day-number\s*{[^}]*color:\s*#c2c9d1;/s,
    );
    expect(desktopStyles).toMatch(
      /\.day-cell\.is-outside-month\.is-weekend \.day-number,\s*\.month-grid\.invert-past-colors \.day-cell\.is-outside-month\.is-weekend \.day-number\s*{[^}]*color:\s*#ef9f9f;/s,
    );
    expect(ui2MonthCalendar).toMatch(
      /\.calendar-cell\.is-dimmed \.date-number\s*{[^}]*color:\s*#c2c9d1;/s,
    );
    expect(ui2MonthCalendar).toMatch(
      /\.calendar-cell\.is-dimmed\.is-weekend \.date-number\s*{[^}]*color:\s*#ef9f9f;/s,
    );
  });

  it('uses one shared separator plane between the weekday rail and the month grid', () => {
    const monthGrid = readSource('../../features/calendar/MonthGrid.vue');
    const mobileStyles = monthGrid.match(
      /@media \(max-width: 640px\)\s*{([\s\S]*?)\n}\n\n@media \(prefers-reduced-motion:/,
    )?.[1];

    expect(mobileStyles).toBeDefined();
    expect(mobileStyles).toMatch(
      /\.month-grid\s*{[^}]*gap:\s*1px;[^}]*background:\s*var\(--ui-color-border\);[^}]*border:\s*1px solid var\(--ui-color-border\);/s,
    );
    expect(mobileStyles).not.toMatch(
      /\.weekday-row\s*{[^}]*border-bottom:\s*1px solid var\(--ui-color-border\);/s,
    );
  });

  it('rounds only the selected corner frame while the moving month cells stay square', () => {
    const monthGrid = readSource('../../features/calendar/MonthGrid.vue');

    expect(monthGrid).not.toMatch(
      /\.week-row:last-child \.day-cell:first-child\s*{[^}]*border-bottom-left-radius:/s,
    );
    expect(monthGrid).toMatch(
      /\.week-row:last-child \.day-cell:first-child\.is-selected::after\s*{[^}]*border-bottom-left-radius:\s*calc\(var\(--ui-radius-large\) - 1px\);/s,
    );
    expect(monthGrid).toMatch(
      /\.week-row:last-child \.day-cell:last-child\.is-selected::after\s*{[^}]*border-bottom-right-radius:\s*calc\(var\(--ui-radius-large\) - 1px\);/s,
    );
  });

  it('keeps the calendar/details stack start-aligned with the existing fixed spacing', () => {
    const calendarView = readSource('./CalendarView.vue');

    expect(calendarView).toMatch(
      /\.calendar-view\s*{[^}]*display:\s*grid;[^}]*gap:\s*12px;[^}]*align-content:\s*start;/s,
    );
    expect(selectedDateDetails).toMatch(
      /\.selected-date-details\s*{[^}]*margin-top:\s*var\(--ui-spacing-lg\);/s,
    );
    expect(selectedDateDetails).toMatch(
      /@media \(max-width: 640px\)[\s\S]*?\.selected-date-details\s*{[^}]*margin-top:\s*12px;/s,
    );
  });

  it('uses the exact Storybook bell silhouette and notification dot treatment', () => {
    const notificationBell = readSource('../../features/notifications/NotificationBell.vue');
    const actionIcon = readSource('../../components/LucideMinimalActionIcon.vue');

    expect(actionIcon).toContain('d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"');
    expect(actionIcon).toContain('d="M10 21h4"');
    expect(notificationBell).toContain('name="bell"');
    expect(notificationBell).toContain('v-if="unreadCount > 0" class="notification-dot"');
    expect(notificationBell).toMatch(
      /\.notification-trigger\s*{[^}]*width:\s*44px;[^}]*height:\s*44px;[^}]*background:\s*var\(--ui-color-background\);[^}]*border:\s*0;[^}]*border-radius:\s*15px;/s,
    );
  });
});
