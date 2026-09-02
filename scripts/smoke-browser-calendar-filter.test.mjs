import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

function source(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

describe('browser smoke calendar filter gate', () => {
  it('accepts the explicit empty-month state instead of waiting for conditional selects', () => {
    const smoke = source('./smoke-browser.mjs');
    const calendarView = source('../apps/web/src/views/calendar/CalendarView.vue');

    expect(calendarView).toContain('v-if="roleOptions.length > 0"');
    expect(calendarView).toContain('v-if="shiftTypeOptions.length > 0"');
    expect(calendarView).toContain('v-if="memberOptions.length > 0"');
    expect(smoke).toContain('async function assertCalendarFilterSheetControls');
    expect(smoke).toContain('.day-cell:not([data-outside-month="true"]) .day-select-button');
    expect(smoke).toContain('[aria-label$="，暂无排班"]');
    expect(smoke).toContain("assertSelectPopupInsideSheet(filterSheet, '手机月历筛选')");
    expect(smoke).toContain('async function assertSelectedDateDutyDetails');
    expect(smoke).toContain('当日暂无符合当前筛选条件的排班。');
    expect(smoke).toContain('async function assertAssignmentEventSheet');
    expect(smoke).toContain('const populatedMonthDate');
    expect(smoke.indexOf('[data-wheel-value="8"]')).toBeLessThan(
      smoke.indexOf('await assertAssignmentEventSheet(page, dutyDetails)'),
    );
    expect(smoke).toContain('async function selectStatisticsFixtureMonth');
    expect(smoke).toContain('await selectStatisticsFixtureMonth(page)');
    expect(smoke).toContain("'.member-statistics-table tbody tr td:not([colspan])'");
  });
});
