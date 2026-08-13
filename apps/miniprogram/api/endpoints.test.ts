import type {
  ApprovedLeaveRequestResult,
  CalendarReadModel,
  CreateDirectDutyAdjustmentInput,
  CreateDirectSwapInput,
  DutyAdjustmentMutationInput,
  DutyAdjustmentRequest,
  GroupDutyAdjustmentSettings,
  GroupLeaveReflowStrategy,
  GroupSwapSettings,
  GuestCalendarReadModel,
  HolidayReadModel,
  MemberSwapSettings,
  PreviewLeaveRequestInput,
  RejectedLeaveRequestResult,
  RejectLeaveRequestInput,
  ScheduleEventPage,
  ScheduleEventQuery,
  SwapRequestMutationInput,
  SwapRequest,
  UpdateGroupDutyAdjustmentSettingsInput,
  UpdateGroupLeaveReflowStrategyInput,
  UpdateGroupSwapSettingsInput,
  UpdateMemberSwapSettingsInput,
  VisitorResolveResponse,
} from '@schedule/contracts';
import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

const { requestEndpointMock, requestMock } = vi.hoisted(() => ({
  requestEndpointMock: vi.fn(),
  requestMock: vi.fn(),
}));

vi.mock('./client.js', () => ({ request: requestMock, requestEndpoint: requestEndpointMock }));

import {
  acceptDutyAdjustment,
  acceptSwapRequest,
  approveLeaveRequest,
  cancelDutyAdjustment,
  cancelSwapRequest,
  createDirectDutyAdjustment,
  createDirectSwapRequest,
  getGroupDutyAdjustmentSettings,
  getGroupSwapSettings,
  getLeaveReflowStrategy,
  getMyDutyAdjustmentSettings,
  getMySwapSettings,
  previewDutyAdjustment,
  previewLeaveRequestApproval,
  rejectLeaveRequest,
  updateGroupDutyAdjustmentSettings,
  updateGroupSwapSettings,
  updateLeaveReflowStrategy,
  updateMySwapSettings,
  updateProfile,
  getCalendar,
  getGuestCalendar,
  getGuestHolidays,
  getLoggedInGuestCalendar,
  getSchedulePeriodCalendar,
  resolveGuestGroup,
  createManualScheduleTemplate,
  applyManualScheduleTemplate,
  deleteManualScheduleTemplate,
  getHolidays,
  getSchedulingConfig,
  listManualScheduleTemplates,
  listEvents,
  listSchedulePeriodHistory,
  listScheduleDrafts,
  previewManualTemplateApply,
  previewScheduleChange,
  publishScheduleDraftBatch,
  updateManualScheduleTemplate,
  withdrawSchedulePeriod,
} from './endpoints.js';

const groupId = 'group-1';
const operationId = 'operation-1';
const expectedVersion = 4;

