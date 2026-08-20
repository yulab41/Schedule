import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const calendarView = read('../../views/calendar/CalendarView.vue');
const groupSetup = read('../groups/GroupSetupPanel.vue');
const apiClient = read('../../api/client.ts');

describe('calendar preferences production wiring', () => {
  it('loads effective preferences and applies the default shift only to month data', () => {
    expect(calendarView).toContain('api.getCalendarPreferences(props.group.id)');
    expect(calendarView).toContain('const monthVisibleAssignments = computed');
    expect(calendarView).toContain('effectiveMonthShiftTypeId');
    expect(calendarView).toContain(':assignments="monthVisibleAssignments"');
    expect(calendarView).toContain(':assignments="visibleAssignments"');
  });

  it('offers group-admin defaults and personal overrides in group settings', () => {
    expect(groupSetup).toContain('群组日历默认设置');
    expect(groupSetup).toContain('我的日历偏好');
    expect(groupSetup).toContain('updateGroupCalendarDefaults');
    expect(groupSetup).toContain('updateMyCalendarPreferences');
    expect(apiClient).toContain('/calendar-preferences`');
    expect(apiClient).toContain('/calendar-settings`');
    expect(apiClient).toContain('/calendar-preferences/mine`');
  });
});

function read(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}
