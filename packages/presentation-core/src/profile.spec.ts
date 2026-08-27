import { describe, expect, it } from 'vitest';

import {
  buildMyProfileOverview,
  type MyProfileCalendarLike,
  type MyProfileContactLike,
  type MyProfileDutyAssignmentLike,
  type MyProfileMemberLike,
  type MyProfileMonthStatisticsLike,
  type MyProfileStatisticsMemberLike,
  type MyProfileStatisticsSummaryLike,
  type MyProfileYearStatisticsLike,
} from './profile.js';

describe('shared my profile overview', () => {
  it('joins statistics, contact details, and trends through the current membership id', () => {
    const overview = buildMyProfileOverview({
      businessDate: '2026-08-20',
      businessMonth: '2026-08',
      calendars: [],
      contacts: [contact('other'), contact('member-current', '13412348339')],
      members: [member('other', false), member('member-current', true)],
      monthStatistics: monthStatistics(memberRow('member-current', 8, 2, 1)),
      yearStatistics: yearStatistics([
        ['2026-05', 4],
        ['2026-06', 6],
        ['2026-07', 6],
        ['2026-08', 8],
      ]),
    });

    expect(overview.membershipId).toBe('member-current');
    expect(overview.mobilePhone).toBe('13412348339');
    expect(overview.monthCount).toBe(8);
    expect(overview.yearCount).toBe(24);
    expect(overview.specialDateCount).toBe(3);
    expect(overview.monthDelta).toBe(2);
    expect(overview.trend).toEqual([
      { businessMonth: '2026-05', count: 4, label: '5月' },
      { businessMonth: '2026-06', count: 6, label: '6月' },
      { businessMonth: '2026-07', count: 6, label: '7月' },
      { businessMonth: '2026-08', count: 8, label: '8月' },
    ]);
  });

  it('selects the earliest upcoming actual or unmodified planned duty for the current member', () => {
    const later = assignment({
      actualMembershipId: 'member-current',
      businessDate: '2026-08-25',
      id: 'later',
    });
    const next = assignment({
      businessDate: '2026-08-22',
      id: 'next',
      plannedMembershipId: 'member-current',
    });
    const reassigned = assignment({
      actualMembershipId: 'other',
      businessDate: '2026-08-21',
      id: 'reassigned',
      plannedMembershipId: 'member-current',
    });

    const overview = buildMyProfileOverview({
      businessDate: '2026-08-20',
      businessMonth: '2026-08',
      calendars: [calendar([later, next, reassigned])],
      contacts: [],
      members: [member('member-current', true)],
      now: '2026-08-20T00:00:00.000Z',
    });

    expect(overview.nextDuty?.id).toBe('next');
  });

  it('does not bind private data by display name when no current membership is identified', () => {
    const overview = buildMyProfileOverview({
      businessDate: '2026-08-20',
      businessMonth: '2026-08',
      calendars: [calendar([assignment({ actualMembershipId: 'same-name-member' })])],
      contacts: [contact('same-name-member', '13412348339')],
      members: [member('same-name-member', false)],
      monthStatistics: monthStatistics(memberRow('same-name-member', 8, 2, 1)),
    });

    expect(overview.membershipId).toBeUndefined();
    expect(overview.mobilePhone).toBeUndefined();
    expect(overview.monthCount).toBeUndefined();
    expect(overview.nextDuty).toBeUndefined();
  });
});

function member(
  id: string,
  isCurrentUser: boolean,
): MyProfileMemberLike & {
  readonly realName: string;
  readonly role: 'member';
  readonly version: number;
} {
  return {
    id,
    isCurrentUser,
    realName: '同名成员',
    role: 'member',
    version: 1,
  };
}

function contact(
  membershipId: string,
  mobilePhone?: string,
): MyProfileContactLike & { readonly isConfirmed: boolean; readonly version: number } {
  return {
    isConfirmed: true,
    membershipId,
    ...(mobilePhone === undefined ? {} : { mobilePhone }),
    version: 1,
  };
}

