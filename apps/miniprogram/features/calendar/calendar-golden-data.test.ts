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

describe('calendar golden data', () => {
  it('pins all 2026 server calendar, holiday, swap, and duty-adjustment samples', () => {
    const sourceSnapshot = JSON.stringify({ goldenCalendars, goldenEvents, goldenHolidays });
    const filters = { membershipIds: ['eda3c420-b0e8-4d1a-b908-864eab403ae7'] };
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
    expect(august.assignmentCount).toBe(31);
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
      actualMemberName: '许少伟',
      markers: [{ type: 'swap' }],
      plannedMemberName: '林恩宇',
    });
    expect(findDay(august, '2026-08-12')?.assignments[0]).toMatchObject({
      actualMemberName: '黄耿杰',
      markers: [{ type: 'overtime' }],
      plannedMemberName: '洪晨善',
    });
    expect(findDay(september, '2026-09-16')?.assignments[0]).toMatchObject({
      actualMemberName: '洪晨善',
      assignmentId: '3da0f9ff-90ca-40db-8376-5dbdb0c7c708',
      markers: [{ type: 'swap' }],
      plannedMemberName: '黄耿杰',
      routeActionId: 'assignment:3da0f9ff-90ca-40db-8376-5dbdb0c7c708',
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
