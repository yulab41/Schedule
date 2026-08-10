import { describe, expect, it } from 'vitest';

import {
  goldenHolidays,
  getGoldenCalendar,
  goldenCalendar,
  goldenToday,
} from './calendar-golden-data.js';
import { buildCalendarMonthViewModel } from './calendar-view-model.js';
import { buildCalendarSurfaceViewModel, findCalendarPhoneAction } from './calendar-surface.js';

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
});
