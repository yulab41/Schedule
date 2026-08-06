import type {
  AppliedManualScheduleTemplateResult,
  CalendarReadModel,
  GroupSummary,
  ManualScheduleTemplate,
  ManualApplyPreview,
  UserProfile,
} from '@schedule/contracts';
import { apiErrorCodes } from '@schedule/contracts';
import { describe, expect, it, vi } from 'vitest';

import type { CloudbaseAuthClient } from '../auth/cloudbase.js';
import { createApiClient } from './client.js';

vi.mock('@cloudbase/js-sdk', () => ({
  default: { init: vi.fn() },
}));

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
  it('sends the current CloudBase access token to the profile endpoint', async () => {
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
    await expect(client.claimGroup({ groupCode: '1234', realName: 'Lin Enyu' })).resolves.toEqual({
      status: 'request_created',
    });
    await expect(client.regenerateGroupCode(group.id, {})).resolves.toEqual({
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
        body: JSON.stringify({ groupCode: '1234', realName: 'Lin Enyu' }),
        method: 'POST',
      }),
    );
    expect(fetchImplementation).toHaveBeenNthCalledWith(
      3,
      '/api/groups/group-1/group-code',
      expect.objectContaining({ body: '{}', method: 'PUT' }),
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

  it('lists public guest groups and reads a selected month without a group code', async () => {
    const guestGroups = [{ id: group.id, name: group.name }];
    const guestCalendar = { calendar, groupName: group.name };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(guestGroups), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(guestCalendar), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.listGuestGroups()).resolves.toEqual(guestGroups);
    await expect(client.getGuestGroupCalendar(group.id, '2026-08')).resolves.toEqual(guestCalendar);

    expect(fetchImplementation).toHaveBeenNthCalledWith(
      1,
      '/api/guest/groups',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(fetchImplementation).toHaveBeenNthCalledWith(
      2,
      '/api/guest/groups/group-1/calendar?businessMonth=2026-08',
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
        new Response(JSON.stringify([{ id: 'group-1', name: '门诊' }]), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response('日期,星期\r\n2026-10-01,周四\r\n', { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await client.listGuestGroups();
    await client.downloadExport('group-1', 'export-job-1');

    expect(fetchImplementation).toHaveBeenNthCalledWith(
      1,
      '/api/guest/groups',
      expect.objectContaining({ method: 'GET' }),
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

function createAuthClient(): CloudbaseAuthClient {
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
    setDevIdentity: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
  };
}
