import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { groupMemberships, groups } from '../src/index.js';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  fileURLToPath(new URL('../../../migrations/0043_calendar_preferences.sql', import.meta.url)),
  'utf8',
);
const journal = readFileSync(
  fileURLToPath(new URL('../../../migrations/meta/_journal.json', import.meta.url)),
  'utf8',
);

describe('calendar preference persistence schema', () => {
  it('adds group defaults and nullable membership overrides with safe defaults', () => {
    expect(migration).toContain('`default_calendar_view`');
    expect(migration).toContain("NOT NULL DEFAULT 'month'");
    expect(migration).toContain('`default_month_shift_type_id` CHAR(36) NULL');
    expect(migration).toContain('`calendar_view_override`');
    expect(migration).toContain('`month_shift_type_override_id` CHAR(36) NULL');
    expect(journal).toContain('0043_calendar_preferences');
  });

  it('keeps Drizzle types aligned with the migration', () => {
    expect(groups.defaultCalendarView.getSQLType()).toContain('enum');
    expect(groups.defaultMonthShiftTypeId.getSQLType()).toBe('char(36)');
    expect(groupMemberships.calendarViewOverride.getSQLType()).toContain('enum');
    expect(groupMemberships.monthShiftTypeOverrideId.getSQLType()).toBe('char(36)');
  });
});
