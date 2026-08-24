import type {
  CalendarDutyAssignment,
  CalendarReadModel,
  DutyAdjustmentPreview,
  DutyAdjustmentRequest,
  DutyAdjustmentStatus,
  GroupMember,
  GroupSummary,
  LeaveReflowPreview,
  LeaveRequest,
  LeaveRequestStatus,
  SwapAssignmentSummary,
  SwapPreview,
  SwapRequest,
  SwapRequestStatus,
} from '@schedule/contracts';

export type P7WorkflowKind = 'duty' | 'leave' | 'swap';
export type P7WorkflowRole = 'member' | 'owner';
export type P7WorkflowSurface =
  | 'approval'
  | 'conflict'
  | 'create'
  | 'direct'
  | 'empty'
  | 'error'
  | 'list'
  | 'loading'
  | 'preview';

export interface P7WorkflowFixtureOptions {
  readonly role: P7WorkflowRole;
  readonly surface: P7WorkflowSurface;
  readonly workflow: P7WorkflowKind;
}

const groupId = '11111111-1111-4111-8111-111111111111';
const currentMembershipId = '22222222-2222-4222-8222-222222222221';
const colleagueMembershipId = '22222222-2222-4222-8222-222222222222';
const thirdMembershipId = '22222222-2222-4222-8222-222222222223';
const scheduleRoleId = '33333333-3333-4333-8333-333333333333';
const shiftTypeId = '44444444-4444-4444-8444-444444444444';
const periodId = '55555555-5555-4555-8555-555555555555';
const firstAssignmentId = '66666666-6666-4666-8666-666666666661';
const secondAssignmentId = '66666666-6666-4666-8666-666666666662';
const thirdAssignmentId = '66666666-6666-4666-8666-666666666663';

export function getP7WorkflowGroup(role: P7WorkflowRole): GroupSummary {
  return {
    groupCode: '0796',
    id: groupId,
    name: '急诊一组',
    role,
    version: 8,
  };
}

const groupMembers: readonly GroupMember[] = [
  {
    id: currentMembershipId,
    isCurrentUser: true,
    realName: '林医生',
    role: 'member',
  },
  {
    id: colleagueMembershipId,
    isCurrentUser: false,
    realName: '陈医生',
    role: 'member',
  },
  {
    id: thirdMembershipId,
    isCurrentUser: false,
    realName: '王医生',
    role: 'member',
  },
];

const calendarAssignments = [
  calendarAssignment(
    firstAssignmentId,
    currentMembershipId,
    '林医生',
    '2026-08-26',
    '2026-08-26T00:00:00.000Z',
  ),
  calendarAssignment(
    secondAssignmentId,
    colleagueMembershipId,
    '陈医生',
    '2026-08-27',
    '2026-08-27T00:00:00.000Z',
  ),
  calendarAssignment(
    thirdAssignmentId,
    thirdMembershipId,
    '王医生',
    '2026-08-28',
    '2026-08-28T00:00:00.000Z',
  ),
] as const satisfies readonly CalendarDutyAssignment[];

const leaveRequests = {
  approved: leaveRequest('approved', 2, currentMembershipId, '林医生'),
  pending: leaveRequest('pending', 1, currentMembershipId, '林医生'),
  rejected: leaveRequest('rejected', 3, currentMembershipId, '林医生'),
} as const;

const leaveApprovals = [
  leaveRequest('pending', 11, colleagueMembershipId, '陈医生'),
  leaveRequest('approved', 12, thirdMembershipId, '王医生'),
  leaveRequest('rejected', 13, colleagueMembershipId, '陈医生'),
] as const;

const swapRequests = [
  swapRequest('pending_target', 1, 'mine'),
  swapRequest('pending_target', 2, 'incoming'),
  swapRequest('pending_approval', 3, 'mine'),
  swapRequest('completed', 4, 'mine'),
  swapRequest('rejected', 5, 'mine'),
  swapRequest('cancelled', 6, 'mine'),
  swapRequest('revoked', 7, 'mine'),
] as const;

const swapApprovals = [
  swapRequest('pending_approval', 21, 'incoming'),
  swapRequest('completed', 22, 'incoming'),
  swapRequest('rejected', 23, 'incoming'),
  swapRequest('cancelled', 24, 'incoming'),
  swapRequest('revoked', 25, 'incoming'),
] as const;

