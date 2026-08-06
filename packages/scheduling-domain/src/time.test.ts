import { describe, expect, it } from 'vitest';

import {
  getChinaStandardTimeBusinessDate,
  toChinaStandardTimeShiftRange,
  toChinaStandardTimeUtcTimestamp,
} from './time.js';

describe('China Standard Time schedule helpers', () => {
  it('stores a cross-day all-day assignment in UTC while retaining its CST business date', () => {
    const range = toChinaStandardTimeShiftRange({
      businessDate: '2028-02-29',
      crossesMidnight: true,
      endTime: '08:00',
      startTime: '08:00',
    });

    expect(range).toEqual({
      businessDate: '2028-02-29',
      endsAt: new Date('2028-03-01T00:00:00.000Z'),
      startsAt: new Date('2028-02-29T00:00:00.000Z'),
    });
    expect(getChinaStandardTimeBusinessDate(new Date('2028-02-29T16:00:00.000Z'))).toBe(
      '2028-03-01',
    );
  });

  it('rejects an invalid local date or a non-crossing shift that ends before it starts', () => {
    expect(() =>
      toChinaStandardTimeShiftRange({
        businessDate: '2026-02-30',
        crossesMidnight: false,
        endTime: '08:00',
        startTime: '08:00',
      }),
    ).toThrow('valid YYYY-MM-DD');
    expect(() =>
      toChinaStandardTimeShiftRange({
        businessDate: '2026-08-01',
        crossesMidnight: false,
        endTime: '07:00',
        startTime: '08:00',
      }),
    ).toThrow('after its start');
  });

  it('converts a China Standard Time date and time to the UTC instant', () => {
    expect(toChinaStandardTimeUtcTimestamp('2026-08-06', '00:00')).toEqual(
      new Date('2026-08-05T16:00:00.000Z'),
    );
    expect(toChinaStandardTimeUtcTimestamp('2026-08-06', '08:00')).toEqual(
      new Date('2026-08-06T00:00:00.000Z'),
    );
  });
});
