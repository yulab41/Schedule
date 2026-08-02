import type {
  AddRosterEntriesResponse,
  ApiErrorCode,
  ApiErrorResponse,
  AppliedManualScheduleTemplateResult,
  ApplyManualScheduleTemplateRequest,
  ApproveLeaveRequestInput,
  ApprovedLeaveRequestResult,
  CalendarReadModel,
  ClaimGroupResponse,
  CreateDirectDutyAdjustmentInput,
  CreateDutyAdjustmentRequestInput,
  CreateLeaveRequestInput,
  CreateSwapRequestInput,
  CreateScheduleRoleRequest,
  CreateShiftTypeRequest,
  CreateManualScheduleTemplateRequest,
  CreateGroupRequest,
  GroupMember,
  GroupMemberContact,
  GroupDutyAdjustmentSettings,
  GroupSchedulePublishMode,
  GroupLeaveReflowStrategy,
  GroupSwapSettings,
  GroupSummary,
  JsonObject,
  LeaveReflowPreview,
  LeaveRequest,
  ManualApplyPreview,
  ManualScheduleTemplate,
  MemberSwapSettings,
  PreviewLeaveRequestInput,
  PreviewManualTemplateApplyRequest,
  RejectedLeaveRequestResult,
  RejectLeaveRequestInput,
  ReorderRotationMembersRequest,
  RegenerateGroupCodeRequest,
  ReplaceScheduleRoleMembersRequest,
  RevokeDutyAdjustmentInput,
  ScheduleRole,
  ScheduleEvent,
  ScheduleEventDetail,
  ScheduleEventPage,
  ScheduleEventQuery,
  SchedulingConfig,
  ShiftType,
  SwapPairInput,
  SwapPreview,
  SwapRequest,
  SwapRequestMutationInput,
  DutyAdjustmentMutationInput,
  DutyAdjustmentPairInput,
  DutyAdjustmentPreview,
  DutyAdjustmentRequest,
  UpdateRotationRuleRequest,
  TransferGroupOwnershipRequest,
  UpdateGroupMemberContactRequest,
  UpdateGroupMemberRoleRequest,
  UpdateGroupDutyAdjustmentSettingsInput,
  UpdateManualScheduleTemplateRequest,
  UpdateGroupLeaveReflowStrategyInput,
  UpdateGroupSwapSettingsInput,
  UpdateMemberSwapSettingsInput,
  UpdateShiftTypeRequest,
  UserProfile,
} from '@schedule/contracts';

import { getAuthenticatedSession, type CloudbaseAuthClient } from '../auth/cloudbase.js';

export interface ApiClient {
  acceptDutyAdjustment(
    groupId: string,
    dutyAdjustmentId: string,
    input: DutyAdjustmentMutationInput,
  ): Promise<DutyAdjustmentRequest>;
  acceptSwapRequest(
    groupId: string,
    swapRequestId: string,
    input: SwapRequestMutationInput,
  ): Promise<SwapRequest>;
  addRosterEntries(
    groupId: string,
    input: { readonly realNames: readonly string[] },
  ): Promise<AddRosterEntriesResponse>;
  approveLeaveRequest(
    groupId: string,
    leaveRequestId: string,
    input: ApproveLeaveRequestInput,
  ): Promise<ApprovedLeaveRequestResult>;
  approveDutyAdjustment(
    groupId: string,
    dutyAdjustmentId: string,
    input: DutyAdjustmentMutationInput,
  ): Promise<DutyAdjustmentRequest>;
  approveSwapRequest(
    groupId: string,
    swapRequestId: string,
    input: SwapRequestMutationInput,
  ): Promise<SwapRequest>;
  applyManualTemplate(
    groupId: string,
    templateId: string,
    input: ApplyManualScheduleTemplateRequest,
  ): Promise<AppliedManualScheduleTemplateResult>;
  claimGroup(input: { readonly groupCode: string }): Promise<ClaimGroupResponse>;
  cancelSwapRequest(
    groupId: string,
    swapRequestId: string,
    input: SwapRequestMutationInput,
  ): Promise<SwapRequest>;
  cancelDutyAdjustment(
    groupId: string,
    dutyAdjustmentId: string,
    input: DutyAdjustmentMutationInput,
  ): Promise<DutyAdjustmentRequest>;
  createLeaveRequest(groupId: string, input: CreateLeaveRequestInput): Promise<LeaveRequest>;
  createSwapRequest(groupId: string, input: CreateSwapRequestInput): Promise<SwapRequest>;
  createDirectDutyAdjustment(
    groupId: string,
    input: CreateDirectDutyAdjustmentInput,
  ): Promise<DutyAdjustmentRequest>;
  createDutyAdjustmentRequest(
    groupId: string,
    input: CreateDutyAdjustmentRequestInput,
  ): Promise<DutyAdjustmentRequest>;
  createManualScheduleTemplate(
    groupId: string,
    input: CreateManualScheduleTemplateRequest,
  ): Promise<ManualScheduleTemplate>;
  createScheduleRole(groupId: string, input: CreateScheduleRoleRequest): Promise<ScheduleRole>;
  createShiftType(groupId: string, input: CreateShiftTypeRequest): Promise<ShiftType>;
  createGroup(input: CreateGroupRequest): Promise<GroupSummary>;
  createCurrentProfile(input: { readonly realName: string }): Promise<UserProfile>;
  deleteGroup(groupId: string): Promise<void>;
  getCalendar(groupId: string, businessMonth: string): Promise<CalendarReadModel>;
  getCurrentProfile(): Promise<UserProfile>;
  getEventDetail(groupId: string, eventId: string): Promise<ScheduleEventDetail>;
  getGroupEvents(
    groupId: string,
    query: Omit<ScheduleEventQuery, 'groupId'>,
  ): Promise<ScheduleEventPage>;
  getGroupDutyAdjustmentSettings(groupId: string): Promise<GroupDutyAdjustmentSettings>;
  getGroupSwapSettings(groupId: string): Promise<GroupSwapSettings>;
  getLeaveReflowStrategy(groupId: string): Promise<GroupLeaveReflowStrategy>;
  getMySwapSettings(groupId: string): Promise<MemberSwapSettings>;
  getSchedulePublishMode(groupId: string): Promise<GroupSchedulePublishMode>;
  getSchedulingConfig(groupId: string): Promise<SchedulingConfig>;
  listManualScheduleTemplates(groupId: string): Promise<ManualScheduleTemplate[]>;
  listGroupContacts(groupId: string): Promise<GroupMemberContact[]>;
  listGroupMembers(groupId: string): Promise<GroupMember[]>;
  listGroups(): Promise<GroupSummary[]>;
  listDutyAdjustmentApprovals(groupId: string): Promise<DutyAdjustmentRequest[]>;
  listLeaveRequestApprovals(groupId: string): Promise<LeaveRequest[]>;
  listMyDutyAdjustments(groupId: string): Promise<DutyAdjustmentRequest[]>;
  listMyLeaveRequests(groupId: string): Promise<LeaveRequest[]>;
  listMySwapRequests(groupId: string): Promise<SwapRequest[]>;
  listSwapApprovals(groupId: string): Promise<SwapRequest[]>;
  previewLeaveRequestApproval(
    groupId: string,
    leaveRequestId: string,
    input: PreviewLeaveRequestInput,
  ): Promise<LeaveReflowPreview>;
  previewDutyAdjustment(
    groupId: string,
    input: DutyAdjustmentPairInput,
  ): Promise<DutyAdjustmentPreview>;
  previewSwap(groupId: string, input: SwapPairInput): Promise<SwapPreview>;
  previewManualTemplateApply(
    groupId: string,
    templateId: string,
    input: PreviewManualTemplateApplyRequest,
  ): Promise<ManualApplyPreview>;
  regenerateGroupCode(groupId: string, input: RegenerateGroupCodeRequest): Promise<GroupSummary>;
  rejectLeaveRequest(
    groupId: string,
    leaveRequestId: string,
    input: RejectLeaveRequestInput,
  ): Promise<RejectedLeaveRequestResult>;
  rejectSwapRequest(
    groupId: string,
    swapRequestId: string,
    input: SwapRequestMutationInput,
  ): Promise<SwapRequest>;
  rejectDutyAdjustment(
    groupId: string,
    dutyAdjustmentId: string,
    input: DutyAdjustmentMutationInput,
  ): Promise<DutyAdjustmentRequest>;
  revokeDutyAdjustment(
    groupId: string,
    dutyAdjustmentId: string,
    input: RevokeDutyAdjustmentInput,
  ): Promise<DutyAdjustmentRequest>;
  reorderRotationMembers(
    groupId: string,
    roleId: string,
    input: ReorderRotationMembersRequest,
  ): Promise<ScheduleRole>;
  replaceScheduleRoleMembers(
    groupId: string,
    roleId: string,
    input: ReplaceScheduleRoleMembersRequest,
  ): Promise<ScheduleRole>;
  transferGroupOwnership(
    groupId: string,
    input: TransferGroupOwnershipRequest,
  ): Promise<GroupSummary>;
  updateManualScheduleTemplate(
    groupId: string,
    templateId: string,
    input: UpdateManualScheduleTemplateRequest,
  ): Promise<ManualScheduleTemplate>;
  updateGroupMemberContact(
    groupId: string,
    membershipId: string,
    input: UpdateGroupMemberContactRequest,
  ): Promise<GroupMemberContact>;
  updateGroupMemberRole(
    groupId: string,
    membershipId: string,
    input: UpdateGroupMemberRoleRequest,
  ): Promise<GroupMember>;
  updateGroupDutyAdjustmentSettings(
    groupId: string,
    input: UpdateGroupDutyAdjustmentSettingsInput,
  ): Promise<GroupDutyAdjustmentSettings>;
  updateGroupSwapSettings(
    groupId: string,
    input: UpdateGroupSwapSettingsInput,
  ): Promise<GroupSwapSettings>;
  updateLeaveReflowStrategy(
    groupId: string,
    input: UpdateGroupLeaveReflowStrategyInput,
  ): Promise<GroupLeaveReflowStrategy>;
  updateMySwapSettings(
    groupId: string,
    input: UpdateMemberSwapSettingsInput,
  ): Promise<MemberSwapSettings>;
  updateRotationRule(
    groupId: string,
    roleId: string,
    input: UpdateRotationRuleRequest,
  ): Promise<ScheduleRole>;
  updateShiftType(
    groupId: string,
    shiftTypeId: string,
    input: UpdateShiftTypeRequest,
  ): Promise<ShiftType>;
}

