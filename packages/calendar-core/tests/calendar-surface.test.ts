import { describe, expect, it } from 'vitest';

import {
  buildCalendarMonthViewModel,
  buildCalendarCacheNotice,
  buildCalendarSurfaceViewModel,
  createCalendarMonthStateViewModel,
  findCalendarPhoneAction,
  recenterCalendarMonthSlots,
} from '../src/index.js';
import { calendarFixture, holidayFixture } from './fixtures.js';

function month(businessMonth: string) {
  const assignments = calendarFixture.assignments.map((assignment) => ({
    ...assignment,
    businessDate: `${businessMonth}-${assignment.businessDate.slice(-2)}`,
    endsAt: `${businessMonth}-${assignment.businessDate.slice(-2)}T16:00:00+08:00`,
    id: `${businessMonth}:${assignment.id}`,
    startsAt: `${businessMonth}-${assignment.businessDate.slice(-2)}T08:00:00+08:00`,
  }));
  return buildCalendarMonthViewModel({
    calendar: { ...calendarFixture, assignments, businessMonth },
    filters: {},
    holidays: {
      ...holidayFixture,
      dates: [],
      year: Number(businessMonth.slice(0, 4)),
    },
    status: 'ready',
    today: '2026-08-15',
  });
}

describe('calendar month/week/list surfaces and empty semantics', () => {
  const august = month('2026-08');
  const september = month('2026-09');

  it('builds month, nonempty list, and cross-month week surfaces', () => {
    expect(
      buildCalendarSurfaceViewModel({
        businessMonth: '2026-08',
        mode: 'month',
        monthSlots: [{ businessMonth: '2026-08', viewModel: august }],
        weekStart: '2026-08-03',
      }),
    ).toMatchObject({
      emptyMessage: '本月暂无已发布排班。',
      isEmpty: false,
      kind: 'month',
      month: { businessMonth: '2026-08' },
    });
    const list = buildCalendarSurfaceViewModel({
      businessMonth: '2026-08',
      mode: 'list',
      monthSlots: [{ businessMonth: '2026-08', viewModel: august }],
      weekStart: '2026-08-03',
    });
    expect(list.kind).toBe('list');
    if (list.kind === 'list') {
      expect(list).toMatchObject({
        emptyMessage: '本月暂无已发布排班。',
        isEmpty: false,
      });
      expect(list.days.every(({ assignments }) => assignments.length > 0)).toBe(true);
    }
    expect(
      buildCalendarSurfaceViewModel({
        businessMonth: '2026-08',
        mode: 'week',
        monthSlots: [
          { businessMonth: '2026-08', viewModel: august },
          { businessMonth: '2026-09', viewModel: september },
        ],
        weekStart: '2026-08-31',
      }),
    ).toMatchObject({
      emptyMessage: '本周暂无已发布排班。',
      isEmpty: true,
      kind: 'week',
      weekStart: '2026-08-31',
    });
  });

  it('keeps list empty rather than inventing dates when filtered results are empty', () => {
    const emptyMonth = buildCalendarMonthViewModel({
      calendar: calendarFixture,
      filters: { roleIds: ['role-2'], shiftTypeIds: ['shift-1'] },
      holidays: holidayFixture,
      status: 'ready',
      today: '2026-08-15',
    });
    expect(emptyMonth.isMonthEmpty).toBe(true);
    const surface = buildCalendarSurfaceViewModel({
      businessMonth: '2026-08',
      mode: 'list',
      monthSlots: [{ businessMonth: '2026-08', viewModel: emptyMonth }],
      weekStart: '2026-08-03',
    });
    expect(surface).toMatchObject({
      days: [],
      emptyMessage: '当前筛选条件下暂无排班。',
      isEmpty: true,
      kind: 'list',
    });

    const onlyChanges = buildCalendarMonthViewModel({
      calendar: { ...calendarFixture, assignments: [] },
      filters: { onlyChanges: true },
      holidays: holidayFixture,
      status: 'ready',
      today: '2026-08-15',
    });
    expect(
      buildCalendarSurfaceViewModel({
        businessMonth: '2026-08',
        mode: 'month',
        monthSlots: [{ businessMonth: '2026-08', viewModel: onlyChanges }],
        weekStart: '2026-08-10',
      }),
    ).toMatchObject({
      emptyMessage: '本月没有带变动标记的班次。',
      isEmpty: true,
      kind: 'month',
    });
  });

  it('retains loaded slots and prioritizes known cross-month failures over loading', () => {
    const slots = [
      { businessMonth: '2026-08', viewModel: august },
      { businessMonth: '2026-09', viewModel: september },
    ] as const;
    const recentered = recenterCalendarMonthSlots(slots, ['2026-08', '2026-09', '2026-10']);
    expect(recentered[0]).toBe(slots[0]);
    expect(recentered[1]).toBe(slots[1]);
    expect(recentered[2]).toEqual({
      businessMonth: '2026-10',
      viewModel: createCalendarMonthStateViewModel('2026-10', 'loading'),
    });
    expect(
      buildCalendarSurfaceViewModel({
        businessMonth: '2026-08',
        mode: 'week',
        monthSlots: [
          {
            businessMonth: '2026-08',
            viewModel: createCalendarMonthStateViewModel('2026-08', 'loading'),
          },
          {
            businessMonth: '2026-09',
            viewModel: createCalendarMonthStateViewModel('2026-09', 'forbidden', '禁止访问'),
          },
        ],
        weekStart: '2026-08-31',
      }),
    ).toEqual({
      businessMonth: '2026-09',
      kind: 'state',
      message: '禁止访问',
      status: 'forbidden',
    });
    expect(findCalendarPhoneAction(slots, 'missing')).toBeUndefined();
  });

  it('aggregates the earliest cache provenance and stale flag across required months', () => {
    const cachedAugust = {
      ...august,
      cacheSavedAt: '2026-08-13T06:00:00.000Z',
      isStale: false,
      status: 'cached' as const,
    };
    const cachedSeptember = {
      ...september,
      cacheSavedAt: '2026-08-13T05:00:00.000Z',
      isStale: true,
      status: 'cached' as const,
    };
    const slots = [
      { businessMonth: '2026-08', viewModel: cachedAugust },
      { businessMonth: '2026-09', viewModel: cachedSeptember },
    ] as const;
    expect(buildCalendarCacheNotice(slots, ['2026-08', '2026-09', '2026-09'])).toEqual({
      savedAtText: '2026-08-13 13:00',
      stale: true,
    });
    expect(buildCalendarCacheNotice(slots, ['2026-08'])).toEqual({
      savedAtText: '2026-08-13 14:00',
      stale: false,
    });
    expect(buildCalendarCacheNotice(slots, ['2026-10'])).toBeUndefined();
  });

  it('finds a packed phone action once when adjacent slots repeat an assignment snapshot', () => {
    const actionId = august.weeks
      .flatMap(({ days }) => days)
      .flatMap((day) => (day.kind === 'day' ? day.assignments : []))
      .flatMap(({ phoneActions }) => phoneActions)[0]?.actionId;
    expect(actionId).toBeDefined();
    expect(
      findCalendarPhoneAction(
        [
          { businessMonth: '2026-08', viewModel: august },
          { businessMonth: '2026-08-copy', viewModel: august },
        ],
        actionId!,
      ),
    ).toMatchObject({ actionId });
  });

  it('uses the week-scoped changed-only empty message without hiding the seven days', () => {
    const changedOnlyAugust = buildCalendarMonthViewModel({
      calendar: { ...calendarFixture, assignments: [] },
      filters: { onlyChanges: true },
      holidays: holidayFixture,
      status: 'ready',
      today: '2026-08-15',
    });
    const changedOnlySeptember = buildCalendarMonthViewModel({
      calendar: { ...calendarFixture, assignments: [], businessMonth: '2026-09' },
      filters: { onlyChanges: true },
      holidays: { ...holidayFixture, dates: [] },
      status: 'ready',
      today: '2026-08-15',
    });
    const surface = buildCalendarSurfaceViewModel({
      businessMonth: '2026-08',
      mode: 'week',
      monthSlots: [
        { businessMonth: '2026-08', viewModel: changedOnlyAugust },
        { businessMonth: '2026-09', viewModel: changedOnlySeptember },
      ],
      weekStart: '2026-08-31',
    });
    expect(surface).toMatchObject({
      emptyMessage: '本周没有带变动标记的班次。',
      isEmpty: true,
      kind: 'week',
      week: { days: expect.arrayContaining([expect.objectContaining({ kind: 'day' })]) },
    });
    if (surface.kind === 'week') expect(surface.week.days).toHaveLength(7);
  });
});