const dutyRequests = [
  dutyRequest('pending_target', 1, 'mine'),
  dutyRequest('pending_target', 2, 'incoming'),
  dutyRequest('pending_approval', 3, 'mine'),
  dutyRequest('completed', 4, 'mine'),
  dutyRequest('rejected', 5, 'mine'),
  dutyRequest('cancelled', 6, 'mine'),
  dutyRequest('revoked', 7, 'mine'),
] as const;

const dutyApprovals = [
  dutyRequest('pending_approval', 21, 'incoming'),
  dutyRequest('completed', 22, 'incoming'),
  dutyRequest('rejected', 23, 'incoming'),
  dutyRequest('cancelled', 24, 'incoming'),
  dutyRequest('revoked', 25, 'incoming'),
] as const;

export function createP7WorkflowFixtureFetch(
  options: P7WorkflowFixtureOptions,
): typeof globalThis.fetch {
  return async (input, init) => {
    const request = input instanceof Request ? input : undefined;
    const url = new URL(
      request?.url ?? String(input),
      typeof window === 'undefined' ? 'http://storybook.local' : window.location.origin,
    );
    const path = url.pathname.replace(/^\/api/u, '');
    const method = String(init?.method ?? request?.method ?? 'GET').toUpperCase();

    if (options.surface === 'loading' && isWorkflowRead(path, options.workflow)) {
      return new Promise<Response>(() => undefined);
    }
    if (options.surface === 'error' && isWorkflowRead(path, options.workflow)) {
      return json(
        {
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: '工作流资料暂时无法加载，请稍后重试。',
            requestId: 'p7-storybook-error',
          },
        },
        503,
      );
    }

    if (path === '/groups' && method === 'GET') {
      return json([getP7WorkflowGroup(options.role)]);
    }
    if (path === '/notifications/unread-count' && method === 'GET') {
      return json({ unreadCount: 2 });
    }
    if (path === '/notifications' && method === 'GET') {
      return json({ notifications: [], unreadCount: 2 });
    }
    if (path === `/groups/${groupId}/members` && method === 'GET') {
      return json(groupMembers);
    }
    if (path === `/groups/${groupId}/calendar-preferences` && method === 'GET') {
      return json({
        canManageGroupDefaults: options.role === 'owner',
        effectiveMonthShiftTypeId: null,
        effectiveView: 'month',
        groupDefaultMonthShiftTypeId: null,
        groupDefaultView: 'month',
        groupId,
        memberDefaultMonthShiftTypeId: null,
        memberDefaultView: null,
        membershipId: currentMembershipId,
      });
    }
    if (path === `/groups/${groupId}/calendar` && method === 'GET') {
      return json(calendar(url.searchParams.get('businessMonth') ?? '2026-08'));
    }
    if (path === '/holidays' && method === 'GET') {
      return json({
        confirmed: true,
        dates: [],
        year: Number(url.searchParams.get('year') ?? 2026),
      });
    }

    if (path === `/groups/${groupId}/leave-reflow-strategy`) {
      return json({ strategy: 'keep-original-order' });
    }
    if (path === `/groups/${groupId}/leave-requests/affected-shifts` && method === 'POST') {
      return json([
        {
          assignmentId: firstAssignmentId,
          businessDate: '2026-08-26',
          isCovered: false,
          shiftTypeAbbreviation: '全',
          shiftTypeName: '全天班',
        },
      ]);
    }
    if (path === `/groups/${groupId}/leave-requests/approvals` && method === 'GET') {
      return json(options.surface === 'empty' ? [] : leaveApprovals);
    }
    if (path === `/groups/${groupId}/leave-requests` && method === 'GET') {
      return json(
        options.surface === 'empty'
          ? []
          : [leaveRequests.pending, leaveRequests.approved, leaveRequests.rejected],
      );
    }
    if (/\/leave-requests\/[^/]+\/preview$/u.test(path) && method === 'POST') {
      return json(leavePreview());
    }

    if (path === `/groups/${groupId}/swaps/settings`) {
      return json({ requiresApproval: true });
    }
    if (path === `/groups/${groupId}/swaps/my-settings`) {
      return json({ autoAcceptSwaps: false });
    }
    if (path === `/groups/${groupId}/swaps/approvals` && method === 'GET') {
      return json(options.surface === 'empty' ? [] : swapApprovals);
    }
    if (path === `/groups/${groupId}/swaps` && method === 'GET') {
      return json(options.surface === 'empty' ? [] : swapRequests);
    }
    if (path === `/groups/${groupId}/swaps/preview` && method === 'POST') {
      return json(swapPreview(options.surface === 'conflict'));
    }

    if (path === `/groups/${groupId}/duty-adjustments/settings`) {
      return json({ requiresApproval: true });
    }
    if (path === `/groups/${groupId}/duty-adjustments/my-settings`) {
      return json({ autoAcceptSwaps: false });
    }
    if (path === `/groups/${groupId}/duty-adjustments/approvals` && method === 'GET') {
      return json(options.surface === 'empty' ? [] : dutyApprovals);
    }
    if (path === `/groups/${groupId}/duty-adjustments` && method === 'GET') {
      return json(options.surface === 'empty' ? [] : dutyRequests);
    }
    if (path === `/groups/${groupId}/duty-adjustments/preview` && method === 'POST') {
      return json(dutyPreview(options.surface === 'conflict'));
    }

    return json(
      {
        error: {
          code: 'NOT_FOUND',
          message: `P7 Storybook fixture 未覆盖 ${method} ${path}`,
          requestId: 'p7-storybook-missing-route',
        },
      },
      404,
    );
  };
}