export interface CreateApiClientOptions {
  readonly apiBaseUrl?: string;
  readonly auth: CloudbaseAuthClient;
  readonly fetch?: typeof fetch;
}

const knownApiErrorCodes = new Set<ApiErrorCode>([
  'AUTHENTICATION_REQUIRED',
  'FORBIDDEN',
  'NOT_FOUND',
  'VALIDATION_FAILED',
  'CONFLICT',
  'RATE_LIMITED',
  'SERVICE_UNAVAILABLE',
  'INTERNAL_ERROR',
]);

export function createApiClient(options: CreateApiClientOptions): ApiClient {
  const baseUrl = options.apiBaseUrl ?? import.meta.env.VITE_API_BASE_URL ?? '/api';
  const fetchImplementation = options.fetch ?? fetch;

  return {
    acceptDutyAdjustment(groupId, dutyAdjustmentId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/duty-adjustments/${encodeURIComponent(dutyAdjustmentId)}/accept`,
        {
          body: JSON.stringify(input),
          method: 'POST',
        },
        isDutyAdjustmentRequest,
      );
    },
    acceptSwapRequest(groupId, swapRequestId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/swaps/${encodeURIComponent(swapRequestId)}/accept`,
        {
          body: JSON.stringify(input),
          method: 'POST',
        },
        isSwapRequest,
      );
    },
    applyManualTemplate(groupId, templateId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/manual-schedule-templates/${encodeURIComponent(templateId)}/apply`,
        {
          body: JSON.stringify(input),
          method: 'POST',
        },
        isAppliedManualScheduleTemplateResult,
      );
    },
    approveLeaveRequest(groupId, leaveRequestId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/leave-requests/${encodeURIComponent(leaveRequestId)}/approve`,
        {
          body: JSON.stringify(input),
          method: 'POST',
        },
        isApprovedLeaveRequestResult,
      );
    },
    approveDutyAdjustment(groupId, dutyAdjustmentId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/duty-adjustments/${encodeURIComponent(dutyAdjustmentId)}/approve`,
        {
          body: JSON.stringify(input),
          method: 'POST',
        },
        isDutyAdjustmentRequest,
      );
    },
    approveSwapRequest(groupId, swapRequestId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/swaps/${encodeURIComponent(swapRequestId)}/approve`,
        {
          body: JSON.stringify(input),
          method: 'POST',
        },
        isSwapRequest,
      );
    },
    addRosterEntries(groupId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/roster-entries`,
        {
          body: JSON.stringify(input),
          method: 'POST',
        },
        isAddRosterEntriesResponse,
      );
    },
    claimGroup(input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        '/groups/claim',
        {
          body: JSON.stringify(input),
          method: 'POST',
        },
        isClaimGroupResponse,
      );
    },
    cancelSwapRequest(groupId, swapRequestId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/swaps/${encodeURIComponent(swapRequestId)}/cancel`,
        {
          body: JSON.stringify(input),
          method: 'POST',
        },
        isSwapRequest,
      );
    },
    cancelDutyAdjustment(groupId, dutyAdjustmentId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/duty-adjustments/${encodeURIComponent(dutyAdjustmentId)}/cancel`,
        {
          body: JSON.stringify(input),
          method: 'POST',
        },
        isDutyAdjustmentRequest,
      );
    },
    createLeaveRequest(groupId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/leave-requests`,
        {
          body: JSON.stringify(input),
          method: 'POST',
        },
        isLeaveRequest,
      );
    },
    createDirectDutyAdjustment(groupId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/duty-adjustments/direct`,
        {
          body: JSON.stringify(input),
          method: 'POST',
        },
        isDutyAdjustmentRequest,
      );
    },
    createDutyAdjustmentRequest(groupId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/duty-adjustments`,
        {
          body: JSON.stringify(input),
          method: 'POST',
        },
        isDutyAdjustmentRequest,
      );
    },
    createSwapRequest(groupId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/swaps`,
        {
          body: JSON.stringify(input),
          method: 'POST',
        },
        isSwapRequest,
      );
    },
    createManualScheduleTemplate(groupId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/manual-schedule-templates`,
        {
          body: JSON.stringify(input),
          method: 'POST',
        },
        isManualScheduleTemplate,
      );
    },
    createScheduleRole(groupId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/schedule-roles`,
        {
          body: JSON.stringify(input),
          method: 'POST',
        },
        isScheduleRole,
      );
    },
    createShiftType(groupId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/shift-types`,
        {
          body: JSON.stringify(input),
          method: 'POST',
        },
        isShiftType,
      );
    },
    createGroup(input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        '/groups',
        {
          body: JSON.stringify(input),
          method: 'POST',
        },
        isGroupSummary,
      );
    },
    createCurrentProfile(input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        '/users',
        {
          body: JSON.stringify(input),
          method: 'POST',
        },
        isUserProfile,
      );
    },
    deleteGroup(groupId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}`,
        { method: 'DELETE' },
        isUndefined,
      );
    },
    getCalendar(groupId, businessMonth) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/calendar?businessMonth=${encodeURIComponent(businessMonth)}`,
        { method: 'GET' },
        isCalendarReadModel,
      );
    },
    getCurrentProfile() {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        '/users/me',
        { method: 'GET' },
        isUserProfile,
      );
    },
    getEventDetail(groupId, eventId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/events/${encodeURIComponent(eventId)}`,
        { method: 'GET' },
        isScheduleEventDetail,
      );
    },
    getGroupEvents(groupId, query) {
      const params = new URLSearchParams();
      if (query.cursor !== undefined) {
        params.set('cursor', query.cursor);
      }
      if (query.eventTypes !== undefined && query.eventTypes.length > 0) {
        params.set('eventTypes', query.eventTypes.join(','));
      }
      if (query.from !== undefined) {
        params.set('from', query.from);
      }
      if (query.membershipId !== undefined) {
        params.set('membershipId', query.membershipId);
      }
      if (query.operatorUserId !== undefined) {
        params.set('operatorUserId', query.operatorUserId);
      }
      if (query.pageSize !== undefined) {
        params.set('pageSize', String(query.pageSize));
      }
      if (query.scheduleRoleId !== undefined) {
        params.set('scheduleRoleId', query.scheduleRoleId);
      }
      if (query.shiftId !== undefined) {
        params.set('shiftId', query.shiftId);
      }
      if (query.to !== undefined) {
        params.set('to', query.to);
      }
      const queryString = params.toString();
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/events${queryString === '' ? '' : `?${queryString}`}`,
        { method: 'GET' },
        isScheduleEventPage,
      );
    },
    getGroupDutyAdjustmentSettings(groupId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/duty-adjustments/settings`,
        { method: 'GET' },
        isGroupDutyAdjustmentSettings,
      );
    },
    getGroupSwapSettings(groupId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/swaps/settings`,
        { method: 'GET' },
        isGroupSwapSettings,
      );
    },
    getLeaveReflowStrategy(groupId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/leave-reflow-strategy`,
        { method: 'GET' },
        isGroupLeaveReflowStrategy,
      );
    },
    getMySwapSettings(groupId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/swaps/my-settings`,
        { method: 'GET' },
        isMemberSwapSettings,
      );
    },
    getSchedulePublishMode(groupId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/schedule-publish-mode`,
        { method: 'GET' },
        isGroupSchedulePublishMode,
      );
    },
    getSchedulingConfig(groupId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/scheduling-config`,
        { method: 'GET' },
        isSchedulingConfig,
      );
    },
    listManualScheduleTemplates(groupId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/manual-schedule-templates`,
        { method: 'GET' },
        isManualScheduleTemplateList,
      );
    },
    listGroupContacts(groupId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/contacts`,
        { method: 'GET' },
        isGroupMemberContactList,
      );
    },
    listGroupMembers(groupId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/members`,
        { method: 'GET' },
        isGroupMemberList,
      );
    },
    listGroups() {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        '/groups',
        { method: 'GET' },
        isGroupSummaryList,
      );
    },
    listDutyAdjustmentApprovals(groupId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/duty-adjustments/approvals`,
        { method: 'GET' },
        isDutyAdjustmentRequestList,
      );
    },
    listLeaveRequestApprovals(groupId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/leave-requests/approvals`,
        { method: 'GET' },
        isLeaveRequestList,
      );
    },
    listMyDutyAdjustments(groupId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/duty-adjustments`,
        { method: 'GET' },
        isDutyAdjustmentRequestList,
      );
    },
    listMyLeaveRequests(groupId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/leave-requests`,
        { method: 'GET' },
        isLeaveRequestList,
      );
    },
    listMySwapRequests(groupId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/swaps`,
        { method: 'GET' },
        isSwapRequestList,
      );
    },
    listSwapApprovals(groupId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/swaps/approvals`,
        { method: 'GET' },
        isSwapRequestList,
      );
    },
    previewManualTemplateApply(groupId, templateId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/manual-schedule-templates/${encodeURIComponent(templateId)}/apply-preview`,
        {
          body: JSON.stringify(input),
          method: 'POST',
        },
        isManualApplyPreview,
      );
    },
    previewDutyAdjustment(groupId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/duty-adjustments/preview`,
        {
          body: JSON.stringify(input),
          method: 'POST',
        },
        isDutyAdjustmentPreview,
      );
    },
    previewSwap(groupId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/swaps/preview`,
        {
          body: JSON.stringify(input),
          method: 'POST',
        },
        isSwapPreview,
      );
    },
    previewLeaveRequestApproval(groupId, leaveRequestId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/leave-requests/${encodeURIComponent(leaveRequestId)}/preview`,
        {
          body: JSON.stringify(input),
          method: 'POST',
        },
        isLeaveReflowPreview,
      );
    },
    regenerateGroupCode(groupId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/group-code`,
        {
          body: JSON.stringify(input),
          method: 'PUT',
        },
        isGroupSummary,
      );
    },
    rejectLeaveRequest(groupId, leaveRequestId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/leave-requests/${encodeURIComponent(leaveRequestId)}/reject`,
        {
          body: JSON.stringify(input),
          method: 'POST',
        },
        isRejectedLeaveRequestResult,
      );
    },
    rejectSwapRequest(groupId, swapRequestId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/swaps/${encodeURIComponent(swapRequestId)}/reject`,
        {
          body: JSON.stringify(input),
          method: 'POST',
        },
        isSwapRequest,
      );
    },
    rejectDutyAdjustment(groupId, dutyAdjustmentId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/duty-adjustments/${encodeURIComponent(dutyAdjustmentId)}/reject`,
        {
          body: JSON.stringify(input),
          method: 'POST',
        },
        isDutyAdjustmentRequest,
      );
    },
    revokeDutyAdjustment(groupId, dutyAdjustmentId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/duty-adjustments/${encodeURIComponent(dutyAdjustmentId)}/revoke`,
        {
          body: JSON.stringify(input),
          method: 'POST',
        },
        isDutyAdjustmentRequest,
      );
    },
    reorderRotationMembers(groupId, roleId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/schedule-roles/${encodeURIComponent(roleId)}/rotation-members`,
        {
          body: JSON.stringify(input),
          method: 'PUT',
        },
        isScheduleRole,
      );
    },
    replaceScheduleRoleMembers(groupId, roleId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/schedule-roles/${encodeURIComponent(roleId)}/members`,
        {
          body: JSON.stringify(input),
          method: 'PUT',
        },
        isScheduleRole,
      );
    },
    transferGroupOwnership(groupId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/owner-transfer`,
        {
          body: JSON.stringify(input),
          method: 'POST',
        },
        isGroupSummary,
      );
    },
    updateManualScheduleTemplate(groupId, templateId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/manual-schedule-templates/${encodeURIComponent(templateId)}`,
        {
          body: JSON.stringify(input),
          method: 'PUT',
        },
        isManualScheduleTemplate,
      );
    },
    updateGroupMemberContact(groupId, membershipId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(membershipId)}/contact`,
        {
          body: JSON.stringify(input),
          method: 'PUT',
        },
        isGroupMemberContact,
      );
    },
    updateGroupMemberRole(groupId, membershipId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(membershipId)}/role`,
        {
          body: JSON.stringify(input),
          method: 'PUT',
        },
        isGroupMember,
      );
    },
    updateGroupDutyAdjustmentSettings(groupId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/duty-adjustments/settings`,
        {
          body: JSON.stringify(input),
          method: 'PUT',
        },
        isGroupDutyAdjustmentSettings,
      );
    },
    updateGroupSwapSettings(groupId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/swaps/settings`,
        {
          body: JSON.stringify(input),
          method: 'PUT',
        },
        isGroupSwapSettings,
      );
    },
    updateLeaveReflowStrategy(groupId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/leave-reflow-strategy`,
        {
          body: JSON.stringify(input),
          method: 'PUT',
        },
        isGroupLeaveReflowStrategy,
      );
    },
    updateMySwapSettings(groupId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/swaps/my-settings`,
        {
          body: JSON.stringify(input),
          method: 'PUT',
        },
        isMemberSwapSettings,
      );
    },
    updateRotationRule(groupId, roleId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/schedule-roles/${encodeURIComponent(roleId)}/rotation-rule`,
        {
          body: JSON.stringify(input),
          method: 'PUT',
        },
        isScheduleRole,
      );
    },
    updateShiftType(groupId, shiftTypeId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/shift-types/${encodeURIComponent(shiftTypeId)}`,
        {
          body: JSON.stringify(input),
          method: 'PUT',
        },
        isShiftType,
      );
    },
  };
}

