import { describe, expect, it } from 'vitest';

import {
  MAX_MANUAL_CELLS,
  MAX_MANUAL_DAYS,
  MAX_MANUAL_MEMBERS,
  getManualScheduleInclusiveDayCount,
  isManualScheduleDateRangeWithinLimit,
  isValidManualScheduleDate,
} from './manual-schedule-limits.js';

describe('manual schedule limits contract', () => {
  it('publishes the frozen member, day, and logical-cell limits', () => {
    expect(MAX_MANUAL_MEMBERS).toBe(20);
    expect(MAX_MANUAL_DAYS).toBe(30);
    expect(MAX_MANUAL_CELLS).toBe(600);
    expect(MAX_MANUAL_CELLS).toBe(MAX_MANUAL_MEMBERS * MAX_MANUAL_DAYS);
  });

  it('accepts only real calendar dates in strict YYYY-MM-DD form', () => {
    expect(isValidManualScheduleDate('2026-08-23')).toBe(true);
    expect(isValidManualScheduleDate('2028-02-29')).toBe(true);

    for (const invalid of [
      '2026-8-23',
      '2026-08-3',
      '2026-02-29',
      '2026-04-31',
      '2026-00-01',
      '2026-13-01',
      '0000-01-01',
      '0099-01-01',
      '0999-12-31',
      ' 2026-08-23',
      '2026-08-23T00:00:00Z',
    ]) {
      expect(isValidManualScheduleDate(invalid), invalid).toBe(false);
    }
  });

  it('counts both endpoints across month and leap-day boundaries', () => {
    expect(getManualScheduleInclusiveDayCount('2026-08-23', '2026-08-23')).toBe(1);
    expect(getManualScheduleInclusiveDayCount('2026-01-31', '2026-02-01')).toBe(2);
    expect(getManualScheduleInclusiveDayCount('2028-02-28', '2028-03-01')).toBe(3);
    expect(getManualScheduleInclusiveDayCount('2026-02-28', '2026-03-01')).toBe(2);
  });

  it('rejects invalid or reversed day-count inputs', () => {
    expect(() => getManualScheduleInclusiveDayCount('2026-02-29', '2026-03-01')).toThrow(
      'valid YYYY-MM-DD',
    );
    expect(() => getManualScheduleInclusiveDayCount('2026-03-02', '2026-03-01')).toThrow(
      'must not precede',
    );
  });

  it('accepts at most thirty inclusive days and fails closed otherwise', () => {
    expect(isManualScheduleDateRangeWithinLimit('2026-01-01', '2026-01-30')).toBe(true);
    expect(isManualScheduleDateRangeWithinLimit('2028-02-01', '2028-03-01')).toBe(true);
    expect(isManualScheduleDateRangeWithinLimit('2026-01-01', '2026-01-31')).toBe(false);
    expect(isManualScheduleDateRangeWithinLimit('2026-03-02', '2026-03-01')).toBe(false);
    expect(isManualScheduleDateRangeWithinLimit('2026-02-29', '2026-03-01')).toBe(false);
  });
});
