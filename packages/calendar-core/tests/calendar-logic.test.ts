import { describe, expect, it } from 'vitest';

import {
  addBusinessMonths,
  buildMonthGrid,
  filterCalendarAssignments,
  formatShiftTimeRange,
  getAvailablePhoneActions,
  getBusinessMonthLabel,
  getCalendarMarkerDescription,
  getCalendarMarkerLabel,
  getCurrentBusinessDate,
  getCurrentBusinessMonth,
  getDutyMemberName,
  getHolidayShortLabel,
  isPastBusinessDate,
  parseBusinessDate,
  parseBusinessMonth,
  sortCalendarAssignments,
} from '../src/index.js';
import { makeAssignment } from './fixtures.js';

describe('calendar core logic', () => {
  it('uses CST and rejects unreal dates and months', () => {
    expect(getCurrentBusinessDate(new Date('2026-07-31T16:00:00.000Z'))).toBe('2026-08-01');
    expect(getCurrentBusinessMonth(new Date('2026-07-31T16:00:00.000Z'))).toBe('2026-08');
    expect(addBusinessMonths('2026-01', -1)).toBe('2025-12');
    expect(addBusinessMonths('2026-12', 1)).toBe('2027-01');
    expect(getBusinessMonthLabel('2026-08')).toBe('2026年8月');
    expect(isPastBusinessDate('2026-08-03', '2026-08-04')).toBe(true);
    expect(() => parseBusinessMonth('2026-13')).toThrow();
    expect(() => parseBusinessMonth('2026-8')).toThrow();
    expect(() => parseBusinessDate('2026-02-29')).toThrow();
    expect(parseBusinessDate('2028-02-29')).toEqual({ day: 29, month: 2, year: 2028 });
  });

  it('builds immutable Monday-first seven-column grids across leap and six-week months', () => {
    const august = buildMonthGrid(2026, 8);
    expect(august[0]?.map((cell) => cell?.businessDate)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      '2026-08-01',
      '2026-08-02',
    ]);
    expect(august).toHaveLength(6);
    expect(august.every((week) => week.length === 7)).toBe(true);
    const leapDays = buildMonthGrid(2028, 2)
      .flat()
      .filter((cell) => cell !== null);
    expect(leapDays).toHaveLength(29);
    expect(leapDays.at(-1)?.businessDate).toBe('2028-02-29');
  });

  it('filters by all facets without mutating and treats actual membership as authoritative', () => {
    const source = Object.freeze([
      makeAssignment({
        actualMemberName: '',
        actualMembershipId: 'actual',
        changeMarkers: ['swap'],
        id: 'show',
      }),
      makeAssignment({ id: 'hide', scheduleRoleId: 'other', shiftTypeId: 'other-shift' }),
    ]);
    expect(
      filterCalendarAssignments(source, {
        membershipIds: ['actual'],
        onlyChanges: true,
        roleIds: ['role-1'],
        shiftTypeIds: ['shift-1'],
      }).map(({ id }) => id),
    ).toEqual(['show']);
    expect(filterCalendarAssignments(source, { membershipIds: ['member-1'] })).toEqual([source[1]]);
    expect(getDutyMemberName(source[0]!)).toBe('');
    expect(source.map(({ id }) => id)).toEqual(['show', 'hide']);
  });

  it('sorts stably with midnight last and does not mutate equal assignments', () => {
    const source = Object.freeze([
      makeAssignment({ id: 'first', startsAt: '2026-08-15T06:00:00+08:00' }),
      makeAssignment({ id: 'midnight', startsAt: '2026-08-15T00:00:00+08:00' }),
      makeAssignment({ id: 'later', startsAt: '2026-08-15T07:00:00+08:00' }),
      makeAssignment({ id: 'second', startsAt: '2026-08-15T06:00:00+08:00' }),
    ]);
    expect(sortCalendarAssignments(source).map(({ id }) => id)).toEqual([
      'first',
      'second',
      'later',
      'midnight',
    ]);
    expect(source.map(({ id }) => id)).toEqual(['first', 'midnight', 'later', 'second']);
    expect(formatShiftTimeRange(makeAssignment())).toBe('08:00–16:00');
  });

  it('preserves approved compact labels and phone confirmation actions', () => {
    expect(getHolidayShortLabel('劳动节')).toBe('五一');
    expect(getHolidayShortLabel('中国人民解放军建军纪念日')).toBe('中国');
    const markers = ['swap', 'leave-cover', 'overtime'] as const;
    expect(markers.map(getCalendarMarkerLabel)).toEqual(['换', '替', '加']);
    expect(markers.map(getCalendarMarkerDescription)).toEqual(['换班', '请假替班', '加班']);
    expect(getAvailablePhoneActions(undefined)).toEqual([]);
    expect(
      getAvailablePhoneActions({
        isConfirmed: false,
        membershipId: 'member',
        mobilePhone: 'SYNTHETIC',
        realName: '成员',
      }),
    ).toEqual([{ kind: 'copy', label: '长号', number: 'SYNTHETIC' }]);
  });
});