export class ApiClientError extends Error {
  public readonly code: ApiErrorCode | 'NETWORK_ERROR' | undefined;
  public readonly latestData: JsonObject | undefined;
  public readonly requestId: string | undefined;
  public readonly status: number | undefined;

  public constructor(input: {
    readonly code?: ApiErrorCode | 'NETWORK_ERROR';
    readonly latestData?: JsonObject;
    readonly message: string;
    readonly requestId?: string;
    readonly status?: number;
  }) {
    super(input.message);
    this.name = 'ApiClientError';
    this.code = input.code;
    this.latestData = input.latestData;
    this.requestId = input.requestId;
    this.status = input.status;
  }
}

async function requestJson<ResponseBody>(
  auth: CloudbaseAuthClient,
  fetchImplementation: typeof fetch,
  baseUrl: string,
  path: string,
  init: { readonly body?: string; readonly method: 'DELETE' | 'GET' | 'POST' | 'PUT' },
  isResponseBody: (value: unknown) => value is ResponseBody,
): Promise<ResponseBody> {
  const session = getAuthenticatedSession(await auth.getSession());

  if (session === undefined) {
    throw new ApiClientError({
      code: 'AUTHENTICATION_REQUIRED',
      message: '登录状态已失效，请重新登录。',
      status: 401,
    });
  }

  let response: Response;
  try {
    response = await fetchImplementation(joinUrl(baseUrl, path), {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      method: init.method,
      ...(init.body === undefined ? {} : { body: init.body }),
    });
  } catch {
    throw new ApiClientError({
      code: 'NETWORK_ERROR',
      message: '无法连接到服务，请检查网络后重试。',
    });
  }

  const body = await readJson(response);
  if (!response.ok) {
    throw toApiClientError(response.status, body);
  }

  if (!isResponseBody(body)) {
    throw new ApiClientError({
      code: 'SERVICE_UNAVAILABLE',
      message: '服务返回了无效资料，请稍后重试。',
      status: response.status,
    });
  }

  return body;
}

function isAddRosterEntriesResponse(value: unknown): value is AddRosterEntriesResponse {
  return (
    value !== null &&
    typeof value === 'object' &&
    'added' in value &&
    typeof value.added === 'number' &&
    Number.isInteger(value.added) &&
    value.added > 0
  );
}

function isCalendarReadModel(value: unknown): value is CalendarReadModel {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const calendar = value as Partial<CalendarReadModel>;
  return (
    typeof calendar.businessMonth === 'string' &&
    /^\d{4}-\d{2}$/u.test(calendar.businessMonth) &&
    typeof calendar.groupId === 'string' &&
    Array.isArray(calendar.assignments) &&
    calendar.assignments.every(isCalendarDutyAssignment) &&
    Array.isArray(calendar.members) &&
    calendar.members.every(isCalendarDutyMember) &&
    Array.isArray(calendar.roles) &&
    calendar.roles.every(isCalendarRoleSummary) &&
    Array.isArray(calendar.shiftTypes) &&
    calendar.shiftTypes.every(isCalendarShiftTypeSummary)
  );
}