function calendar(businessMonth: string): CalendarReadModel {
  return {
    assignments: businessMonth === '2026-08' ? calendarAssignments : [],
    businessMonth,
    groupId,
    members: [
      {
        isConfirmed: true,
        membershipId: currentMembershipId,
        realName: '林医生',
        shortPhone: '6101',
      },
      {
        isConfirmed: true,
        membershipId: colleagueMembershipId,
        realName: '陈医生',
        shortPhone: '6102',
      },
      {
        isConfirmed: true,
        membershipId: thirdMembershipId,
        realName: '王医生',
        shortPhone: '6103',
      },
    ],
    roles: [{ id: scheduleRoleId, name: '一线值班' }],
    shiftTypes: [
      {
        abbreviation: '全',
        color: '#1F5AA6',
        crossesMidnight: false,
        id: shiftTypeId,
        isAllDay: true,
        name: '全天班',
        textColor: '#FFFFFF',
      },
    ],
  };
}

function calendarAssignment(
  id: string,
  membershipId: string,
  memberName: string,
  businessDate: string,
  startsAt: string,
): CalendarDutyAssignment {
  const endsAt = new Date(new Date(startsAt).valueOf() + 24 * 60 * 60 * 1000).toISOString();
  return {
    actualMemberName: memberName,
    actualMembershipId: membershipId,
    businessDate,
    changeMarkers: [],
    endsAt,
    id,
    plannedMemberName: memberName,
    plannedMembershipId: membershipId,
    schedulePeriodId: periodId,
    scheduleRoleId,
    scheduleRoleName: '一线值班',
    shiftTypeAbbreviation: '全',
    shiftTypeColor: '#1F5AA6',
    shiftTypeId,
    shiftTypeName: '全天班',
    shiftTypeTextColor: '#FFFFFF',
    slotPosition: 1,
    startsAt,
  };
}

function assignmentSummary(assignment: CalendarDutyAssignment): SwapAssignmentSummary {
  return {
    actualMemberId: assignment.actualMembershipId,
    actualMemberName: assignment.actualMemberName,
    assignmentId: assignment.id,
    businessDate: assignment.businessDate,
    endsAt: assignment.endsAt,
    plannedMemberId: assignment.plannedMembershipId,
    plannedMemberName: assignment.plannedMemberName,
    scheduleRoleId: assignment.scheduleRoleId,
    scheduleRoleName: assignment.scheduleRoleName,
    shiftTypeAbbreviation: assignment.shiftTypeAbbreviation,
    shiftTypeColor: assignment.shiftTypeColor,
    shiftTypeId: assignment.shiftTypeId,
    shiftTypeName: assignment.shiftTypeName,
    shiftTypeTextColor: assignment.shiftTypeTextColor,
    slotPosition: assignment.slotPosition,
    startsAt: assignment.startsAt,
    version: 1,
  };
}

