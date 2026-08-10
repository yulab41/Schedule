import { describe, expect, it } from 'vitest';

import {
  goldenHolidays,
  getGoldenCalendar,
  goldenCalendar,
  goldenToday,
} from './calendar-golden-data.js';
import {
  buildCalendarMonthViewModel,
  createCalendarMonthStateViewModel,
} from './calendar-view-model.js';
import {
  buildCalendarSurfaceViewModel,
  findCalendarPhoneAction,
  recenterCalendarMonthSlots,
} from './calendar-surface.js';

const august = buildCalendarMonthViewModel({
  calendar: getGoldenCalendar('2026-08'),
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

describe('calendar renderer surfaces', () => {
  it('builds month, list, and cross-month week surfaces', () => {
    expect(
      buildCalendarSurfaceViewModel({
        businessMonth: '2026-08',
        mode: 'month',
        monthSlots: [{ businessMonth: '2026-08', viewModel: august }],
        weekStart: '2026-08-03',
      }),
    ).toMatchObject({ kind: 'month', month: { businessMonth: '2026-08' } });
    const list = buildCalendarSurfaceViewModel({
      businessMonth: '2026-08',
      mode: 'list',
      monthSlots: [{ businessMonth: '2026-08', viewModel: august }],
      weekStart: '2026-08-03',
    });
    expect(list.kind).toBe('list');
    if (list.kind === 'list') {
      expect(list.days.map(({ businessDate }) => businessDate)).toEqual(
        [...new Set(goldenCalendar.assignments.map(({ businessDate }) => businessDate))].sort(),
      );
    }
    const week = buildCalendarSurfaceViewModel({
      businessMonth: '2026-08',
      mode: 'week',
      monthSlots: [
        { businessMonth: '2026-08', viewModel: august },
        { businessMonth: '2026-09', viewModel: september },
      ],
      weekStart: '2026-08-31',
    });
    expect(week).toMatchObject({ kind: 'week', weekStart: '2026-08-31' });
    expect(
      findCalendarPhoneAction([{ businessMonth: '2026-08', viewModel: august }], 'missing'),
    ).toBeUndefined();
  });

  it('retains already loaded slots when navigation re-centers the three-month window', () => {
    const july = buildCalendarMonthViewModel({
      calendar: getGoldenCalendar('2026-07'),
      filters: {},
      holidays: goldenHolidays,
      status: 'ready',
      today: goldenToday,
    });
    const slots = [
      { businessMonth: '2026-07', viewModel: july },
      { businessMonth: '2026-08', viewModel: august },
      { businessMonth: '2026-09', viewModel: september },
    ] as const;

    const next = recenterCalendarMonthSlots(slots, ['2026-08', '2026-09', '2026-10']);

    expect(next[0]).toBe(slots[1]);
    expect(next[1]).toBe(slots[2]);
    expect(next[2]).toEqual({
      businessMonth: '2026-10',
      viewModel: createCalendarMonthStateViewModel('2026-10', 'loading'),
    });
  });
});