function isCalendarDutyAssignment(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const assignment = value as Partial<CalendarReadModel['assignments'][number]>;
  return (
    typeof assignment.businessDate === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/u.test(assignment.businessDate) &&
    typeof assignment.endsAt === 'string' &&
    typeof assignment.id === 'string' &&
    assignment.id.length > 0 &&
    typeof assignment.startsAt === 'string' &&
    typeof assignment.schedulePeriodId === 'string' &&
    assignment.schedulePeriodId.length > 0 &&
    typeof assignment.scheduleRoleId === 'string' &&
    assignment.scheduleRoleId.length > 0 &&
    typeof assignment.scheduleRoleName === 'string' &&
    assignment.scheduleRoleName.length > 0 &&
    typeof assignment.shiftTypeAbbreviation === 'string' &&
    assignment.shiftTypeAbbreviation.length > 0 &&
    typeof assignment.shiftTypeColor === 'string' &&
    /^#[\dA-F]{6}$/iu.test(assignment.shiftTypeColor) &&
    typeof assignment.shiftTypeId === 'string' &&
    assignment.shiftTypeId.length > 0 &&
    typeof assignment.shiftTypeName === 'string' &&
    assignment.shiftTypeName.length > 0 &&
    typeof assignment.shiftTypeTextColor === 'string' &&
    /^#[\dA-F]{6}$/iu.test(assignment.shiftTypeTextColor) &&
    typeof assignment.slotPosition === 'number' &&
    Number.isInteger(assignment.slotPosition) &&
    assignment.slotPosition >= 1 &&
    Array.isArray(assignment.changeMarkers) &&
    assignment.changeMarkers.every(isCalendarChangeMarker) &&
    (assignment.actualMemberName === undefined ||
      typeof assignment.actualMemberName === 'string') &&
    (assignment.actualMembershipId === undefined ||
      typeof assignment.actualMembershipId === 'string') &&
    (assignment.plannedMemberName === undefined ||
      typeof assignment.plannedMemberName === 'string') &&
    (assignment.plannedMembershipId === undefined ||
      typeof assignment.plannedMembershipId === 'string')
  );
}

function isCalendarChangeMarker(value: unknown): boolean {
  return (
    value === 'swap' ||
    value === 'leave-cover' ||
    value === 'manual-adjustment' ||
    value === 'overtime'
  );
}

function isCalendarDutyMember(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const member = value as Partial<CalendarReadModel['members'][number]>;
  return (
    typeof member.membershipId === 'string' &&
    member.membershipId.length > 0 &&
    typeof member.realName === 'string' &&
    member.realName.length > 0 &&
    typeof member.isConfirmed === 'boolean' &&
    (member.mobilePhone === undefined || typeof member.mobilePhone === 'string') &&
    (member.shortPhone === undefined || typeof member.shortPhone === 'string')
  );
}

function isCalendarRoleSummary(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const role = value as Partial<CalendarReadModel['roles'][number]>;
  return (
    typeof role.id === 'string' &&
    role.id.length > 0 &&
    typeof role.name === 'string' &&
    role.name.length > 0
  );
}

function isCalendarShiftTypeSummary(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const shiftType = value as Partial<CalendarReadModel['shiftTypes'][number]>;
  return (
    typeof shiftType.id === 'string' &&
    shiftType.id.length > 0 &&
    typeof shiftType.name === 'string' &&
    shiftType.name.length > 0 &&
    typeof shiftType.abbreviation === 'string' &&
    shiftType.abbreviation.length > 0 &&
    typeof shiftType.color === 'string' &&
    /^#[\dA-F]{6}$/iu.test(shiftType.color) &&
    typeof shiftType.textColor === 'string' &&
    /^#[\dA-F]{6}$/iu.test(shiftType.textColor) &&
    typeof shiftType.crossesMidnight === 'boolean' &&
    typeof shiftType.isAllDay === 'boolean' &&
    (shiftType.startTime === undefined || /^\d{2}:\d{2}$/u.test(shiftType.startTime)) &&
    (shiftType.endTime === undefined || /^\d{2}:\d{2}$/u.test(shiftType.endTime))
  );
}

function isClaimGroupResponse(value: unknown): value is ClaimGroupResponse {
  if (value === null || typeof value !== 'object' || !('status' in value)) {
    return false;
  }

  if (value.status === 'request_created') {
    return Object.keys(value).length === 1;
  }

  return value.status === 'claimed' && 'group' in value && isGroupSummary(value.group);
}

function isGroupMember(value: unknown): value is GroupMember {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const member = value as Partial<GroupMember>;
  return (
    typeof member.id === 'string' &&
    member.id.length > 0 &&
    typeof member.isCurrentUser === 'boolean' &&
    typeof member.realName === 'string' &&
    member.realName.length > 0 &&
    (member.role === 'administrator' || member.role === 'member' || member.role === 'owner')
  );
}

function isGroupMemberContact(value: unknown): value is GroupMemberContact {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const contact = value as Partial<GroupMemberContact>;
  return (
    typeof contact.membershipId === 'string' &&
    contact.membershipId.length > 0 &&
    typeof contact.isConfirmed === 'boolean' &&
    typeof contact.version === 'number' &&
    Number.isInteger(contact.version) &&
    contact.version >= 0 &&
    (contact.mobilePhone === undefined || typeof contact.mobilePhone === 'string') &&
    (contact.shortPhone === undefined || typeof contact.shortPhone === 'string') &&
    (contact.updatedAt === undefined || typeof contact.updatedAt === 'string')
  );
}

function isGroupMemberContactList(value: unknown): value is GroupMemberContact[] {
  return Array.isArray(value) && value.every(isGroupMemberContact);
}

function isGroupMemberList(value: unknown): value is GroupMember[] {
  return Array.isArray(value) && value.every(isGroupMember);
}

function isScheduleRole(value: unknown): value is ScheduleRole {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const role = value as Partial<ScheduleRole>;
  return (
    typeof role.id === 'string' &&
    role.id.length > 0 &&
    typeof role.name === 'string' &&
    role.name.length > 0 &&
    typeof role.version === 'number' &&
    Number.isInteger(role.version) &&
    Array.isArray(role.members) &&
    role.members.every(isScheduleRoleMember) &&
    isRotationRule(role.rotationRule)
  );
}

function isScheduleRoleMember(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const member = value as {
    id?: unknown;
    membershipId?: unknown;
    position?: unknown;
    realName?: unknown;
    version?: unknown;
  };
  return (
    typeof member.id === 'string' &&
    member.id.length > 0 &&
    typeof member.membershipId === 'string' &&
    member.membershipId.length > 0 &&
    typeof member.position === 'number' &&
    Number.isInteger(member.position) &&
    member.position >= 1 &&
    typeof member.realName === 'string' &&
    member.realName.length > 0 &&
    typeof member.version === 'number' &&
    Number.isInteger(member.version)
  );
}

function isRotationRule(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const rule = value as {
    currentPosition?: unknown;
    defaultShiftTypeId?: unknown;
    requiredMembersPerDay?: unknown;
    startDate?: unknown;
    startingMemberScheduleRoleId?: unknown;
    version?: unknown;
  };
  return (
    typeof rule.currentPosition === 'number' &&
    Number.isInteger(rule.currentPosition) &&
    rule.currentPosition >= 1 &&
    typeof rule.defaultShiftTypeId === 'string' &&
    rule.defaultShiftTypeId.length > 0 &&
    typeof rule.requiredMembersPerDay === 'number' &&
    Number.isInteger(rule.requiredMembersPerDay) &&
    rule.requiredMembersPerDay >= 1 &&
    typeof rule.version === 'number' &&
    Number.isInteger(rule.version) &&
    (rule.startDate === undefined || typeof rule.startDate === 'string') &&
    (rule.startingMemberScheduleRoleId === undefined ||
      typeof rule.startingMemberScheduleRoleId === 'string')
  );
}

function isSchedulingConfig(value: unknown): value is SchedulingConfig {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const config = value as Partial<SchedulingConfig>;
  return (
    Array.isArray(config.groupMembers) &&
    config.groupMembers.every(isSchedulingGroupMember) &&
    Array.isArray(config.roles) &&
    config.roles.every(isScheduleRole) &&
    Array.isArray(config.shiftTypes) &&
    config.shiftTypes.every(isShiftType)
  );
}

function isSchedulingGroupMember(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const member = value as { membershipId?: unknown; realName?: unknown };
  return (
    typeof member.membershipId === 'string' &&
    member.membershipId.length > 0 &&
    typeof member.realName === 'string' &&
    member.realName.length > 0
  );
}