function leaveRequest(
  status: LeaveRequestStatus,
  index: number,
  membershipId: string,
  memberName: string,
): LeaveRequest {
  return {
    ...(status !== 'pending'
      ? { decidedAt: '2026-08-22T08:30:00.000Z', decidedByMemberName: '周主任' }
      : {}),
    createdAt: '2026-08-20T01:24:00.000Z',
    endsAt: `2026-08-${String(26 + (index % 2)).padStart(2, '0')}T00:00:00.000Z`,
    groupId,
    id: `77777777-7777-4777-8777-${String(index).padStart(12, '0')}`,
    isAllDay: true,
    ...(status === 'approved' ? { isRevocable: true } : {}),
    leaveType: index % 2 === 0 ? 'training' : 'sick',
    memberName,
    membershipId,
    reason: status === 'rejected' ? '与培训安排冲突' : '门诊进修与休整',
    reflowStrategy: index % 2 === 0 ? 'shift-forward' : 'keep-original-order',
    startsAt: `2026-08-${String(25 + (index % 2)).padStart(2, '0')}T00:00:00.000Z`,
    status,
    version: 1,
  };
}

function leavePreview(): LeaveReflowPreview {
  return {
    affectedAssignments: [
      {
        assignmentId: firstAssignmentId,
        businessDate: '2026-08-26',
        endsAt: '2026-08-27T00:00:00.000Z',
        nextMemberId: thirdMembershipId,
        nextMemberName: '王医生',
        previousMemberId: colleagueMembershipId,
        previousMemberName: '陈医生',
        shiftTypeAbbreviation: '全',
        shiftTypeColor: '#1F5AA6',
        shiftTypeId,
        shiftTypeName: '全天班',
        shiftTypeTextColor: '#FFFFFF',
        slotPosition: 1,
        startsAt: '2026-08-26T00:00:00.000Z',
      },
    ],
    affectedShiftCount: 2,
    affectedShifts: [
      {
        businessDate: '2026-08-26',
        memberName: '陈医生',
        shiftTypeAbbreviation: '全',
        shiftTypeName: '全天班',
      },
      {
        businessDate: '2026-08-27',
        memberName: '王医生',
        shiftTypeAbbreviation: '全',
        shiftTypeName: '全天班',
      },
    ],
    conflicts: [
      {
        assignmentBusinessKeys: ['2026-08-26:一线值班:1'],
        code: 'MEMBER_TIME_OVERLAP',
        memberName: '王医生',
        membershipId: thirdMembershipId,
      },
    ],
    continuousDutyWarnings: [
      {
        assignmentBusinessKeys: ['2026-08-26:一线值班:1', '2026-08-27:一线值班:1'],
        code: 'CONTINUOUS_DUTY_24_HOURS',
        endsAt: '2026-08-28T00:00:00.000Z',
        memberName: '王医生',
        membershipId: thirdMembershipId,
        startsAt: '2026-08-26T00:00:00.000Z',
      },
    ],
    groupDefaultStrategy: 'keep-original-order',
    leaveRequestId: leaveApprovals[0].id,
    leaveRequestVersion: 1,
    overlapsUnpublishedPeriod: true,
    periodVersions: { [periodId]: 5 },
    rulesVersion: 6,
    statisticsDelta: {
      byMember: [
        {
          assignmentDelta: 1,
          countedDelta: 1,
          membershipId: thirdMembershipId,
          realName: '王医生',
          weekendDelta: 0,
        },
      ],
      totalAssignmentDelta: 0,
      totalCountedDelta: 0,
      totalWeekendDelta: 0,
    },
    strategy: 'keep-original-order',
    vacancies: [
      {
        assignmentBusinessKey: '2026-08-27:一线值班:1',
        businessDate: '2026-08-27',
        code: 'NO_ELIGIBLE_MEMBER',
        scheduleRoleId,
        slotPosition: 1,
      },
    ],
    workflowBlockers: [
      {
        assignmentId: secondAssignmentId,
        message: '该班次已有待审批换班，需先处理换班申请。',
      },
    ],
  };
}

