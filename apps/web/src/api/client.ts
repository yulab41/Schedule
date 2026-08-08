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
  DissolvedGroup,
  GroupCatalogEntry,
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
  UpdateGroupNameRequest,
  UpdateGroupDutyAdjustmentSettingsInput,
  UpdateManualScheduleTemplateRequest,
  UpdateGroupLeaveReflowStrategyInput,
  UpdateGroupSwapSettingsInput,
  UpdateMemberSwapSettingsInput,
  UpdateShiftTypeRequest,
  UserProfile,
} from '@schedule/contracts';

import {
  addRosterEntriesResponseSchema,
  apiErrorCodes,
  appliedManualScheduleTemplateResultSchema,
  approvedLeaveRequestResultSchema,
  calendarReadModelSchema,
  claimGroupResponseSchema,
  convertPendingRosterResponseSchema,
  createMembershipClaimResponseSchema,
  deletedResultSchema,
  dutyAdjustmentPreviewSchema,
  dutyAdjustmentRequestListSchema,
  dutyAdjustmentRequestSchema,
  dissolvedGroupListSchema,
  guestCalendarReadModelSchema,
  guestGroupSummaryListSchema,
  groupCatalogListSchema,
  groupDutyAdjustmentSettingsSchema,
  groupMemberContactListSchema,
  groupMemberContactSchema,
  groupMemberListSchema,
  groupMemberSchema,
  groupSchedulePublishModeSchema,
  groupSwapSettingsSchema,
  groupSummaryListSchema,
  groupSummarySchema,
  groupLeaveReflowStrategySchema,
  groupNotificationSettingsSchema,
  holidayReadModelSchema,
  leaveAffectedShiftListSchema,
  leaveReflowPreviewSchema,
  leaveRequestListSchema,
  leaveRequestMutationResultSchema,
  leaveRequestSchema,
  manualApplyPreviewSchema,
  manualScheduleTemplateListSchema,
  manualScheduleTemplateSchema,
  membershipClaimLookupResponseSchema,
  membershipClaimRequestListSchema,
  membershipClaimRequestSchema,
  memberNotificationPreferencesSchema,
  memberSwapSettingsSchema,
  monthStatisticsSnapshotSchema,
  pastScheduleAssignmentListSchema,
  pastScheduleBackfillRecordListSchema,
  pastSchedulePeriodListSchema,
  notificationPageSchema,
  notificationRecordSchema,
  publishSchedulePeriodBatchResultSchema,
  publishSchedulePeriodResultSchema,
  pushConfigurationSchema,
  readAllResultSchema,
  rejectedLeaveRequestResultSchema,
  savedResultSchema,
  scheduleChangeImpactPreviewSchema,
  scheduleDraftSummaryListSchema,
  scheduleEventDetailSchema,
  scheduleEventPageSchema,
  scheduleExportJobSchema,
  scheduleGenerationPreviewSchema,
  scheduleRoleSchema,
  schedulePeriodHistoryItemListSchema,
  schedulePeriodMutationResultSchema,
  schedulingConfigSchema,
  shiftTypeSchema,
  swapPreviewSchema,
  swapRequestListSchema,
  swapRequestSchema,
  statisticsRecalculateCheckResultSchema,
  unreadCountResultSchema,
  updatePastScheduleAssignmentResultSchema,
  userProfileSchema,
  yearStatisticsSchema,
} from '@schedule/contracts';
import { getAuthenticatedSession, type AuthClient } from '../auth/local-auth.js';
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
    readonly realName?: string;
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
  deleteShiftType(groupId: string, shiftTypeId: string): Promise<void>;
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
  listGroupCatalog(): Promise<GroupCatalogEntry[]>;
  joinGroupAsGuest(groupId: string): Promise<GroupSummary>;
  leaveGroup(groupId: string): Promise<void>;
  updateGroupName(groupId: string, input: UpdateGroupNameRequest): Promise<GroupSummary>;
  listDissolvedGroups(): Promise<DissolvedGroup[]>;
  restoreGroup(groupId: string): Promise<void>;
  getGroupGuestCalendar(groupId: string, businessMonth: string): Promise<GuestCalendarReadModel>;
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
  readonly auth: AuthClient;
  readonly fetch?: typeof fetch;
  readonly isOnline?: () => boolean;
}