function isShiftType(value: unknown): value is ShiftType {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const shiftType = value as Partial<ShiftType>;
  return (
    typeof shiftType.id === 'string' &&
    shiftType.id.length > 0 &&
    typeof shiftType.name === 'string' &&
    shiftType.name.length > 0 &&
    typeof shiftType.abbreviation === 'string' &&
    shiftType.abbreviation.length > 0 &&
    typeof shiftType.color === 'string' &&
    /^#[\dA-F]{6}$/iu.test(shiftType.color) &&
    typeof shiftType.textColor === 'string' &&
    /^#[\dA-F]{6}$/iu.test(shiftType.textColor) &&
    typeof shiftType.displayOrder === 'number' &&
    Number.isInteger(shiftType.displayOrder) &&
    typeof shiftType.isAllDay === 'boolean' &&
    typeof shiftType.isEnabled === 'boolean' &&
    typeof shiftType.crossesMidnight === 'boolean' &&
    typeof shiftType.countsTowardStatistics === 'boolean' &&
    typeof shiftType.configurationVersion === 'number' &&
    Number.isInteger(shiftType.configurationVersion) &&
    typeof shiftType.version === 'number' &&
    Number.isInteger(shiftType.version) &&
    (shiftType.startTime === undefined || /^\d{2}:\d{2}$/.test(shiftType.startTime)) &&
    (shiftType.endTime === undefined || /^\d{2}:\d{2}$/.test(shiftType.endTime))
  );
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function toApiClientError(status: number, body: unknown): ApiClientError {
  if (isApiErrorResponse(body)) {
    return new ApiClientError({
      code: body.error.code,
      ...(body.error.latestData === undefined ? {} : { latestData: body.error.latestData }),
      message: body.error.message,
      requestId: body.error.requestId,
      status,
    });
  }

  return new ApiClientError({
    message: getHttpErrorMessage(status),
    status,
  });
}

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  if (value === null || typeof value !== 'object' || !('error' in value)) {
    return false;
  }

  const error = value.error;
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string' &&
    knownApiErrorCodes.has(error.code as ApiErrorCode) &&
    'message' in error &&
    typeof error.message === 'string' &&
    'requestId' in error &&
    typeof error.requestId === 'string'
  );
}

function isUserProfile(value: unknown): value is UserProfile {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const profile = value as Partial<UserProfile>;
  return (
    typeof profile.id === 'string' &&
    profile.id.length > 0 &&
    typeof profile.realName === 'string' &&
    profile.realName.length > 0 &&
    typeof profile.version === 'number' &&
    Number.isInteger(profile.version) &&
    profile.version >= 1
  );
}

function isGroupSummary(value: unknown): value is GroupSummary {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const group = value as Partial<GroupSummary>;
  return (
    typeof group.id === 'string' &&
    group.id.length > 0 &&
    typeof group.name === 'string' &&
    group.name.length > 0 &&
    typeof group.groupCode === 'string' &&
    /^\d{4}$/.test(group.groupCode) &&
    (group.role === 'administrator' || group.role === 'member' || group.role === 'owner') &&
    typeof group.version === 'number' &&
    Number.isInteger(group.version) &&
    group.version >= 1
  );
}

function isGroupSummaryList(value: unknown): value is GroupSummary[] {
  return Array.isArray(value) && value.every(isGroupSummary);
}

function isGroupSchedulePublishMode(value: unknown): value is GroupSchedulePublishMode {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const publishMode = (value as { publishMode?: unknown }).publishMode;
  return publishMode === 'draft' || publishMode === 'published';
}

function isLeaveRequest(value: unknown): value is LeaveRequest {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const request = value as Partial<LeaveRequest>;
  return (
    typeof request.id === 'string' &&
    request.id.length > 0 &&
    typeof request.groupId === 'string' &&
    request.groupId.length > 0 &&
    typeof request.membershipId === 'string' &&
    request.membershipId.length > 0 &&
    (request.leaveType === 'training' ||
      request.leaveType === 'rotation' ||
      request.leaveType === 'sick' ||
      request.leaveType === 'maternity' ||
      request.leaveType === 'other') &&
    typeof request.startsAt === 'string' &&
    typeof request.endsAt === 'string' &&
    typeof request.isAllDay === 'boolean' &&
    typeof request.reason === 'string' &&
    (request.status === 'pending' ||
      request.status === 'approved' ||
      request.status === 'rejected') &&
    (request.reflowStrategy === 'keep-original-order' ||
      request.reflowStrategy === 'shift-forward') &&
    typeof request.version === 'number' &&
    Number.isInteger(request.version) &&
    request.version >= 1 &&
    typeof request.createdAt === 'string' &&
    (request.memberName === undefined || typeof request.memberName === 'string') &&
    (request.approverUserId === undefined || typeof request.approverUserId === 'string') &&
    (request.decidedAt === undefined || typeof request.decidedAt === 'string')
  );
}

function isLeaveRequestList(value: unknown): value is LeaveRequest[] {
  return Array.isArray(value) && value.every(isLeaveRequest);
}

function isGroupLeaveReflowStrategy(value: unknown): value is GroupLeaveReflowStrategy {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const strategy = (value as { strategy?: unknown }).strategy;
  return strategy === 'keep-original-order' || strategy === 'shift-forward';
}

function isLeaveReflowPreview(value: unknown): value is LeaveReflowPreview {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const preview = value as Partial<LeaveReflowPreview>;
  return (
    Array.isArray(preview.affectedAssignments) &&
    preview.affectedAssignments.every(isLeaveAffectedAssignment) &&
    Array.isArray(preview.conflicts) &&
    preview.conflicts.every(isLeaveReflowConflict) &&
    Array.isArray(preview.continuousDutyWarnings) &&
    preview.continuousDutyWarnings.every(isContinuousDutyWarning) &&
    (preview.groupDefaultStrategy === 'keep-original-order' ||
      preview.groupDefaultStrategy === 'shift-forward') &&
    typeof preview.leaveRequestId === 'string' &&
    preview.leaveRequestId.length > 0 &&
    typeof preview.leaveRequestVersion === 'number' &&
    Number.isInteger(preview.leaveRequestVersion) &&
    isStringNumberRecord(preview.periodVersions) &&
    typeof preview.rulesVersion === 'number' &&
    Number.isInteger(preview.rulesVersion) &&
    isLeaveStatisticsDelta(preview.statisticsDelta) &&
    (preview.strategy === 'keep-original-order' || preview.strategy === 'shift-forward') &&
    Array.isArray(preview.vacancies) &&
    preview.vacancies.every(isScheduleGenerationVacancy)
  );
}

function isLeaveAffectedAssignment(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const assignment = value as {
    assignmentId?: unknown;
    businessDate?: unknown;
    endsAt?: unknown;
    nextMemberId?: unknown;
    nextMemberName?: unknown;
    previousMemberId?: unknown;
    previousMemberName?: unknown;
    shiftTypeAbbreviation?: unknown;
    shiftTypeColor?: unknown;
    shiftTypeId?: unknown;
    shiftTypeName?: unknown;
    shiftTypeTextColor?: unknown;
    slotPosition?: unknown;
    startsAt?: unknown;
  };
  return (
    typeof assignment.assignmentId === 'string' &&
    assignment.assignmentId.length > 0 &&
    typeof assignment.businessDate === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/u.test(assignment.businessDate) &&
    typeof assignment.endsAt === 'string' &&
    typeof assignment.shiftTypeAbbreviation === 'string' &&
    typeof assignment.shiftTypeColor === 'string' &&
    /^#[\dA-F]{6}$/iu.test(assignment.shiftTypeColor) &&
    typeof assignment.shiftTypeId === 'string' &&
    assignment.shiftTypeId.length > 0 &&
    typeof assignment.shiftTypeName === 'string' &&
    assignment.shiftTypeName.length > 0 &&
    typeof assignment.shiftTypeTextColor === 'string' &&
    /^#[\dA-F]{6}$/iu.test(assignment.shiftTypeTextColor) &&
    typeof assignment.slotPosition === 'number' &&
    Number.isInteger(assignment.slotPosition) &&
    assignment.slotPosition >= 1 &&
    typeof assignment.startsAt === 'string' &&
    (assignment.nextMemberId === undefined || typeof assignment.nextMemberId === 'string') &&
    (assignment.nextMemberName === undefined || typeof assignment.nextMemberName === 'string') &&
    (assignment.previousMemberId === undefined ||
      typeof assignment.previousMemberId === 'string') &&
    (assignment.previousMemberName === undefined ||
      typeof assignment.previousMemberName === 'string')
  );
}

function isLeaveReflowConflict(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const conflict = value as {
    assignmentBusinessKeys?: unknown;
    code?: unknown;
    memberName?: unknown;
    membershipId?: unknown;
  };
  return (
    Array.isArray(conflict.assignmentBusinessKeys) &&
    conflict.assignmentBusinessKeys.every((key) => typeof key === 'string') &&
    (conflict.code === 'MEMBER_LEAVE_OVERLAP' || conflict.code === 'MEMBER_TIME_OVERLAP') &&
    typeof conflict.membershipId === 'string' &&
    conflict.membershipId.length > 0 &&
    (conflict.memberName === undefined || typeof conflict.memberName === 'string')
  );
}

function isLeaveStatisticsDelta(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const delta = value as {
    byMember?: unknown;
    totalAssignmentDelta?: unknown;
    totalCountedDelta?: unknown;
    totalWeekendDelta?: unknown;
  };
  return (
    Array.isArray(delta.byMember) &&
    delta.byMember.every(
      (member) =>
        member !== null &&
        typeof member === 'object' &&
        typeof (member as { membershipId?: unknown }).membershipId === 'string' &&
        typeof (member as { realName?: unknown }).realName === 'string' &&
        typeof (member as { assignmentDelta?: unknown }).assignmentDelta === 'number' &&
        typeof (member as { countedDelta?: unknown }).countedDelta === 'number' &&
        typeof (member as { weekendDelta?: unknown }).weekendDelta === 'number',
    ) &&
    typeof delta.totalAssignmentDelta === 'number' &&
    typeof delta.totalCountedDelta === 'number' &&
    typeof delta.totalWeekendDelta === 'number'
  );
}