function memberRow(
  membershipId: string,
  actualCount: number,
  weekendCount = 0,
  holidayCount = 0,
): MyProfileStatisticsMemberLike & {
  readonly actualVsPlanned: readonly unknown[];
  readonly byRole: readonly unknown[];
  readonly byShiftType: readonly unknown[];
  readonly countedActualCount: number;
  readonly countedPlannedCount: number;
  readonly deductionCount: number;
  readonly deltaCount: number;
  readonly leaveCoverCount: number;
  readonly manualAdjustmentCount: number;
  readonly netDutyAdjustment: number;
  readonly overtimeCount: number;
  readonly plannedCount: number;
  readonly realName: string;
  readonly swapCount: number;
} {
  return {
    actualCount,
    actualVsPlanned: [],
    byRole: [],
    byShiftType: [],
    countedActualCount: actualCount,
    countedPlannedCount: actualCount,
    deductionCount: 0,
    deltaCount: 0,
    holidayCount,
    leaveCoverCount: 0,
    manualAdjustmentCount: 0,
    membershipId,
    netDutyAdjustment: 0,
    overtimeCount: 0,
    plannedCount: actualCount,
    realName: '同名成员',
    swapCount: 0,
    weekendCount,
  };
}

function summary(rows: readonly MyProfileStatisticsMemberLike[]): MyProfileStatisticsSummaryLike & {
  readonly actualCount: number;
  readonly byRole: readonly unknown[];
  readonly byShiftType: readonly unknown[];
  readonly countedActualCount: number;
  readonly countedPlannedCount: number;
  readonly deductionCount: number;
  readonly holidayCount: number;
  readonly leaveCoverCount: number;
  readonly manualAdjustmentCount: number;
  readonly netDutyAdjustment: number;
  readonly overtimeCount: number;
  readonly plannedCount: number;
  readonly swapCount: number;
  readonly weekendCount: number;
} {
  return {
    actualCount: rows.reduce((total, row) => total + row.actualCount, 0),
    byRole: [],
    byShiftType: [],
    countedActualCount: 0,
    countedPlannedCount: 0,
    deductionCount: 0,
    holidayCount: 0,
    leaveCoverCount: 0,
    manualAdjustmentCount: 0,
    members: rows,
    netDutyAdjustment: 0,
    overtimeCount: 0,
    plannedCount: 0,
    swapCount: 0,
    weekendCount: 0,
  };
}

function monthStatistics(row: MyProfileStatisticsMemberLike): MyProfileMonthStatisticsLike & {
  readonly businessMonth: string;
  readonly computedAt: string;
  readonly groupId: string;
  readonly version: number;
} {
  return {
    businessMonth: '2026-08',
    computedAt: '2026-08-20T00:00:00.000Z',
    groupId: 'group-1',
    summary: summary([row]),
    version: 1,
  };
}

function yearStatistics(
  months: readonly (readonly [string, number])[],
): MyProfileYearStatisticsLike & { readonly year: number } {
  const monthRows = months.map(([businessMonth, count]) => ({
    businessMonth,
    summary: summary([memberRow('member-current', count)]),
  }));
  return {
    months: monthRows,
    summary: summary([
      memberRow(
        'member-current',
        months.reduce((total, [, count]) => total + count, 0),
      ),
    ]),
    year: 2026,
  };
}

function assignment(
  overrides: Partial<MyProfileDutyAssignmentLike> = {},
): MyProfileDutyAssignmentLike & {
  readonly changeMarkers: readonly unknown[];
  readonly schedulePeriodId: string;
  readonly scheduleRoleId: string;
  readonly shiftTypeAbbreviation: string;
  readonly shiftTypeColor: string;
  readonly shiftTypeId: string;
  readonly shiftTypeTextColor: string;
  readonly slotPosition: number;
} {
  return {
    businessDate: '2026-08-20',
    changeMarkers: [],
    endsAt: '2026-08-20T09:30:00.000Z',
    id: 'assignment-1',
    schedulePeriodId: 'period-1',
    scheduleRoleId: 'role-1',
    scheduleRoleName: '头颈外科',
    shiftTypeAbbreviation: '日',
    shiftTypeColor: '#0A66D5',
    shiftTypeId: 'shift-1',
    shiftTypeName: '日班',
    shiftTypeTextColor: '#FFFFFF',
    slotPosition: 1,
    startsAt: '2026-08-20T00:00:00.000Z',
    ...overrides,
  };
}

function calendar(assignments: readonly MyProfileDutyAssignmentLike[]): MyProfileCalendarLike & {
  readonly businessMonth: string;
  readonly groupId: string;
  readonly members: readonly unknown[];
  readonly roles: readonly unknown[];
  readonly shiftTypes: readonly unknown[];
} {
  return {
    assignments,
    businessMonth: '2026-08',
    groupId: 'group-1',
    members: [],
    roles: [],
    shiftTypes: [],
  };
}