describe('workflow endpoint wrappers', () => {
  beforeEach(() => {
    requestMock.mockReset();
  });

  it('uses domain-specific mutation and preview inputs with their real result types', () => {
    const swapMutation: SwapRequestMutationInput = { expectedVersion, operationId };
    const dutyMutation: DutyAdjustmentMutationInput = { expectedVersion, operationId };
    const rejectLeave: RejectLeaveRequestInput = { expectedVersion, operationId };
    const leavePreview: PreviewLeaveRequestInput = { strategy: 'shift-forward' };

    acceptSwapRequest(groupId, 'swap-1', swapMutation);
    cancelSwapRequest(groupId, 'swap-1', swapMutation);
    acceptDutyAdjustment(groupId, 'duty-1', dutyMutation);
    cancelDutyAdjustment(groupId, 'duty-1', dutyMutation);
    previewDutyAdjustment(groupId, {
      coveredAssignmentId: 'assignment-1',
      overtimeMembershipId: 'membership-1',
    });
    previewLeaveRequestApproval(groupId, 'leave-1', leavePreview);
    approveLeaveRequest(groupId, 'leave-1', {
      expectedPeriodVersions: { 'period-1': 2 },
      expectedRulesVersion: 3,
      expectedVersion,
      operationId,
    });
    rejectLeaveRequest(groupId, 'leave-1', rejectLeave);

    expect(requestMock.mock.calls).toEqual([
      [`/groups/${groupId}/swaps/swap-1/accept`, { data: swapMutation, method: 'POST' }],
      [`/groups/${groupId}/swaps/swap-1/cancel`, { data: swapMutation, method: 'POST' }],
      [`/groups/${groupId}/duty-adjustments/duty-1/accept`, { data: dutyMutation, method: 'POST' }],
      [`/groups/${groupId}/duty-adjustments/duty-1/cancel`, { data: dutyMutation, method: 'POST' }],
      [
        `/groups/${groupId}/duty-adjustments/preview`,
        {
          data: { coveredAssignmentId: 'assignment-1', overtimeMembershipId: 'membership-1' },
          method: 'POST',
        },
      ],
      [`/groups/${groupId}/leave-requests/leave-1/preview`, { data: leavePreview, method: 'POST' }],
      [
        `/groups/${groupId}/leave-requests/leave-1/approve`,
        {
          data: {
            expectedPeriodVersions: { 'period-1': 2 },
            expectedRulesVersion: 3,
            expectedVersion,
            operationId,
          },
          method: 'POST',
        },
      ],
      [`/groups/${groupId}/leave-requests/leave-1/reject`, { data: rejectLeave, method: 'POST' }],
    ]);

    expectTypeOf(
      approveLeaveRequest(groupId, 'leave-1', {
        expectedPeriodVersions: { 'period-1': 2 },
        expectedRulesVersion: 3,
        expectedVersion,
        operationId,
      }),
    ).toEqualTypeOf<Promise<ApprovedLeaveRequestResult>>();
    expectTypeOf(rejectLeaveRequest(groupId, 'leave-1', rejectLeave)).toEqualTypeOf<
      Promise<RejectedLeaveRequestResult>
    >();
    expectTypeOf(acceptSwapRequest(groupId, 'swap-1', swapMutation)).toEqualTypeOf<
      Promise<SwapRequest>
    >();
    expectTypeOf(acceptDutyAdjustment(groupId, 'duty-1', dutyMutation)).toEqualTypeOf<
      Promise<DutyAdjustmentRequest>
    >();
  });

  it('keeps direct paths and settings wrappers aligned with the API routes', () => {
    const directSwap: CreateDirectSwapInput = {
      initiatorAssignmentId: 'assignment-1',
      operationId,
      targetAssignmentId: 'assignment-2',
    };
    const directDuty: CreateDirectDutyAdjustmentInput = {
      coveredAssignmentId: 'assignment-1',
      operationId,
      overtimeMembershipId: 'membership-2',
    };
    const swapSettings: UpdateGroupSwapSettingsInput = { requiresApproval: true };
    const dutySettings: UpdateGroupDutyAdjustmentSettingsInput = { requiresApproval: false };
    const memberSettings: UpdateMemberSwapSettingsInput = { autoAcceptSwaps: true };
    const leaveSettings: UpdateGroupLeaveReflowStrategyInput = { strategy: 'shift-forward' };

    createDirectSwapRequest(groupId, directSwap);
    createDirectDutyAdjustment(groupId, directDuty);
    getGroupSwapSettings(groupId);
    updateGroupSwapSettings(groupId, swapSettings);
    getGroupDutyAdjustmentSettings(groupId);
    updateGroupDutyAdjustmentSettings(groupId, dutySettings);
    getMySwapSettings(groupId);
    getMyDutyAdjustmentSettings(groupId);
    updateMySwapSettings(groupId, memberSettings);
    getLeaveReflowStrategy(groupId);
    updateLeaveReflowStrategy(groupId, leaveSettings);

    expect(requestMock.mock.calls).toEqual([
      [`/groups/${groupId}/swaps/direct`, { data: directSwap, method: 'POST' }],
      [`/groups/${groupId}/duty-adjustments/direct`, { data: directDuty, method: 'POST' }],
      [`/groups/${groupId}/swaps/settings`],
      [`/groups/${groupId}/swaps/settings`, { data: swapSettings, method: 'PUT' }],
      [`/groups/${groupId}/duty-adjustments/settings`],
      [`/groups/${groupId}/duty-adjustments/settings`, { data: dutySettings, method: 'PUT' }],
      [`/groups/${groupId}/swaps/my-settings`],
      [`/groups/${groupId}/duty-adjustments/my-settings`],
      [`/groups/${groupId}/swaps/my-settings`, { data: memberSettings, method: 'PUT' }],
      [`/groups/${groupId}/leave-reflow-strategy`],
      [`/groups/${groupId}/leave-reflow-strategy`, { data: leaveSettings, method: 'PUT' }],
    ]);

    expectTypeOf(getGroupSwapSettings(groupId)).toEqualTypeOf<Promise<GroupSwapSettings>>();
    expectTypeOf(getGroupDutyAdjustmentSettings(groupId)).toEqualTypeOf<
      Promise<GroupDutyAdjustmentSettings>
    >();
    expectTypeOf(getMySwapSettings(groupId)).toEqualTypeOf<Promise<MemberSwapSettings>>();
    expectTypeOf(getMyDutyAdjustmentSettings(groupId)).toEqualTypeOf<Promise<MemberSwapSettings>>();
    expectTypeOf(getLeaveReflowStrategy(groupId)).toEqualTypeOf<
      Promise<GroupLeaveReflowStrategy>
    >();
    expectTypeOf(createDirectSwapRequest(groupId, directSwap)).toEqualTypeOf<
      Promise<SwapRequest>
    >();
    expectTypeOf(createDirectDutyAdjustment(groupId, directDuty)).toEqualTypeOf<
      Promise<DutyAdjustmentRequest>
    >();
  });
});