function isApprovedLeaveRequestResult(value: unknown): value is ApprovedLeaveRequestResult {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const result = value as Partial<ApprovedLeaveRequestResult>;
  return (
    isLeaveRequest(result.leaveRequest) &&
    typeof result.operationId === 'string' &&
    result.operationId.length > 0 &&
    isLeaveReflowPreview(result.preview) &&
    result.status === 'approved' &&
    (result.strategy === 'keep-original-order' || result.strategy === 'shift-forward')
  );
}

function isRejectedLeaveRequestResult(value: unknown): value is RejectedLeaveRequestResult {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const result = value as Partial<RejectedLeaveRequestResult>;
  return (
    isLeaveRequest(result.leaveRequest) &&
    typeof result.operationId === 'string' &&
    result.operationId.length > 0 &&
    result.status === 'rejected'
  );
}

function isStringNumberRecord(value: unknown): value is Readonly<Record<string, number>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every((version) => typeof version === 'number');
}

function isSwapAssignmentSummary(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const assignment = value as {
    actualMemberId?: unknown;
    actualMemberName?: unknown;
    assignmentId?: unknown;
    businessDate?: unknown;
    endsAt?: unknown;
    plannedMemberId?: unknown;
    plannedMemberName?: unknown;
    scheduleRoleId?: unknown;
    scheduleRoleName?: unknown;
    shiftTypeAbbreviation?: unknown;
    shiftTypeColor?: unknown;
    shiftTypeId?: unknown;
    shiftTypeName?: unknown;
    shiftTypeTextColor?: unknown;
    slotPosition?: unknown;
    startsAt?: unknown;
    version?: unknown;
  };
  return (
    typeof assignment.assignmentId === 'string' &&
    assignment.assignmentId.length > 0 &&
    typeof assignment.businessDate === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/u.test(assignment.businessDate) &&
    typeof assignment.endsAt === 'string' &&
    typeof assignment.scheduleRoleId === 'string' &&
    assignment.scheduleRoleId.length > 0 &&
    typeof assignment.scheduleRoleName === 'string' &&
    typeof assignment.shiftTypeAbbreviation === 'string' &&
    assignment.shiftTypeAbbreviation.length > 0 &&
    typeof assignment.shiftTypeColor === 'string' &&
    /^#[\dA-F]{6}$/iu.test(assignment.shiftTypeColor) &&
    typeof assignment.shiftTypeId === 'string' &&
    assignment.shiftTypeId.length > 0 &&
    typeof assignment.shiftTypeName === 'string' &&
    assignment.shiftTypeName.length > 0 &&
    typeof assignment.shiftTypeTextColor === 'string' &&
    /^#[\dA-F]{6}$/iu.test(assignment.shiftTypeTextColor) &&
    typeof assignment.slotPosition === 'number' &&
    Number.isInteger(assignment.slotPosition) &&
    assignment.slotPosition >= 1 &&
    typeof assignment.startsAt === 'string' &&
    typeof assignment.version === 'number' &&
    Number.isInteger(assignment.version) &&
    assignment.version >= 1 &&
    (assignment.actualMemberId === undefined || typeof assignment.actualMemberId === 'string') &&
    (assignment.actualMemberName === undefined ||
      typeof assignment.actualMemberName === 'string') &&
    (assignment.plannedMemberId === undefined || typeof assignment.plannedMemberId === 'string') &&
    (assignment.plannedMemberName === undefined || typeof assignment.plannedMemberName === 'string')
  );
}

function isSwapPreview(value: unknown): value is SwapPreview {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const preview = value as Partial<SwapPreview>;
  return (
    Array.isArray(preview.conflicts) &&
    preview.conflicts.every(isSwapConflict) &&
    typeof preview.groupId === 'string' &&
    preview.groupId.length > 0 &&
    isSwapAssignmentSummary(preview.initiatorAssignment) &&
    typeof preview.initiatorEligibleForTargetShift === 'boolean' &&
    isSwapRequestStatus(preview.nextStatus) &&
    typeof preview.requiresApproval === 'boolean' &&
    isSwapAssignmentSummary(preview.targetAssignment) &&
    typeof preview.targetAutoAccepts === 'boolean' &&
    typeof preview.targetEligibleForInitiatorShift === 'boolean'
  );
}

function isSwapConflict(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const conflict = value as {
    assignmentId?: unknown;
    code?: unknown;
    membershipId?: unknown;
    message?: unknown;
  };
  return (
    (conflict.code === 'MEMBER_LEAVE_OVERLAP' ||
      conflict.code === 'MEMBER_NOT_ELIGIBLE' ||
      conflict.code === 'MEMBER_TIME_OVERLAP') &&
    typeof conflict.membershipId === 'string' &&
    conflict.membershipId.length > 0 &&
    typeof conflict.message === 'string' &&
    (conflict.assignmentId === undefined || typeof conflict.assignmentId === 'string')
  );
}

function isSwapRequest(value: unknown): value is SwapRequest {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const request = value as Partial<SwapRequest>;
  return (
    typeof request.id === 'string' &&
    request.id.length > 0 &&
    typeof request.groupId === 'string' &&
    request.groupId.length > 0 &&
    typeof request.initiatorMembershipId === 'string' &&
    request.initiatorMembershipId.length > 0 &&
    typeof request.targetMembershipId === 'string' &&
    request.targetMembershipId.length > 0 &&
    typeof request.initiatorAssignmentId === 'string' &&
    request.initiatorAssignmentId.length > 0 &&
    typeof request.targetAssignmentId === 'string' &&
    request.targetAssignmentId.length > 0 &&
    typeof request.initiatorAssignmentVersion === 'number' &&
    Number.isInteger(request.initiatorAssignmentVersion) &&
    typeof request.targetAssignmentVersion === 'number' &&
    Number.isInteger(request.targetAssignmentVersion) &&
    isSwapRequestStatus(request.status) &&
    typeof request.version === 'number' &&
    Number.isInteger(request.version) &&
    request.version >= 1 &&
    typeof request.createdAt === 'string' &&
    isSwapAssignmentSummary(request.initiatorAssignment) &&
    isSwapAssignmentSummary(request.targetAssignment) &&
    (request.initiatorMemberName === undefined ||
      typeof request.initiatorMemberName === 'string') &&
    (request.targetMemberName === undefined || typeof request.targetMemberName === 'string') &&
    (request.approverUserId === undefined || typeof request.approverUserId === 'string') &&
    (request.decidedAt === undefined || typeof request.decidedAt === 'string')
  );
}

function isSwapRequestStatus(value: unknown): boolean {
  return (
    value === 'pending_target' ||
    value === 'pending_approval' ||
    value === 'completed' ||
    value === 'rejected' ||
    value === 'cancelled'
  );
}

function isSwapRequestList(value: unknown): value is SwapRequest[] {
  return Array.isArray(value) && value.every(isSwapRequest);
}

function isGroupSwapSettings(value: unknown): value is GroupSwapSettings {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as { requiresApproval?: unknown }).requiresApproval === 'boolean'
  );
}

function isMemberSwapSettings(value: unknown): value is MemberSwapSettings {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as { autoAcceptSwaps?: unknown }).autoAcceptSwaps === 'boolean'
  );
}

function isDutyAdjustmentAssignmentSummary(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const assignment = value as {
    actualMemberId?: unknown;
    actualMemberName?: unknown;
    assignmentId?: unknown;
    businessDate?: unknown;
    endsAt?: unknown;
    plannedMemberId?: unknown;
    plannedMemberName?: unknown;
    scheduleRoleId?: unknown;
    scheduleRoleName?: unknown;
    shiftTypeAbbreviation?: unknown;
    shiftTypeColor?: unknown;
    shiftTypeId?: unknown;
    shiftTypeName?: unknown;
    shiftTypeTextColor?: unknown;
    slotPosition?: unknown;
    startsAt?: unknown;
    version?: unknown;
  };
  return (
    typeof assignment.assignmentId === 'string' &&
    assignment.assignmentId.length > 0 &&
    typeof assignment.businessDate === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/u.test(assignment.businessDate) &&
    typeof assignment.endsAt === 'string' &&
    typeof assignment.scheduleRoleId === 'string' &&
    assignment.scheduleRoleId.length > 0 &&
    typeof assignment.scheduleRoleName === 'string' &&
    typeof assignment.shiftTypeAbbreviation === 'string' &&
    assignment.shiftTypeAbbreviation.length > 0 &&
    typeof assignment.shiftTypeColor === 'string' &&
    /^#[\dA-F]{6}$/iu.test(assignment.shiftTypeColor) &&
    typeof assignment.shiftTypeId === 'string' &&
    assignment.shiftTypeId.length > 0 &&
    typeof assignment.shiftTypeName === 'string' &&
    assignment.shiftTypeName.length > 0 &&
    typeof assignment.shiftTypeTextColor === 'string' &&
    /^#[\dA-F]{6}$/iu.test(assignment.shiftTypeTextColor) &&
    typeof assignment.slotPosition === 'number' &&
    Number.isInteger(assignment.slotPosition) &&
    assignment.slotPosition >= 1 &&
    typeof assignment.startsAt === 'string' &&
    typeof assignment.version === 'number' &&
    Number.isInteger(assignment.version) &&
    assignment.version >= 1 &&
    (assignment.actualMemberId === undefined || typeof assignment.actualMemberId === 'string') &&
    (assignment.actualMemberName === undefined ||
      typeof assignment.actualMemberName === 'string') &&
    (assignment.plannedMemberId === undefined || typeof assignment.plannedMemberId === 'string') &&
    (assignment.plannedMemberName === undefined || typeof assignment.plannedMemberName === 'string')
  );
}