// Built from the contract list so a new error code reaches the client automatically.
const knownApiErrorCodes = new Set<string>(apiErrorCodes);

export function createApiClient(options: CreateApiClientOptions): ApiClient {
  const baseUrl = options.apiBaseUrl ?? import.meta.env.VITE_API_BASE_URL ?? '/api';
  const fetchImplementation = options.fetch ?? fetch;
  const isOnline = options.isOnline ?? isNavigatorOnline;

  function requestJson<ResponseBody>(
    auth: AuthClient,
    fetchImplementationOverride: typeof fetch,
    baseUrlOverride: string,
    path: string,
    init: { readonly body?: string; readonly method: 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT' },
    isResponseBody: (value: unknown) => value is ResponseBody,
  ): Promise<ResponseBody> {
    return requestWithOnline({
      auth,
      baseUrl: baseUrlOverride,
      fetchImplementation: fetchImplementationOverride,
      init,
      isOnline,
      parseResponse: (response) => parseJsonResponse(response, isResponseBody),
      path,
    });
  }

  function requestPublicJson<ResponseBody>(
    fetchImplementationOverride: typeof fetch,
    baseUrlOverride: string,
    path: string,
    init: { readonly body?: string; readonly method: 'GET' | 'POST' },
    isResponseBody: (value: unknown) => value is ResponseBody,
  ): Promise<ResponseBody> {
    return requestWithOnline({
      auth: undefined,
      baseUrl: baseUrlOverride,
      fetchImplementation: fetchImplementationOverride,
      init,
      isOnline,
      parseResponse: (response) => parseJsonResponse(response, isResponseBody),
      path,
    });
  }

  function requestText(
    auth: AuthClient,
    fetchImplementationOverride: typeof fetch,
    baseUrlOverride: string,
    path: string,
    init: { readonly method: 'GET' },
  ): Promise<string> {
    return requestWithOnline({
      auth,
      baseUrl: baseUrlOverride,
      fetchImplementation: fetchImplementationOverride,
      init,
      isOnline,
      parseResponse: parseTextResponse,
      path,
    });
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
        isResponseBodyFromSchema(scheduleExportJobSchema),
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
        isResponseBodyFromSchema(scheduleExportJobSchema),
      );
    },
    getMonthStatistics(groupId, businessMonth) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/statistics?businessMonth=${encodeURIComponent(businessMonth)}`,
        { method: 'GET' },
        isResponseBodyFromSchema(monthStatisticsSnapshotSchema),
      );
    },
    getYearStatistics(groupId, year) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/statistics/year?year=${encodeURIComponent(String(year))}`,
        { method: 'GET' },
        isResponseBodyFromSchema(yearStatisticsSchema),
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
        isResponseBodyFromSchema(statisticsRecalculateCheckResultSchema),
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
        isResponseBodyFromSchema(monthStatisticsSnapshotSchema),
      );
    },
    deletePushSubscription() {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        '/notifications/push-subscription',
        { method: 'DELETE' },
        isResponseBodyFromSchema(deletedResultSchema),
      );
    },
    getGroupNotificationSettings(groupId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/notification-settings`,
        { method: 'GET' },
        isResponseBodyFromSchema(groupNotificationSettingsSchema),
      );
    },
    getMyNotificationPreferences(groupId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/notification-preferences/mine`,
        { method: 'GET' },
        isResponseBodyFromSchema(memberNotificationPreferencesSchema),
      );
    },
    getPushConfiguration() {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        '/notifications/push-config',
        { method: 'GET' },
        isResponseBodyFromSchema(pushConfigurationSchema),
      );
    },
    getUnreadNotificationCount() {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        '/notifications/unread-count',
        { method: 'GET' },
        isResponseBodyFromSchema(unreadCountResultSchema),
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
        isResponseBodyFromSchema(notificationPageSchema),
      );
    },
    listGuestGroups() {
      return requestPublicJson(
        fetchImplementation,
        baseUrl,
        '/guest/groups',
        { method: 'GET' },
        isResponseBodyFromSchema(guestGroupSummaryListSchema),
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
        isResponseBodyFromSchema(readAllResultSchema),
      );
    },
    markNotificationRead(notificationId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/notifications/${encodeURIComponent(notificationId)}/read`,
        { method: 'POST' },
        isResponseBodyFromSchema(notificationRecordSchema),
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
        isResponseBodyFromSchema(savedResultSchema),
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
        isResponseBodyFromSchema(groupNotificationSettingsSchema),
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
        isResponseBodyFromSchema(memberNotificationPreferencesSchema),
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
        isResponseBodyFromSchema(dutyAdjustmentRequestSchema),
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
        isResponseBodyFromSchema(swapRequestSchema),
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
        isResponseBodyMatching<AppliedManualScheduleTemplateResult>(
          appliedManualScheduleTemplateResultSchema,
        ),
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
        isResponseBodyMatching<ApprovedLeaveRequestResult>(approvedLeaveRequestResultSchema),
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
        isResponseBodyFromSchema(dutyAdjustmentRequestSchema),
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
        isResponseBodyFromSchema(swapRequestSchema),
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
        isResponseBodyFromSchema(addRosterEntriesResponseSchema),
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
        isResponseBodyFromSchema(addRosterEntriesResponseSchema),
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
        isResponseBodyFromSchema(convertPendingRosterResponseSchema),
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
        isResponseBodyFromSchema(claimGroupResponseSchema),
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
        isResponseBodyFromSchema(swapRequestSchema),
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
        isResponseBodyFromSchema(dutyAdjustmentRequestSchema),
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
        isResponseBodyFromSchema(leaveRequestSchema),
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
        isResponseBodyFromSchema(dutyAdjustmentRequestSchema),
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
        isResponseBodyFromSchema(dutyAdjustmentRequestSchema),
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
        isResponseBodyFromSchema(swapRequestSchema),
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
        isResponseBodyFromSchema(swapRequestSchema),
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
        isResponseBodyFromSchema(manualScheduleTemplateSchema),
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
        isResponseBodyFromSchema(scheduleRoleSchema),
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
        isResponseBodyFromSchema(shiftTypeSchema),
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
        isResponseBodyFromSchema(groupSummarySchema),
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
        isResponseBodyFromSchema(userProfileSchema),
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
    deleteShiftType(groupId, shiftTypeId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/shift-types/${encodeURIComponent(shiftTypeId)}`,
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
        isResponseBodyFromSchema(calendarReadModelSchema),
      );
    },
    getGuestCalendar(groupCode, businessMonth) {
      return requestPublicJson(
        fetchImplementation,
        baseUrl,
        '/guest/calendar',
        {
          body: JSON.stringify({ businessMonth, groupCode }),
          method: 'POST',
        },
        isResponseBodyFromSchema(guestCalendarReadModelSchema),
      );
    },
    getGuestGroupCalendar(groupId, businessMonth) {
      return requestPublicJson(
        fetchImplementation,
        baseUrl,
        `/guest/groups/${encodeURIComponent(groupId)}/calendar?businessMonth=${encodeURIComponent(businessMonth)}`,
        { method: 'GET' },
        isResponseBodyFromSchema(guestCalendarReadModelSchema),
      );
    },
    getCurrentProfile() {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        '/users/me',
        { method: 'GET' },
        isResponseBodyFromSchema(userProfileSchema),
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
        isResponseBodyFromSchema(userProfileSchema),
      );
    },
    getHolidays(year) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/holidays?year=${encodeURIComponent(String(year))}`,
        { method: 'GET' },
        isResponseBodyFromSchema(holidayReadModelSchema),
      );
    },
    getGuestHolidays(year) {
      return requestPublicJson(
        fetchImplementation,
        baseUrl,
        `/guest/holidays?year=${encodeURIComponent(String(year))}`,
        { method: 'GET' },
        isResponseBodyFromSchema(holidayReadModelSchema),
      );
    },
    getEventDetail(groupId, eventId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/events/${encodeURIComponent(eventId)}`,
        { method: 'GET' },
        isResponseBodyFromSchema(scheduleEventDetailSchema),
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
        isResponseBodyFromSchema(scheduleEventPageSchema),
      );
    },
    getGroupDutyAdjustmentSettings(groupId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/duty-adjustments/settings`,
        { method: 'GET' },
        isResponseBodyFromSchema(groupDutyAdjustmentSettingsSchema),
      );
    },
    getGroupSwapSettings(groupId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/swaps/settings`,
        { method: 'GET' },
        isResponseBodyFromSchema(groupSwapSettingsSchema),
      );
    },
    getLeaveReflowStrategy(groupId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/leave-reflow-strategy`,
        { method: 'GET' },
        isResponseBodyFromSchema(groupLeaveReflowStrategySchema),
      );
    },
    getMySwapSettings(groupId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/swaps/my-settings`,
        { method: 'GET' },
        isResponseBodyFromSchema(memberSwapSettingsSchema),
      );
    },
    getMyDutyAdjustmentSettings(groupId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/duty-adjustments/my-settings`,
        { method: 'GET' },
        isResponseBodyFromSchema(memberSwapSettingsSchema),
      );
    },
    getSchedulePublishMode(groupId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/schedule-publish-mode`,
        { method: 'GET' },
        isResponseBodyFromSchema(groupSchedulePublishModeSchema),
      );
    },
    listScheduleDrafts(groupId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/schedule-periods`,
        { method: 'GET' },
        isResponseBodyMatching<ScheduleDraftSummary[]>(scheduleDraftSummaryListSchema),
      );
    },
    getScheduleDraftPreview(groupId, schedulePeriodId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/schedules/${encodeURIComponent(schedulePeriodId)}/preview`,
        { method: 'GET' },
        isResponseBodyMatching<ScheduleGenerationPreview>(scheduleGenerationPreviewSchema),
      );
    },
    getSchedulePeriodCalendar(groupId, schedulePeriodId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/calendar/periods/${encodeURIComponent(schedulePeriodId)}`,
        { method: 'GET' },
        isResponseBodyFromSchema(calendarReadModelSchema),
      );
    },
    listPastSchedulePeriods(groupId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/past-schedules`,
        { method: 'GET' },
        isResponseBodyFromSchema(pastSchedulePeriodListSchema),
      );
    },
    listPastScheduleAssignments(groupId, schedulePeriodId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/past-schedules/${encodeURIComponent(schedulePeriodId)}/assignments`,
        { method: 'GET' },
        isResponseBodyFromSchema(pastScheduleAssignmentListSchema),
      );
    },
    listPastScheduleBackfillRecords(groupId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/past-schedules/backfill-records`,
        { method: 'GET' },
        isResponseBodyFromSchema(pastScheduleBackfillRecordListSchema),
      );
    },
    updatePastScheduleAssignment(groupId, schedulePeriodId, assignmentId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/past-schedules/${encodeURIComponent(schedulePeriodId)}/assignments/${encodeURIComponent(assignmentId)}`,
        { body: JSON.stringify(input), method: 'PUT' },
        isResponseBodyFromSchema(updatePastScheduleAssignmentResultSchema),
      );
    },
    createPastScheduleAssignment(groupId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/past-schedules/assignments`,
        { body: JSON.stringify(input), method: 'POST' },
        isResponseBodyFromSchema(updatePastScheduleAssignmentResultSchema),
      );
    },
    previewScheduleChange(groupId, schedulePeriodId, action) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/schedules/${encodeURIComponent(schedulePeriodId)}/change-impact?action=${encodeURIComponent(action)}`,
        { method: 'GET' },
        isResponseBodyFromSchema(scheduleChangeImpactPreviewSchema),
      );
    },
    listSchedulePeriodHistory(groupId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/schedule-periods/history`,
        { method: 'GET' },
        isResponseBodyFromSchema(schedulePeriodHistoryItemListSchema),
      );
    },
    publishSchedulePeriod(groupId, schedulePeriodId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/schedules/${encodeURIComponent(schedulePeriodId)}/publish`,
        { method: 'POST', body: JSON.stringify(input) },
        isResponseBodyMatching<PublishSchedulePeriodResult>(publishSchedulePeriodResultSchema),
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
        isResponseBodyMatching<PublishSchedulePeriodBatchResult>(
          publishSchedulePeriodBatchResultSchema,
        ),
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
        isResponseBodyMatching<SchedulePeriodMutationResult>(schedulePeriodMutationResultSchema),
      );
    },
    getSchedulingConfig(groupId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/scheduling-config`,
        { method: 'GET' },
        isSchedulingConfigResponse,
      );
    },
    listManualScheduleTemplates(groupId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/manual-schedule-templates`,
        { method: 'GET' },
        isResponseBodyFromSchema(manualScheduleTemplateListSchema),
      );
    },
    listGroupContacts(groupId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/contacts`,
        { method: 'GET' },
        isResponseBodyFromSchema(groupMemberContactListSchema),
      );
    },
    listGroupMembers(groupId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/members`,
        { method: 'GET' },
        isResponseBodyFromSchema(groupMemberListSchema),
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
        isResponseBodyFromSchema(membershipClaimLookupResponseSchema),
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
        isResponseBodyFromSchema(createMembershipClaimResponseSchema),
      );
    },
    listMembershipClaimRequests(groupId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/claim-requests`,
        { method: 'GET' },
        isResponseBodyFromSchema(membershipClaimRequestListSchema),
      );
    },
    approveMembershipClaimRequest(groupId, claimRequestId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/claim-requests/${encodeURIComponent(claimRequestId)}/approve`,
        { method: 'POST' },
        isResponseBodyFromSchema(membershipClaimRequestSchema),
      );
    },
    rejectMembershipClaimRequest(groupId, claimRequestId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/claim-requests/${encodeURIComponent(claimRequestId)}/reject`,
        { method: 'POST' },
        isResponseBodyFromSchema(membershipClaimRequestSchema),
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
        isResponseBodyFromSchema(groupSummaryListSchema),
      );
    },
    listGroupCatalog() {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        '/groups/catalog',
        { method: 'GET' },
        isResponseBodyFromSchema(groupCatalogListSchema),
      );
    },
    joinGroupAsGuest(groupId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/join-guest`,
        { method: 'POST' },
        isResponseBodyFromSchema(groupSummarySchema),
      );
    },
    leaveGroup(groupId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/leave`,
        { method: 'POST' },
        isUndefined,
      );
    },
    updateGroupName(groupId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/name`,
        {
          body: JSON.stringify(input),
          method: 'PUT',
        },
        isResponseBodyFromSchema(groupSummarySchema),
      );
    },
    listDissolvedGroups() {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        '/groups/dissolved',
        { method: 'GET' },
        isResponseBodyFromSchema(dissolvedGroupListSchema),
      );
    },
    restoreGroup(groupId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/restore`,
        { method: 'POST' },
        isUndefined,
      );
    },
    getGroupGuestCalendar(groupId, businessMonth) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/guest-calendar?businessMonth=${encodeURIComponent(businessMonth)}`,
        { method: 'GET' },
        isResponseBodyFromSchema(guestCalendarReadModelSchema),
      );
    },
    listDutyAdjustmentApprovals(groupId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/duty-adjustments/approvals`,
        { method: 'GET' },
        isResponseBodyFromSchema(dutyAdjustmentRequestListSchema),
      );
    },
    listLeaveRequestApprovals(groupId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/leave-requests/approvals`,
        { method: 'GET' },
        isResponseBodyFromSchema(leaveRequestListSchema),
      );
    },
    listMyDutyAdjustments(groupId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/duty-adjustments`,
        { method: 'GET' },
        isResponseBodyFromSchema(dutyAdjustmentRequestListSchema),
      );
    },
    listMyLeaveRequests(groupId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/leave-requests`,
        { method: 'GET' },
        isResponseBodyFromSchema(leaveRequestListSchema),
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
        isResponseBodyFromSchema(leaveAffectedShiftListSchema),
      );
    },
    listMySwapRequests(groupId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/swaps`,
        { method: 'GET' },
        isResponseBodyFromSchema(swapRequestListSchema),
      );
    },
    listSwapApprovals(groupId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/swaps/approvals`,
        { method: 'GET' },
        isResponseBodyFromSchema(swapRequestListSchema),
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
        isResponseBodyMatching<ManualApplyPreview>(manualApplyPreviewSchema),
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
        isResponseBodyFromSchema(dutyAdjustmentPreviewSchema),
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
        isResponseBodyFromSchema(swapPreviewSchema),
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
        isResponseBodyMatching<LeaveReflowPreview>(leaveReflowPreviewSchema),
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
        isResponseBodyFromSchema(groupSummarySchema),
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
        isResponseBodyFromSchema(rejectedLeaveRequestResultSchema),
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
        isResponseBodyFromSchema(leaveRequestMutationResultSchema),
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
        isResponseBodyFromSchema(leaveRequestMutationResultSchema),
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
        isResponseBodyFromSchema(swapRequestSchema),
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
        isResponseBodyFromSchema(swapRequestSchema),
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
        isResponseBodyFromSchema(dutyAdjustmentRequestSchema),
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
        isResponseBodyFromSchema(dutyAdjustmentRequestSchema),
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
        isResponseBodyFromSchema(scheduleRoleSchema),
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
        isResponseBodyFromSchema(scheduleRoleSchema),
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
        isResponseBodyFromSchema(groupSummarySchema),
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
        isResponseBodyFromSchema(manualScheduleTemplateSchema),
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
        isResponseBodyFromSchema(groupMemberContactSchema),
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
        isResponseBodyFromSchema(groupMemberSchema),
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
        isResponseBodyFromSchema(groupDutyAdjustmentSettingsSchema),
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
        isResponseBodyFromSchema(groupSwapSettingsSchema),
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
        isResponseBodyFromSchema(groupLeaveReflowStrategySchema),
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
        isResponseBodyFromSchema(memberSwapSettingsSchema),
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
        isResponseBodyFromSchema(scheduleRoleSchema),
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
        isResponseBodyFromSchema(shiftTypeSchema),
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

async function requestWithOnline<ResponseBody>(options: {
  readonly auth: AuthClient | undefined;
  readonly baseUrl: string;
  readonly fetchImplementation: typeof fetch;
  readonly init: {
    readonly body?: string;
    readonly method: 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT';
  };
  readonly isOnline: () => boolean;
  readonly parseResponse: (response: Response) => Promise<ResponseBody>;
  readonly path: string;
}): Promise<ResponseBody> {
  const offlineError = getOfflineSubmitError(options.isOnline(), options.init.method);
  if (offlineError !== undefined) {
    throw new ApiClientError({ code: 'OFFLINE', message: offlineError });
  }

  const session =
    options.auth === undefined
      ? undefined
      : getAuthenticatedSession(await options.auth.getSession());
  if (session === undefined && options.auth !== undefined) {
    throw new ApiClientError({
      code: 'AUTHENTICATION_REQUIRED',
      message: '登录状态已失效，请重新登录。',
      status: 401,
    });
  }

  let response: Response;
  try {
    response = await options.fetchImplementation.call(
      globalThis,
      joinUrl(options.baseUrl, options.path),
      {
        headers: {
          ...(session === undefined ? {} : { Authorization: `Bearer ${session.access_token}` }),
          ...(options.init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        method: options.init.method,
        ...(options.init.body === undefined ? {} : { body: options.init.body }),
      },
    );
  } catch {
    throw new ApiClientError({
      code: 'NETWORK_ERROR',
      message: '无法连接到服务，请检查网络后重试。',
    });
  }

  return options.parseResponse(response);
}

async function parseJsonResponse<ResponseBody>(
  response: Response,
  isResponseBody: (value: unknown) => value is ResponseBody,
): Promise<ResponseBody> {
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

async function parseTextResponse(response: Response): Promise<string> {
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

interface JsonSchema<ResponseBody> {
  readonly safeParse: (
    value: unknown,
  ) => { readonly data: ResponseBody; readonly success: true } | { readonly success: false };
}

function isResponseBodyFromSchema<ResponseBody>(
  schema: JsonSchema<ResponseBody>,
): (value: unknown) => value is ResponseBody {
  return (value: unknown): value is ResponseBody => schema.safeParse(value).success;
}

function isSchedulingConfigResponse(value: unknown): value is SchedulingConfig {
  // schema 允许缺省 rulesVersion（旧守卫不校验该字段）；导出类型保持必填供模板应用使用。
  return schedulingConfigSchema.safeParse(value).success;
}

function isResponseBodyMatching<ResponseBody>(
  schema: JsonSchema<unknown>,
): (value: unknown) => value is ResponseBody {
  // 用于 schema 推断类型比导出契约类型更宽松的读模型（旧守卫忽略的必填字段）。
  return (value: unknown): value is ResponseBody => schema.safeParse(value).success;
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
    knownApiErrorCodes.has(error.code) &&
    'message' in error &&
    typeof error.message === 'string' &&
    'requestId' in error &&
    typeof error.requestId === 'string'
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
