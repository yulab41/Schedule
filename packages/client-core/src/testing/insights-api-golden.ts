import type {
  MonthStatisticsSnapshot,
  ScheduleEventDetail,
  ScheduleEventPage,
  YearStatistics,
} from '@schedule/contracts';

export const insightsEventGoldenResponse = {
  events: [
    {
      affectedMembershipIds: ['membership-1'],
      affectedShiftIds: ['shift-1'],
      eventStatus: 'completed',
      eventType: 'schedule_published',
      groupId: 'group-1',
      id: 'event-1',
      occurredAt: '2026-08-25T10:00:00.000Z',
      objectType: 'schedule_period',
      operationId: 'operation-1',
    },
  ],
  nextCursor: 'cursor-event-1',
} satisfies ScheduleEventPage;

export const insightsEventDetailGoldenResponse = {
  event: insightsEventGoldenResponse.events[0]!,
  relatedEvents: [],
} satisfies ScheduleEventDetail;

const summary = {
  actualCount: 8,
  byRole: [{ actualCount: 8, plannedCount: 9, scheduleRoleId: 'role-1', scheduleRoleName: '夜班' }],
  byShiftType: [
    { actualCount: 8, plannedCount: 9, shiftTypeId: 'shift-type-1', shiftTypeName: '夜班' },
  ],
  countedActualCount: 7,
  countedPlannedCount: 8,
  deductionCount: 0,
  holidayCount: 1,
  leaveCoverCount: 0,
  manualAdjustmentCount: 0,
  members: [
    {
      actualCount: 8,
      actualVsPlanned: [],
      byRole: [],
      byShiftType: [],
      countedActualCount: 7,
      countedPlannedCount: 8,
      deductionCount: 0,
      deltaCount: -1,
      holidayCount: 1,
      leaveCoverCount: 0,
      manualAdjustmentCount: 0,
      membershipId: 'membership-1',
      netDutyAdjustment: 0,
      overtimeCount: 0,
      plannedCount: 9,
      realName: '王医生',
      swapCount: 0,
      weekendCount: 2,
    },
  ],
  netDutyAdjustment: 0,
  overtimeCount: 0,
  plannedCount: 9,
  swapCount: 0,
  weekendCount: 2,
} as const;

export const insightsMonthStatisticsGoldenResponse = {
  businessMonth: '2026-08',
  computedAt: '2026-08-25T10:00:00.000Z',
  groupId: 'group-1',
  summary,
  version: 3,
} satisfies MonthStatisticsSnapshot;

export const insightsYearStatisticsGoldenResponse = {
  months: [{ businessMonth: '2026-08', summary }],
  summary,
  year: 2026,
} satisfies YearStatistics;