function isDutyAdjustmentConflict(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const conflict = value as {
    assignmentId?: unknown;
    code?: unknown;
    membershipId?: unknown;
    message?: unknown;
  };
  return (
    (conflict.code === 'MEMBER_LEAVE_OVERLAP' ||
      conflict.code === 'MEMBER_NOT_ELIGIBLE' ||
      conflict.code === 'MEMBER_TIME_OVERLAP') &&
    typeof conflict.membershipId === 'string' &&
    conflict.membershipId.length > 0 &&
    typeof conflict.message === 'string' &&
    (conflict.assignmentId === undefined || typeof conflict.assignmentId === 'string')
  );
}

function isDutyAdjustmentPreview(value: unknown): value is DutyAdjustmentPreview {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const preview = value as Partial<DutyAdjustmentPreview>;
  return (
    Array.isArray(preview.conflicts) &&
    preview.conflicts.every(isDutyAdjustmentConflict) &&
    isDutyAdjustmentAssignmentSummary(preview.coveredAssignment) &&
    (preview.deductedMemberName === undefined || typeof preview.deductedMemberName === 'string') &&
    typeof preview.groupId === 'string' &&
    preview.groupId.length > 0 &&
    isDutyAdjustmentRequestStatus(preview.nextStatus) &&
    typeof preview.overtimeAutoAccepts === 'boolean' &&
    (preview.overtimeMemberName === undefined || typeof preview.overtimeMemberName === 'string') &&
    typeof preview.requiresApproval === 'boolean'
  );
}

function isDutyAdjustmentRequestStatus(value: unknown): boolean {
  return (
    value === 'pending_target' ||
    value === 'pending_approval' ||
    value === 'completed' ||
    value === 'rejected' ||
    value === 'cancelled' ||
    value === 'revoked'
  );
}

function isDutyAdjustmentRequest(value: unknown): value is DutyAdjustmentRequest {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const request = value as Partial<DutyAdjustmentRequest>;
  return (
    typeof request.id === 'string' &&
    request.id.length > 0 &&
    typeof request.groupId === 'string' &&
    request.groupId.length > 0 &&
    typeof request.coveredAssignmentId === 'string' &&
    request.coveredAssignmentId.length > 0 &&
    typeof request.overtimeMembershipId === 'string' &&
    request.overtimeMembershipId.length > 0 &&
    typeof request.deductedMembershipId === 'string' &&
    request.deductedMembershipId.length > 0 &&
    typeof request.assignmentVersion === 'number' &&
    Number.isInteger(request.assignmentVersion) &&
    isDutyAdjustmentRequestStatus(request.status) &&
    typeof request.version === 'number' &&
    Number.isInteger(request.version) &&
    request.version >= 1 &&
    typeof request.createdAt === 'string' &&
    isDutyAdjustmentAssignmentSummary(request.coveredAssignment) &&
    (request.overtimeMemberName === undefined || typeof request.overtimeMemberName === 'string') &&
    (request.deductedMemberName === undefined || typeof request.deductedMemberName === 'string') &&
    (request.approverUserId === undefined || typeof request.approverUserId === 'string') &&
    (request.decidedAt === undefined || typeof request.decidedAt === 'string') &&
    (request.reason === undefined || typeof request.reason === 'string')
  );
}

function isDutyAdjustmentRequestList(value: unknown): value is DutyAdjustmentRequest[] {
  return Array.isArray(value) && value.every(isDutyAdjustmentRequest);
}

function isJsonObjectValue(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isScheduleEvent(value: unknown): value is ScheduleEvent {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const event = value as Partial<ScheduleEvent>;
  return (
    typeof event.id === 'string' &&
    event.id.length > 0 &&
    typeof event.groupId === 'string' &&
    event.groupId.length > 0 &&
    typeof event.eventType === 'string' &&
    event.eventType.length > 0 &&
    typeof event.eventStatus === 'string' &&
    typeof event.objectType === 'string' &&
    typeof event.operationId === 'string' &&
    typeof event.occurredAt === 'string' &&
    Array.isArray(event.affectedMembershipIds) &&
    event.affectedMembershipIds.every((membershipId) => typeof membershipId === 'string') &&
    Array.isArray(event.affectedShiftIds) &&
    event.affectedShiftIds.every((shiftId) => typeof shiftId === 'string') &&
    (event.afterData === undefined || isJsonObjectValue(event.afterData)) &&
    (event.approverUserId === undefined || typeof event.approverUserId === 'string') &&
    (event.beforeData === undefined || isJsonObjectValue(event.beforeData)) &&
    (event.initiatedByUserId === undefined || typeof event.initiatedByUserId === 'string') &&
    (event.objectId === undefined || typeof event.objectId === 'string') &&
    (event.operatorUserId === undefined || typeof event.operatorUserId === 'string') &&
    (event.parentEventId === undefined || typeof event.parentEventId === 'string') &&
    (event.reason === undefined || typeof event.reason === 'string') &&
    (event.schedulePeriodId === undefined || typeof event.schedulePeriodId === 'string') &&
    (event.statisticsDelta === undefined || isJsonObjectValue(event.statisticsDelta))
  );
}

function isScheduleEventPage(value: unknown): value is ScheduleEventPage {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const page = value as Partial<ScheduleEventPage>;
  return (
    Array.isArray(page.events) &&
    page.events.every(isScheduleEvent) &&
    (page.nextCursor === undefined || typeof page.nextCursor === 'string')
  );
}

function isScheduleEventDetail(value: unknown): value is ScheduleEventDetail {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const detail = value as Partial<ScheduleEventDetail>;
  return (
    isScheduleEvent(detail.event) &&
    Array.isArray(detail.relatedEvents) &&
    detail.relatedEvents.every(isScheduleEvent)
  );
}

function isGroupDutyAdjustmentSettings(value: unknown): value is GroupDutyAdjustmentSettings {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as { requiresApproval?: unknown }).requiresApproval === 'boolean'
  );
}

function isAppliedManualScheduleTemplateResult(
  value: unknown,
): value is AppliedManualScheduleTemplateResult {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const result = value as Partial<AppliedManualScheduleTemplateResult>;
  return (
    typeof result.operationId === 'string' &&
    result.operationId.length > 0 &&
    Array.isArray(result.periods) &&
    result.periods.every(isSchedulePeriodSummary) &&
    isManualApplyPreview(result.preview) &&
    (result.publishMode === 'draft' || result.publishMode === 'published') &&
    (result.status === 'draft' || result.status === 'published') &&
    typeof result.templateId === 'string' &&
    result.templateId.length > 0 &&
    typeof result.templateVersion === 'number' &&
    Number.isInteger(result.templateVersion)
  );
}

function isSchedulePeriodSummary(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const period = value as {
    businessMonth?: unknown;
    id?: unknown;
    revision?: unknown;
    status?: unknown;
  };
  return (
    typeof period.businessMonth === 'string' &&
    /^\d{4}-\d{2}/u.test(period.businessMonth) &&
    typeof period.id === 'string' &&
    period.id.length > 0 &&
    typeof period.revision === 'number' &&
    Number.isInteger(period.revision) &&
    typeof period.status === 'string' &&
    period.status.length > 0
  );
}

function isManualApplyPreview(value: unknown): value is ManualApplyPreview {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const preview = value as Partial<ManualApplyPreview>;
  return (
    /^\d{4}-\d{2}-\d{2}$/u.test(preview.applyEndDate ?? '') &&
    /^\d{4}-\d{2}-\d{2}$/u.test(preview.applyStartDate ?? '') &&
    Array.isArray(preview.assignments) &&
    preview.assignments.every(isManualApplyAssignment) &&
    Array.isArray(preview.conflicts) &&
    preview.conflicts.every(isManualApplyConflict) &&
    Array.isArray(preview.continuousDutyWarnings) &&
    preview.continuousDutyWarnings.every(isContinuousDutyWarning) &&
    typeof preview.cycleDays === 'number' &&
    Number.isInteger(preview.cycleDays) &&
    typeof preview.rulesVersion === 'number' &&
    Number.isInteger(preview.rulesVersion) &&
    typeof preview.scheduleRoleId === 'string' &&
    preview.scheduleRoleId.length > 0 &&
    typeof preview.scheduleRoleName === 'string' &&
    preview.scheduleRoleName.length > 0 &&
    isScheduleGenerationStatistics(preview.statistics) &&
    typeof preview.templateId === 'string' &&
    preview.templateId.length > 0 &&
    typeof preview.templateVersion === 'number' &&
    Number.isInteger(preview.templateVersion) &&
    Array.isArray(preview.vacancies) &&
    preview.vacancies.every(isScheduleGenerationVacancy)
  );
}

