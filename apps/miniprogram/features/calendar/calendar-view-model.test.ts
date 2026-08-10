import type { CalendarReadModel, HolidayReadModel } from '@schedule/contracts';
import { describe, expect, it } from 'vitest';

import {
  buildCalendarMonthViewModel,
  createCalendarMonthStateViewModel,
  type CalendarDayViewModel,
  type CalendarMonthDataViewModel,
} from './calendar-view-model.js';

const calendar: CalendarReadModel = {
  assignments: [
    {
      businessDate: '2026-08-15',
      changeMarkers: ['swap', 'leave-cover'],
      endsAt: '2026-08-15T12:00:00+08:00',
      id: 'assignment-2',
      plannedMemberName: '一位名字很长的值班医生',
      plannedMembershipId: 'member-confirmed',
      schedulePeriodId: 'period-2',
      scheduleRoleId: 'role-1',
      scheduleRoleName: '门诊',
      shiftTypeAbbreviation: '全天',
      shiftTypeColor: '#123456',
      shiftTypeId: 'shift-1',
      shiftTypeName: '上午班',
      shiftTypeTextColor: '#FFFFFF',
      slotPosition: 2,
      startsAt: '2026-08-15T08:00:00+08:00',
    },
    {
      actualMemberName: '实际替班医生',
      actualMembershipId: 'member-unconfirmed',
      businessDate: '2026-08-15',
      changeMarkers: ['swap', 'overtime'],
      endsAt: '2026-08-15T07:00:00+08:00',
      id: 'assignment-1',
      plannedMemberName: '计划医生',
      plannedMembershipId: 'member-confirmed',
      schedulePeriodId: 'period-1',
      scheduleRoleId: 'role-1',
      scheduleRoleName: '门诊',
      shiftTypeAbbreviation: 'A',
      shiftTypeColor: '#123456',
      shiftTypeId: 'shift-1',
      shiftTypeName: '上午班',
      shiftTypeTextColor: '#FFFFFF',
      slotPosition: 1,
      startsAt: '2026-08-15T06:00:00+08:00',
    },
    {
      actualMemberName: '',
      actualMembershipId: 'member-none',
      businessDate: '2026-08-16',
      changeMarkers: [],
      endsAt: '2026-08-16T16:00:00+08:00',
      id: 'assignment-3',
      schedulePeriodId: 'period-3',
      scheduleRoleId: 'role-2',
      scheduleRoleName: '急诊',
      shiftTypeAbbreviation: 'B',
      shiftTypeColor: '#654321',
      shiftTypeId: 'shift-2',
      shiftTypeName: '夜班',
      shiftTypeTextColor: '#000000',
      slotPosition: 1,
      startsAt: '2026-08-16T08:00:00+08:00',
    },
  ],
  businessMonth: '2026-08',
  groupId: 'group-1',
  members: [
    {
      isConfirmed: true,
      membershipId: 'member-confirmed',
      mobilePhone: '13800000000',
      realName: '已确认医生',
      shortPhone: '13800000000',
    },
    {
      isConfirmed: false,
      membershipId: 'member-unconfirmed',
      mobilePhone: '13900000000',
      realName: '未确认医生',
      shortPhone: '6601',
    },
    { isConfirmed: true, membershipId: 'member-none', realName: '无号码医生' },
  ],
  roles: [
    { id: 'role-1', name: '门诊' },
    { id: 'role-2', name: '急诊' },
  ],
  shiftTypes: [
    {
      abbreviation: 'A',
      color: '#123456',
      crossesMidnight: false,
      id: 'shift-1',
      isAllDay: false,
      name: '上午班',
      textColor: '#FFFFFF',
    },
    {
      abbreviation: 'B',
      color: '#654321',
      crossesMidnight: true,
      id: 'shift-2',
      isAllDay: false,
      name: '夜班',
      textColor: '#000000',
    },
  ],
};

