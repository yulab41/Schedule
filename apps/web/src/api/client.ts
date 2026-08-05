import type {
  AddGroupMembersRequest,
  AddGroupMembersResponse,
  AddRosterEntriesResponse,
  ConvertPendingRosterRequest,
  ConvertPendingRosterResponse,
  CreateMembershipClaimRequest,
  CreateMembershipClaimResponse,
  ApiErrorCode,
  ApiErrorResponse,
  AppliedManualScheduleTemplateResult,
  ApplyManualScheduleTemplateRequest,
  ApproveLeaveRequestInput,
  ApprovedLeaveRequestResult,
  CalendarReadModel,
  ClaimGroupResponse,
  CreatePastScheduleAssignmentInput,
  CreateScheduleExportInput,
  CreateDirectDutyAdjustmentInput,
  CreateDutyAdjustmentRequestInput,
  CreateDirectSwapInput,
  CreateLeaveRequestInput,
  CreateSwapRequestInput,
  RevokeSwapRequestInput,
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
  GuestCalendarReadModel,
  GuestGroupSummary,
  HolidayReadModel,
  JsonObject,
  LeaveReflowPreview,
  LeaveAffectedShift,
  LeaveAffectedShiftsInput,
  LeaveRequestMutationInput,
  LeaveRequestMutationResult,
  LeaveRequest,
  ManualApplyPreview,
  ManualScheduleTemplate,
  MemberSwapSettings,
  MemberNotificationPreferences,
  MembershipClaimLookupResponse,
  MembershipClaimRequest,
  MonthStatisticsSnapshot,
  NotificationPage,
  NotificationRecord,
  PastScheduleAssignment,
  PastScheduleBackfillRecord,
  PastSchedulePeriod,
  PushConfiguration,
  PublishSchedulePeriodBatchRequest,
  PublishSchedulePeriodBatchResult,
  PublishSchedulePeriodRequest,
  PublishSchedulePeriodResult,
  ScheduleDraftSummary,
  ScheduleChangeImpactPreview,
  ScheduleGenerationPreview,
  SchedulePeriodMutationRequest,
  SchedulePeriodMutationResult,
  SchedulePeriodHistoryItem,
  StatisticsRecalculateCheckResult,
  YearStatistics,
  UpdateGroupNotificationSettingsInput,
  UpdateMemberNotificationPreferencesInput,
  UpdatePastScheduleAssignmentInput,
  UpdatePastScheduleAssignmentResult,
  WebPushSubscriptionInput,
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
  ScheduleExportJob,
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
import { getOfflineSubmitError, isNavigatorOnline } from '../pwa/offline-guard.js';

export interface ApiClient {
  acceptDutyAdjustment(
    groupId: string,
    dutyAdjustmentId: string,
    input: DutyAdjustmentMutationInput,
  ): Promise<DutyAdjustmentRequest>;
  createExportJob(groupId: string, input: CreateScheduleExportInput): Promise<ScheduleExportJob>;
  deletePushSubscription(): Promise<{ readonly deleted: boolean }>;
  downloadExport(groupId: string, exportJobId: string): Promise<string>;
  getExportJob(groupId: string, exportJobId: string): Promise<ScheduleExportJob>;
  getGroupNotificationSettings(
    groupId: string,
  ): Promise<{ readonly dutyReminderHours: readonly number[]; readonly groupId: string }>;
  getMyNotificationPreferences(groupId: string): Promise<MemberNotificationPreferences>;
  getPushConfiguration(): Promise<PushConfiguration>;
  getUnreadNotificationCount(): Promise<{ readonly unreadCount: number }>;
  listNotifications(query: {
    readonly cursor?: string;
    readonly groupId?: string;
    readonly pageSize?: number;
    readonly unreadOnly?: boolean;
  }): Promise<NotificationPage>;
  listGuestGroups(): Promise<readonly GuestGroupSummary[]>;
  markAllNotificationsRead(groupId?: string): Promise<{ readonly count: number }>;
  markNotificationRead(notificationId: string): Promise<NotificationRecord>;
  savePushSubscription(input: WebPushSubscriptionInput): Promise<{ readonly saved: boolean }>;
  updateGroupNotificationSettings(
    groupId: string,
    input: UpdateGroupNotificationSettingsInput,
  ): Promise<{ readonly dutyReminderHours: readonly number[]; readonly groupId: string }>;
  updateMyNotificationPreferences(
    groupId: string,
    input: UpdateMemberNotificationPreferencesInput,
  ): Promise<MemberNotificationPreferences>;
  acceptSwapRequest(
    groupId: string,
    swapRequestId: string,
    input: SwapRequestMutationInput,
  ): Promise<SwapRequest>;
  addRosterEntries(
    groupId: string,
    input: { readonly realNames: readonly string[] },
  ): Promise<AddRosterEntriesResponse>;
  addGroupMembers(groupId: string, input: AddGroupMembersRequest): Promise<AddGroupMembersResponse>;
  convertRosterEntries(
    groupId: string,
    input: ConvertPendingRosterRequest,
  ): Promise<ConvertPendingRosterResponse>;
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
  claimGroup(input: {
    readonly groupCode: string;
    readonly realName: string;
  }): Promise<ClaimGroupResponse>;
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
  createDirectSwapRequest(groupId: string, input: CreateDirectSwapInput): Promise<SwapRequest>;
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
  deleteGroupMember(groupId: string, memberId: string): Promise<void>;
  deleteManualScheduleTemplate(groupId: string, templateId: string): Promise<void>;
  deleteScheduleRole(groupId: string, roleId: string): Promise<void>;
  getCalendar(groupId: string, businessMonth: string): Promise<CalendarReadModel>;
  getGuestCalendar(groupCode: string, businessMonth: string): Promise<GuestCalendarReadModel>;
  getGuestGroupCalendar(groupId: string, businessMonth: string): Promise<GuestCalendarReadModel>;
  getCurrentProfile(): Promise<UserProfile>;
  getHolidays(year: number): Promise<HolidayReadModel>;
  getGuestHolidays(year: number): Promise<HolidayReadModel>;
  getMonthStatistics(groupId: string, businessMonth: string): Promise<MonthStatisticsSnapshot>;
  getEventDetail(groupId: string, eventId: string): Promise<ScheduleEventDetail>;
  getGroupEvents(
    groupId: string,
    query: Omit<ScheduleEventQuery, 'groupId'>,
  ): Promise<ScheduleEventPage>;
  getGroupDutyAdjustmentSettings(groupId: string): Promise<GroupDutyAdjustmentSettings>;
  getGroupSwapSettings(groupId: string): Promise<GroupSwapSettings>;
  getLeaveReflowStrategy(groupId: string): Promise<GroupLeaveReflowStrategy>;
  getMySwapSettings(groupId: string): Promise<MemberSwapSettings>;
  getMyDutyAdjustmentSettings(groupId: string): Promise<MemberSwapSettings>;
  getSchedulePublishMode(groupId: string): Promise<GroupSchedulePublishMode>;
  getSchedulingConfig(groupId: string): Promise<SchedulingConfig>;
  getScheduleDraftPreview(
    groupId: string,
    schedulePeriodId: string,
  ): Promise<ScheduleGenerationPreview>;
  getSchedulePeriodCalendar(groupId: string, schedulePeriodId: string): Promise<CalendarReadModel>;
  listPastSchedulePeriods(groupId: string): Promise<readonly PastSchedulePeriod[]>;
  listPastScheduleAssignments(
    groupId: string,
    schedulePeriodId: string,
  ): Promise<readonly PastScheduleAssignment[]>;
  listPastScheduleBackfillRecords(groupId: string): Promise<readonly PastScheduleBackfillRecord[]>;
  updatePastScheduleAssignment(
    groupId: string,
    schedulePeriodId: string,
    assignmentId: string,
    input: UpdatePastScheduleAssignmentInput,
  ): Promise<UpdatePastScheduleAssignmentResult>;
  createPastScheduleAssignment(
    groupId: string,
    input: CreatePastScheduleAssignmentInput,
  ): Promise<UpdatePastScheduleAssignmentResult>;
  previewScheduleChange(
    groupId: string,
    schedulePeriodId: string,
    action: 'publish' | 'withdraw',
  ): Promise<ScheduleChangeImpactPreview>;
  listSchedulePeriodHistory(groupId: string): Promise<SchedulePeriodHistoryItem[]>;
  listScheduleDrafts(groupId: string): Promise<ScheduleDraftSummary[]>;
  listManualScheduleTemplates(groupId: string): Promise<ManualScheduleTemplate[]>;
  listGroupContacts(groupId: string): Promise<GroupMemberContact[]>;
  listGroupMembers(groupId: string): Promise<GroupMember[]>;
  listGroups(): Promise<GroupSummary[]>;
  lookupClaimMatches(groupId: string, realName: string): Promise<MembershipClaimLookupResponse>;
  createMembershipClaimRequest(
    groupId: string,
    input: CreateMembershipClaimRequest,
  ): Promise<CreateMembershipClaimResponse>;
  listMembershipClaimRequests(groupId: string): Promise<MembershipClaimRequest[]>;
  approveMembershipClaimRequest(
    groupId: string,
    claimRequestId: string,
  ): Promise<MembershipClaimRequest>;
  rejectMembershipClaimRequest(
    groupId: string,
    claimRequestId: string,
  ): Promise<MembershipClaimRequest>;
  revokeMembershipClaim(groupId: string, membershipId: string): Promise<void>;
  updateProfile(realName: string): Promise<UserProfile>;
  listDutyAdjustmentApprovals(groupId: string): Promise<DutyAdjustmentRequest[]>;
  listLeaveRequestApprovals(groupId: string): Promise<LeaveRequest[]>;
  listMyDutyAdjustments(groupId: string): Promise<DutyAdjustmentRequest[]>;
  listMyLeaveRequests(groupId: string): Promise<LeaveRequest[]>;
  getLeaveAffectedShifts(
    groupId: string,
    input: LeaveAffectedShiftsInput,
  ): Promise<readonly LeaveAffectedShift[]>;
  listMySwapRequests(groupId: string): Promise<SwapRequest[]>;
  listSwapApprovals(groupId: string): Promise<SwapRequest[]>;
  getYearStatistics(groupId: string, year: number): Promise<YearStatistics>;
  publishSchedulePeriod(
    groupId: string,
    schedulePeriodId: string,
    input: PublishSchedulePeriodRequest,
  ): Promise<PublishSchedulePeriodResult>;
  publishScheduleDraftBatch(
    groupId: string,
    input: PublishSchedulePeriodBatchRequest,
  ): Promise<PublishSchedulePeriodBatchResult>;
  deleteScheduleDraft(groupId: string, schedulePeriodId: string): Promise<void>;
  withdrawSchedulePeriod(
    groupId: string,
    schedulePeriodId: string,
    input: SchedulePeriodMutationRequest,
  ): Promise<SchedulePeriodMutationResult>;
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
  cancelLeaveRequest(
    groupId: string,
    leaveRequestId: string,
    input: LeaveRequestMutationInput,
  ): Promise<LeaveRequestMutationResult>;
  revokeLeaveRequest(
    groupId: string,
    leaveRequestId: string,
    input: LeaveRequestMutationInput,
  ): Promise<LeaveRequestMutationResult>;
  rejectSwapRequest(
    groupId: string,
    swapRequestId: string,
    input: SwapRequestMutationInput,
  ): Promise<SwapRequest>;
  revokeSwapRequest(
    groupId: string,
    swapRequestId: string,
    input: RevokeSwapRequestInput,
  ): Promise<SwapRequest>;
  rejectDutyAdjustment(
    groupId: string,
    dutyAdjustmentId: string,
    input: DutyAdjustmentMutationInput,
  ): Promise<DutyAdjustmentRequest>;
  recalculateStatistics(
    groupId: string,
    businessMonth: string,
  ): Promise<StatisticsRecalculateCheckResult>;
  refreshMonthStatistics(groupId: string, businessMonth: string): Promise<MonthStatisticsSnapshot>;
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
  readonly isOnline?: () => boolean;
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
  const isOnline = options.isOnline ?? isNavigatorOnline;

  function requestJson<ResponseBody>(
    auth: CloudbaseAuthClient,
    fetchImplementationOverride: typeof fetch,
    baseUrlOverride: string,
    path: string,
    init: { readonly body?: string; readonly method: 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT' },
    isResponseBody: (value: unknown) => value is ResponseBody,
  ): Promise<ResponseBody> {
    return requestJsonWithOnline(
      auth,
      fetchImplementationOverride,
      baseUrlOverride,
      path,
      init,
      isResponseBody,
      isOnline,
    );
  }

  function requestText(
    auth: CloudbaseAuthClient,
    fetchImplementationOverride: typeof fetch,
    baseUrlOverride: string,
    path: string,
    init: { readonly method: 'GET' },
  ): Promise<string> {
    return requestTextWithOnline(
      auth,
      fetchImplementationOverride,
      baseUrlOverride,
      path,
      init,
      isOnline,
    );
  }

  return {
    createExportJob(groupId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/exports`,
        {
          body: JSON.stringify(input),
          method: 'POST',
        },
        isScheduleExportJob,
      );
    },
    downloadExport(groupId, exportJobId) {
      return requestText(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/exports/${encodeURIComponent(exportJobId)}/download`,
        { method: 'GET' },
      );
    },
    getExportJob(groupId, exportJobId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/exports/${encodeURIComponent(exportJobId)}`,
        { method: 'GET' },
        isScheduleExportJob,
      );
    },
    getMonthStatistics(groupId, businessMonth) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/statistics?businessMonth=${encodeURIComponent(businessMonth)}`,
        { method: 'GET' },
        isMonthStatisticsSnapshot,
      );
    },
    getYearStatistics(groupId, year) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/statistics/year?year=${encodeURIComponent(String(year))}`,
        { method: 'GET' },
        isYearStatistics,
      );
    },
    recalculateStatistics(groupId, businessMonth) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/statistics/recalculate-check`,
        {
          body: JSON.stringify({ businessMonth }),
          method: 'POST',
        },
        isStatisticsRecalculateCheckResult,
      );
    },
    refreshMonthStatistics(groupId, businessMonth) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/statistics/refresh`,
        {
          body: JSON.stringify({ businessMonth }),
          method: 'POST',
        },
        isMonthStatisticsSnapshot,
      );
    },
    deletePushSubscription() {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        '/notifications/push-subscription',
        { method: 'DELETE' },
        isDeletedResult,
      );
    },
    getGroupNotificationSettings(groupId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/notification-settings`,
        { method: 'GET' },
        isGroupNotificationSettings,
      );
    },
    getMyNotificationPreferences(groupId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/notification-preferences/mine`,
        { method: 'GET' },
        isMemberNotificationPreferences,
      );
    },
    getPushConfiguration() {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        '/notifications/push-config',
        { method: 'GET' },
        isPushConfiguration,
      );
    },
    getUnreadNotificationCount() {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        '/notifications/unread-count',
        { method: 'GET' },
        isUnreadCountResult,
      );
    },
    listNotifications(query) {
      const params = new URLSearchParams();
      if (query.cursor !== undefined) {
        params.set('cursor', query.cursor);
      }
      if (query.groupId !== undefined) {
        params.set('groupId', query.groupId);
      }
      if (query.pageSize !== undefined) {
        params.set('pageSize', String(query.pageSize));
      }
      if (query.unreadOnly === true) {
        params.set('unreadOnly', 'true');
      }
      const queryString = params.toString();
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/notifications${queryString === '' ? '' : `?${queryString}`}`,
        { method: 'GET' },
        isNotificationPage,
      );
    },
    listGuestGroups() {
      return requestPublicJsonWithOnline(
        fetchImplementation,
        baseUrl,
        '/guest/groups',
        { method: 'GET' },
        isGuestGroupSummaryList,
        isOnline,
      );
    },
    markAllNotificationsRead(groupId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        '/notifications/read-all',
        {
          method: 'POST',
          ...(groupId === undefined ? {} : { body: JSON.stringify({ groupId }) }),
        },
        isReadAllResult,
      );
    },
    markNotificationRead(notificationId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/notifications/${encodeURIComponent(notificationId)}/read`,
        { method: 'POST' },
        isNotificationRecord,
      );
    },
    savePushSubscription(input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        '/notifications/push-subscription',
        {
          body: JSON.stringify(input),
          method: 'PUT',
        },
        isSavedResult,
      );
    },
    updateGroupNotificationSettings(groupId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/notification-settings`,
        {
          body: JSON.stringify(input),
          method: 'PUT',
        },
        isGroupNotificationSettings,
      );
    },
    updateMyNotificationPreferences(groupId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/notification-preferences/mine`,
        {
          body: JSON.stringify(input),
          method: 'PUT',
        },
        isMemberNotificationPreferences,
      );
    },
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
    addGroupMembers(groupId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/members`,
        {
          body: JSON.stringify(input),
          method: 'POST',
        },
        isAddRosterEntriesResponse,
      );
    },
    convertRosterEntries(groupId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/roster-entries/convert`,
        {
          body: JSON.stringify(input),
          method: 'POST',
        },
        isConvertPendingRosterResponse,
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
    createDirectSwapRequest(groupId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/swaps/direct`,
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
    deleteGroupMember(groupId, memberId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(memberId)}`,
        { method: 'DELETE' },
        isUndefined,
      );
    },
    deleteManualScheduleTemplate(groupId, templateId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/manual-schedule-templates/${encodeURIComponent(templateId)}`,
        { method: 'DELETE' },
        isUndefined,
      );
    },
    deleteScheduleRole(groupId, roleId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/schedule-roles/${encodeURIComponent(roleId)}`,
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
    getGuestCalendar(groupCode, businessMonth) {
      return requestPublicJsonWithOnline(
        fetchImplementation,
        baseUrl,
        '/guest/calendar',
        {
          body: JSON.stringify({ businessMonth, groupCode }),
          method: 'POST',
        },
        isGuestCalendarReadModel,
        isOnline,
      );
    },
    getGuestGroupCalendar(groupId, businessMonth) {
      return requestPublicJsonWithOnline(
        fetchImplementation,
        baseUrl,
        `/guest/groups/${encodeURIComponent(groupId)}/calendar?businessMonth=${encodeURIComponent(businessMonth)}`,
        { method: 'GET' },
        isGuestCalendarReadModel,
        isOnline,
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
    updateProfile(realName) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        '/users/me',
        {
          body: JSON.stringify({ realName }),
          method: 'PATCH',
        },
        isUserProfile,
      );
    },
    getHolidays(year) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/holidays?year=${encodeURIComponent(String(year))}`,
        { method: 'GET' },
        isHolidayReadModel,
      );
    },
    getGuestHolidays(year) {
      return requestPublicJsonWithOnline(
        fetchImplementation,
        baseUrl,
        `/guest/holidays?year=${encodeURIComponent(String(year))}`,
        { method: 'GET' },
        isHolidayReadModel,
        isOnline,
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
    getMyDutyAdjustmentSettings(groupId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/duty-adjustments/my-settings`,
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
    listScheduleDrafts(groupId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/schedule-periods`,
        { method: 'GET' },
        isScheduleDraftSummaryList,
      );
    },
    getScheduleDraftPreview(groupId, schedulePeriodId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/schedules/${encodeURIComponent(schedulePeriodId)}/preview`,
        { method: 'GET' },
        isScheduleGenerationPreview,
      );
    },
    getSchedulePeriodCalendar(groupId, schedulePeriodId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/calendar/periods/${encodeURIComponent(schedulePeriodId)}`,
        { method: 'GET' },
        isCalendarReadModel,
      );
    },
    listPastSchedulePeriods(groupId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/past-schedules`,
        { method: 'GET' },
        isPastSchedulePeriodList,
      );
    },
    listPastScheduleAssignments(groupId, schedulePeriodId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/past-schedules/${encodeURIComponent(schedulePeriodId)}/assignments`,
        { method: 'GET' },
        isPastScheduleAssignmentList,
      );
    },
    listPastScheduleBackfillRecords(groupId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/past-schedules/backfill-records`,
        { method: 'GET' },
        isPastScheduleBackfillRecordList,
      );
    },
    updatePastScheduleAssignment(groupId, schedulePeriodId, assignmentId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/past-schedules/${encodeURIComponent(schedulePeriodId)}/assignments/${encodeURIComponent(assignmentId)}`,
        { body: JSON.stringify(input), method: 'PUT' },
        isUpdatePastScheduleAssignmentResult,
      );
    },
    createPastScheduleAssignment(groupId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/past-schedules/assignments`,
        { body: JSON.stringify(input), method: 'POST' },
        isUpdatePastScheduleAssignmentResult,
      );
    },
    previewScheduleChange(groupId, schedulePeriodId, action) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/schedules/${encodeURIComponent(schedulePeriodId)}/change-impact?action=${encodeURIComponent(action)}`,
        { method: 'GET' },
        isScheduleChangeImpactPreview,
      );
    },
    listSchedulePeriodHistory(groupId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/schedule-periods/history`,
        { method: 'GET' },
        isSchedulePeriodHistoryItemList,
      );
    },
    publishSchedulePeriod(groupId, schedulePeriodId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/schedules/${encodeURIComponent(schedulePeriodId)}/publish`,
        { method: 'POST', body: JSON.stringify(input) },
        isPublishSchedulePeriodResult,
      );
    },
    publishScheduleDraftBatch(groupId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/schedules/publish-batch`,
        {
          body: JSON.stringify(input),
          method: 'POST',
        },
        isPublishSchedulePeriodBatchResult,
      );
    },
    deleteScheduleDraft(groupId, schedulePeriodId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/schedules/${encodeURIComponent(schedulePeriodId)}`,
        { method: 'DELETE' },
        isUndefined,
      );
    },
    withdrawSchedulePeriod(groupId, schedulePeriodId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/schedules/${encodeURIComponent(schedulePeriodId)}/withdraw`,
        { body: JSON.stringify(input), method: 'POST' },
        isSchedulePeriodMutationResult,
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
    lookupClaimMatches(groupId, realName) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/claim-lookups`,
        {
          body: JSON.stringify({ realName }),
          method: 'POST',
        },
        isMembershipClaimLookupResponse,
      );
    },
    createMembershipClaimRequest(groupId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/claim-requests`,
        {
          body: JSON.stringify(input),
          method: 'POST',
        },
        isCreateMembershipClaimResponse,
      );
    },
    listMembershipClaimRequests(groupId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/claim-requests`,
        { method: 'GET' },
        isMembershipClaimRequestList,
      );
    },
    approveMembershipClaimRequest(groupId, claimRequestId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/claim-requests/${encodeURIComponent(claimRequestId)}/approve`,
        { method: 'POST' },
        isMembershipClaimRequest,
      );
    },
    rejectMembershipClaimRequest(groupId, claimRequestId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/claim-requests/${encodeURIComponent(claimRequestId)}/reject`,
        { method: 'POST' },
        isMembershipClaimRequest,
      );
    },
    revokeMembershipClaim(groupId, membershipId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(membershipId)}/revoke-claim`,
        { method: 'POST' },
        isUndefined,
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
    getLeaveAffectedShifts(groupId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/leave-requests/affected-shifts`,
        {
          body: JSON.stringify(input),
          method: 'POST',
        },
        isLeaveAffectedShiftList,
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
    cancelLeaveRequest(groupId, leaveRequestId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/leave-requests/${encodeURIComponent(leaveRequestId)}/cancel`,
        {
          body: JSON.stringify(input),
          method: 'POST',
        },
        isLeaveRequestMutationResult,
      );
    },
    revokeLeaveRequest(groupId, leaveRequestId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/leave-requests/${encodeURIComponent(leaveRequestId)}/revoke`,
        {
          body: JSON.stringify(input),
          method: 'POST',
        },
        isLeaveRequestMutationResult,
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
    revokeSwapRequest(groupId, swapRequestId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/swaps/${encodeURIComponent(swapRequestId)}/revoke`,
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
  public readonly code: ApiErrorCode | 'NETWORK_ERROR' | 'OFFLINE' | undefined;
  public readonly latestData: JsonObject | undefined;
  public readonly requestId: string | undefined;
  public readonly status: number | undefined;

  public constructor(input: {
    readonly code?: ApiErrorCode | 'NETWORK_ERROR' | 'OFFLINE';
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

async function requestPublicJsonWithOnline<ResponseBody>(
  fetchImplementation: typeof fetch,
  baseUrl: string,
  path: string,
  init: { readonly body?: string; readonly method: 'GET' | 'POST' },
  isResponseBody: (value: unknown) => value is ResponseBody,
  isOnline: () => boolean,
): Promise<ResponseBody> {
  const offlineError = getOfflineSubmitError(isOnline(), init.method);
  if (offlineError !== undefined) {
    throw new ApiClientError({ code: 'OFFLINE', message: offlineError });
  }

  let response: Response;
  try {
    response = await fetchImplementation(joinUrl(baseUrl, path), {
      headers: init.body === undefined ? {} : { 'Content-Type': 'application/json' },
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

async function requestJsonWithOnline<ResponseBody>(
  auth: CloudbaseAuthClient,
  fetchImplementation: typeof fetch,
  baseUrl: string,
  path: string,
  init: { readonly body?: string; readonly method: 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT' },
  isResponseBody: (value: unknown) => value is ResponseBody,
  isOnline: () => boolean,
): Promise<ResponseBody> {
  const session = getAuthenticatedSession(await auth.getSession());

  const offlineError = getOfflineSubmitError(isOnline(), init.method);
  if (offlineError !== undefined) {
    throw new ApiClientError({
      code: 'OFFLINE',
      message: offlineError,
    });
  }

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

async function requestTextWithOnline(
  auth: CloudbaseAuthClient,
  fetchImplementation: typeof fetch,
  baseUrl: string,
  path: string,
  init: { readonly method: 'GET' },
  isOnline: () => boolean,
): Promise<string> {
  const session = getAuthenticatedSession(await auth.getSession());

  const offlineError = getOfflineSubmitError(isOnline(), init.method);
  if (offlineError !== undefined) {
    throw new ApiClientError({
      code: 'OFFLINE',
      message: offlineError,
    });
  }

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
      },
      method: init.method,
    });
  } catch {
    throw new ApiClientError({
      code: 'NETWORK_ERROR',
      message: '无法连接到服务，请检查网络后重试。',
    });
  }

  const text = await response.text();
  if (!response.ok) {
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      body = undefined;
    }
    throw toApiClientError(response.status, body);
  }

  return text;
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

function isConvertPendingRosterResponse(value: unknown): value is ConvertPendingRosterResponse {
  return (
    value !== null &&
    typeof value === 'object' &&
    'converted' in value &&
    typeof value.converted === 'number' &&
    Number.isInteger(value.converted) &&
    value.converted >= 0 &&
    'skipped' in value &&
    typeof value.skipped === 'number' &&
    Number.isInteger(value.skipped) &&
    value.skipped >= 0
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

function isGuestCalendarReadModel(value: unknown): value is GuestCalendarReadModel {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as Partial<GuestCalendarReadModel>).groupName === 'string' &&
    isCalendarReadModel((value as Partial<GuestCalendarReadModel>).calendar)
  );
}

function isGuestGroupSummaryList(value: unknown): value is readonly GuestGroupSummary[] {
  return (
    Array.isArray(value) &&
    value.every(
      (group) =>
        group !== null &&
        typeof group === 'object' &&
        typeof (group as Partial<GuestGroupSummary>).id === 'string' &&
        typeof (group as Partial<GuestGroupSummary>).name === 'string',
    )
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

function isMembershipClaimLookupEntry(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const entry = value as {
    readonly isUnclaimed?: unknown;
    readonly membershipId?: unknown;
    readonly realName?: unknown;
    readonly role?: unknown;
  };
  return (
    typeof entry.membershipId === 'string' &&
    entry.membershipId.length > 0 &&
    typeof entry.realName === 'string' &&
    entry.realName.length > 0 &&
    typeof entry.isUnclaimed === 'boolean' &&
    (entry.role === 'administrator' || entry.role === 'member' || entry.role === 'owner')
  );
}

function isMembershipClaimLookupResponse(value: unknown): value is MembershipClaimLookupResponse {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const body = value as Partial<MembershipClaimLookupResponse>;
  return Array.isArray(body.matches) && body.matches.every(isMembershipClaimLookupEntry);
}

function isMembershipClaimRequest(value: unknown): value is MembershipClaimRequest {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const claim = value as Partial<MembershipClaimRequest>;
  return (
    typeof claim.id === 'string' &&
    claim.id.length > 0 &&
    typeof claim.groupId === 'string' &&
    claim.groupId.length > 0 &&
    typeof claim.requestingUserId === 'string' &&
    claim.requestingUserId.length > 0 &&
    typeof claim.requestingUserRealName === 'string' &&
    typeof claim.targetMembershipId === 'string' &&
    claim.targetMembershipId.length > 0 &&
    typeof claim.targetMemberRealName === 'string' &&
    typeof claim.status === 'string' &&
    typeof claim.createdAt === 'string' &&
    typeof claim.version === 'number' &&
    (claim.decidedAt === undefined || typeof claim.decidedAt === 'string') &&
    (claim.decidedByRealName === undefined || typeof claim.decidedByRealName === 'string') &&
    (claim.decidedByUserId === undefined || typeof claim.decidedByUserId === 'string')
  );
}

function isMembershipClaimRequestList(value: unknown): value is MembershipClaimRequest[] {
  return Array.isArray(value) && value.every(isMembershipClaimRequest);
}

function isCreateMembershipClaimResponse(value: unknown): value is CreateMembershipClaimResponse {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const body = value as { readonly direct?: unknown; readonly request?: unknown };
  if (typeof body.direct !== 'boolean') {
    return false;
  }
  if (body.direct === true) {
    return body.request === undefined;
  }

  return body.request !== undefined && isMembershipClaimRequest(body.request);
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
    (member.isUnclaimed === undefined || typeof member.isUnclaimed === 'boolean') &&
    (member.isPendingRoster === undefined || typeof member.isPendingRoster === 'boolean') &&
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
    (request.reason === undefined || typeof request.reason === 'string') &&
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
    (request.decidedByMemberName === undefined ||
      typeof request.decidedByMemberName === 'string') &&
    (request.decidedAt === undefined || typeof request.decidedAt === 'string') &&
    (request.isRevocable === undefined || typeof request.isRevocable === 'boolean') &&
    (request.revocationBlockedReason === undefined ||
      typeof request.revocationBlockedReason === 'string')
  );
}

function isLeaveRequestList(value: unknown): value is LeaveRequest[] {
  return Array.isArray(value) && value.every(isLeaveRequest);
}

function isLeaveAffectedShiftList(value: unknown): value is readonly LeaveAffectedShift[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item !== null &&
        typeof item === 'object' &&
        typeof (item as { assignmentId?: unknown }).assignmentId === 'string' &&
        typeof (item as { businessDate?: unknown }).businessDate === 'string' &&
        typeof (item as { isCovered?: unknown }).isCovered === 'boolean' &&
        typeof (item as { shiftTypeAbbreviation?: unknown }).shiftTypeAbbreviation === 'string' &&
        typeof (item as { shiftTypeName?: unknown }).shiftTypeName === 'string',
    )
  );
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

function isLeaveRequestMutationResult(value: unknown): value is LeaveRequestMutationResult {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const result = value as Partial<LeaveRequestMutationResult>;
  return (
    typeof result.leaveRequestId === 'string' &&
    result.leaveRequestId.length > 0 &&
    typeof result.operationId === 'string' &&
    result.operationId.length > 0 &&
    (result.status === 'cancelled' || result.status === 'revoked')
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
      conflict.code === 'MEMBER_TIME_OVERLAP' ||
      conflict.code === 'ASSIGNMENT_HAS_ACTIVE_SWAP_REQUEST' ||
      conflict.code === 'ASSIGNMENT_HAS_PENDING_DUTY_ADJUSTMENT') &&
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
    (request.decidedAt === undefined || typeof request.decidedAt === 'string') &&
    (request.revocationReason === undefined || typeof request.revocationReason === 'string')
  );
}

function isSwapRequestStatus(value: unknown): boolean {
  return (
    value === 'pending_target' ||
    value === 'pending_approval' ||
    value === 'completed' ||
    value === 'rejected' ||
    value === 'cancelled' ||
    value === 'revoked'
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
      conflict.code === 'MEMBER_TIME_OVERLAP' ||
      conflict.code === 'ASSIGNMENT_HAS_ACTIVE_SWAP_REQUEST' ||
      conflict.code === 'ASSIGNMENT_HAS_ACTIVE_DUTY_ADJUSTMENT') &&
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
    (request.reason === undefined || typeof request.reason === 'string') &&
    (request.revocationReason === undefined || typeof request.revocationReason === 'string')
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

function isScheduleDraftSummaryList(value: unknown): value is ScheduleDraftSummary[] {
  return Array.isArray(value) && value.every(isScheduleDraftSummary);
}

function isSchedulePeriodHistoryItemList(value: unknown): value is SchedulePeriodHistoryItem[] {
  return Array.isArray(value) && value.every(isSchedulePeriodHistoryItem);
}

function isPastSchedulePeriodList(value: unknown): value is PastSchedulePeriod[] {
  return Array.isArray(value) && value.every(isPastSchedulePeriod);
}

function isPastSchedulePeriod(value: unknown): value is PastSchedulePeriod {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const period = value as Partial<PastSchedulePeriod>;
  return (
    typeof period.id === 'string' &&
    period.id.length > 0 &&
    typeof period.businessMonth === 'string' &&
    /^\d{4}-\d{2}$/u.test(period.businessMonth) &&
    (period.periodStatus === 'past' || period.periodStatus === 'published') &&
    typeof period.scheduleRoleId === 'string' &&
    period.scheduleRoleId.length > 0 &&
    typeof period.scheduleRoleName === 'string' &&
    period.scheduleRoleName.length > 0 &&
    typeof period.revision === 'number' &&
    Number.isInteger(period.revision) &&
    typeof period.version === 'number' &&
    Number.isInteger(period.version)
  );
}

function isPastScheduleAssignmentList(value: unknown): value is PastScheduleAssignment[] {
  return Array.isArray(value) && value.every(isPastScheduleAssignment);
}

function isPastScheduleBackfillRecordList(value: unknown): value is PastScheduleBackfillRecord[] {
  return Array.isArray(value) && value.every(isPastScheduleBackfillRecord);
}

function isPastScheduleBackfillRecord(value: unknown): value is PastScheduleBackfillRecord {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const record = value as Partial<PastScheduleBackfillRecord>;
  return (
    typeof record.assignmentId === 'string' &&
    record.assignmentId.length > 0 &&
    typeof record.businessDate === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/u.test(record.businessDate) &&
    typeof record.backfilledAt === 'string' &&
    record.backfilledAt.length > 0 &&
    typeof record.operatorName === 'string' &&
    typeof record.shiftTypeName === 'string' &&
    typeof record.shiftTypeAbbreviation === 'string'
  );
}

function isPastScheduleAssignment(value: unknown): value is PastScheduleAssignment {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const assignment = value as Partial<PastScheduleAssignment>;
  return (
    typeof assignment.assignmentId === 'string' &&
    assignment.assignmentId.length > 0 &&
    typeof assignment.businessDate === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/u.test(assignment.businessDate) &&
    typeof assignment.shiftTypeId === 'string' &&
    assignment.shiftTypeId.length > 0 &&
    typeof assignment.shiftTypeName === 'string' &&
    typeof assignment.shiftTypeAbbreviation === 'string' &&
    typeof assignment.slotPosition === 'number' &&
    Number.isInteger(assignment.slotPosition)
  );
}

function isUpdatePastScheduleAssignmentResult(
  value: unknown,
): value is UpdatePastScheduleAssignmentResult {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const result = value as Partial<UpdatePastScheduleAssignmentResult>;
  return (
    isPastScheduleAssignment(result.assignment) &&
    (result.eventId === undefined ||
      (typeof result.eventId === 'string' && result.eventId.length > 0))
  );
}

function isSchedulePeriodHistoryItem(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const item = value as Partial<SchedulePeriodHistoryItem>;
  return (
    typeof item.id === 'string' &&
    item.id.length > 0 &&
    typeof item.businessMonth === 'string' &&
    /^\d{4}-\d{2}$/u.test(item.businessMonth) &&
    typeof item.scheduleRoleId === 'string' &&
    item.scheduleRoleId.length > 0 &&
    typeof item.scheduleRoleName === 'string' &&
    item.scheduleRoleName.length > 0 &&
    typeof item.revision === 'number' &&
    Number.isInteger(item.revision) &&
    item.revision >= 1 &&
    typeof item.version === 'number' &&
    Number.isInteger(item.version) &&
    item.version >= 1 &&
    typeof item.createdAt === 'string' &&
    (item.status === 'draft' ||
      item.status === 'pending_publication' ||
      item.status === 'published' ||
      item.status === 'replaced' ||
      item.status === 'withdrawn' ||
      item.status === 'past') &&
    (item.applyStartDate === undefined || typeof item.applyStartDate === 'string') &&
    (item.applyEndDate === undefined || typeof item.applyEndDate === 'string') &&
    (item.operationId === undefined || typeof item.operationId === 'string') &&
    (item.publishedAt === undefined || typeof item.publishedAt === 'string')
  );
}

function isScheduleGenerationPreview(value: unknown): value is ScheduleGenerationPreview {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const preview = value as Partial<ScheduleGenerationPreview>;
  const assignments = preview.assignments ?? [];
  return (
    typeof preview.businessMonth === 'string' &&
    /^\d{4}-\d{2}(-\d{2})?$/u.test(preview.businessMonth) &&
    typeof preview.rulesVersion === 'number' &&
    Number.isInteger(preview.rulesVersion) &&
    Array.isArray(assignments) &&
    assignments.every(
      (assignment) =>
        assignment !== null &&
        typeof assignment === 'object' &&
        typeof assignment.businessDate === 'string' &&
        typeof assignment.shiftTypeId === 'string',
    ) &&
    Array.isArray(preview.scheduleRoleIds) &&
    preview.statistics !== null &&
    typeof preview.statistics === 'object'
  );
}

function isScheduleDraftSummary(value: unknown): boolean {
  if (!isSchedulePeriodSummary(value)) {
    return false;
  }

  const draft = value as Partial<ScheduleDraftSummary>;
  return typeof draft.scheduleRoleName === 'string' && draft.scheduleRoleName.length > 0;
}

function isPublishSchedulePeriodResult(value: unknown): value is PublishSchedulePeriodResult {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const result = value as Partial<PublishSchedulePeriodResult>;
  const preview = result.preview as { businessMonth?: unknown; statistics?: unknown } | undefined;
  return (
    isSchedulePeriodSummary(result.period) &&
    preview !== undefined &&
    preview !== null &&
    typeof preview === 'object' &&
    typeof preview.businessMonth === 'string' &&
    preview.statistics !== null &&
    typeof preview.statistics === 'object' &&
    Array.isArray(result.workflowImpacts) &&
    result.workflowImpacts.every(isScheduleWorkflowImpact)
  );
}

function isScheduleWorkflowImpact(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const impact = value as {
    businessDates?: unknown;
    id?: unknown;
    kind?: unknown;
    memberNames?: unknown;
    status?: unknown;
  };
  return (
    Array.isArray(impact.businessDates) &&
    impact.businessDates.every((date) => typeof date === 'string') &&
    typeof impact.id === 'string' &&
    (impact.kind === 'swap' || impact.kind === 'duty_adjustment') &&
    Array.isArray(impact.memberNames) &&
    impact.memberNames.every((name) => typeof name === 'string') &&
    typeof impact.status === 'string'
  );
}

function isScheduleChangeImpactPreview(value: unknown): value is ScheduleChangeImpactPreview {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const preview = value as Partial<ScheduleChangeImpactPreview>;
  return (
    (preview.action === 'publish' || preview.action === 'withdraw') &&
    Array.isArray(preview.affectedPeriodIds) &&
    preview.affectedPeriodIds.every((id) => typeof id === 'string') &&
    Array.isArray(preview.workflowImpacts) &&
    preview.workflowImpacts.every(isScheduleWorkflowImpact)
  );
}

function isSchedulePeriodMutationResult(value: unknown): value is SchedulePeriodMutationResult {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const result = value as Partial<SchedulePeriodMutationResult>;
  return (
    isSchedulePeriodSummary(result.period) &&
    Array.isArray(result.workflowImpacts) &&
    result.workflowImpacts.every(isScheduleWorkflowImpact)
  );
}

function isPublishSchedulePeriodBatchResult(
  value: unknown,
): value is PublishSchedulePeriodBatchResult {
  return (
    value !== null &&
    typeof value === 'object' &&
    'periods' in value &&
    Array.isArray(value.periods) &&
    value.periods.every(isSchedulePeriodSummary)
  );
}

function isHolidayReadModel(value: unknown): value is HolidayReadModel {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const holiday = value as Partial<HolidayReadModel>;
  return (
    typeof holiday.confirmed === 'boolean' &&
    typeof holiday.year === 'number' &&
    Number.isInteger(holiday.year) &&
    Array.isArray(holiday.dates) &&
    holiday.dates.every(
      (date) =>
        date !== null &&
        typeof date === 'object' &&
        typeof (date as { date?: unknown }).date === 'string' &&
        typeof (date as { holidayName?: unknown }).holidayName === 'string' &&
        typeof (date as { isOffDay?: unknown }).isOffDay === 'boolean' &&
        typeof (date as { isWorkday?: unknown }).isWorkday === 'boolean',
    )
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

function isNotificationRecord(value: unknown): value is NotificationRecord {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const notification = value as Partial<NotificationRecord>;
  return (
    typeof notification.id === 'string' &&
    notification.id.length > 0 &&
    typeof notification.recipientUserId === 'string' &&
    notification.recipientUserId.length > 0 &&
    typeof notification.notificationType === 'string' &&
    notification.notificationType.length > 0 &&
    typeof notification.title === 'string' &&
    notification.title.length > 0 &&
    typeof notification.body === 'string' &&
    notification.body.length > 0 &&
    typeof notification.createdAt === 'string' &&
    typeof notification.isRead === 'boolean' &&
    (notification.groupId === undefined || typeof notification.groupId === 'string') &&
    (notification.objectId === undefined || typeof notification.objectId === 'string') &&
    (notification.objectType === undefined || typeof notification.objectType === 'string') &&
    (notification.payload === undefined || isJsonObjectValue(notification.payload)) &&
    (notification.scheduleEventId === undefined ||
      typeof notification.scheduleEventId === 'string') &&
    (notification.shiftAssignmentId === undefined ||
      typeof notification.shiftAssignmentId === 'string')
  );
}

function isNotificationPage(value: unknown): value is NotificationPage {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const page = value as Partial<NotificationPage>;
  return (
    Array.isArray(page.notifications) &&
    page.notifications.every(isNotificationRecord) &&
    typeof page.unreadCount === 'number' &&
    Number.isInteger(page.unreadCount) &&
    (page.nextCursor === undefined || typeof page.nextCursor === 'string')
  );
}

function isUnreadCountResult(value: unknown): value is { readonly unreadCount: number } {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as { unreadCount?: unknown }).unreadCount === 'number' &&
    Number.isInteger((value as { unreadCount: number }).unreadCount)
  );
}

function isReadAllResult(value: unknown): value is { readonly count: number } {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as { count?: unknown }).count === 'number' &&
    Number.isInteger((value as { count: number }).count)
  );
}

function isSavedResult(value: unknown): value is { readonly saved: boolean } {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as { saved?: unknown }).saved === 'boolean'
  );
}

function isDeletedResult(value: unknown): value is { readonly deleted: boolean } {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as { deleted?: unknown }).deleted === 'boolean'
  );
}

function isGroupNotificationSettings(
  value: unknown,
): value is { readonly dutyReminderHours: readonly number[]; readonly groupId: string } {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const settings = value as {
    dutyReminderHours?: unknown;
    groupId?: unknown;
  };
  return (
    typeof settings.groupId === 'string' &&
    settings.groupId.length > 0 &&
    Array.isArray(settings.dutyReminderHours) &&
    settings.dutyReminderHours.every(
      (hour) => typeof hour === 'number' && Number.isInteger(hour) && hour >= 1,
    )
  );
}

function isMemberNotificationPreferences(value: unknown): value is MemberNotificationPreferences {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const preferences = value as Partial<MemberNotificationPreferences>;
  return (
    typeof preferences.membershipId === 'string' &&
    preferences.membershipId.length > 0 &&
    typeof preferences.browserNotificationsEnabled === 'boolean' &&
    (preferences.dutyReminderHours === null ||
      (Array.isArray(preferences.dutyReminderHours) &&
        preferences.dutyReminderHours.every(
          (hour) => typeof hour === 'number' && Number.isInteger(hour) && hour >= 1,
        )))
  );
}

function isPushConfiguration(value: unknown): value is PushConfiguration {
  return (
    value !== null &&
    typeof value === 'object' &&
    ((value as { vapidPublicKey?: unknown }).vapidPublicKey === null ||
      typeof (value as { vapidPublicKey?: unknown }).vapidPublicKey === 'string')
  );
}

function isStatisticsRoleCount(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const count = value as {
    actualCount?: unknown;
    plannedCount?: unknown;
    scheduleRoleId?: unknown;
    scheduleRoleName?: unknown;
  };
  return (
    typeof count.actualCount === 'number' &&
    typeof count.plannedCount === 'number' &&
    typeof count.scheduleRoleId === 'string' &&
    typeof count.scheduleRoleName === 'string'
  );
}

function isStatisticsShiftTypeCount(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const count = value as {
    actualCount?: unknown;
    plannedCount?: unknown;
    shiftTypeId?: unknown;
    shiftTypeName?: unknown;
  };
  return (
    typeof count.actualCount === 'number' &&
    typeof count.plannedCount === 'number' &&
    typeof count.shiftTypeId === 'string' &&
    typeof count.shiftTypeName === 'string'
  );
}

function isStatisticsMemberRow(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const row = value as {
    actualCount?: unknown;
    actualVsPlanned?: unknown;
    byRole?: unknown;
    byShiftType?: unknown;
    countedActualCount?: unknown;
    countedPlannedCount?: unknown;
    deductionCount?: unknown;
    deltaCount?: unknown;
    holidayCount?: unknown;
    leaveCoverCount?: unknown;
    manualAdjustmentCount?: unknown;
    membershipId?: unknown;
    netDutyAdjustment?: unknown;
    overtimeCount?: unknown;
    plannedCount?: unknown;
    realName?: unknown;
    swapCount?: unknown;
    weekendCount?: unknown;
  };
  return (
    typeof row.actualCount === 'number' &&
    Array.isArray(row.actualVsPlanned) &&
    Array.isArray(row.byRole) &&
    row.byRole.every(isStatisticsRoleCount) &&
    Array.isArray(row.byShiftType) &&
    row.byShiftType.every(isStatisticsShiftTypeCount) &&
    typeof row.countedActualCount === 'number' &&
    typeof row.countedPlannedCount === 'number' &&
    typeof row.deductionCount === 'number' &&
    typeof row.deltaCount === 'number' &&
    typeof row.holidayCount === 'number' &&
    typeof row.leaveCoverCount === 'number' &&
    typeof row.manualAdjustmentCount === 'number' &&
    typeof row.membershipId === 'string' &&
    typeof row.netDutyAdjustment === 'number' &&
    typeof row.overtimeCount === 'number' &&
    typeof row.plannedCount === 'number' &&
    typeof row.realName === 'string' &&
    typeof row.swapCount === 'number' &&
    typeof row.weekendCount === 'number'
  );
}

function isStatisticsSummary(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const summary = value as {
    actualCount?: unknown;
    byRole?: unknown;
    byShiftType?: unknown;
    countedActualCount?: unknown;
    countedPlannedCount?: unknown;
    deductionCount?: unknown;
    holidayCount?: unknown;
    leaveCoverCount?: unknown;
    manualAdjustmentCount?: unknown;
    members?: unknown;
    netDutyAdjustment?: unknown;
    overtimeCount?: unknown;
    plannedCount?: unknown;
    swapCount?: unknown;
    weekendCount?: unknown;
  };
  return (
    typeof summary.actualCount === 'number' &&
    Array.isArray(summary.byRole) &&
    summary.byRole.every(isStatisticsRoleCount) &&
    Array.isArray(summary.byShiftType) &&
    summary.byShiftType.every(isStatisticsShiftTypeCount) &&
    typeof summary.countedActualCount === 'number' &&
    typeof summary.countedPlannedCount === 'number' &&
    typeof summary.deductionCount === 'number' &&
    typeof summary.holidayCount === 'number' &&
    typeof summary.leaveCoverCount === 'number' &&
    typeof summary.manualAdjustmentCount === 'number' &&
    Array.isArray(summary.members) &&
    summary.members.every(isStatisticsMemberRow) &&
    typeof summary.netDutyAdjustment === 'number' &&
    typeof summary.overtimeCount === 'number' &&
    typeof summary.plannedCount === 'number' &&
    typeof summary.swapCount === 'number' &&
    typeof summary.weekendCount === 'number'
  );
}

function isMonthStatisticsSnapshot(value: unknown): value is MonthStatisticsSnapshot {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const snapshot = value as Partial<MonthStatisticsSnapshot>;
  return (
    typeof snapshot.businessMonth === 'string' &&
    typeof snapshot.computedAt === 'string' &&
    typeof snapshot.groupId === 'string' &&
    typeof snapshot.version === 'number' &&
    isStatisticsSummary(snapshot.summary)
  );
}

function isYearStatistics(value: unknown): value is YearStatistics {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const year = value as Partial<YearStatistics>;
  return (
    typeof year.year === 'number' &&
    Array.isArray(year.months) &&
    year.months.every(
      (month) =>
        typeof (month as { businessMonth?: unknown }).businessMonth === 'string' &&
        isStatisticsSummary((month as { summary?: unknown }).summary),
    ) &&
    isStatisticsSummary(year.summary)
  );
}

function isStatisticsRecalculateCheckResult(
  value: unknown,
): value is StatisticsRecalculateCheckResult {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const result = value as Partial<StatisticsRecalculateCheckResult>;
  return (
    typeof result.businessMonth === 'string' &&
    typeof result.matched === 'boolean' &&
    Array.isArray(result.mismatches) &&
    result.mismatches.every((entry) => typeof entry === 'string') &&
    isStatisticsSummary(result.recomputed) &&
    isStatisticsSummary(result.snapshot) &&
    typeof result.snapshotVersion === 'number'
  );
}

function isScheduleExportJob(value: unknown): value is ScheduleExportJob {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const job = value as Partial<ScheduleExportJob>;
  return (
    typeof job.id === 'string' &&
    typeof job.groupId === 'string' &&
    (job.exportType === 'schedule' || job.exportType === 'statistics') &&
    (job.periodType === 'month' || job.periodType === 'year') &&
    typeof job.period === 'string' &&
    (job.status === 'pending' ||
      job.status === 'running' ||
      job.status === 'completed' ||
      job.status === 'failed') &&
    typeof job.createdAt === 'string' &&
    (job.completedAt === undefined || typeof job.completedAt === 'string') &&
    (job.error === undefined || typeof job.error === 'string') &&
    (job.expiresAt === undefined || typeof job.expiresAt === 'string') &&
    (job.membershipId === undefined || typeof job.membershipId === 'string') &&
    (job.roleId === undefined || typeof job.roleId === 'string') &&
    (job.rowCount === undefined || typeof job.rowCount === 'number')
  );
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
