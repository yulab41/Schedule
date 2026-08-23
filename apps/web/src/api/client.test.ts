import type {
  AppliedManualScheduleTemplateResult,
  CalendarReadModel,
  ApprovedLeaveRequestResult,
  DutyAdjustmentPreview,
  DutyAdjustmentRequest,
  DirectoryFacetSnapshot,
  DirectoryPage,
  DissolvedGroup,
  GroupCatalogEntry,
  GroupNotificationSettings,
  GroupMember,
  GroupMemberContact,
  GroupSummary,
  GuestCalendarReadModel,
  HolidayReadModel,
  LeaveAffectedAssignment,
  LeaveAffectedShift,
  LeaveReflowPreview,
  LeaveRequest,
  LeaveRequestMutationResult,
  LeaveStatisticsDelta,
  LeaveWorkflowBlocker,
  ManualScheduleTemplate,
  ManualApplyPreview,
  MembershipClaimRequest,
  MemberNotificationPreferences,
  MonthStatisticsSnapshot,
  NotificationRecord,
  PastScheduleAssignment,
  PastScheduleBackfillBatchResult,
  PastScheduleBackfillRecord,
  PastSchedulePeriod,
  ScheduleChangeImpactPreview,
  ScheduleDraftSummary,
  ScheduleEvent,
  ScheduleGenerationPreview,
  SchedulePeriodHistoryItem,
  ScheduleExportJob,
  ScheduleRole,
  StatisticsMemberRow,
  StatisticsRecalculateCheckResult,
  StatisticsSummary,
  SwapAssignmentSummary,
  SwapPreview,
  SwapRequest,
  SchedulingConfig,
  ShiftType,
  ScheduleWorkflowImpact,
  UserProfile,
  YearStatistics,
} from '@schedule/contracts';
import { apiErrorCodes } from '@schedule/contracts';
import { describe, expect, it, vi } from 'vitest';

import type { AuthClient } from '../auth/local-auth.js';
import { createApiClient } from './client.js';

const profile: UserProfile = {
  id: 'profile-1',
  realName: '张医生',
  version: 1,
};

const group: GroupSummary = {
  groupCode: '1234',
  id: 'group-1',
  name: 'Emergency Department',
  role: 'owner',
  version: 1,
};

const calendar: CalendarReadModel = {
  assignments: [
    {
      businessDate: '2026-08-01',
      changeMarkers: [],
      endsAt: '2026-08-01T00:00:00.000Z',
      id: 'assignment-1',
      plannedMembershipId: 'membership-1',
      plannedMemberName: '张医生',
      schedulePeriodId: 'period-1',
      scheduleRoleId: 'role-1',
      scheduleRoleName: '一线',
      shiftTypeAbbreviation: '全',
      shiftTypeColor: '#1F5AA6',
      shiftTypeId: 'shift-1',
      shiftTypeName: '全天班',
      shiftTypeTextColor: '#FFFFFF',
      slotPosition: 1,
      startsAt: '2026-07-31T16:00:00.000Z',
    },
  ],
  businessMonth: '2026-08',
  groupId: 'group-1',
  members: [
    {
      isConfirmed: false,
      membershipId: 'membership-1',
      realName: '张医生',
    },
  ],
  roles: [{ id: 'role-1', name: '一线' }],
  shiftTypes: [
    {
      abbreviation: '全',
      color: '#1F5AA6',
      crossesMidnight: true,
      endTime: '08:00',
      id: 'shift-1',
      isAllDay: true,
      name: '全天班',
      startTime: '08:00',
      textColor: '#FFFFFF',
    },
  ],
};

const holidays: HolidayReadModel = {
  confirmed: true,
  dates: [
    {
      date: '2026-01-01',
      holidayName: '元旦',
      isOffDay: true,
      isWorkday: false,
    },
  ],
  year: 2026,
};

const groupMember: GroupMember = {
  id: 'membership-1',
  isCurrentUser: true,
  realName: '张医生',
  role: 'owner',
};

const groupMemberContact: GroupMemberContact = {
  isConfirmed: false,
  membershipId: 'membership-1',
  version: 1,
};

const membershipClaimRequest: MembershipClaimRequest = {
  createdAt: '2026-08-01T00:00:00.000Z',
  groupId: 'group-1',
  id: 'claim-1',
  requestingUserId: 'user-1',
  requestingUserRealName: '张医生',
  status: 'pending',
  targetMemberRealName: '李医生',
  targetMembershipId: 'membership-2',
  version: 1,
};

const scheduleRole: ScheduleRole = {
  id: 'role-1',
  members: [
    {
      id: 'role-member-1',
      membershipId: 'membership-1',
      position: 1,
      realName: '张医生',
      version: 1,
    },
  ],
  name: '一线',
  rotationRule: {
    currentPosition: 1,
    defaultShiftTypeId: 'shift-1',
    requiredMembersPerDay: 1,
    version: 1,
  },
  version: 1,
};

const shiftType: ShiftType = {
  abbreviation: '全',
  color: '#1F5AA6',
  configurationVersion: 1,
  countsTowardStatistics: true,
  crossesMidnight: true,
  displayOrder: 1,
  endTime: '08:00',
  id: 'shift-1',
  isAllDay: true,
  isBuiltIn: true,
  isEnabled: true,
  name: '全天班',
  startTime: '08:00',
  textColor: '#FFFFFF',
  version: 1,
};

const schedulingConfig: SchedulingConfig = {
  groupMembers: [{ membershipId: 'membership-1', realName: '张医生' }],
  roles: [scheduleRole],
  rulesVersion: 3,
  shiftTypes: [shiftType],
};

const scheduleDraft: ScheduleDraftSummary = {
  businessMonth: '2026-08',
  id: 'period-1',
  revision: 1,
  rulesVersion: 3,
  scheduleRoleId: 'role-1',
  scheduleRoleName: '一线',
  status: 'draft',
  version: 1,
};

const schedulePeriodHistoryItem: SchedulePeriodHistoryItem = {
  businessMonth: '2026-08',
  createdAt: '2026-08-01T00:00:00.000Z',
  id: 'period-1',
  revision: 1,
  scheduleRoleId: 'role-1',
  scheduleRoleName: '一线',
  status: 'draft',
  version: 1,
};

const scheduleWorkflowImpact: ScheduleWorkflowImpact = {
  businessDates: ['2026-08-01'],
  id: 'impact-1',
  kind: 'swap',
  memberNames: ['张医生', '李医生'],
  status: 'pending',
};

const scheduleGenerationPreview: ScheduleGenerationPreview = {
  assignments: [
    {
      businessDate: '2026-08-01',
      endsAt: '2026-08-02T00:00:00.000Z',
      scheduleRoleId: 'role-1',
      scheduleRoleName: '一线',
      shiftTypeAbbreviation: '全',
      shiftTypeColor: '#1F5AA6',
      shiftTypeId: 'shift-1',
      shiftTypeName: '全天班',
      slotPosition: 1,
      startsAt: '2026-07-31T16:00:00.000Z',
    },
  ],
  businessMonth: '2026-08',
  continuousDutyWarnings: [],
  hardConflicts: [],
  rulesVersion: 3,
  scheduleRoleIds: ['role-1'],
  statistics: {
    assignmentCount: 1,
    byRole: [],
    byShiftType: [],
    countedAssignmentCount: 1,
    vacancyCount: 0,
  },
  vacancies: [],
};

const scheduleChangeImpactPreview: ScheduleChangeImpactPreview = {
  action: 'publish',
  affectedPeriodIds: ['period-1'],
  workflowImpacts: [scheduleWorkflowImpact],
};

const pastSchedulePeriod: PastSchedulePeriod = {
  businessMonth: '2026-07',
  id: 'past-1',
  periodStatus: 'past',
  revision: 1,
  scheduleRoleId: 'role-1',
  scheduleRoleName: '一线',
  version: 1,
};

const pastScheduleAssignment: PastScheduleAssignment = {
  assignmentId: 'assignment-1',
  businessDate: '2026-07-01',
  shiftTypeAbbreviation: '全',
  shiftTypeId: 'shift-1',
  shiftTypeName: '全天班',
  slotPosition: 1,
};

const pastScheduleBackfillRecord: PastScheduleBackfillRecord = {
  assignmentId: 'assignment-1',
  backfilledAt: '2026-08-01T00:00:00.000Z',
  businessDate: '2026-07-01',
  operatorName: '张医生',
  shiftTypeAbbreviation: '全',
  shiftTypeName: '全天班',
};

const pastScheduleBackfillBatchResult: PastScheduleBackfillBatchResult = {
  assignments: [pastScheduleAssignment],
  eventIds: ['event-1'],
};

const swapAssignment: SwapAssignmentSummary = {
  assignmentId: 'assignment-1',
  businessDate: '2026-08-01',
  endsAt: '2026-08-02T00:00:00.000Z',
  scheduleRoleId: 'role-1',
  scheduleRoleName: '一线',
  shiftTypeAbbreviation: '全',
  shiftTypeColor: '#1F5AA6',
  shiftTypeId: 'shift-1',
  shiftTypeName: '全天班',
  shiftTypeTextColor: '#FFFFFF',
  slotPosition: 1,
  startsAt: '2026-07-31T16:00:00.000Z',
  version: 1,
};

const swapPreview: SwapPreview = {
  conflicts: [],
  groupId: 'group-1',
  initiatorAssignment: swapAssignment,
  initiatorEligibleForTargetShift: true,
  nextStatus: 'pending_target',
  requiresApproval: false,
  targetAssignment: { ...swapAssignment, assignmentId: 'assignment-2' },
  targetAutoAccepts: true,
  targetEligibleForInitiatorShift: true,
};

const swapRequest: SwapRequest = {
  createdAt: '2026-08-01T00:00:00.000Z',
  groupId: 'group-1',
  id: 'swap-1',
  initiatorAssignment: swapAssignment,
  initiatorAssignmentId: 'assignment-1',
  initiatorAssignmentVersion: 1,
  initiatorMembershipId: 'membership-1',
  status: 'pending_target',
  targetAssignment: { ...swapAssignment, assignmentId: 'assignment-2' },
  targetAssignmentId: 'assignment-2',
  targetAssignmentVersion: 1,
  targetMembershipId: 'membership-2',
  version: 1,
};

const dutyAdjustmentPreview: DutyAdjustmentPreview = {
  conflicts: [],
  coveredAssignment: { ...swapAssignment },
  groupId: 'group-1',
  nextStatus: 'pending_target',
  overtimeAutoAccepts: true,
  requiresApproval: false,
};

const dutyAdjustmentRequest: DutyAdjustmentRequest = {
  assignmentVersion: 1,
  coveredAssignment: { ...swapAssignment },
  coveredAssignmentId: 'assignment-1',
  createdAt: '2026-08-01T00:00:00.000Z',
  deductedMembershipId: 'membership-1',
  groupId: 'group-1',
  id: 'duty-1',
  overtimeMembershipId: 'membership-2',
  status: 'pending_target',
  version: 1,
};

const leaveRequest: LeaveRequest = {
  createdAt: '2026-08-01T00:00:00.000Z',
  endsAt: '2026-08-05T00:00:00.000Z',
  groupId: 'group-1',
  id: 'leave-1',
  isAllDay: true,
  leaveType: 'training',
  membershipId: 'membership-1',
  reflowStrategy: 'keep-original-order',
  startsAt: '2026-08-01T00:00:00.000Z',
  status: 'pending',
  version: 1,
};

const leaveAffectedShift: LeaveAffectedShift = {
  assignmentId: 'assignment-1',
  businessDate: '2026-08-01',
  isCovered: false,
  shiftTypeAbbreviation: '全',
  shiftTypeName: '全天班',
};