describe('Task 10 endpoint boundaries', () => {
  beforeEach(() => {
    requestEndpointMock.mockReset();
    requestMock.mockReset();
  });

  it('sends the profile concurrency version', () => {
    updateProfile({ realName: '张医生', version: 7 });

    expect(requestMock).toHaveBeenCalledWith('/users/me', {
      data: { realName: '张医生', version: 7 },
      method: 'PATCH',
    });
    expect(requestEndpointMock).not.toHaveBeenCalled();
  });
});

describe('calendar and holiday read endpoint boundaries', () => {
  beforeEach(() => {
    requestEndpointMock.mockReset();
    requestMock.mockReset();
  });

  it('decodes protected and public reads through client-core descriptors', () => {
    const protectedCalendar = getCalendar('group/1', '2026-08');
    const archivedCalendar = getSchedulePeriodCalendar('group/1', 'period/1');
    const loggedInGuestCalendar = getLoggedInGuestCalendar('group/1', '2026-08');
    const guestResolve = resolveGuestGroup('a'.repeat(32));
    const publicCalendar = getGuestCalendar('group/1', 'b'.repeat(32), '2026-08');
    const protectedHolidays = getHolidays(2026);
    const publicHolidays = getGuestHolidays(2026);

    expect(requestMock).not.toHaveBeenCalled();
    expect(requestEndpointMock.mock.calls).toEqual([
      [
        expect.objectContaining({
          auth: true,
          decodeResponse: expect.any(Function),
          method: 'GET',
          path: '/groups/group%2F1/calendar',
          query: { businessMonth: '2026-08' },
        }),
      ],
      [
        expect.objectContaining({
          auth: true,
          decodeResponse: expect.any(Function),
          method: 'GET',
          path: '/groups/group%2F1/calendar/periods/period%2F1',
        }),
      ],
      [
        expect.objectContaining({
          auth: true,
          decodeResponse: expect.any(Function),
          method: 'GET',
          path: '/groups/group%2F1/guest-calendar',
          query: { businessMonth: '2026-08' },
        }),
      ],
      [
        expect.objectContaining({
          auth: false,
          body: { visitorKey: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
          decodeResponse: expect.any(Function),
          method: 'POST',
          path: '/guest/groups/resolve',
        }),
      ],
      [
        expect.objectContaining({
          auth: false,
          decodeResponse: expect.any(Function),
          method: 'GET',
          path: '/guest/groups/group%2F1/calendar',
          query: {
            businessMonth: '2026-08',
            visitorKey: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          },
        }),
      ],
      [
        expect.objectContaining({
          auth: true,
          decodeResponse: expect.any(Function),
          method: 'GET',
          path: '/holidays',
          query: { year: 2026 },
        }),
      ],
      [
        expect.objectContaining({
          auth: false,
          decodeResponse: expect.any(Function),
          method: 'GET',
          path: '/guest/holidays',
          query: { year: 2026 },
        }),
      ],
    ]);

    expectTypeOf(protectedCalendar).toEqualTypeOf<Promise<CalendarReadModel>>();
    expectTypeOf(archivedCalendar).toEqualTypeOf<Promise<CalendarReadModel>>();
    expectTypeOf(loggedInGuestCalendar).toEqualTypeOf<Promise<GuestCalendarReadModel>>();
    expectTypeOf(guestResolve).toEqualTypeOf<Promise<VisitorResolveResponse>>();
    expectTypeOf(publicCalendar).toEqualTypeOf<Promise<GuestCalendarReadModel>>();
    expectTypeOf(protectedHolidays).toEqualTypeOf<Promise<HolidayReadModel>>();
    expectTypeOf(publicHolidays).toEqualTypeOf<Promise<HolidayReadModel>>();
  });

  it('preserves present empty strings and zero at the transport boundary', () => {
    getCalendar('', '');
    getSchedulePeriodCalendar('', '');
    getGuestCalendar('', '', '');
    resolveGuestGroup('');
    getHolidays(0);
    getGuestHolidays(0);

    expect(requestMock).not.toHaveBeenCalled();
    expect(requestEndpointMock.mock.calls).toEqual([
      [expect.objectContaining({ path: '/groups//calendar', query: { businessMonth: '' } })],
      [expect.objectContaining({ path: '/groups//calendar/periods/' })],
      [
        expect.objectContaining({
          path: '/guest/groups//calendar',
          query: { businessMonth: '', visitorKey: '' },
        }),
      ],
      [expect.objectContaining({ body: { visitorKey: '' }, path: '/guest/groups/resolve' })],
      [expect.objectContaining({ path: '/holidays', query: { year: 0 } })],
      [expect.objectContaining({ path: '/guest/holidays', query: { year: 0 } })],
    ]);
  });
});

describe('event endpoint boundaries', () => {
  beforeEach(() => {
    requestEndpointMock.mockReset();
    requestMock.mockReset();
  });

  it('adapts the complete event query contract and omits absent or empty filters', () => {
    const eventGroupId = 'group/1';
    const query = {
      cursor: 'cursor/+=',
      eventTypes: ['swap_completed', 'duty_adjustment_completed'],
      from: '2026-08-01T00:00:00+08:00',
      membershipId: 'membership-1',
      operatorUserId: 'user-1',
      pageSize: 100,
      scheduleRoleId: 'role-1',
      shiftId: 'assignment-1',
      to: '2026-09-01T00:00:00+08:00',
    } satisfies Omit<ScheduleEventQuery, 'groupId'>;

    const response = listEvents(eventGroupId, query);
    listEvents(eventGroupId, { eventTypes: [] });

    expect(requestMock).not.toHaveBeenCalled();
    expect(requestEndpointMock.mock.calls).toEqual([
      [
        expect.objectContaining({
          auth: true,
          decodeResponse: expect.any(Function),
          method: 'GET',
          path: '/groups/group%2F1/events',
          query: {
            cursor: 'cursor/+=',
            eventTypes: 'swap_completed,duty_adjustment_completed',
            from: '2026-08-01T00:00:00+08:00',
            membershipId: 'membership-1',
            operatorUserId: 'user-1',
            pageSize: 100,
            scheduleRoleId: 'role-1',
            shiftId: 'assignment-1',
            to: '2026-09-01T00:00:00+08:00',
          },
        }),
      ],
      [
        expect.objectContaining({
          auth: true,
          decodeResponse: expect.any(Function),
          method: 'GET',
          path: '/groups/group%2F1/events',
          query: {},
        }),
      ],
    ]);
    expectTypeOf(response).toEqualTypeOf<Promise<ScheduleEventPage>>();
  });
});

describe('manual template endpoint boundaries', () => {
  beforeEach(() => {
    requestEndpointMock.mockReset();
    requestMock.mockReset();
  });

  it('uses only the existing configuration, history, and template CRUD routes', () => {
    const input = {
      cells: [{ cycleDay: 1, membershipId: 'member-1', shiftTypeId: 'shift-1' }],
      cycleDays: 7,
      membershipIds: ['member-1'],
      scheduleRoleId: 'role-1',
      startDate: '2026-08-12',
    };
    getSchedulingConfig(groupId);
    listManualScheduleTemplates(groupId);
    listSchedulePeriodHistory(groupId);
    createManualScheduleTemplate(groupId, input);
    updateManualScheduleTemplate(groupId, 'template-1', { ...input, expectedVersion: 2 });
    deleteManualScheduleTemplate(groupId, 'template-1');

    expect(requestMock.mock.calls).toEqual([
      [`/groups/${groupId}/scheduling-config`],
      [`/groups/${groupId}/manual-schedule-templates`],
      [`/groups/${groupId}/schedule-periods/history`],
      [`/groups/${groupId}/manual-schedule-templates`, { data: input, method: 'POST' }],
      [
        `/groups/${groupId}/manual-schedule-templates/template-1`,
        { data: { ...input, expectedVersion: 2 }, method: 'PUT' },
      ],
      [`/groups/${groupId}/manual-schedule-templates/template-1`, { method: 'DELETE' }],
    ]);
  });

  it('keeps preview, apply, publish, and withdraw on their existing protected paths', () => {
    previewManualTemplateApply(groupId, 'template-1', { expectedRulesVersion: 4 });
    applyManualScheduleTemplate(groupId, 'template-1', {
      expectedRulesVersion: 4,
      operationId,
    });
    listScheduleDrafts(groupId);
    previewScheduleChange(groupId, 'period-1', 'withdraw');
    publishScheduleDraftBatch(groupId, { operationId, schedulePeriodIds: ['period-1'] });
    withdrawSchedulePeriod(groupId, 'period-1', { expectedVersion: 2, operationId });

    expect(requestMock.mock.calls).toEqual([
      [
        `/groups/${groupId}/manual-schedule-templates/template-1/apply-preview`,
        { data: { expectedRulesVersion: 4 }, method: 'POST' },
      ],
      [
        `/groups/${groupId}/manual-schedule-templates/template-1/apply`,
        { data: { expectedRulesVersion: 4, operationId }, method: 'POST' },
      ],
      [`/groups/${groupId}/schedule-periods`],
      [`/groups/${groupId}/schedules/period-1/change-impact?action=withdraw`],
      [
        `/groups/${groupId}/schedules/publish-batch`,
        { data: { operationId, schedulePeriodIds: ['period-1'] }, method: 'POST' },
      ],
      [
        `/groups/${groupId}/schedules/period-1/withdraw`,
        { data: { expectedVersion: 2, operationId }, method: 'POST' },
      ],
    ]);
  });
});
