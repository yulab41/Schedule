import { describe, expect, it } from 'vitest';

import {
  buildCalendarMonthViewModel,
  type CalendarAssignmentFilters,
  createCalendarMonthStateViewModel,
  type CalendarDayViewModel,
  type CalendarFilterViewModel,
  type CalendarMonthDataViewModel,
  mergeCalendarFilterViewModels,
} from '../src/index.js';
import { calendarFixture, holidayFixture, makeAssignment } from './fixtures.js';

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

describe('calendar renderer-neutral month view model', () => {
  it('maps assignments, holidays, markers, details, and empty days without mutating inputs', () => {
    const snapshot = JSON.stringify({ calendarFixture, holidayFixture });
    const ready = buildCalendarMonthViewModel({
      calendar: calendarFixture,
      filters: {},
      holidays: holidayFixture,
      status: 'ready',
      today: '2026-08-15',
    });
    expect(ready).toMatchObject({
      assignmentCount: 3,
      businessMonth: '2026-08',
      isMonthEmpty: false,
      monthLabel: '2026年8月',
      status: 'ready',
    });
    expect(ready.weeks.every(({ days }) => days.length === 7)).toBe(true);
    const day = findDay(ready, '2026-08-15');
    expect(day).toMatchObject({
      isEmpty: false,
      isToday: true,
      isWeekend: true,
      weekdayLabel: '周六',
    });
    expect(day?.assignments.map(({ assignmentId }) => assignmentId)).toEqual(['earlier', 'later']);
    expect(day?.assignments[1]).toMatchObject({
      businessDate: '2026-08-15',
      compactShiftLabel: '全',
      memberName: '一位名字很长的值班医生',
      roleName: '门诊',
      shiftTypeName: '全天班',
      timeRange: '09:00–16:00',
    });
    expect(day?.assignments[0]?.markers.map(({ label }) => label)).toEqual(['换', '加']);
    expect(day?.assignments[0]?.phoneActions[0]).toMatchObject({
      kind: 'copy',
      label: '长号',
    });
    expect(findDay(ready, '2026-08-16')?.assignments[0]?.memberName).toBe('');
    expect(findDay(ready, '2026-08-16')?.holiday).toMatchObject({
      label: '五一',
      tone: 'off-day',
    });
    expect(findDay(ready, '2026-08-17')?.holiday).toMatchObject({
      label: '班',
      tone: 'workday',
    });
    expect(findDay(ready, '2026-08-01')?.isEmpty).toBe(true);
    expect(JSON.stringify({ calendarFixture, holidayFixture })).toBe(snapshot);
  });

  it('uses real platform-neutral filter options and canonical empty selection for all', () => {
    const unfiltered = buildCalendarMonthViewModel({
      calendar: calendarFixture,
      filters: {},
      holidays: holidayFixture,
      status: 'ready',
      today: '2026-08-15',
    });
    expect(unfiltered.filters.roles).toEqual([
      { id: 'role-1', label: '门诊' },
      { id: 'role-2', label: '急诊' },
    ]);
    expect(unfiltered.filters.members[0]).toEqual({ id: 'member-1', label: '计划医生' });
    expect(unfiltered.filters.shiftTypes[0]).toEqual({
      id: 'shift-1',
      label: '全天班（全天）',
    });
    expect(unfiltered.filters).toMatchObject({
      selectedMembershipIds: [],
      selectedRoleIds: [],
      selectedShiftTypeIds: [],
    });
    expect(unfiltered.filters).not.toHaveProperty('selectedMembershipIndex');
    expect(unfiltered.filters).not.toHaveProperty('selectedRoleIndex');
    expect(unfiltered.filters).not.toHaveProperty('selectedShiftTypeIndex');

    const filtered = buildCalendarMonthViewModel({
      calendar: calendarFixture,
      filters: {
        membershipIds: ['member-2', 'missing-member'],
        roleIds: ['role-1', 'missing-role'],
        shiftTypeIds: ['shift-1', 'missing-shift'],
      },
      holidays: holidayFixture,
      status: 'ready',
      today: '2026-08-15',
    });
    expect(filtered.assignmentCount).toBe(1);
    expect(filtered.filters).toMatchObject({
      selectedMembershipIds: ['member-2', 'missing-member'],
      selectedRoleIds: ['role-1', 'missing-role'],
      selectedShiftTypeIds: ['shift-1', 'missing-shift'],
    });
  });

  it('keeps adjacent-month-only global IDs restrictive while normalizing local UI selection', () => {
    const render = (filters: CalendarAssignmentFilters) =>
      buildCalendarMonthViewModel({
        calendar: calendarFixture,
        filters,
        holidays: holidayFixture,
        status: 'ready',
        today: '2026-08-15',
      });

    for (const { filters, label } of [
      { filters: { membershipIds: ['neighbor-member'] }, label: 'member' },
      { filters: { roleIds: ['neighbor-role'] }, label: 'role' },
      { filters: { shiftTypeIds: ['neighbor-shift'] }, label: 'shift type' },
    ] satisfies readonly {
      readonly filters: CalendarAssignmentFilters;
      readonly label: string;
    }[]) {
      expect(render(filters).assignmentCount, label).toBe(0);
    }

    expect(
      render({
        membershipIds: ['neighbor-member'],
        roleIds: ['neighbor-role'],
        shiftTypeIds: ['neighbor-shift'],
      }).filters,
    ).toMatchObject({
      selectedMembershipIds: ['neighbor-member'],
      selectedRoleIds: ['neighbor-role'],
      selectedShiftTypeIds: ['neighbor-shift'],
    });
  });

  it('merges cross-month filter options and selected unions without receiver helpers', () => {
    const first: CalendarFilterViewModel = {
      members: [
        { id: 'member-1', label: '成员一' },
        { id: 'member-2', label: '成员二' },
      ],
      onlyChanges: false,
      roles: [
        { id: 'role-1', label: '岗位一' },
        { id: 'role-2', label: '岗位二' },
      ],
      selectedMembershipIds: ['member-2', 'missing-member'],
      selectedRoleIds: ['role-2', 'missing-role'],
      selectedShiftTypeIds: ['shift-2', 'missing-shift'],
      shiftTypes: [
        { id: 'shift-1', label: '白班（白）' },
        { id: 'shift-2', label: '夜班（夜）' },
      ],
    };
    const second: CalendarFilterViewModel = {
      members: [
        { id: 'member-2', label: '不应覆盖成员二' },
        { id: 'member-3', label: '成员三' },
      ],
      onlyChanges: true,
      roles: [
        { id: 'role-2', label: '不应覆盖岗位二' },
        { id: 'role-3', label: '岗位三' },
      ],
      selectedMembershipIds: ['member-3', 'member-2'],
      selectedRoleIds: ['role-3', 'role-2'],
      selectedShiftTypeIds: ['shift-3', 'shift-2'],
      shiftTypes: [
        { id: 'shift-2', label: '不应覆盖夜班' },
        { id: 'shift-3', label: '中班（中）' },
      ],
    };
    const inputs: CalendarFilterViewModel[] = [first, second];
    for (const receiver of [
      inputs,
      first.members,
      first.roles,
      first.shiftTypes,
      first.selectedMembershipIds,
      first.selectedRoleIds,
      first.selectedShiftTypeIds,
      second.members,
      second.roles,
      second.shiftTypes,
      second.selectedMembershipIds,
      second.selectedRoleIds,
      second.selectedShiftTypeIds,
    ]) {
      Object.defineProperty(receiver, 'every', {
        value: () => {
          throw new Error('receiver every must not be called');
        },
      });
    }
    const snapshot = JSON.stringify(inputs);

    expect(mergeCalendarFilterViewModels(inputs)).toEqual({
      members: [
        { id: 'member-1', label: '成员一' },
        { id: 'member-2', label: '成员二' },
        { id: 'member-3', label: '成员三' },
      ],
      onlyChanges: true,
      roles: [
        { id: 'role-1', label: '岗位一' },
        { id: 'role-2', label: '岗位二' },
        { id: 'role-3', label: '岗位三' },
      ],
      selectedMembershipIds: ['member-2', 'missing-member', 'member-3'],
      selectedRoleIds: ['role-2', 'missing-role', 'role-3'],
      selectedShiftTypeIds: ['shift-2', 'missing-shift', 'shift-3'],
      shiftTypes: [
        { id: 'shift-1', label: '白班（白）' },
        { id: 'shift-2', label: '夜班（夜）' },
        { id: 'shift-3', label: '中班（中）' },
      ],
    });
    expect(mergeCalendarFilterViewModels([])).toEqual({
      members: [],
      onlyChanges: false,
      roles: [],
      selectedMembershipIds: [],
      selectedRoleIds: [],
      selectedShiftTypeIds: [],
      shiftTypes: [],
    });
    expect(JSON.stringify(inputs)).toBe(snapshot);
  });

  it('labels all-day and cross-midnight detail ranges without an ambiguous repeated clock', () => {
    const ready = buildCalendarMonthViewModel({
      calendar: {
        ...calendarFixture,
        assignments: [
          makeAssignment({
            endsAt: '2026-08-16T08:00:00+08:00',
            id: 'all-day',
            startsAt: '2026-08-15T08:00:00+08:00',
          }),
          makeAssignment({
            endsAt: '2026-08-16T08:00:00+08:00',
            id: 'overnight',
            shiftTypeAbbreviation: '夜',
            shiftTypeColor: '#654321',
            shiftTypeId: 'shift-2',
            shiftTypeName: '夜班',
            shiftTypeTextColor: '#000000',
            startsAt: '2026-08-15T20:00:00+08:00',
          }),
        ],
        shiftTypes: calendarFixture.shiftTypes.map((shiftType) =>
          shiftType.id === 'shift-1'
            ? { ...shiftType, crossesMidnight: true, isAllDay: true }
            : shiftType,
        ),
      },
      filters: {},
      holidays: holidayFixture,
      status: 'ready',
      today: '2026-08-15',
    });

    expect(
      findDay(ready, '2026-08-15')?.assignments.map(({ assignmentId, timeRange }) => ({
        assignmentId,
        timeRange,
      })),
    ).toEqual([
      { assignmentId: 'all-day', timeRange: '全天（08:00–次日08:00）' },
      { assignmentId: 'overnight', timeRange: '20:00–次日08:00' },
    ]);
  });

  it('preserves cache metadata and terminal states while rejecting identity-invalid inputs', () => {
    expect(createCalendarMonthStateViewModel('2026-08', 'loading')).toMatchObject({
      message: '正在加载排班',
      status: 'loading',
    });
    expect(createCalendarMonthStateViewModel('2026-08', 'error', '网络错误')).toMatchObject({
      message: '网络错误',
      status: 'error',
    });
    const cached = buildCalendarMonthViewModel({
      cacheSavedAt: '2026-08-13T00:00:00.000Z',
      calendar: calendarFixture,
      filters: {},
      holidays: holidayFixture,
      isStale: true,
      status: 'cached',
      today: '2026-08-15',
    });
    expect(cached).toMatchObject({
      cacheSavedAt: '2026-08-13T00:00:00.000Z',
      isStale: true,
      status: 'cached',
    });
    expect(() =>
      buildCalendarMonthViewModel({
        calendar: {
          ...calendarFixture,
          assignments: [{ ...calendarFixture.assignments[0]!, businessDate: '2026-09-01' }],
        },
        filters: {},
        holidays: holidayFixture,
        status: 'ready',
        today: '2026-08-15',
      }),
    ).toThrow();
    expect(() =>
      buildCalendarMonthViewModel({
        calendar: calendarFixture,
        filters: {},
        holidays: { ...holidayFixture, year: 2027 },
        status: 'ready',
        today: '2026-08-15',
      }),
    ).toThrow();
  });
});
