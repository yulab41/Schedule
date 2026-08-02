import { describe, expect, it } from 'vitest';

import {
  calculateMonthStatistics,
  type StatisticsAssignmentInput,
  type StatisticsHolidayInput,
} from './calculate.js';

function assignment(overrides: Partial<StatisticsAssignmentInput> = {}): StatisticsAssignmentInput {
  return {
    actualMemberId: 'member-a',
    actualMemberName: 'A Doctor',
    businessDate: '2026-10-01',
    countsTowardStatistics: true,
    id: 'assignment-1',
    plannedMemberId: 'member-a',
    plannedMemberName: 'A Doctor',
    scheduleRoleId: 'role-1',
    scheduleRoleName: 'Primary',
    shiftTypeId: 'shift-1',
    shiftTypeName: 'All Day',
    ...overrides,
  };
}

describe('calculateMonthStatistics', () => {
  it('counts planned and actual duty per member with role and shift-type breakdowns', () => {
    const result = calculateMonthStatistics({
      assignments: [
        assignment({ id: 'assignment-1', businessDate: '2026-10-05' }),
        assignment({ id: 'assignment-2', businessDate: '2026-10-06' }),
        assignment({
          actualMemberId: 'member-b',
          actualMemberName: 'B Doctor',
          id: 'assignment-3',
          plannedMemberId: 'member-b',
          plannedMemberName: 'B Doctor',
        }),
      ],
      holidays: [],
      memberNames: [
        { membershipId: 'member-a', realName: 'A Doctor' },
        { membershipId: 'member-b', realName: 'B Doctor' },
      ],
      workflowCounts: [],
    });

    expect(result.plannedCount).toBe(3);
    expect(result.actualCount).toBe(3);
    expect(result.countedPlannedCount).toBe(3);
    const memberA = result.members.find((member) => member.membershipId === 'member-a');
    expect(memberA).toMatchObject({ plannedCount: 2, actualCount: 2, realName: 'A Doctor' });
    expect(result.byRole).toEqual([
      {
        actualCount: 3,
        plannedCount: 3,
        scheduleRoleId: 'role-1',
        scheduleRoleName: 'Primary',
      },
    ]);
    expect(result.byShiftType[0]).toMatchObject({
      actualCount: 3,
      plannedCount: 3,
      shiftTypeId: 'shift-1',
    });
  });

  it('falls back to the planned member when the actual member is not set', () => {
    const result = calculateMonthStatistics({
      assignments: [
        assignment({
          actualMemberId: null,
          actualMemberName: null,
          id: 'freshly-generated',
        }),
      ],
      holidays: [],
      memberNames: [{ membershipId: 'member-a', realName: 'A Doctor' }],
      workflowCounts: [],
    });

    expect(result.actualCount).toBe(1);
    expect(result.members[0]).toMatchObject({
      actualCount: 1,
      deltaCount: 0,
      plannedCount: 1,
    });
    expect(result.members[0]?.actualVsPlanned).toEqual([]);
  });

  it('treats holidays before weekends and ignores makeup workdays for weekend counts', () => {
    const holidays: readonly StatisticsHolidayInput[] = [
      { date: '2026-10-03', isOffDay: true, isWorkday: false },
      { date: '2026-10-04', isOffDay: false, isWorkday: true },
    ];
    const result = calculateMonthStatistics({
      assignments: [
        assignment({ id: 'holiday-saturday', businessDate: '2026-10-03' }),
        assignment({ id: 'makeup-sunday', businessDate: '2026-10-04' }),
        assignment({ id: 'regular-saturday', businessDate: '2026-10-10' }),
      ],
      holidays,
      memberNames: [{ membershipId: 'member-a', realName: 'A Doctor' }],
      workflowCounts: [],
    });

    expect(result.holidayCount).toBe(1);
    expect(result.weekendCount).toBe(1);
    const memberA = result.members[0];
    expect(memberA).toMatchObject({ holidayCount: 1, weekendCount: 1 });
  });

  it('excludes non-counted shifts and vacancies from duty statistics', () => {
    const result = calculateMonthStatistics({
      assignments: [
        assignment({
          businessDate: '2026-10-11',
          countsTowardStatistics: false,
          id: 'office-shift',
          shiftTypeName: 'Office',
        }),
        assignment({
          actualMemberId: null,
          actualMemberName: null,
          id: 'vacancy',
          plannedMemberId: null,
          plannedMemberName: null,
        }),
      ],
      holidays: [],
      memberNames: [{ membershipId: 'member-a', realName: 'A Doctor' }],
      workflowCounts: [],
    });

    expect(result.plannedCount).toBe(1);
    expect(result.countedPlannedCount).toBe(0);
    expect(result.weekendCount).toBe(0);
    expect(result.members[0]).toMatchObject({
      plannedCount: 1,
      actualCount: 1,
      countedPlannedCount: 0,
      countedActualCount: 0,
    });
  });

  it('computes swap, overtime, deduction, net, and change-impact counts', () => {
    const result = calculateMonthStatistics({
      assignments: [assignment({ id: 'assignment-1' })],
      holidays: [],
      memberNames: [{ membershipId: 'member-a', realName: 'A Doctor' }],
      workflowCounts: [
        {
          deductionCount: 1,
          leaveCoverCount: 2,
          manualAdjustmentCount: 1,
          membershipId: 'member-a',
          overtimeCount: 1,
          swapCount: 3,
        },
      ],
    });

    expect(result.members[0]).toMatchObject({
      deductionCount: 1,
      deltaCount: 0,
      leaveCoverCount: 2,
      manualAdjustmentCount: 1,
      netDutyAdjustment: 0,
      overtimeCount: 1,
      swapCount: 3,
    });
    expect(result.netDutyAdjustment).toBe(0);
  });

  it('lists actual-vs-planned coverage and counts both sides', () => {
    const result = calculateMonthStatistics({
      assignments: [
        assignment({
          actualMemberId: 'member-b',
          actualMemberName: 'B Doctor',
          id: 'covered-shift',
        }),
      ],
      holidays: [],
      memberNames: [
        { membershipId: 'member-a', realName: 'A Doctor' },
        { membershipId: 'member-b', realName: 'B Doctor' },
      ],
      workflowCounts: [],
    });

    const memberA = result.members.find((member) => member.membershipId === 'member-a');
    const memberB = result.members.find((member) => member.membershipId === 'member-b');
    expect(memberA).toMatchObject({ plannedCount: 1, actualCount: 0, deltaCount: -1 });
    expect(memberB).toMatchObject({ plannedCount: 0, actualCount: 1, deltaCount: 1 });
    expect(memberB?.actualVsPlanned).toEqual([
      {
        actualMemberId: 'member-b',
        actualMemberName: 'B Doctor',
        businessDate: '2026-10-01',
        plannedMemberId: 'member-a',
        plannedMemberName: 'A Doctor',
        shiftTypeName: 'All Day',
      },
    ]);
  });
});