function isManualApplyAssignment(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const assignment = value as {
    businessDate?: unknown;
    endsAt?: unknown;
    plannedMemberId?: unknown;
    plannedMemberName?: unknown;
    scheduleRoleId?: unknown;
    scheduleRoleName?: unknown;
    shiftTypeAbbreviation?: unknown;
    shiftTypeColor?: unknown;
    shiftTypeId?: unknown;
    shiftTypeName?: unknown;
    slotPosition?: unknown;
    startsAt?: unknown;
  };
  return (
    typeof assignment.businessDate === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/u.test(assignment.businessDate) &&
    typeof assignment.endsAt === 'string' &&
    typeof assignment.scheduleRoleId === 'string' &&
    assignment.scheduleRoleId.length > 0 &&
    typeof assignment.scheduleRoleName === 'string' &&
    assignment.scheduleRoleName.length > 0 &&
    typeof assignment.shiftTypeAbbreviation === 'string' &&
    assignment.shiftTypeAbbreviation.length > 0 &&
    typeof assignment.shiftTypeColor === 'string' &&
    /^#[\dA-F]{6}$/iu.test(assignment.shiftTypeColor) &&
    typeof assignment.shiftTypeId === 'string' &&
    assignment.shiftTypeId.length > 0 &&
    typeof assignment.shiftTypeName === 'string' &&
    assignment.shiftTypeName.length > 0 &&
    typeof assignment.slotPosition === 'number' &&
    Number.isInteger(assignment.slotPosition) &&
    assignment.slotPosition >= 1 &&
    typeof assignment.startsAt === 'string' &&
    (assignment.plannedMemberId === undefined || typeof assignment.plannedMemberId === 'string') &&
    (assignment.plannedMemberName === undefined || typeof assignment.plannedMemberName === 'string')
  );
}

function isManualApplyConflict(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const conflict = value as {
    assignmentBusinessKeys?: unknown;
    code?: unknown;
    memberName?: unknown;
    membershipId?: unknown;
  };
  return (
    Array.isArray(conflict.assignmentBusinessKeys) &&
    conflict.assignmentBusinessKeys.every((key) => typeof key === 'string') &&
    (conflict.code === 'MEMBER_LEAVE_OVERLAP' || conflict.code === 'MEMBER_TIME_OVERLAP') &&
    typeof conflict.membershipId === 'string' &&
    conflict.membershipId.length > 0 &&
    (conflict.memberName === undefined || typeof conflict.memberName === 'string')
  );
}

function isContinuousDutyWarning(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const warning = value as {
    assignmentBusinessKeys?: unknown;
    code?: unknown;
    endsAt?: unknown;
    membershipId?: unknown;
    startsAt?: unknown;
  };
  return (
    Array.isArray(warning.assignmentBusinessKeys) &&
    warning.assignmentBusinessKeys.every((key) => typeof key === 'string') &&
    warning.code === 'CONTINUOUS_DUTY_24_HOURS' &&
    typeof warning.endsAt === 'string' &&
    typeof warning.membershipId === 'string' &&
    warning.membershipId.length > 0 &&
    typeof warning.startsAt === 'string'
  );
}

function isScheduleGenerationVacancy(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const vacancy = value as {
    assignmentBusinessKey?: unknown;
    businessDate?: unknown;
    code?: unknown;
    scheduleRoleId?: unknown;
    slotPosition?: unknown;
  };
  return (
    typeof vacancy.assignmentBusinessKey === 'string' &&
    typeof vacancy.businessDate === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/u.test(vacancy.businessDate) &&
    vacancy.code === 'NO_ELIGIBLE_MEMBER' &&
    typeof vacancy.scheduleRoleId === 'string' &&
    typeof vacancy.slotPosition === 'number' &&
    Number.isInteger(vacancy.slotPosition) &&
    vacancy.slotPosition >= 1
  );
}

function isScheduleGenerationStatistics(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const statistics = value as {
    assignmentCount?: unknown;
    byRole?: unknown;
    byShiftType?: unknown;
    countedAssignmentCount?: unknown;
    vacancyCount?: unknown;
  };
  return (
    typeof statistics.assignmentCount === 'number' &&
    Number.isInteger(statistics.assignmentCount) &&
    Array.isArray(statistics.byRole) &&
    statistics.byRole.every(isRoleCount) &&
    Array.isArray(statistics.byShiftType) &&
    statistics.byShiftType.every(isShiftTypeCount) &&
    typeof statistics.countedAssignmentCount === 'number' &&
    Number.isInteger(statistics.countedAssignmentCount) &&
    typeof statistics.vacancyCount === 'number' &&
    Number.isInteger(statistics.vacancyCount)
  );
}

function isRoleCount(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const role = value as {
    assignmentCount?: unknown;
    scheduleRoleId?: unknown;
    vacancyCount?: unknown;
  };
  return (
    typeof role.assignmentCount === 'number' &&
    typeof role.scheduleRoleId === 'string' &&
    typeof role.vacancyCount === 'number'
  );
}

function isShiftTypeCount(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const shiftType = value as { assignmentCount?: unknown; shiftTypeId?: unknown };
  return typeof shiftType.assignmentCount === 'number' && typeof shiftType.shiftTypeId === 'string';
}

function isManualScheduleTemplate(value: unknown): value is ManualScheduleTemplate {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const template = value as Partial<ManualScheduleTemplate>;
  return (
    typeof template.id === 'string' &&
    template.id.length > 0 &&
    typeof template.groupId === 'string' &&
    template.groupId.length > 0 &&
    typeof template.scheduleRoleId === 'string' &&
    template.scheduleRoleId.length > 0 &&
    typeof template.scheduleRoleName === 'string' &&
    template.scheduleRoleName.length > 0 &&
    typeof template.startDate === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/u.test(template.startDate) &&
    typeof template.cycleDays === 'number' &&
    Number.isInteger(template.cycleDays) &&
    template.cycleDays >= 1 &&
    template.cycleDays <= 31 &&
    typeof template.version === 'number' &&
    Number.isInteger(template.version) &&
    template.version >= 1 &&
    Array.isArray(template.members) &&
    template.members.every(isManualScheduleTemplateMember) &&
    Array.isArray(template.cells) &&
    template.cells.every(isManualScheduleTemplateCell)
  );
}

function isManualScheduleTemplateMember(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const member = value as Partial<ManualScheduleTemplate['members'][number]>;
  return (
    typeof member.membershipId === 'string' &&
    member.membershipId.length > 0 &&
    typeof member.realName === 'string' &&
    member.realName.length > 0 &&
    typeof member.memberScheduleRoleVersion === 'number' &&
    Number.isInteger(member.memberScheduleRoleVersion) &&
    member.memberScheduleRoleVersion >= 1 &&
    typeof member.currentMemberScheduleRoleVersion === 'number' &&
    Number.isInteger(member.currentMemberScheduleRoleVersion) &&
    member.currentMemberScheduleRoleVersion >= 0 &&
    typeof member.isAvailable === 'boolean' &&
    typeof member.isStale === 'boolean'
  );
}

function isManualScheduleTemplateCell(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const cell = value as Partial<ManualScheduleTemplate['cells'][number]>;
  return (
    typeof cell.cycleDay === 'number' &&
    Number.isInteger(cell.cycleDay) &&
    cell.cycleDay >= 1 &&
    cell.cycleDay <= 31 &&
    typeof cell.membershipId === 'string' &&
    cell.membershipId.length > 0 &&
    typeof cell.shiftTypeId === 'string' &&
    cell.shiftTypeId.length > 0 &&
    typeof cell.shiftTypeName === 'string' &&
    cell.shiftTypeName.length > 0 &&
    typeof cell.shiftTypeAbbreviation === 'string' &&
    cell.shiftTypeAbbreviation.length > 0 &&
    typeof cell.shiftTypeColor === 'string' &&
    /^#[\dA-F]{6}$/iu.test(cell.shiftTypeColor) &&
    typeof cell.shiftTypeTextColor === 'string' &&
    /^#[\dA-F]{6}$/iu.test(cell.shiftTypeTextColor) &&
    typeof cell.shiftTypeConfigurationVersion === 'number' &&
    Number.isInteger(cell.shiftTypeConfigurationVersion) &&
    cell.shiftTypeConfigurationVersion >= 1 &&
    typeof cell.currentShiftTypeConfigurationVersion === 'number' &&
    Number.isInteger(cell.currentShiftTypeConfigurationVersion) &&
    cell.currentShiftTypeConfigurationVersion >= 0 &&
    typeof cell.isShiftTypeEnabled === 'boolean' &&
    typeof cell.isStale === 'boolean'
  );
}

function isManualScheduleTemplateList(value: unknown): value is ManualScheduleTemplate[] {
  return Array.isArray(value) && value.every(isManualScheduleTemplate);
}

function isUndefined(value: unknown): value is undefined {
  return value === undefined;
}

function getHttpErrorMessage(status: number): string {
  if (status === 401) {
    return '登录状态已失效，请重新登录。';
  }

  if (status === 403) {
    return '当前账户无权执行此操作。';
  }

  if (status === 409) {
    return '资料已发生变化，请刷新后重试。';
  }

  return '服务暂时不可用，请稍后重试。';
}
