import { describe, expect, it } from 'vitest';

import {
  getGoldenCalendar,
  goldenBusinessMonth,
  goldenCalendar,
  goldenCalendars,
  goldenEvents,
  goldenHolidays,
  goldenToday,
} from './calendar-golden-data.js';
import {
  buildCalendarMonthViewModel,
  type CalendarDayViewModel,
  type CalendarMonthDataViewModel,
} from './calendar-view-model.js';

function findDay(
  viewModel: CalendarMonthDataViewModel,
  businessDate: string,
): CalendarDayViewModel | undefined {
  return viewModel.weeks
    .flatMap(({ days }) => days)
    .find(
      (day): day is CalendarDayViewModel => day.kind === 'day' && day.businessDate === businessDate,
    );
}

describe('synthetic calendar golden data', () => {
  it('pins anonymous 2026 calendar, holiday, swap, and duty-adjustment samples', () => {
    const sourceSnapshot = JSON.stringify({ goldenCalendars, goldenEvents, goldenHolidays });
    const filters = { membershipIds: ['fixture-member-b'] };
    const filterSnapshot = JSON.stringify(filters);
    const august = buildCalendarMonthViewModel({
      calendar: goldenCalendar,
      filters: {},
      holidays: goldenHolidays,
      status: 'ready',
      today: goldenToday,
    });
    const september = buildCalendarMonthViewModel({
      calendar: getGoldenCalendar('2026-09'),
      filters: {},
      holidays: goldenHolidays,
      status: 'ready',
      today: goldenToday,
    });

    expect(august.status).toBe('ready');
    expect(september.status).toBe('ready');
    if (august.status !== 'ready' || september.status !== 'ready') {
      throw new Error('expected ready calendar view models');
    }
    expect(august.businessMonth).toBe(goldenBusinessMonth);
    expect(august.assignmentCount).toBe(32);
    expect(september.assignmentCount).toBe(30);
    expect(Object.keys(goldenCalendars)).toHaveLength(12);
    expect(getGoldenCalendar('2026-01')).toMatchObject({
      assignments: [],
      businessMonth: '2026-01',
      members: [],
    });
    expect(goldenHolidays).toMatchObject({ confirmed: true, year: 2026 });
    expect(goldenHolidays.dates).toHaveLength(39);
    expect(goldenHolidays.dates).toContainEqual(
      expect.objectContaining({ date: '2026-09-25', holidayName: '中秋节' }),
    );

    expect(findDay(august, '2026-08-08')?.assignments[0]).toMatchObject({
      actualMemberName: '测试成员己',
      markers: [{ type: 'swap' }],
      plannedMemberName: '测试成员丁',
    });
    expect(findDay(august, '2026-08-12')?.assignments[0]).toMatchObject({
      actualMemberName: '测试成员丙',
      markers: [{ type: 'overtime' }],
      plannedMemberName: '测试成员乙',
    });
    expect(findDay(august, '2026-08-15')?.assignments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          backgroundColor: '#1F5AA6',
          roleName: '测试一线',
          shiftTypeName: '测试全天班',
        }),
        expect.objectContaining({
          backgroundColor: '#C2410C',
          markers: [expect.objectContaining({ type: 'leave-cover' })],
          roleName: '测试二线',
          shiftTypeName: '测试晚班',
        }),
      ]),
    );
    const phoneActions = findDay(august, '2026-08-15')?.assignments.flatMap(
      ({ phoneActions: actions }) => actions,
    );
    expect(phoneActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'dial', number: 'FIXTURE-CONFIRMED-PHONE' }),
        expect.objectContaining({ kind: 'copy', number: 'SYNTHETIC-LONG-NUMBER' }),
      ]),
    );
    expect(findDay(september, '2026-09-16')?.assignments[0]).toMatchObject({
      actualMemberName: '测试成员乙',
      assignmentId: 'fixture-assignment-2026-09-16',
      markers: [{ type: 'swap' }],
      plannedMemberName: '测试成员丙',
      routeActionId: 'assignment:fixture-assignment-2026-09-16',
    });
    expect(findDay(september, '2026-09-20')?.holiday).toMatchObject({
      holidayName: '国庆节调休',
      isWorkday: true,
      label: '班',
      tone: 'workday',
    });
    expect(findDay(september, '2026-09-25')?.holiday).toMatchObject({
      holidayName: '中秋节',
      isOffDay: true,
      label: '中秋',
      tone: 'off-day',
    });
    expect(goldenEvents).toHaveLength(14);
    expect(goldenEvents.filter(({ eventType }) => eventType === 'swap_completed')).toHaveLength(3);
    expect(
      goldenEvents.filter(({ eventType }) => eventType === 'duty_adjustment_completed'),
    ).toHaveLength(3);
    expect(JSON.stringify(august)).not.toContain('deduction');
    expect(JSON.stringify(september)).not.toContain('eventId');

    buildCalendarMonthViewModel({
      calendar: goldenCalendar,
      filters,
      holidays: goldenHolidays,
      status: 'ready',
      today: goldenToday,
    });
    expect(JSON.stringify({ goldenCalendars, goldenEvents, goldenHolidays })).toBe(sourceSnapshot);
    expect(JSON.stringify(filters)).toBe(filterSnapshot);
  });
});