const leaveAffectedAssignment: LeaveAffectedAssignment = {
  assignmentId: 'assignment-1',
  businessDate: '2026-08-01',
  endsAt: '2026-08-02T00:00:00.000Z',
  shiftTypeAbbreviation: '全',
  shiftTypeColor: '#1F5AA6',
  shiftTypeId: 'shift-1',
  shiftTypeName: '全天班',
  shiftTypeTextColor: '#FFFFFF',
  slotPosition: 1,
  startsAt: '2026-07-31T16:00:00.000Z',
};

const leaveStatisticsDelta: LeaveStatisticsDelta = {
  byMember: [],
  totalAssignmentDelta: 0,
  totalCountedDelta: 0,
  totalWeekendDelta: 0,
};

const leaveWorkflowBlocker: LeaveWorkflowBlocker = {
  assignmentId: 'assignment-1',
  message: '存在后续工作流',
};

const leaveReflowPreview: LeaveReflowPreview = {
  affectedAssignments: [],
  affectedShiftCount: 0,
  affectedShifts: [],
  conflicts: [],
  continuousDutyWarnings: [],
  groupDefaultStrategy: 'keep-original-order',
  leaveRequestId: 'leave-1',
  leaveRequestVersion: 1,
  overlapsUnpublishedPeriod: false,
  periodVersions: {},
  rulesVersion: 3,
  statisticsDelta: leaveStatisticsDelta,
  strategy: 'keep-original-order',
  vacancies: [],
  workflowBlockers: [],
};

const approvedLeaveResult: ApprovedLeaveRequestResult = {
  leaveRequest,
  operationId: 'op-1',
  preview: leaveReflowPreview,
  status: 'approved',
  strategy: 'keep-original-order',
};

const leaveRequestMutationResult: LeaveRequestMutationResult = {
  leaveRequestId: 'leave-1',
  operationId: 'op-1',
  status: 'cancelled',
};

const scheduleEvent: ScheduleEvent = {
  affectedMembershipIds: ['membership-1'],
  affectedShiftIds: ['assignment-1'],
  eventStatus: 'completed',
  eventType: 'swap_completed',
  groupId: 'group-1',
  id: 'event-1',
  objectType: 'swap',
  occurredAt: '2026-08-01T00:00:00.000Z',
  operationId: 'op-1',
};

const notificationRecord: NotificationRecord = {
  body: '排班有更新',
  createdAt: '2026-08-01T00:00:00.000Z',
  id: 'notification-1',
  isRead: false,
  notificationType: 'schedule_change',
  recipientUserId: 'user-1',
  title: '排班更新',
};

const groupNotificationSettings: GroupNotificationSettings = {
  dutyReminderHours: [24, 2],
  groupId: 'group-1',
};

const memberNotificationPreferences: MemberNotificationPreferences = {
  browserNotificationsEnabled: true,
  dutyReminderHours: [24],
  membershipId: 'membership-1',
  wechatNotificationsEnabled: true,
};

const statisticsRoleCount = {
  actualCount: 1,
  plannedCount: 1,
  scheduleRoleId: 'role-1',
  scheduleRoleName: '一线',
};

const statisticsShiftTypeCount = {
  actualCount: 1,
  plannedCount: 1,
  shiftTypeId: 'shift-1',
  shiftTypeName: '全天班',
};

const statisticsMemberRow: StatisticsMemberRow = {
  actualCount: 1,
  actualVsPlanned: [],
  byRole: [statisticsRoleCount],
  byShiftType: [statisticsShiftTypeCount],
  countedActualCount: 1,
  countedPlannedCount: 1,
  deductionCount: 0,
  deltaCount: 0,
  holidayCount: 0,
  leaveCoverCount: 0,
  manualAdjustmentCount: 0,
  membershipId: 'membership-1',
  netDutyAdjustment: 0,
  overtimeCount: 0,
  plannedCount: 1,
  realName: '张医生',
  swapCount: 0,
  weekendCount: 0,
};

const statisticsSummary: StatisticsSummary = {
  actualCount: 1,
  byRole: [statisticsRoleCount],
  byShiftType: [statisticsShiftTypeCount],
  countedActualCount: 1,
  countedPlannedCount: 1,
  deductionCount: 0,
  holidayCount: 0,
  leaveCoverCount: 0,
  manualAdjustmentCount: 0,
  members: [statisticsMemberRow],
  netDutyAdjustment: 0,
  overtimeCount: 0,
  plannedCount: 1,
  swapCount: 0,
  weekendCount: 0,
};

const monthStatisticsSnapshot: MonthStatisticsSnapshot = {
  businessMonth: '2026-08',
  computedAt: '2026-08-01T00:00:00.000Z',
  groupId: 'group-1',
  summary: statisticsSummary,
  version: 1,
};

const yearStatistics: YearStatistics = {
  months: [{ businessMonth: '2026-08', summary: statisticsSummary }],
  summary: statisticsSummary,
  year: 2026,
};

const statisticsRecalculateCheckResult: StatisticsRecalculateCheckResult = {
  businessMonth: '2026-08',
  matched: true,
  mismatches: [],
  recomputed: statisticsSummary,
  snapshot: statisticsSummary,
  snapshotVersion: 1,
};

const scheduleExportJob: ScheduleExportJob = {
  createdAt: '2026-08-01T00:00:00.000Z',
  exportType: 'schedule',
  groupId: 'group-1',
  id: 'export-1',
  period: '2026-08',
  periodType: 'month',
  status: 'completed',
};

const manualTemplate: ManualScheduleTemplate = {
  cells: [
    {
      currentShiftTypeConfigurationVersion: 1,
      cycleDay: 1,
      isShiftTypeEnabled: true,
      isStale: false,
      membershipId: 'membership-1',
      shiftTypeAbbreviation: '全',
      shiftTypeColor: '#1F5AA6',
      shiftTypeConfigurationVersion: 1,
      shiftTypeId: 'shift-1',
      shiftTypeName: '全天班',
      shiftTypeTextColor: '#FFFFFF',
    },
  ],
  cycleDays: 7,
  groupId: 'group-1',
  id: 'template-1',
  members: [
    {
      currentMemberScheduleRoleVersion: 1,
      isAvailable: true,
      isStale: false,
      membershipId: 'membership-1',
      memberScheduleRoleVersion: 1,
      realName: '张医生',
    },
  ],
  scheduleRoleId: 'role-1',
  scheduleRoleName: '一线',
  startDate: '2026-08-01',
  version: 1,
};

const manualApplyPreview: ManualApplyPreview = {
  applyEndDate: '2026-08-07',
  applyStartDate: '2026-08-01',
  assignments: [
    {
      businessDate: '2026-08-01',
      endsAt: '2026-08-02T00:00:00.000Z',
      plannedMemberId: 'membership-1',
      plannedMemberName: '张医生',
      scheduleRoleId: 'role-1',
      scheduleRoleName: '一线',
      shiftTypeAbbreviation: '全',
      shiftTypeColor: '#1F5AA6',
      shiftTypeId: 'shift-1',
      shiftTypeName: '全天班',
      slotPosition: 1,
      startsAt: '2026-08-01T00:00:00.000Z',
    },
  ],
  conflicts: [],
  continuousDutyWarnings: [],
  cycleDays: 7,
  rulesVersion: 3,
  scheduleRoleId: 'role-1',
  scheduleRoleName: '一线',
  statistics: {
    assignmentCount: 1,
    byRole: [
      {
        assignmentCount: 1,
        countedAssignmentCount: 1,
        scheduleRoleId: 'role-1',
        scheduleRoleName: '一线',
        vacancyCount: 0,
      },
    ],
    byShiftType: [
      {
        assignmentCount: 1,
        countedAssignmentCount: 1,
        shiftTypeAbbreviation: '全',
        shiftTypeId: 'shift-1',
        shiftTypeName: '全天班',
      },
    ],
    countedAssignmentCount: 1,
    vacancyCount: 0,
  },
  templateId: 'template-1',
  templateVersion: 1,
  vacancies: [],
};

const appliedManualTemplate: AppliedManualScheduleTemplateResult = {
  operationId: 'operation-1',
  periods: [
    {
      businessMonth: '2026-08-01',
      id: 'period-1',
      revision: 1,
      rulesVersion: 3,
      scheduleRoleId: 'role-1',
      status: 'draft',
      version: 1,
    },
  ],
  preview: manualApplyPreview,
  publishMode: 'draft',
  status: 'draft',
  templateId: 'template-1',
  templateVersion: 1,
};

