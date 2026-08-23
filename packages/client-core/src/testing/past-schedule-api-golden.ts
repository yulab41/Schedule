import type {
  PastScheduleBackfillBatchResult,
  PastScheduleBackfillRecord,
  PastSchedulePeriod,
} from '@schedule/contracts';

export const pastSchedulePeriodsGoldenResponse = [
  {
    businessMonth: '2026-07',
    id: 'period-past-1',
    periodStatus: 'past',
    revision: 2,
    scheduleRoleId: 'role-1',
    scheduleRoleName: '一线',
    version: 4,
  },
] as const satisfies readonly PastSchedulePeriod[];

export const pastScheduleBackfillRecordsGoldenResponse = [
  {
    actualMemberName: '林医生',
    assignmentId: 'assignment-1',
    backfilledAt: '2026-08-24T01:02:03.000Z',
    businessDate: '2026-07-02',
    operatorName: '值班管理员',
    reason: '实际值班人员更正',
    shiftTypeAbbreviation: '全',
    shiftTypeName: '全天班',
  },
] as const satisfies readonly PastScheduleBackfillRecord[];

export const pastScheduleBackfillBatchGoldenResult = {
  assignments: [
    {
      actualMemberId: 'member-1',
      actualMemberName: '林医生',
      assignmentId: 'assignment-1',
      backfillAt: '2026-08-24T01:02:03.000Z',
      backfillReason: '实际值班人员更正',
      businessDate: '2026-07-02',
      plannedMemberId: 'member-2',
      plannedMemberName: '陈医生',
      shiftTypeAbbreviation: '全',
      shiftTypeId: 'shift-1',
      shiftTypeName: '全天班',
      slotPosition: 1,
    },
  ],
  eventIds: ['event-1'],
} as const satisfies PastScheduleBackfillBatchResult;