function swapRequest(
  status: SwapRequestStatus,
  index: number,
  direction: 'incoming' | 'mine',
): SwapRequest {
  const initiatorAssignment =
    direction === 'mine' ? calendarAssignments[0] : calendarAssignments[1];
  const targetAssignment = direction === 'mine' ? calendarAssignments[1] : calendarAssignments[0];
  const initiatorMembershipId = direction === 'mine' ? currentMembershipId : colleagueMembershipId;
  const targetMembershipId = direction === 'mine' ? colleagueMembershipId : currentMembershipId;
  return {
    ...(status === 'completed' ? { isRevocable: true } : {}),
    ...(status === 'revoked' ? { revocationReason: '门诊安排调整' } : {}),
    approverUserId: status === 'pending_target' ? undefined : 'storybook-owner',
    createdAt: '2026-08-21T02:10:00.000Z',
    groupId,
    id: `88888888-8888-4888-8888-${String(index).padStart(12, '0')}`,
    initiatorAssignment: assignmentSummary(initiatorAssignment),
    initiatorAssignmentId: initiatorAssignment.id,
    initiatorAssignmentVersion: 1,
    initiatorMemberName: direction === 'mine' ? '林医生' : '陈医生',
    initiatorMembershipId,
    status,
    targetAssignment: assignmentSummary(targetAssignment),
    targetAssignmentId: targetAssignment.id,
    targetAssignmentVersion: 1,
    targetMemberName: direction === 'mine' ? '陈医生' : '林医生',
    targetMembershipId,
    version: 1,
  };
}

function swapPreview(conflict: boolean): SwapPreview {
  return {
    conflicts: conflict
      ? [
          {
            assignmentId: secondAssignmentId,
            code: 'MEMBER_LEAVE_OVERLAP',
            membershipId: colleagueMembershipId,
            message: '陈医生在目标班次时间已有已批准请假。',
          },
        ]
      : [],
    groupId,
    initiatorAssignment: assignmentSummary(calendarAssignments[0]),
    initiatorEligibleForTargetShift: !conflict,
    nextStatus: 'pending_approval',
    requiresApproval: true,
    targetAssignment: assignmentSummary(calendarAssignments[1]),
    targetAutoAccepts: true,
    targetEligibleForInitiatorShift: !conflict,
  };
}

function dutyRequest(
  status: DutyAdjustmentStatus,
  index: number,
  direction: 'incoming' | 'mine',
): DutyAdjustmentRequest {
  const deductedMembershipId = direction === 'mine' ? currentMembershipId : colleagueMembershipId;
  const overtimeMembershipId = direction === 'mine' ? colleagueMembershipId : currentMembershipId;
  return {
    ...(status === 'completed' ? { isRevocable: true } : {}),
    ...(status === 'revoked' ? { revocationReason: '加班成员临时调岗' } : {}),
    assignmentVersion: 1,
    coveredAssignment: assignmentSummary(calendarAssignments[0]),
    coveredAssignmentId: firstAssignmentId,
    createdAt: '2026-08-21T03:10:00.000Z',
    deductedMemberName: direction === 'mine' ? '林医生' : '陈医生',
    deductedMembershipId,
    groupId,
    id: `99999999-9999-4999-8999-${String(index).padStart(12, '0')}`,
    overtimeMemberName: direction === 'mine' ? '陈医生' : '林医生',
    overtimeMembershipId,
    reason: '门诊与急诊轮转调整',
    status,
    version: 1,
  };
}

function dutyPreview(conflict: boolean): DutyAdjustmentPreview {
  return {
    conflicts: conflict
      ? [
          {
            assignmentId: firstAssignmentId,
            code: 'MEMBER_TIME_OVERLAP',
            membershipId: colleagueMembershipId,
            message: '陈医生与另一已发布班次时间重叠。',
          },
        ]
      : [],
    coveredAssignment: assignmentSummary(calendarAssignments[0]),
    deductedMemberName: '林医生',
    groupId,
    nextStatus: 'pending_approval',
    overtimeAutoAccepts: true,
    overtimeMemberName: '陈医生',
    requiresApproval: true,
  };
}

function isWorkflowRead(path: string, workflow: P7WorkflowKind): boolean {
  const resource =
    workflow === 'leave' ? 'leave-requests' : workflow === 'swap' ? 'swaps' : 'duty-adjustments';
  return path.includes(`/${resource}`) || (workflow === 'leave' && path.includes('leave-reflow'));
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status,
  });
}