describe('Web API client', () => {
  it('loads directory facets, restores preferred entries, and forwards independent search filters', async () => {
    const facets: DirectoryFacetSnapshot = {
      buildings: [],
      campuses: [{ count: 2, label: '本部院区', value: 'main' }],
      departments: [],
      entryKinds: [{ count: 2, label: '科室', value: 'department' }],
      floors: [{ count: 1, label: '5楼', value: '5楼' }],
      paths: [
        {
          campusCode: 'main',
          count: 2,
          entryKind: 'department',
          floor: '5楼',
        },
      ],
      publishedEffectiveOn: '2026-07-05',
      publishedImportVersion: 'directory-2026-07-05',
      sections: [],
      subunits: [],
      totalCount: 2,
    };
    const page: DirectoryPage = {
      entries: [],
      totalCount: 0,
    };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(facets), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ entries: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(page), { status: 200 }));
    const client = createApiClient({ auth: createAuthClient(), fetch: fetchImplementation });

    await expect(client.getDirectoryFacets(group.id)).resolves.toEqual(facets);
    await expect(
      client.lookupDirectoryEntries(group.id, ['00000000-0000-4000-8000-000000000001']),
    ).resolves.toEqual([]);
    await expect(
      client.searchDirectory(group.id, {
        campusCode: 'main',
        entryKind: 'department',
        floor: '5楼',
        pageSize: 24,
        q: '病案',
      }),
    ).resolves.toEqual(page);

    expect(fetchImplementation).toHaveBeenNthCalledWith(
      1,
      '/api/groups/group-1/directory/facets',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(fetchImplementation).toHaveBeenNthCalledWith(
      2,
      '/api/groups/group-1/directory/lookup',
      expect.objectContaining({
        body: JSON.stringify({ entryIds: ['00000000-0000-4000-8000-000000000001'] }),
        method: 'POST',
      }),
    );
    expect(fetchImplementation).toHaveBeenNthCalledWith(
      3,
      '/api/groups/group-1/directory?campusCode=main&entryKind=department&floor=5%E6%A5%BC&pageSize=24&q=%E7%97%85%E6%A1%88',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer signed-in-token' }),
        method: 'GET',
      }),
    );
  });
  it('sends the current access token to the profile endpoint', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(profile), { status: 201 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.createCurrentProfile({ realName: profile.realName })).resolves.toEqual(
      profile,
    );

    expect(fetchImplementation).toHaveBeenCalledWith(
      '/api/users',
      expect.objectContaining({
        body: JSON.stringify({ realName: profile.realName }),
        headers: {
          Authorization: 'Bearer signed-in-token',
          'Content-Type': 'application/json',
        },
        method: 'POST',
      }),
    );
  });

  it('uses the employee directory endpoints without changing the shared query shape', async () => {
    const employeeFacets: DirectoryFacetSnapshot = {
      buildings: [],
      campuses: [],
      departments: [],
      entryKinds: [],
      floors: [],
      paths: [],
      publishedEffectiveOn: '2026-08-19',
      publishedImportVersion: 'employee-test',
      sections: [],
      subunits: [],
      totalCount: 0,
    };
    const page: DirectoryPage = { entries: [], totalCount: 0 };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(employeeFacets), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ entries: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(page), { status: 200 }));
    const client = createApiClient({ auth: createAuthClient(), fetch: fetchImplementation });

    await expect(client.getEmployeeDirectoryFacets(group.id)).resolves.toEqual(employeeFacets);
    await expect(
      client.lookupEmployeeDirectoryEntries(group.id, ['00000000-0000-4000-8000-000000000001']),
    ).resolves.toEqual([]);
    await expect(client.searchEmployeeDirectory(group.id, { q: '54543' })).resolves.toEqual(page);

    expect(fetchImplementation).toHaveBeenNthCalledWith(
      1,
      '/api/groups/group-1/employee-directory/facets',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(fetchImplementation).toHaveBeenNthCalledWith(
      2,
      '/api/groups/group-1/employee-directory/lookup',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchImplementation).toHaveBeenNthCalledWith(
      3,
      '/api/groups/group-1/employee-directory?q=54543',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('keeps the global receiver when calling the default fetch', async () => {
    const receiverSensitiveFetch = vi.fn<typeof fetch>().mockImplementation(function (
      this: unknown,
    ) {
      if (this === undefined) {
        throw new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation");
      }
      return Promise.resolve(new Response(JSON.stringify(profile), { status: 200 }));
    });
    vi.stubGlobal('fetch', receiverSensitiveFetch);

    try {
      const client = createApiClient({ auth: createAuthClient() });
      await expect(client.getCurrentProfile()).resolves.toEqual(profile);
      expect(receiverSensitiveFetch).toHaveBeenCalled();
      expect(receiverSensitiveFetch.mock.contexts[0]).toBe(globalThis);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('sends group creation, roster claiming, and group-code updates through authenticated API calls', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(group), { status: 201 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'request_created' }), { status: 202 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ...group, groupCode: '9876', version: 2 }), { status: 200 }),
      );
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(
      client.createGroup({ groupCode: '1234', name: 'Emergency Department' }),
    ).resolves.toEqual(group);
    await expect(client.claimGroup({ groupCode: '1234' })).resolves.toEqual({
      status: 'request_created',
    });
    await expect(client.updateGroupCode(group.id, { groupCode: '5678' })).resolves.toEqual({
      ...group,
      groupCode: '9876',
      version: 2,
    });

    expect(fetchImplementation).toHaveBeenNthCalledWith(
      1,
      '/api/groups',
      expect.objectContaining({
        body: JSON.stringify({ groupCode: '1234', name: 'Emergency Department' }),
        method: 'POST',
      }),
    );
    expect(fetchImplementation).toHaveBeenNthCalledWith(
      2,
      '/api/groups/claim',
      expect.objectContaining({
        body: JSON.stringify({ groupCode: '1234' }),
        method: 'POST',
      }),
    );
    expect(fetchImplementation).toHaveBeenNthCalledWith(
      3,
      '/api/groups/group-1/group-code',
      expect.objectContaining({ body: JSON.stringify({ groupCode: '5678' }), method: 'PUT' }),
    );
  });

  it('sends group membership self-service calls through authenticated API calls', async () => {
    const catalog: GroupCatalogEntry[] = [
      { id: 'group-1', name: 'Emergency Department', relation: 'none' },
    ];
    const guestGroup: GroupSummary = {
      id: 'group-1',
      name: 'Emergency Department',
      role: 'guest',
      version: 1,
    };
    const dissolved: DissolvedGroup[] = [
      { deletedAt: '2026-08-08T00:00:00.000Z', id: 'group-1', name: 'Emergency Department' },
    ];
    const guestCalendar: GuestCalendarReadModel = {
      calendar,
      groupName: 'Emergency Department',
    };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(catalog), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(guestGroup), { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(group), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(dissolved), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(guestCalendar), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.listGroupCatalog()).resolves.toEqual(catalog);
    await expect(client.joinGroupAsGuest('group-1')).resolves.toEqual(guestGroup);
    await expect(client.leaveGroup('group-1')).resolves.toBeUndefined();
    await expect(client.updateGroupName('group-1', { name: 'Renamed group' })).resolves.toEqual(
      group,
    );
    await expect(client.listDissolvedGroups()).resolves.toEqual(dissolved);
    await expect(client.restoreGroup('group-1')).resolves.toBeUndefined();
    await expect(client.getGroupGuestCalendar('group-1', '2026-08')).resolves.toEqual(
      guestCalendar,
    );

    expect(fetchImplementation).toHaveBeenNthCalledWith(
      1,
      '/api/groups/catalog',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(fetchImplementation).toHaveBeenNthCalledWith(
      2,
      '/api/groups/group-1/join-guest',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchImplementation).toHaveBeenNthCalledWith(
      3,
      '/api/groups/group-1/leave',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchImplementation).toHaveBeenNthCalledWith(
      4,
      '/api/groups/group-1/name',
      expect.objectContaining({
        body: JSON.stringify({ name: 'Renamed group' }),
        method: 'PUT',
      }),
    );
    expect(fetchImplementation).toHaveBeenNthCalledWith(
      5,
      '/api/groups/dissolved',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(fetchImplementation).toHaveBeenNthCalledWith(
      6,
      '/api/groups/group-1/restore',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchImplementation).toHaveBeenNthCalledWith(
      7,
      '/api/groups/group-1/guest-calendar?businessMonth=2026-08',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('loads the calendar read model for a group and month', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(calendar), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.getCalendar(group.id, '2026-08')).resolves.toEqual(calendar);

    expect(fetchImplementation).toHaveBeenCalledWith(
      '/api/groups/group-1/calendar?businessMonth=2026-08',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('resolves a visitor key and reads a selected guest month', async () => {
    const resolved = { groupId: group.id, groupName: group.name };
    const guestCalendar = { calendar, groupName: group.name };
    const visitorKey = 'a'.repeat(32);
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(resolved), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(guestCalendar), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.resolveGuestGroup(visitorKey)).resolves.toEqual(resolved);
    await expect(
      client.getGuestGroupCalendarByVisitorKey(group.id, visitorKey, '2026-08'),
    ).resolves.toEqual(guestCalendar);

    expect(fetchImplementation).toHaveBeenNthCalledWith(
      1,
      '/api/guest/groups/resolve',
      expect.objectContaining({ body: JSON.stringify({ visitorKey }), method: 'POST' }),
    );
    expect(fetchImplementation).toHaveBeenNthCalledWith(
      2,
      `/api/guest/groups/group-1/calendar?businessMonth=2026-08&visitorKey=${visitorKey}`,
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('loads confirmed holidays through the public guest endpoint', async () => {
    const guestHolidays = {
      confirmed: true,
      dates: [
        {
          date: '2026-01-01',
          holidayName: '元旦',
          isOffDay: true,
          isWorkday: false,
        },
      ],
      year: 2026,
    };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(guestHolidays), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.getGuestHolidays(2026)).resolves.toEqual(guestHolidays);

    expect(fetchImplementation).toHaveBeenCalledWith(
      '/api/guest/holidays?year=2026',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('rejects a holidays response with unknown fields', async () => {
    const extendedHolidays = { ...holidays, extra: 'kept' };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(extendedHolidays), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.getHolidays(2026)).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a holidays response with a non-integer year', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ ...holidays, year: 2026.5 }), { status: 200 }),
      );
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.getHolidays(2026)).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a holidays response whose confirmed flag is not a boolean', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ ...holidays, confirmed: 'true' }), { status: 200 }),
      );
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.getHolidays(2026)).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a holidays response without a dates array', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ confirmed: true, year: 2026 }), { status: 200 }),
      );
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.getHolidays(2026)).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a holidays date entry missing its holiday name', async () => {
    const invalidHolidays = {
      ...holidays,
      dates: [{ date: '2026-01-01', isOffDay: true, isWorkday: false }],
    };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidHolidays), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.getHolidays(2026)).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a holidays date entry with a non-boolean isOffDay', async () => {
    const invalidHolidays = {
      ...holidays,
      dates: [{ ...holidays.dates[0], isOffDay: 'yes' }],
    };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidHolidays), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.getHolidays(2026)).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a holidays date entry with a non-string date', async () => {
    const invalidHolidays = {
      ...holidays,
      dates: [{ ...holidays.dates[0], date: 20260101 }],
    };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidHolidays), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.getHolidays(2026)).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects an add roster response with a non-positive added count', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ added: 0 }), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(
      client.addRosterEntries(group.id, { realNames: ['张医生'] }),
    ).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a convert roster response with a negative skipped count', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ converted: 1, skipped: -1 }), { status: 200 }),
      );
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(
      client.convertRosterEntries(group.id, { realNames: ['张医生'] }),
    ).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a claimed group response without its group', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ status: 'claimed' }), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(
      client.claimGroup({ groupCode: '1234', realName: '张医生' }),
    ).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a claim lookup response with an invalid role', async () => {
    const invalidLookup = {
      matches: [
        {
          isUnclaimed: true,
          membershipId: 'membership-1',
          realName: '张医生',
          role: 'admin',
        },
      ],
    };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidLookup), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.lookupClaimMatches(group.id, '张医生')).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a membership claim request with an unknown status', async () => {
    const futureStatusClaim = { ...membershipClaimRequest, status: 'future-status' };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(futureStatusClaim), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(
      client.approveMembershipClaimRequest(group.id, membershipClaimRequest.id),
    ).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a membership claim request list with a non-number version', async () => {
    const invalidClaim = { ...membershipClaimRequest, version: '1' };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify([invalidClaim]), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.listMembershipClaimRequests(group.id)).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a direct claim response that still includes a request', async () => {
    const invalidResponse = { direct: true, request: membershipClaimRequest };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidResponse), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(
      client.createMembershipClaimRequest(group.id, { membershipId: 'membership-2' }),
    ).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a non-direct claim response without a request', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ direct: false }), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(
      client.createMembershipClaimRequest(group.id, { membershipId: 'membership-2' }),
    ).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('accepts a group member with optional claim fields', async () => {
    const fullMember = {
      ...groupMember,
      claimRequestStatus: 'pending',
      claimedByName: '张医生',
      isClaimedByCurrentUser: true,
      isPendingRoster: true,
      isUnclaimed: true,
    };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify([fullMember]), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.listGroupMembers(group.id)).resolves.toEqual([fullMember]);
  });

  it('rejects a group member with an empty real name', async () => {
    const invalidMember = { ...groupMember, realName: '' };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify([invalidMember]), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.listGroupMembers(group.id)).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a group member contact with a negative version', async () => {
    const invalidContact = { ...groupMemberContact, version: -1 };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify([invalidContact]), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.listGroupContacts(group.id)).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a group summary with a malformed group code', async () => {
    const invalidGroup = { ...group, groupCode: '123' };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify([invalidGroup]), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.listGroups()).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a group summary with an unknown role', async () => {
    const invalidGroup = { ...group, role: 'admin' };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify([invalidGroup]), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.listGroups()).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a schedule publish mode with an unknown mode', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ publishMode: 'auto' }), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.getSchedulePublishMode(group.id)).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('accepts a scheduling config without a rules version', async () => {
    const configWithoutRulesVersion = {
      groupMembers: schedulingConfig.groupMembers,
      roles: schedulingConfig.roles,
      shiftTypes: schedulingConfig.shiftTypes,
    };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(configWithoutRulesVersion), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.getSchedulingConfig(group.id)).resolves.toEqual(configWithoutRulesVersion);
  });

  it('rejects a scheduling config with a non-numeric rules version', async () => {
    const invalidConfig = { ...schedulingConfig, rulesVersion: '3' };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidConfig), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.getSchedulingConfig(group.id)).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a scheduling config with a non-array roles field', async () => {
    const invalidConfig = { ...schedulingConfig, roles: {} };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidConfig), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.getSchedulingConfig(group.id)).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a scheduling config with a scheduling group member whose real name is empty', async () => {
    const invalidConfig = {
      ...schedulingConfig,
      groupMembers: [{ membershipId: 'membership-1', realName: '' }],
    };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidConfig), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.getSchedulingConfig(group.id)).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a schedule role response with a non-integer version', async () => {
    const invalidRole = { ...scheduleRole, version: 1.5 };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidRole), { status: 201 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.createScheduleRole(group.id, { name: '一线' })).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 201,
    });
  });

  it('rejects a schedule role response whose member has a zero position', async () => {
    const invalidRole = {
      ...scheduleRole,
      members: [{ ...scheduleRole.members[0], position: 0 }],
    };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidRole), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(
      client.replaceScheduleRoleMembers(group.id, scheduleRole.id, {
        membershipIds: ['membership-1'],
      }),
    ).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a schedule role response whose rotation rule requires zero members per day', async () => {
    const invalidRole = {
      ...scheduleRole,
      rotationRule: { ...scheduleRole.rotationRule, requiredMembersPerDay: 0 },
    };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidRole), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(
      client.updateRotationRule(group.id, scheduleRole.id, {
        currentPosition: 1,
        defaultShiftTypeId: 'shift-1',
        requiredMembersPerDay: 1,
      }),
    ).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a shift type response with a malformed color', async () => {
    const invalidShiftType = { ...shiftType, color: 'blue' };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidShiftType), { status: 201 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(
      client.createShiftType(group.id, {
        abbreviation: '全',
        color: '#1F5AA6',
        countsTowardStatistics: true,
        crossesMidnight: true,
        endTime: '08:00',
        isEnabled: true,
        name: '全天班',
        startTime: '08:00',
      }),
    ).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 201,
    });
  });

  it('rejects a shift type response with a malformed start time', async () => {
    const invalidShiftType = { ...shiftType, startTime: '8:00' };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidShiftType), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(
      client.updateShiftType(group.id, shiftType.id, {
        abbreviation: '全',
        color: '#1F5AA6',
        countsTowardStatistics: true,
        crossesMidnight: true,
        endTime: '08:00',
        isEnabled: true,
        name: '全天班',
        startTime: '08:00',
      }),
    ).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('accepts a schedule draft summary missing the unvalidated period fields', async () => {
    const minimalDraft = {
      businessMonth: scheduleDraft.businessMonth,
      id: scheduleDraft.id,
      revision: scheduleDraft.revision,
      scheduleRoleName: scheduleDraft.scheduleRoleName,
      status: scheduleDraft.status,
    };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify([minimalDraft]), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.listScheduleDrafts(group.id)).resolves.toEqual([minimalDraft]);
  });

  it('rejects a schedule draft summary with a non-numeric rules version', async () => {
    const invalidDraft = { ...scheduleDraft, rulesVersion: '3' };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify([invalidDraft]), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.listScheduleDrafts(group.id)).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a schedule draft list entry with a non-integer revision', async () => {
    const invalidDraft = { ...scheduleDraft, revision: 1.5 };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify([invalidDraft]), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.listScheduleDrafts(group.id)).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a schedule period history item with an unknown status', async () => {
    const invalidItem = { ...schedulePeriodHistoryItem, status: 'archived' };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify([invalidItem]), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.listSchedulePeriodHistory(group.id)).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a schedule draft preview with a non-array schedule role ids field', async () => {
    const invalidPreview = { ...scheduleGenerationPreview, scheduleRoleIds: 'role-1' };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidPreview), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(
      client.getScheduleDraftPreview(group.id, schedulePeriodHistoryItem.id),
    ).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a schedule generation preview with non-array continuous duty warnings', async () => {
    const invalidPreview = { ...scheduleGenerationPreview, continuousDutyWarnings: {} };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidPreview), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(
      client.getScheduleDraftPreview(group.id, schedulePeriodHistoryItem.id),
    ).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a schedule change impact preview with an unknown action', async () => {
    const invalidPreview = { ...scheduleChangeImpactPreview, action: 'delete' };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidPreview), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(
      client.previewScheduleChange(group.id, schedulePeriodHistoryItem.id, 'publish'),
    ).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a publish schedule period result with non-array workflow impacts', async () => {
    const invalidResult = {
      period: scheduleDraft,
      preview: scheduleGenerationPreview,
      workflowImpacts: {},
    };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidResult), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(
      client.publishSchedulePeriod(group.id, schedulePeriodHistoryItem.id, {
        expectedVersion: 1,
        operationId: 'op-1',
      }),
    ).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a publish batch result whose period has an empty status', async () => {
    const invalidPeriod = { ...scheduleDraft, status: '' };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ periods: [invalidPeriod] }), { status: 200 }),
      );
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(
      client.publishScheduleDraftBatch(group.id, {
        operationId: 'op-1',
        schedulePeriodIds: [schedulePeriodHistoryItem.id],
      }),
    ).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a schedule period mutation result with a malformed period', async () => {
    const invalidResult = {
      period: { ...scheduleDraft, id: '' },
      workflowImpacts: [scheduleWorkflowImpact],
    };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidResult), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(
      client.withdrawSchedulePeriod(group.id, schedulePeriodHistoryItem.id, {
        expectedVersion: 1,
        operationId: 'op-1',
      }),
    ).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
    expect(fetchImplementation).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ 'Idempotency-Key': 'op-1' }),
      }),
    );
  });

  it('sends the delete operation id in the Idempotency-Key header', async () => {
    const operationId = '33333333-3333-4333-8333-333333333333';
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(
      client.deleteScheduleDraft(group.id, schedulePeriodHistoryItem.id, operationId),
    ).resolves.toBeUndefined();
    expect(fetchImplementation).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ 'Idempotency-Key': operationId }),
        method: 'DELETE',
      }),
    );
  });

  it('rejects a past schedule period with a malformed business month', async () => {
    const invalidPeriod = { ...pastSchedulePeriod, businessMonth: '2026-7' };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify([invalidPeriod]), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.listPastSchedulePeriods(group.id)).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a past schedule assignment with a non-integer slot position', async () => {
    const invalidAssignment = { ...pastScheduleAssignment, slotPosition: 1.5 };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify([invalidAssignment]), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(
      client.listPastScheduleAssignments(group.id, pastSchedulePeriod.id),
    ).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a past schedule backfill record with a malformed business date', async () => {
    const invalidRecord = { ...pastScheduleBackfillRecord, businessDate: '2026-7-1' };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify([invalidRecord]), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.listPastScheduleBackfillRecords(group.id)).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('submits one atomic past schedule backfill batch with its idempotency key', async () => {
    const operationId = '22222222-2222-4222-8222-222222222222';
    const input = {
      items: [
        {
          actualMembershipId: '33333333-3333-4333-8333-333333333333',
          businessDate: '2026-07-01',
          scheduleRoleId: '44444444-4444-4444-8444-444444444444',
          shiftTypeId: '55555555-5555-4555-8555-555555555555',
        },
      ],
      operationId,
      reason: '实际值班人员更正',
    };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify(pastScheduleBackfillBatchResult), { status: 201 }),
      );
    const client = createApiClient({ auth: createAuthClient(), fetch: fetchImplementation });

    await expect(client.submitPastScheduleBackfillBatch(group.id, input)).resolves.toEqual(
      pastScheduleBackfillBatchResult,
    );
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
    expect(fetchImplementation).toHaveBeenCalledWith(
      '/api/groups/group-1/past-schedules/backfill-batches',
      {
        body: JSON.stringify(input),
        headers: {
          Authorization: 'Bearer signed-in-token',
          'Content-Type': 'application/json',
          'Idempotency-Key': operationId,
        },
        method: 'POST',
      },
    );
  });

  it('rejects an update past schedule result with an empty event id', async () => {
    const invalidResult = { assignment: pastScheduleAssignment, eventId: '' };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidResult), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(
      client.updatePastScheduleAssignment(
        group.id,
        pastSchedulePeriod.id,
        pastScheduleAssignment.assignmentId,
        { actualMembershipId: 'membership-2' },
      ),
    ).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a swap preview with an unknown conflict code', async () => {
    const invalidPreview = {
      ...swapPreview,
      conflicts: [{ code: 'UNKNOWN', membershipId: 'membership-1', message: '冲突' }],
    };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidPreview), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(
      client.previewSwap(group.id, {
        initiatorAssignmentId: 'assignment-1',
        targetAssignmentId: 'assignment-2',
        targetMembershipId: 'membership-2',
      }),
    ).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a swap preview whose assignment has a non-integer version', async () => {
    const invalidPreview = {
      ...swapPreview,
      initiatorAssignment: { ...swapAssignment, version: 1.5 },
    };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidPreview), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(
      client.previewSwap(group.id, {
        initiatorAssignmentId: 'assignment-1',
        targetAssignmentId: 'assignment-2',
        targetMembershipId: 'membership-2',
      }),
    ).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a swap preview whose assignment has a malformed shift type color', async () => {
    const invalidPreview = {
      ...swapPreview,
      targetAssignment: { ...swapAssignment, assignmentId: 'assignment-2', shiftTypeColor: 'blue' },
    };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidPreview), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(
      client.previewSwap(group.id, {
        initiatorAssignmentId: 'assignment-1',
        targetAssignmentId: 'assignment-2',
        targetMembershipId: 'membership-2',
      }),
    ).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a swap request with an unknown status', async () => {
    const invalidRequest = { ...swapRequest, status: 'unknown' };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify([invalidRequest]), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.listMySwapRequests(group.id)).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a swap request with an empty target assignment id', async () => {
    const invalidRequest = { ...swapRequest, targetAssignmentId: '' };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify([invalidRequest]), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.listSwapApprovals(group.id)).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects group swap settings with a non-boolean requiresApproval', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ requiresApproval: 'yes' }), { status: 200 }),
      );
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.getGroupSwapSettings(group.id)).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects member swap settings with a non-boolean autoAcceptSwaps', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ autoAcceptSwaps: 'yes' }), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.getMySwapSettings(group.id)).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a duty adjustment preview with an unknown status', async () => {
    const invalidPreview = { ...dutyAdjustmentPreview, nextStatus: 'unknown' };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidPreview), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(
      client.previewDutyAdjustment(group.id, {
        coveredAssignmentId: 'assignment-1',
        overtimeMembershipId: 'membership-2',
      }),
    ).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a duty adjustment conflict with an unknown code', async () => {
    const invalidPreview = {
      ...dutyAdjustmentPreview,
      conflicts: [{ code: 'UNKNOWN', membershipId: 'membership-1', message: '冲突' }],
    };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidPreview), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(
      client.previewDutyAdjustment(group.id, {
        coveredAssignmentId: 'assignment-1',
        overtimeMembershipId: 'membership-2',
      }),
    ).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a duty adjustment request with a non-integer assignment version', async () => {
    const invalidRequest = { ...dutyAdjustmentRequest, assignmentVersion: 1.5 };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify([invalidRequest]), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.listMyDutyAdjustments(group.id)).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a duty adjustment request whose covered assignment has a zero slot position', async () => {
    const invalidRequest = {
      ...dutyAdjustmentRequest,
      coveredAssignment: { ...swapAssignment, slotPosition: 0 },
    };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify([invalidRequest]), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.listDutyAdjustmentApprovals(group.id)).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects group duty adjustment settings with a non-boolean requiresApproval', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ requiresApproval: 'yes' }), { status: 200 }),
      );
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.getGroupDutyAdjustmentSettings(group.id)).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a leave request with an unknown status', async () => {
    const invalidRequest = { ...leaveRequest, status: 'unknown' };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify([invalidRequest]), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.listMyLeaveRequests(group.id)).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a leave request with an unknown leave type', async () => {
    const invalidRequest = { ...leaveRequest, leaveType: 'vacation' };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidRequest), { status: 201 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(
      client.createLeaveRequest(group.id, {
        endsAt: '2026-08-05T00:00:00.000Z',
        isAllDay: true,
        leaveType: 'training',
        startsAt: '2026-08-01T00:00:00.000Z',
      }),
    ).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 201,
    });
  });

  it('rejects a leave request with a non-integer version', async () => {
    const invalidRequest = { ...leaveRequest, version: 1.5 };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify([invalidRequest]), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.listLeaveRequestApprovals(group.id)).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects an affected shift list with a non-boolean isCovered', async () => {
    const invalidShift = { ...leaveAffectedShift, isCovered: 'yes' };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify([invalidShift]), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(
      client.getLeaveAffectedShifts(group.id, {
        endsAt: '2026-08-05T00:00:00.000Z',
        startsAt: '2026-08-01T00:00:00.000Z',
      }),
    ).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('accepts a leave reflow preview missing the unvalidated fields', async () => {
    const minimalPreview = {
      affectedAssignments: leaveReflowPreview.affectedAssignments,
      conflicts: leaveReflowPreview.conflicts,
      continuousDutyWarnings: leaveReflowPreview.continuousDutyWarnings,
      groupDefaultStrategy: leaveReflowPreview.groupDefaultStrategy,
      leaveRequestId: leaveReflowPreview.leaveRequestId,
      leaveRequestVersion: leaveReflowPreview.leaveRequestVersion,
      periodVersions: leaveReflowPreview.periodVersions,
      rulesVersion: leaveReflowPreview.rulesVersion,
      statisticsDelta: leaveReflowPreview.statisticsDelta,
      strategy: leaveReflowPreview.strategy,
      vacancies: leaveReflowPreview.vacancies,
      workflowBlockers: leaveReflowPreview.workflowBlockers,
    };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(minimalPreview), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(
      client.previewLeaveRequestApproval(group.id, leaveRequest.id, {}),
    ).resolves.toEqual(minimalPreview);
  });

  it('rejects a leave reflow preview with a non-numeric affected shift count', async () => {
    const invalidPreview = { ...leaveReflowPreview, affectedShiftCount: '1' };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidPreview), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(
      client.previewLeaveRequestApproval(group.id, leaveRequest.id, {}),
    ).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a leave reflow preview with non-array affected shifts', async () => {
    const invalidPreview = { ...leaveReflowPreview, affectedShifts: {} };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidPreview), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(
      client.previewLeaveRequestApproval(group.id, leaveRequest.id, {}),
    ).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a leave reflow preview with a non-boolean overlaps flag', async () => {
    const invalidPreview = { ...leaveReflowPreview, overlapsUnpublishedPeriod: 'yes' };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidPreview), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(
      client.previewLeaveRequestApproval(group.id, leaveRequest.id, {}),
    ).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a leave reflow preview with a non-array conflicts field', async () => {
    const invalidPreview = { ...leaveReflowPreview, conflicts: {} };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidPreview), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(
      client.previewLeaveRequestApproval(group.id, leaveRequest.id, {}),
    ).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a leave reflow preview with non-numeric period versions', async () => {
    const invalidPreview = { ...leaveReflowPreview, periodVersions: { 'period-1': 'x' } };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidPreview), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(
      client.previewLeaveRequestApproval(group.id, leaveRequest.id, {}),
    ).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a leave reflow preview with an empty workflow blocker message', async () => {
    const invalidPreview = {
      ...leaveReflowPreview,
      workflowBlockers: [{ ...leaveWorkflowBlocker, message: '' }],
    };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidPreview), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(
      client.previewLeaveRequestApproval(group.id, leaveRequest.id, {}),
    ).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a leave reflow preview with a malformed affected assignment color', async () => {
    const invalidPreview = {
      ...leaveReflowPreview,
      affectedAssignments: [{ ...leaveAffectedAssignment, shiftTypeColor: 'blue' }],
    };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidPreview), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(
      client.previewLeaveRequestApproval(group.id, leaveRequest.id, {}),
    ).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a leave reflow preview with a non-number statistics total', async () => {
    const invalidPreview = {
      ...leaveReflowPreview,
      statisticsDelta: { ...leaveStatisticsDelta, totalAssignmentDelta: '1' },
    };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidPreview), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(
      client.previewLeaveRequestApproval(group.id, leaveRequest.id, {}),
    ).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects group leave reflow strategy with an unknown strategy', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ strategy: 'manual' }), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.getLeaveReflowStrategy(group.id)).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects an approved leave result with the wrong status', async () => {
    const invalidResult = { ...approvedLeaveResult, status: 'rejected' };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidResult), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(
      client.approveLeaveRequest(group.id, leaveRequest.id, {
        expectedPeriodVersions: {},
        expectedRulesVersion: 3,
        expectedVersion: 1,
        operationId: 'op-1',
      }),
    ).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a leave request mutation result with an unknown status', async () => {
    const invalidResult = { ...leaveRequestMutationResult, status: 'pending' };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidResult), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(
      client.cancelLeaveRequest(group.id, leaveRequest.id, {
        expectedVersion: 1,
        operationId: 'op-1',
      }),
    ).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a manual apply preview with a malformed apply start date', async () => {
    const invalidPreview = { ...manualApplyPreview, applyStartDate: '2026-8-1' };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidPreview), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(
      client.previewManualTemplateApply(group.id, manualTemplate.id, {
        expectedRulesVersion: 3,
      }),
    ).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a manual apply preview with a non-integer cycle days', async () => {
    const invalidPreview = { ...manualApplyPreview, cycleDays: 7.5 };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidPreview), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(
      client.previewManualTemplateApply(group.id, manualTemplate.id, {
        expectedRulesVersion: 3,
      }),
    ).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a manual apply preview with a malformed assignment color', async () => {
    const invalidPreview = {
      ...manualApplyPreview,
      assignments: [{ ...manualApplyPreview.assignments[0], shiftTypeColor: 'blue' }],
    };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidPreview), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(
      client.previewManualTemplateApply(group.id, manualTemplate.id, {
        expectedRulesVersion: 3,
      }),
    ).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a manual apply preview with an unknown conflict code', async () => {
    const invalidPreview = {
      ...manualApplyPreview,
      conflicts: [{ code: 'UNKNOWN', membershipId: 'membership-1', message: '冲突' }],
    };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidPreview), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(
      client.previewManualTemplateApply(group.id, manualTemplate.id, {
        expectedRulesVersion: 3,
      }),
    ).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a manual apply preview with a non-array vacancies field', async () => {
    const invalidPreview = { ...manualApplyPreview, vacancies: {} };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidPreview), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(
      client.previewManualTemplateApply(group.id, manualTemplate.id, {
        expectedRulesVersion: 3,
      }),
    ).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a manual apply preview with a non-integer statistics count', async () => {
    const invalidPreview = {
      ...manualApplyPreview,
      statistics: { ...manualApplyPreview.statistics, assignmentCount: 1.5 },
    };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidPreview), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(
      client.previewManualTemplateApply(group.id, manualTemplate.id, {
        expectedRulesVersion: 3,
      }),
    ).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a manual schedule template with a cycle days above 30', async () => {
    const invalidTemplate = { ...manualTemplate, cycleDays: 31 };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify([invalidTemplate]), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.listManualScheduleTemplates(group.id)).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a manual schedule template member with a zero member role version', async () => {
    const invalidTemplate = {
      ...manualTemplate,
      members: [{ ...manualTemplate.members[0], memberScheduleRoleVersion: 0 }],
    };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify([invalidTemplate]), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.listManualScheduleTemplates(group.id)).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a manual schedule template cell with a zero cycle day', async () => {
    const invalidTemplate = {
      ...manualTemplate,
      cells: [{ ...manualTemplate.cells[0], cycleDay: 0 }],
    };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify([invalidTemplate]), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.listManualScheduleTemplates(group.id)).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects an applied manual template result with the wrong status', async () => {
    const invalidResult = { ...appliedManualTemplate, status: 'pending' };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidResult), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(
      client.applyManualTemplate(group.id, manualTemplate.id, {
        expectedRulesVersion: 3,
        operationId: 'op-1',
      }),
    ).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects an applied manual template result with a non-integer template version', async () => {
    const invalidResult = { ...appliedManualTemplate, templateVersion: 1.5 };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidResult), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(
      client.applyManualTemplate(group.id, manualTemplate.id, {
        expectedRulesVersion: 3,
        operationId: 'op-1',
      }),
    ).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a schedule event with a non-array affected shift ids', async () => {
    const invalidEvent = { ...scheduleEvent, affectedShiftIds: 'assignment-1' };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ events: [invalidEvent] }), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.getGroupEvents(group.id, { pageSize: 50 })).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a schedule event with an array afterData', async () => {
    const invalidEvent = { ...scheduleEvent, afterData: [] };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ events: [invalidEvent] }), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.getGroupEvents(group.id, { pageSize: 50 })).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a schedule event page with a non-string next cursor', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ events: [scheduleEvent], nextCursor: 5 }), { status: 200 }),
      );
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.getGroupEvents(group.id, { pageSize: 50 })).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a schedule event detail with a malformed related event', async () => {
    const invalidDetail = {
      event: scheduleEvent,
      relatedEvents: [{ ...scheduleEvent, id: '' }],
    };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidDetail), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.getEventDetail(group.id, scheduleEvent.id)).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a notification record with an empty title', async () => {
    const invalidRecord = { ...notificationRecord, title: '' };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidRecord), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.markNotificationRead(notificationRecord.id)).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a notification page with a non-integer unread count', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ notifications: [notificationRecord], unreadCount: 1.5 }), {
        status: 200,
      }),
    );
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.listNotifications({ pageSize: 30 })).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects an unread count result with a non-integer count', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ unreadCount: 1.5 }), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.getUnreadNotificationCount()).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a read-all result with a non-integer count', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ count: 1.5 }), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.markAllNotificationsRead(group.id)).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a saved result with a non-boolean saved flag', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ saved: 'yes' }), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(
      client.savePushSubscription({
        endpoint: 'https://example.com/push',
        keys: { auth: 'auth', p256dh: 'p256dh' },
      }),
    ).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a deleted result with a non-boolean deleted flag', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ deleted: 'yes' }), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.deletePushSubscription()).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects group notification settings with a non-integer reminder hour', async () => {
    const invalidSettings = { ...groupNotificationSettings, dutyReminderHours: [1.5] };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidSettings), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.getGroupNotificationSettings(group.id)).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects member notification preferences with a zero reminder hour', async () => {
    const invalidPreferences = {
      ...memberNotificationPreferences,
      dutyReminderHours: [0],
    };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidPreferences), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.getMyNotificationPreferences(group.id)).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('accepts legacy member notification preferences without the WeChat flag', async () => {
    const legacyPreferences = {
      browserNotificationsEnabled: true,
      dutyReminderHours: null,
      membershipId: memberNotificationPreferences.membershipId,
    };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(legacyPreferences), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.getMyNotificationPreferences(group.id)).resolves.toEqual({
      ...legacyPreferences,
      wechatNotificationsEnabled: true,
    });
  });

  it('rejects member notification preferences with a non-boolean WeChat flag', async () => {
    const invalidPreferences = {
      ...memberNotificationPreferences,
      wechatNotificationsEnabled: 'true',
    };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidPreferences), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.getMyNotificationPreferences(group.id)).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects push configuration with a non-null non-string vapid key', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ vapidPublicKey: 5 }), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.getPushConfiguration()).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('accepts a statistics member row with arbitrary actualVsPlanned entries', async () => {
    const lenientRow = { ...statisticsMemberRow, actualVsPlanned: ['anything'] };
    const lenientSnapshot = {
      ...monthStatisticsSnapshot,
      summary: { ...statisticsSummary, members: [lenientRow] },
    };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(lenientSnapshot), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.getMonthStatistics(group.id, '2026-08')).resolves.toEqual(lenientSnapshot);
  });

  it('rejects month statistics with a non-number version', async () => {
    const invalidSnapshot = { ...monthStatisticsSnapshot, version: '1' };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidSnapshot), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.getMonthStatistics(group.id, '2026-08')).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects month statistics with a summary missing members', async () => {
    const invalidSnapshot = {
      ...monthStatisticsSnapshot,
      summary: { ...statisticsSummary, members: undefined },
    };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidSnapshot), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.refreshMonthStatistics(group.id, '2026-08')).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects year statistics with a non-array months field', async () => {
    const invalidYear = { ...yearStatistics, months: {} };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidYear), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.getYearStatistics(group.id, 2026)).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects year statistics with a month summary missing byRole', async () => {
    const invalidYear = {
      ...yearStatistics,
      months: [{ businessMonth: '2026-08', summary: { ...statisticsSummary, byRole: undefined } }],
    };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidYear), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.getYearStatistics(group.id, 2026)).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a recalculate check result with a non-boolean matched flag', async () => {
    const invalidResult = { ...statisticsRecalculateCheckResult, matched: 'yes' };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidResult), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.recalculateStatistics(group.id, '2026-08')).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a recalculate check result with a non-string mismatch', async () => {
    const invalidResult = { ...statisticsRecalculateCheckResult, mismatches: [5] };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidResult), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.recalculateStatistics(group.id, '2026-08')).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects statistics summary with a non-array members field', async () => {
    const invalidSummary = { ...statisticsSummary, members: {} };
    const invalidSnapshot = { ...monthStatisticsSnapshot, summary: invalidSummary };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidSnapshot), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.getMonthStatistics(group.id, '2026-08')).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a statistics member row with a non-array actualVsPlanned field', async () => {
    const invalidRow = { ...statisticsMemberRow, actualVsPlanned: 'x' };
    const invalidSummary = {
      ...statisticsSummary,
      members: [invalidRow],
    };
    const invalidSnapshot = { ...monthStatisticsSnapshot, summary: invalidSummary };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidSnapshot), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.getMonthStatistics(group.id, '2026-08')).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a statistics member row with a non-string real name', async () => {
    const invalidRow = { ...statisticsMemberRow, realName: 5 };
    const invalidSummary = { ...statisticsSummary, members: [invalidRow] };
    const invalidSnapshot = { ...monthStatisticsSnapshot, summary: invalidSummary };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidSnapshot), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.getMonthStatistics(group.id, '2026-08')).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a statistics role count with a non-number planned count', async () => {
    const invalidSummary = {
      ...statisticsSummary,
      byRole: [{ ...statisticsRoleCount, plannedCount: '1' }],
    };
    const invalidSnapshot = { ...monthStatisticsSnapshot, summary: invalidSummary };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidSnapshot), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.getMonthStatistics(group.id, '2026-08')).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a statistics shift type count with a non-string shift type name', async () => {
    const invalidSummary = {
      ...statisticsSummary,
      byShiftType: [{ ...statisticsShiftTypeCount, shiftTypeName: 5 }],
    };
    const invalidSnapshot = { ...monthStatisticsSnapshot, summary: invalidSummary };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidSnapshot), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.getMonthStatistics(group.id, '2026-08')).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects an export job with an unknown export type', async () => {
    const invalidJob = { ...scheduleExportJob, exportType: 'csv' };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidJob), { status: 201 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(
      client.createExportJob(group.id, { exportType: 'schedule', period: '2026-08' }),
    ).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 201,
    });
  });

  it('rejects an export job with an unknown status', async () => {
    const invalidJob = { ...scheduleExportJob, status: 'unknown' };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidJob), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.getExportJob(group.id, scheduleExportJob.id)).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects an export job with a non-string period', async () => {
    const invalidJob = { ...scheduleExportJob, period: 202608 };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidJob), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.getExportJob(group.id, scheduleExportJob.id)).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects an export job missing createdAt', async () => {
    const invalidJob = {
      exportType: scheduleExportJob.exportType,
      groupId: scheduleExportJob.groupId,
      id: scheduleExportJob.id,
      period: scheduleExportJob.period,
      periodType: scheduleExportJob.periodType,
      status: scheduleExportJob.status,
    };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidJob), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.getExportJob(group.id, scheduleExportJob.id)).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a user profile with an empty id', async () => {
    const invalidProfile = { ...profile, id: '' };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidProfile), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.getCurrentProfile()).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a user profile with an empty real name', async () => {
    const invalidProfile = { ...profile, realName: '' };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidProfile), { status: 201 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.createCurrentProfile({ realName: '张医生' })).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 201,
    });
  });

  it('rejects a user profile with a non-integer version', async () => {
    const invalidProfile = { ...profile, version: 1.5 };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidProfile), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.updateProfile('张医生')).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a malformed calendar response', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ businessMonth: '2026-08' }), { status: 200 }),
      );
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.getCalendar(group.id, '2026-08')).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a calendar assignment with a removed change marker', async () => {
    const invalidCalendar = {
      ...calendar,
      assignments: [{ ...calendar.assignments[0], changeMarkers: ['manual-adjustment'] }],
    };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidCalendar), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.getCalendar(group.id, '2026-08')).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a calendar with an invalid business month format', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ ...calendar, businessMonth: '2026-8' }), { status: 200 }),
      );
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.getCalendar(group.id, '2026-08')).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a calendar member with an empty real name', async () => {
    const invalidCalendar = {
      ...calendar,
      members: [{ ...calendar.members[0], realName: '' }],
    };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidCalendar), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.getCalendar(group.id, '2026-08')).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a calendar shift type with a malformed color', async () => {
    const invalidCalendar = {
      ...calendar,
      shiftTypes: [{ ...calendar.shiftTypes[0], color: 'blue' }],
    };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(invalidCalendar), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.getCalendar(group.id, '2026-08')).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a guest calendar response without a group name', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ calendar }), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(
      client.getGuestGroupCalendarByVisitorKey(group.id, 'a'.repeat(32), '2026-08'),
    ).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a visitor resolve response missing its group name', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ groupId: group.id }), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.resolveGuestGroup('a'.repeat(32))).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('creates, lists, and updates manual schedule templates through authenticated API calls', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(manualTemplate), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([manualTemplate]), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ...manualTemplate, version: 2 }), { status: 200 }),
      );
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });
    const createInput = {
      cells: [{ cycleDay: 1, membershipId: 'membership-1', shiftTypeId: 'shift-1' }],
      cycleDays: 7,
      membershipIds: ['membership-1'],
      scheduleRoleId: 'role-1',
      startDate: '2026-08-01',
    };

    await expect(client.createManualScheduleTemplate(group.id, createInput)).resolves.toEqual(
      manualTemplate,
    );
    await expect(client.listManualScheduleTemplates(group.id)).resolves.toEqual([manualTemplate]);
    await expect(
      client.updateManualScheduleTemplate(group.id, manualTemplate.id, {
        ...createInput,
        expectedVersion: 1,
      }),
    ).resolves.toEqual({ ...manualTemplate, version: 2 });

    expect(fetchImplementation).toHaveBeenNthCalledWith(
      1,
      '/api/groups/group-1/manual-schedule-templates',
      expect.objectContaining({
        body: JSON.stringify(createInput),
        method: 'POST',
      }),
    );
    expect(fetchImplementation).toHaveBeenNthCalledWith(
      2,
      '/api/groups/group-1/manual-schedule-templates',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(fetchImplementation).toHaveBeenNthCalledWith(
      3,
      '/api/groups/group-1/manual-schedule-templates/template-1',
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('previews and applies a manual schedule template through authenticated API calls', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(manualApplyPreview), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(appliedManualTemplate), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(
      client.previewManualTemplateApply(group.id, manualTemplate.id, {
        expectedRulesVersion: 3,
      }),
    ).resolves.toEqual(manualApplyPreview);
    await expect(
      client.applyManualTemplate(group.id, manualTemplate.id, {
        expectedRulesVersion: 3,
        operationId: 'operation-1',
      }),
    ).resolves.toEqual(appliedManualTemplate);

    expect(fetchImplementation).toHaveBeenNthCalledWith(
      1,
      '/api/groups/group-1/manual-schedule-templates/template-1/apply-preview',
      expect.objectContaining({
        body: JSON.stringify({ expectedRulesVersion: 3 }),
        method: 'POST',
      }),
    );
    expect(fetchImplementation).toHaveBeenNthCalledWith(
      2,
      '/api/groups/group-1/manual-schedule-templates/template-1/apply',
      expect.objectContaining({
        body: JSON.stringify({ expectedRulesVersion: 3, operationId: 'operation-1' }),
        method: 'POST',
      }),
    );
  });

  it('loads the group schedule publish mode', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ publishMode: 'published' }), { status: 200 }),
      );
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.getSchedulePublishMode(group.id)).resolves.toEqual({
      publishMode: 'published',
    });
    expect(fetchImplementation).toHaveBeenCalledWith(
      '/api/groups/group-1/schedule-publish-mode',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('rejects a malformed manual apply preview response', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ applyStartDate: '2026-08-01' }), { status: 200 }),
      );
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(
      client.previewManualTemplateApply(group.id, manualTemplate.id, {
        expectedRulesVersion: 3,
      }),
    ).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('rejects a malformed manual template response', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ id: 'template-1' }), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.listManualScheduleTemplates(group.id)).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('maps the API conflict contract to a typed client error', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: 'CONFLICT',
            latestData: {
              id: 'template-1',
              objectType: 'manual_schedule_template',
              version: 2,
            },
            message: '资料已发生变化。',
            requestId: 'request-1',
          },
        }),
        { status: 409 },
      ),
    );
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.getCurrentProfile()).rejects.toMatchObject({
      code: 'CONFLICT',
      latestData: {
        id: 'template-1',
        objectType: 'manual_schedule_template',
        version: 2,
      },
      requestId: 'request-1',
      status: 409,
    });
  });

  it('maps every contract error code to a typed client error', async () => {
    for (const code of apiErrorCodes) {
      const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code,
              message: `message-${code}`,
              requestId: `request-${code}`,
            },
          }),
          { status: 400 },
        ),
      );
      const client = createApiClient({
        auth: createAuthClient(),
        fetch: fetchImplementation,
      });

      await expect(client.getCurrentProfile()).rejects.toMatchObject({
        code,
        message: `message-${code}`,
        requestId: `request-${code}`,
        status: 400,
      });
    }
  });

  it('treats an unknown error code as a generic HTTP failure', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: 'NOT_A_REAL_CODE',
            message: 'unknown body',
            requestId: 'request-unknown',
          },
        }),
        { status: 400 },
      ),
    );
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    const error = await client.getCurrentProfile().catch((caught: unknown) => caught);
    expect(error).toMatchObject({
      message: '服务暂时不可用，请稍后重试。',
      status: 400,
    });
    expect((error as { code?: string }).code).toBeUndefined();
  });

  it('rejects a malformed successful profile response', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ id: profile.id }), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.getCurrentProfile()).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('maps forbidden and network failures to recoverable client errors', async () => {
    const forbiddenClient = createApiClient({
      auth: createAuthClient(),
      fetch: vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: 'FORBIDDEN',
              message: '当前账户无权执行此操作。',
              requestId: 'request-2',
            },
          }),
          { status: 403 },
        ),
      ),
    });
    const networkClient = createApiClient({
      auth: createAuthClient(),
      fetch: vi.fn<typeof fetch>().mockRejectedValue(new TypeError('network unavailable')),
    });

    await expect(forbiddenClient.getCurrentProfile()).rejects.toMatchObject({
      code: 'FORBIDDEN',
      status: 403,
    });
    await expect(networkClient.getCurrentProfile()).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    });
  });

  it('blocks offline mutations with an explanation and never queues them', async () => {
    const fetchImplementation = vi.fn<typeof fetch>();
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
      isOnline: () => false,
    });

    await expect(
      client.createGroup({ groupCode: '1234', name: 'Emergency Department' }),
    ).rejects.toMatchObject({
      code: 'OFFLINE',
      message: expect.stringContaining('提交已暂停') as string,
    });
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it('still allows read-only calendar requests while offline', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(calendar), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
      isOnline: () => false,
    });

    await expect(client.getCalendar(group.id, '2026-08')).resolves.toEqual(calendar);
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
  });

  it('creates and lists leave requests with validated responses', async () => {
    const leaveRequest = {
      createdAt: '2026-08-01T00:00:00.000Z',
      endsAt: '2026-08-02T00:00:00.000Z',
      groupId: 'group-1',
      id: 'leave-1',
      isAllDay: true,
      leaveType: 'sick',
      memberName: '张医生',
      membershipId: 'membership-1',
      reason: '病假',
      reflowStrategy: 'keep-original-order',
      startsAt: '2026-08-01T00:00:00.000Z',
      status: 'pending',
      version: 1,
    } as const;
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(leaveRequest), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([leaveRequest]), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    const created = await client.createLeaveRequest('group-1', {
      endsAt: '2026-08-02T00:00:00.000Z',
      isAllDay: true,
      leaveType: 'sick',
      reason: '病假',
      startsAt: '2026-08-01T00:00:00.000Z',
    });
    expect(created).toEqual(leaveRequest);
    expect(await client.listMyLeaveRequests('group-1')).toEqual([leaveRequest]);
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
  });

  it('previews and approves a leave request and rejects malformed previews', async () => {
    const leaveRequest = {
      createdAt: '2026-08-01T00:00:00.000Z',
      endsAt: '2026-08-02T00:00:00.000Z',
      groupId: 'group-1',
      id: 'leave-1',
      isAllDay: true,
      leaveType: 'sick',
      memberName: '张医生',
      membershipId: 'membership-1',
      reason: '病假',
      reflowStrategy: 'keep-original-order',
      startsAt: '2026-08-01T00:00:00.000Z',
      status: 'approved',
      version: 2,
    } as const;
    const preview = {
      affectedAssignments: [],
      conflicts: [],
      continuousDutyWarnings: [],
      groupDefaultStrategy: 'keep-original-order',
      leaveRequestId: 'leave-1',
      leaveRequestVersion: 1,
      periodVersions: { 'period-1': 2 },
      rulesVersion: 3,
      statisticsDelta: {
        byMember: [],
        totalAssignmentDelta: 0,
        totalCountedDelta: 0,
        totalWeekendDelta: 0,
      },
      strategy: 'keep-original-order',
      vacancies: [],
      workflowBlockers: [],
    } as const;
    const approved = {
      leaveRequest,
      operationId: 'operation-1',
      preview,
      status: 'approved',
      strategy: 'keep-original-order',
    } as const;
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(preview), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(approved), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    const previewed = await client.previewLeaveRequestApproval('group-1', 'leave-1', {});
    expect(previewed.periodVersions).toEqual({ 'period-1': 2 });
    const result = await client.approveLeaveRequest('group-1', 'leave-1', {
      expectedPeriodVersions: preview.periodVersions,
      expectedRulesVersion: 3,
      expectedVersion: 1,
      operationId: 'operation-1',
    });
    expect(result.status).toBe('approved');
    expect(result.leaveRequest.version).toBe(2);

    const malformedClient = createApiClient({
      auth: createAuthClient(),
      fetch: vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ ...preview, periodVersions: undefined }), {
          status: 200,
        }),
      ),
    });
    await expect(
      malformedClient.previewLeaveRequestApproval('group-1', 'leave-1', {}),
    ).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE', status: 200 });
  });

  it('previews, creates, and accepts swap requests with validated responses', async () => {
    const assignment = {
      actualMemberId: 'membership-b',
      actualMemberName: '李医生',
      assignmentId: 'assignment-1',
      businessDate: '2026-09-01',
      endsAt: '2026-09-01T16:00:00.000Z',
      plannedMemberId: 'membership-a',
      plannedMemberName: '张医生',
      scheduleRoleId: 'role-1',
      scheduleRoleName: '一线',
      shiftTypeAbbreviation: '全',
      shiftTypeColor: '#1F5AA6',
      shiftTypeId: 'shift-1',
      shiftTypeName: '全天班',
      shiftTypeTextColor: '#FFFFFF',
      slotPosition: 1,
      startsAt: '2026-09-01T00:00:00.000Z',
      version: 1,
    } as const;
    const swapRequest = {
      createdAt: '2026-08-02T00:00:00.000Z',
      groupId: 'group-1',
      id: 'swap-1',
      initiatorAssignment: assignment,
      initiatorAssignmentId: 'assignment-1',
      initiatorAssignmentVersion: 1,
      initiatorMemberName: '张医生',
      initiatorMembershipId: 'membership-a',
      status: 'pending_target',
      targetAssignment: {
        ...assignment,
        assignmentId: 'assignment-2',
        businessDate: '2026-09-02',
        plannedMemberId: 'membership-b',
        plannedMemberName: '李医生',
      },
      targetAssignmentId: 'assignment-2',
      targetAssignmentVersion: 1,
      targetMemberName: '李医生',
      targetMembershipId: 'membership-b',
      version: 1,
    } as const;
    const preview = {
      conflicts: [],
      groupId: 'group-1',
      initiatorAssignment: assignment,
      initiatorEligibleForTargetShift: true,
      nextStatus: 'pending_target',
      requiresApproval: true,
      targetAssignment: {
        ...assignment,
        assignmentId: 'assignment-2',
        businessDate: '2026-09-02',
        plannedMemberId: 'membership-b',
        plannedMemberName: '李医生',
      },
      targetAutoAccepts: false,
      targetEligibleForInitiatorShift: true,
    } as const;
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(preview), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(swapRequest), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(swapRequest), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([swapRequest]), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ requiresApproval: true }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ autoAcceptSwaps: false }), { status: 200 }),
      );
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    const previewed = await client.previewSwap('group-1', {
      initiatorAssignmentId: 'assignment-1',
      targetAssignmentId: 'assignment-2',
      targetMembershipId: 'membership-b',
    });
    expect(previewed.nextStatus).toBe('pending_target');
    expect(previewed.conflicts).toEqual([]);
    const created = await client.createSwapRequest('group-1', {
      initiatorAssignmentId: 'assignment-1',
      operationId: 'operation-1',
      targetAssignmentId: 'assignment-2',
      targetMembershipId: 'membership-b',
    });
    expect(created.status).toBe('pending_target');
    const accepted = await client.acceptSwapRequest('group-1', 'swap-1', {
      expectedVersion: 1,
      operationId: 'operation-2',
    });
    expect(accepted.initiatorAssignmentVersion).toBe(1);
    expect(await client.listMySwapRequests('group-1')).toEqual([swapRequest]);
    expect(await client.getGroupSwapSettings('group-1')).toEqual({ requiresApproval: true });
    expect(await client.getMySwapSettings('group-1')).toEqual({ autoAcceptSwaps: false });

    const malformedClient = createApiClient({
      auth: createAuthClient(),
      fetch: vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ ...preview, nextStatus: 'unknown' }), {
          status: 200,
        }),
      ),
    });
    await expect(
      malformedClient.previewSwap('group-1', {
        initiatorAssignmentId: 'assignment-1',
        targetAssignmentId: 'assignment-2',
        targetMembershipId: 'membership-b',
      }),
    ).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE', status: 200 });
  });

  it('previews, creates, accepts, directly applies, and revokes duty adjustments', async () => {
    const assignment = {
      actualMemberId: 'membership-a',
      actualMemberName: '张医生',
      assignmentId: 'assignment-1',
      businessDate: '2026-09-01',
      endsAt: '2026-09-01T16:00:00.000Z',
      plannedMemberId: 'membership-a',
      plannedMemberName: '张医生',
      scheduleRoleId: 'role-1',
      scheduleRoleName: '一线',
      shiftTypeAbbreviation: '全',
      shiftTypeColor: '#1F5AA6',
      shiftTypeId: 'shift-1',
      shiftTypeName: '全天班',
      shiftTypeTextColor: '#FFFFFF',
      slotPosition: 1,
      startsAt: '2026-09-01T00:00:00.000Z',
      version: 1,
    } as const;
    const preview = {
      conflicts: [],
      coveredAssignment: assignment,
      deductedMemberName: '张医生',
      groupId: 'group-1',
      nextStatus: 'pending_target',
      overtimeAutoAccepts: false,
      overtimeMemberName: '李医生',
      requiresApproval: true,
    } as const;
    const dutyAdjustment = {
      assignmentVersion: 1,
      coveredAssignment: assignment,
      coveredAssignmentId: 'assignment-1',
      createdAt: '2026-08-02T00:00:00.000Z',
      deductedMemberName: '张医生',
      deductedMembershipId: 'membership-a',
      groupId: 'group-1',
      id: 'duty-1',
      overtimeMemberName: '李医生',
      overtimeMembershipId: 'membership-b',
      status: 'pending_target',
      version: 1,
    } as const;
    const completedAdjustment = {
      ...dutyAdjustment,
      decidedAt: '2026-08-02T01:00:00.000Z',
      status: 'completed',
      version: 2,
    } as const;
    const revokedAdjustment = {
      ...completedAdjustment,
      reason: '排班重新调整',
      status: 'revoked',
      version: 3,
    } as const;
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(preview), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(dutyAdjustment), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(dutyAdjustment), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([dutyAdjustment]), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ requiresApproval: true }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(completedAdjustment), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(revokedAdjustment), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    const previewed = await client.previewDutyAdjustment('group-1', {
      coveredAssignmentId: 'assignment-1',
      overtimeMembershipId: 'membership-b',
    });
    expect(previewed.nextStatus).toBe('pending_target');
    expect(previewed.conflicts).toEqual([]);
    const created = await client.createDutyAdjustmentRequest('group-1', {
      coveredAssignmentId: 'assignment-1',
      operationId: 'operation-1',
      overtimeMembershipId: 'membership-b',
    });
    expect(created.status).toBe('pending_target');
    const accepted = await client.acceptDutyAdjustment('group-1', 'duty-1', {
      expectedVersion: 1,
      operationId: 'operation-2',
    });
    expect(accepted.assignmentVersion).toBe(1);
    expect(await client.listMyDutyAdjustments('group-1')).toEqual([dutyAdjustment]);
    expect(await client.getGroupDutyAdjustmentSettings('group-1')).toEqual({
      requiresApproval: true,
    });
    const direct = await client.createDirectDutyAdjustment('group-1', {
      coveredAssignmentId: 'assignment-1',
      operationId: 'operation-3',
      overtimeMembershipId: 'membership-b',
      reason: '管理员直接代值',
    });
    expect(direct.status).toBe('completed');
    const revoked = await client.revokeDutyAdjustment('group-1', 'duty-1', {
      expectedVersion: 2,
      operationId: 'operation-4',
      reason: '排班重新调整',
    });
    expect(revoked.status).toBe('revoked');

    expect(fetchImplementation).toHaveBeenNthCalledWith(
      1,
      '/api/groups/group-1/duty-adjustments/preview',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchImplementation).toHaveBeenNthCalledWith(
      2,
      '/api/groups/group-1/duty-adjustments',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchImplementation).toHaveBeenNthCalledWith(
      3,
      '/api/groups/group-1/duty-adjustments/duty-1/accept',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchImplementation).toHaveBeenNthCalledWith(
      6,
      '/api/groups/group-1/duty-adjustments/direct',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchImplementation).toHaveBeenNthCalledWith(
      7,
      '/api/groups/group-1/duty-adjustments/duty-1/revoke',
      expect.objectContaining({ method: 'POST' }),
    );

    const malformedClient = createApiClient({
      auth: createAuthClient(),
      fetch: vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ ...preview, nextStatus: 'unknown' }), {
          status: 200,
        }),
      ),
    });
    await expect(
      malformedClient.previewDutyAdjustment('group-1', {
        coveredAssignmentId: 'assignment-1',
        overtimeMembershipId: 'membership-b',
      }),
    ).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE', status: 200 });
  });

  it('lists and details schedule events with validated responses', async () => {
    const scheduleEvent = {
      affectedMembershipIds: ['membership-a', 'membership-b'],
      affectedShiftIds: ['assignment-1'],
      afterData: { actualMemberName: '李医生' },
      beforeData: { actualMemberName: '张医生' },
      eventStatus: 'completed',
      eventType: 'swap_completed',
      groupId: 'group-1',
      id: 'event-1',
      objectType: 'swap_request',
      occurredAt: '2026-08-02T00:00:00.000Z',
      operationId: 'operation-1',
      reason: '换班',
      schedulePeriodId: 'period-1',
    } as const;
    const page = { events: [scheduleEvent], nextCursor: 'cursor-1' } as const;
    const detail = { event: scheduleEvent, relatedEvents: [] } as const;
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(page), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(detail), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    const listed = await client.getGroupEvents('group-1', {
      pageSize: 50,
      shiftId: 'assignment-1',
    });
    expect(listed.events[0]?.eventType).toBe('swap_completed');
    expect(listed.nextCursor).toBe('cursor-1');
    const eventDetail = await client.getEventDetail('group-1', 'event-1');
    expect(eventDetail.event.id).toBe('event-1');
    expect(eventDetail.relatedEvents).toEqual([]);

    expect(fetchImplementation).toHaveBeenNthCalledWith(
      1,
      '/api/groups/group-1/events?pageSize=50&shiftId=assignment-1',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(fetchImplementation).toHaveBeenNthCalledWith(
      2,
      '/api/groups/group-1/events/event-1',
      expect.objectContaining({ method: 'GET' }),
    );

    const malformedClient = createApiClient({
      auth: createAuthClient(),
      fetch: vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ ...page, events: [{ id: 'event-1' }] }), {
          status: 200,
        }),
      ),
    });
    await expect(malformedClient.getGroupEvents('group-1', { pageSize: 50 })).rejects.toMatchObject(
      { code: 'SERVICE_UNAVAILABLE', status: 200 },
    );
  });

  it('lists notifications, marks read, and saves push settings with validated responses', async () => {
    const notification = {
      body: '您的值班将在 24 小时后开始。',
      createdAt: '2026-08-02T00:00:00.000Z',
      groupId: 'group-1',
      id: 'notification-1',
      isRead: false,
      notificationType: 'duty_reminder',
      objectType: 'shift_assignment',
      payload: { leadHours: 24 },
      recipientUserId: 'user-1',
      shiftAssignmentId: 'assignment-1',
      title: '值班提醒',
    } as const;
    const page = {
      notifications: [notification],
      unreadCount: 1,
    } as const;
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(page), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ unreadCount: 1 }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ...notification, isRead: true }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ vapidPublicKey: 'test-key' }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ saved: true }), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    const listed = await client.listNotifications({ pageSize: 30 });
    expect(listed.notifications[0]?.notificationType).toBe('duty_reminder');
    expect(listed.unreadCount).toBe(1);
    const unread = await client.getUnreadNotificationCount();
    expect(unread.unreadCount).toBe(1);
    const read = await client.markNotificationRead('notification-1');
    expect(read.isRead).toBe(true);
    const pushConfig = await client.getPushConfiguration();
    expect(pushConfig.vapidPublicKey).toBe('test-key');
    const saved = await client.savePushSubscription({
      endpoint: 'https://push.example.com/endpoint',
      keys: { auth: 'auth', p256dh: 'p256dh' },
    });
    expect(saved.saved).toBe(true);

    expect(fetchImplementation).toHaveBeenNthCalledWith(
      1,
      '/api/notifications?pageSize=30',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(fetchImplementation).toHaveBeenNthCalledWith(
      3,
      '/api/notifications/notification-1/read',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchImplementation).toHaveBeenNthCalledWith(
      5,
      '/api/notifications/push-subscription',
      expect.objectContaining({ method: 'PUT' }),
    );

    const malformedClient = createApiClient({
      auth: createAuthClient(),
      fetch: vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ notifications: [{ id: 'notification-1' }] }), {
          status: 200,
        }),
      ),
    });
    await expect(malformedClient.listNotifications({ pageSize: 30 })).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('loads month and year statistics and runs recalculation checks', async () => {
    const summary = {
      actualCount: 1,
      byRole: [
        {
          actualCount: 1,
          plannedCount: 1,
          scheduleRoleId: 'role-1',
          scheduleRoleName: 'Primary',
        },
      ],
      byShiftType: [
        {
          actualCount: 1,
          plannedCount: 1,
          shiftTypeId: 'shift-1',
          shiftTypeName: 'All Day',
        },
      ],
      countedActualCount: 1,
      countedPlannedCount: 1,
      deductionCount: 0,
      holidayCount: 0,
      leaveCoverCount: 0,
      manualAdjustmentCount: 0,
      members: [
        {
          actualCount: 1,
          actualVsPlanned: [],
          byRole: [
            {
              actualCount: 1,
              plannedCount: 1,
              scheduleRoleId: 'role-1',
              scheduleRoleName: 'Primary',
            },
          ],
          byShiftType: [
            {
              actualCount: 1,
              plannedCount: 1,
              shiftTypeId: 'shift-1',
              shiftTypeName: 'All Day',
            },
          ],
          countedActualCount: 1,
          countedPlannedCount: 1,
          deductionCount: 0,
          deltaCount: 0,
          holidayCount: 0,
          leaveCoverCount: 0,
          manualAdjustmentCount: 0,
          membershipId: 'membership-1',
          netDutyAdjustment: 0,
          overtimeCount: 0,
          plannedCount: 1,
          realName: 'A Doctor',
          swapCount: 0,
          weekendCount: 0,
        },
      ],
      netDutyAdjustment: 0,
      overtimeCount: 0,
      plannedCount: 1,
      swapCount: 0,
      weekendCount: 0,
    } as const;
    const monthSnapshot = {
      businessMonth: '2026-10',
      computedAt: '2026-08-02T00:00:00.000Z',
      groupId: 'group-1',
      summary,
      version: 1,
    } as const;
    const year = { months: [{ businessMonth: '2026-10', summary }], summary, year: 2026 } as const;
    const checkResult = {
      businessMonth: '2026-10',
      matched: true,
      mismatches: [],
      recomputed: summary,
      snapshot: summary,
      snapshotVersion: 1,
    } as const;
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(monthSnapshot), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(year), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(checkResult), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(monthSnapshot), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    const month = await client.getMonthStatistics('group-1', '2026-10');
    expect(month.summary.actualCount).toBe(1);
    expect(month.version).toBe(1);
    const yearResult = await client.getYearStatistics('group-1', 2026);
    expect(yearResult.months).toHaveLength(1);
    const check = await client.recalculateStatistics('group-1', '2026-10');
    expect(check.matched).toBe(true);
    const refreshed = await client.refreshMonthStatistics('group-1', '2026-10');
    expect(refreshed.businessMonth).toBe('2026-10');

    expect(fetchImplementation).toHaveBeenNthCalledWith(
      1,
      '/api/groups/group-1/statistics?businessMonth=2026-10',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(fetchImplementation).toHaveBeenNthCalledWith(
      2,
      '/api/groups/group-1/statistics/year?year=2026',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(fetchImplementation).toHaveBeenNthCalledWith(
      3,
      '/api/groups/group-1/statistics/recalculate-check',
      expect.objectContaining({ method: 'POST' }),
    );

    const malformedClient = createApiClient({
      auth: createAuthClient(),
      fetch: vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response(JSON.stringify({ businessMonth: '2026-10' }), { status: 200 }),
        ),
    });
    await expect(malformedClient.getMonthStatistics('group-1', '2026-10')).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('creates, polls, and downloads export jobs with validated responses', async () => {
    const pendingJob = {
      createdAt: '2026-08-02T00:00:00.000Z',
      exportType: 'schedule',
      groupId: 'group-1',
      id: 'export-job-1',
      period: '2026-10',
      periodType: 'month',
      status: 'pending',
    } as const;
    const completedJob = {
      ...pendingJob,
      completedAt: '2026-08-02T00:00:01.000Z',
      expiresAt: '2026-08-02T00:15:01.000Z',
      rowCount: 2,
      status: 'completed',
    } as const;
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(pendingJob), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(completedJob), { status: 200 }))
      .mockResolvedValueOnce(new Response('日期,星期\r\n2026-10-01,周四\r\n', { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    const created = await client.createExportJob('group-1', {
      exportType: 'schedule',
      period: '2026-10',
    });
    expect(created.status).toBe('pending');
    const fetched = await client.getExportJob('group-1', 'export-job-1');
    expect(fetched.status).toBe('completed');
    expect(fetched.rowCount).toBe(2);
    const csv = await client.downloadExport('group-1', 'export-job-1');
    expect(csv).toContain('2026-10-01');

    expect(fetchImplementation).toHaveBeenNthCalledWith(
      1,
      '/api/groups/group-1/exports',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchImplementation).toHaveBeenNthCalledWith(
      3,
      '/api/groups/group-1/exports/export-job-1/download',
      expect.objectContaining({ method: 'GET' }),
    );

    const malformedClient = createApiClient({
      auth: createAuthClient(),
      fetch: vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(JSON.stringify({ id: 'export-job-1' }), { status: 201 })),
    });
    await expect(
      malformedClient.createExportJob('group-1', {
        exportType: 'schedule',
        period: '2026-10',
      }),
    ).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE', status: 201 });
  });

  it('keeps public requests token-free and sends the token for authenticated text downloads', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ groupId: 'group-1', groupName: '门诊' }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response('日期,星期\r\n2026-10-01,周四\r\n', { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await client.resolveGuestGroup('a'.repeat(32));
    await client.downloadExport('group-1', 'export-job-1');

    expect(fetchImplementation).toHaveBeenNthCalledWith(
      1,
      '/api/guest/groups/resolve',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchImplementation.mock.calls[0]?.[1]).not.toHaveProperty('headers.Authorization');
    expect(fetchImplementation).toHaveBeenNthCalledWith(
      2,
      '/api/groups/group-1/exports/export-job-1/download',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer signed-in-token' }),
      }),
    );
  });

  it('maps a text download error response to the typed client error', async () => {
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: 'NOT_FOUND',
              message: '导出不存在或已过期。',
              requestId: 'request-1',
            },
          }),
          { status: 404 },
        ),
      ),
    });

    await expect(client.downloadExport('group-1', 'missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      requestId: 'request-1',
      status: 404,
    });
  });
});

function createAuthClient(): AuthClient {
  return {
    clearDevIdentity: vi.fn(),
    getSession: vi.fn().mockResolvedValue({
      data: {
        session: {
          access_token: 'signed-in-token',
          user: { is_anonymous: false },
        },
      },
    }),
    setSession: vi.fn(),
    setDevIdentity: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
  };
}