const holidays: HolidayReadModel = {
  confirmed: true,
  dates: [
    { date: '2026-08-16', holidayName: '劳动节', isOffDay: true, isWorkday: false },
    { date: '2026-08-17', holidayName: '补班日', isOffDay: false, isWorkday: true },
  ],
  year: 2026,
};

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

describe('calendar month view model', () => {
  it('maps fixed contract data into a stable, renderer-neutral month', () => {
    const sourceSnapshot = JSON.stringify({ calendar, holidays });
    const filters = { roleIds: ['role-1'], membershipIds: ['member-unconfirmed'] };
    const filterSnapshot = JSON.stringify(filters);
    const ready = buildCalendarMonthViewModel({
      calendar,
      filters: {},
      holidays,
      status: 'ready',
      today: '2026-08-15',
    });

    expect(ready.status).toBe('ready');
    if (ready.status !== 'ready') throw new Error('expected ready VM');
    expect(ready.businessMonth).toBe('2026-08');
    expect(ready.monthLabel).toBe('2026年8月');
    expect(ready.weekdayLabels).toEqual(['一', '二', '三', '四', '五', '六', '日']);
    expect(ready.isMonthEmpty).toBe(false);
    expect(ready.weeks.every((week) => week.days.length === 7)).toBe(true);
    expect(ready.weeks[0]?.id).toBe('week:2026-08:0');
    expect(ready.weeks[0]?.days[0]).toMatchObject({ id: 'cell:2026-08:0:0', kind: 'padding' });

    const denseDay = findDay(ready, '2026-08-15');
    if (denseDay === undefined) throw new Error('expected a real calendar day');
    expect(denseDay.routeActionId).toBe('date:2026-08-15');
    expect(denseDay.assignments[0]?.routeActionId).toBe('assignment:assignment-1');
    expect(denseDay.assignments[1]?.routeActionId).toBe('assignment:assignment-2');
    expect(denseDay.assignments[1]?.compactShiftLabel).toBe('全');
    expect(denseDay).toMatchObject({
      dayNumber: 15,
      id: '2026-08-15',
      isEmpty: false,
      isPast: false,
      isToday: true,
      isWeekend: true,
      kind: 'day',
      weekdayLabel: '周六',
    });
    expect(denseDay.assignments.map(({ memberName }) => memberName)).toEqual([
      '实际替班医生',
      '一位名字很长的值班医生',
    ]);
    expect(denseDay.assignments[0]).toMatchObject({
      backgroundColor: '#123456',
      borderToken: 'color-border-strong',
      foregroundColor: '#FFFFFF',
      roleName: '门诊',
      shiftTypeAbbreviation: 'A',
      shiftTypeName: '上午班',
      timeRange: '06:00–07:00',
    });
    const markers = denseDay.assignments.flatMap(
      ({ markers: assignmentMarkers }) => assignmentMarkers,
    );
    expect(markers.map(({ type }) => type)).toEqual(['swap', 'overtime', 'swap', 'leave-cover']);
    expect(
      new Set(
        markers.map(
          ({ fillToken, foregroundToken, borderToken }) =>
            `${fillToken}:${foregroundToken}:${borderToken}`,
        ),
      ),
    ).toEqual(new Set(['color-warning-light:color-warning:color-warning']));
    expect(new Set(markers.map(({ actionId }) => actionId))).toHaveProperty('size', 4);
    expect(markers[0]).not.toHaveProperty('eventId');
    expect(JSON.stringify(ready)).not.toContain('deduction');
    expect(denseDay.assignments.flatMap(({ phoneActions }) => phoneActions)[0]).toMatchObject({
      actionId: 'assignment-1:phone:长号',
      assignmentId: 'assignment-1',
      kind: 'copy',
    });
    const phoneActions = denseDay.assignments.flatMap(({ phoneActions: actions }) => actions);
    expect(new Set(phoneActions.map(({ actionId }) => actionId))).toHaveProperty(
      'size',
      phoneActions.length,
    );
    expect(findDay(ready, '2026-08-16')?.assignments[0]?.memberName).toBe('');
    expect(findDay(ready, '2026-08-16')?.assignments[0]?.phoneActions).toEqual([]);

    expect(ready.filters.roles[0]).toEqual({ id: '', label: '全部岗位' });
    expect(ready.filters.shiftTypes[0]).toEqual({ id: '', label: '全部班种' });
    expect(ready.filters.members[0]).toEqual({ id: '', label: '全部成员' });
    expect(ready.filters).toMatchObject({
      selectedMembershipIndex: 0,
      selectedRoleIndex: 0,
      selectedShiftTypeIndex: 0,
    });
    expect(findDay(ready, '2026-08-16')?.holiday).toMatchObject({
      isOffDay: true,
      tone: 'off-day',
    });
    expect(findDay(ready, '2026-08-17')?.holiday).toMatchObject({
      isWorkday: true,
      label: '班',
      tone: 'workday',
    });
    expect(findDay(ready, '2026-08-01')?.isEmpty).toBe(true);

    const filtered = buildCalendarMonthViewModel({
      calendar,
      filters,
      holidays,
      status: 'ready',
      today: '2026-08-15',
    });
    expect(filtered.assignmentCount).toBe(1);
    expect(filtered.filters.selectedMembershipIndex).toBe(2);
    expect(filtered.filters.selectedRoleIndex).toBe(1);
    expect(JSON.stringify({ calendar, holidays })).toBe(sourceSnapshot);
    expect(JSON.stringify(filters)).toBe(filterSnapshot);
  });

  it('builds data and terminal states while rejecting invalid input boundaries', () => {
    expect(createCalendarMonthStateViewModel('2026-08', 'loading')).toMatchObject({
      status: 'loading',
    });
    expect(createCalendarMonthStateViewModel('2026-08', 'error', '网络错误')).toMatchObject({
      message: '网络错误',
      status: 'error',
    });
    expect(createCalendarMonthStateViewModel('2026-08', 'forbidden')).toMatchObject({
      status: 'forbidden',
    });
    expect(createCalendarMonthStateViewModel('2026-08', 'conflict')).toMatchObject({
      status: 'conflict',
    });
    for (const status of ['cached', 'refreshing'] as const) {
      expect(
        buildCalendarMonthViewModel({
          calendar,
          filters: {},
          holidays,
          status,
          today: '2026-08-15',
        }),
      ).toMatchObject({ status });
    }
    expect(() =>
      buildCalendarMonthViewModel({
        calendar: {
          ...calendar,
          assignments: [{ ...calendar.assignments[0]!, businessDate: '2026-09-01' }],
        },
        filters: {},
        holidays,
        status: 'ready',
        today: '2026-08-15',
      }),
    ).toThrow();
    expect(() =>
      buildCalendarMonthViewModel({
        calendar,
        filters: {},
        holidays: { ...holidays, year: 2027 },
        status: 'ready',
        today: 'not-a-date',
      }),
    ).toThrow();
    const unavailableFilters = buildCalendarMonthViewModel({
      calendar,
      filters: {
        membershipIds: ['missing-member'],
        roleIds: ['missing-role'],
        shiftTypeIds: ['missing-shift'],
      },
      holidays,
      status: 'ready',
      today: '2026-08-15',
    });
    expect(unavailableFilters.assignmentCount).toBe(calendar.assignments.length);
    expect(unavailableFilters.filters).toMatchObject({
      selectedMembershipIds: [],
      selectedMembershipIndex: 0,
      selectedRoleIds: [],
      selectedRoleIndex: 0,
      selectedShiftTypeIds: [],
      selectedShiftTypeIndex: 0,
    });

    const missingMember = buildCalendarMonthViewModel({
      calendar: {
        ...calendar,
        assignments: [
          {
            ...calendar.assignments[0]!,
            actualMemberName: undefined,
            plannedMemberName: undefined,
          },
        ],
      },
      filters: {},
      holidays,
      status: 'ready',
      today: '2026-08-15',
    });
    expect(findDay(missingMember, '2026-08-15')?.assignments[0]?.memberName).toBe('待定');
  });
});
