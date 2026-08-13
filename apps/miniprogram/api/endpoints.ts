import type {
  AcceptInviteResponse,
  AddRosterEntriesRequest,
  AddRosterEntriesResponse,
  AppliedManualScheduleTemplateResult,
  ApplyManualScheduleTemplateRequest,
  ApproveLeaveRequestInput,
  ApprovedLeaveRequestResult,
  CalendarReadModel,
  CreatePastScheduleAssignmentInput,
  CreateScheduleExportInput,
  ConvertPendingRosterRequest,
  ConvertPendingRosterResponse,
  CreateGroupRequest,
  CreateInviteLinkRequest,
  CreateInviteLinkResponse,
  CreateDutyAdjustmentRequestInput,
  CreateDirectDutyAdjustmentInput,
  CreateDirectSwapInput,
  CreateLeaveRequestInput,
  CreateManualScheduleTemplateRequest,
  CreateScheduleRoleRequest,
  CreateSwapRequestInput,
  CreateShiftTypeRequest,
  DissolvedGroup,
  DutyAdjustmentPreview,
  DutyAdjustmentRequest,
  DutyAdjustmentMutationInput,
  DutyAdjustmentPairInput,
  GroupCatalogEntry,
  GroupMemberContact,
  GroupDutyAdjustmentSettings,
  GroupLeaveReflowStrategy,
  GroupQrResponse,
  GuestCalendarReadModel,
  GroupSchedulePublishMode,
  GroupMember,
  GroupNotificationSettings,
  GroupSummary,
  GroupSwapSettings,
  HolidayCalendarVersion,
  HolidayCoverage,
  HolidayImportPreview,
  HolidayImportResult,
  HolidayReadModel,
  LeaveAffectedShift,
  LeaveAffectedShiftsInput,
  LeaveReflowPreview,
  LeaveRequest,
  LeaveRequestMutationResult,
  LeaveRequestMutationInput,
  MemberSwapSettings,
  ManualApplyPreview,
  ManualScheduleTemplate,
  MemberNotificationPreferences,
  MonthStatisticsSnapshot,
  NotificationPage,
  NotificationRecord,
  PastScheduleAssignment,
  PastScheduleBackfillRecord,
  PastSchedulePeriod,
  PlatformBackupList,
  PlatformJobStatusPage,
  PreviewManualTemplateApplyRequest,
  PublishSchedulePeriodBatchRequest,
  PublishSchedulePeriodBatchResult,
  PublishSchedulePeriodRequest,
  PublishSchedulePeriodResult,
  RegenerateGroupCodeRequest,
  ReplaceScheduleRoleMembersRequest,
  ResolveInviteResponse,
  RevokeDutyAdjustmentInput,
  RevokeSwapRequestInput,
  PreviewLeaveRequestInput,
  RejectedLeaveRequestResult,
  RejectLeaveRequestInput,
  ScheduleExportJob,
  ScheduleGenerationPreview,
  ScheduleChangeImpactPreview,
  ScheduleDraftSummary,
  SchedulePeriodHistoryItem,
  ScheduleEventQuery,
  SchedulePeriodMutationRequest,
  SchedulePeriodMutationResult,
  ScheduleRole,
  SchedulingConfig,
  ShiftType,
  StatisticsRecalculateCheckResult,
  ScheduleEventPage,
  SwapPairInput,
  SwapPreview,
  SwapRequest,
  SwapRequestMutationInput,
  TransferGroupOwnershipRequest,
  UpdateGroupNotificationSettingsInput,
  UpdateGroupMemberRoleRequest,
  UpdateGroupNameRequest,
  UpdateGroupSchedulePublishModeRequest,
  UpdateGroupMemberContactRequest,
  UpdateGroupDutyAdjustmentSettingsInput,
  UpdateGroupLeaveReflowStrategyInput,
  UpdateGroupSwapSettingsInput,
  UpdateManualScheduleTemplateRequest,
  UpdateMemberNotificationPreferencesInput,
  UpdateMemberSwapSettingsInput,
  UpdateUserProfileRequest,
  UpdatePastScheduleAssignmentInput,
  UpdatePastScheduleAssignmentResult,
  UpdatePlatformUserStatusInput,
  UpdateShiftTypeRequest,
  UserProfile,
  VisitorKeyChangedResponse,
  VisitorAccessLogPage,
  VisitorResolveResponse,
  WechatLoginResponse,
  YearStatistics,
} from '@schedule/contracts';
import { buildScheduleEventListEndpoint } from '@schedule/client-core';

import { request, requestEndpoint } from './client.js';

export function wechatLogin(code: string): Promise<WechatLoginResponse> {
  return request<WechatLoginResponse>('/auth/wechat/login', {
    auth: false,
    data: { code },
    method: 'POST',
  });
}

export function getCurrentProfile(): Promise<UserProfile> {
  return request<UserProfile>('/users/me');
}

export function createUserProfile(realName: string): Promise<UserProfile> {
  return request<UserProfile>('/users', {
    data: { realName },
    method: 'POST',
  });
}

export function resolveGuestGroup(visitorKey: string): Promise<VisitorResolveResponse> {
  return request<VisitorResolveResponse>('/guest/groups/resolve', {
    auth: false,
    data: { visitorKey },
    method: 'POST',
  });
}

export function getGuestCalendar(
  groupId: string,
  visitorKey: string,
  businessMonth: string,
): Promise<GuestCalendarReadModel> {
  return request<GuestCalendarReadModel>(`/guest/groups/${groupId}/calendar`, {
    auth: false,
    data: { businessMonth, visitorKey },
  });
}

export function resolveInvite(token: string): Promise<ResolveInviteResponse> {
  return request<ResolveInviteResponse>('/invites/resolve', {
    data: { token },
    method: 'POST',
  });
}

export function acceptInvite(
  token: string,
  confirmRealName: string,
): Promise<AcceptInviteResponse> {
  return request<AcceptInviteResponse>('/invites/accept', {
    data: { confirmRealName, token },
    method: 'POST',
  });
}

export function getGroupQr(groupId: string): Promise<GroupQrResponse> {
  return request<GroupQrResponse>(`/groups/${groupId}/group-qr`);
}

export function listGroups(): Promise<GroupSummary[]> {
  return request<GroupSummary[]>('/groups');
}

export function getCalendar(groupId: string, businessMonth: string): Promise<CalendarReadModel> {
  return request<CalendarReadModel>(`/groups/${groupId}/calendar`, {
    data: { businessMonth },
  });
}

export function getLoggedInGuestCalendar(
  groupId: string,
  businessMonth: string,
): Promise<GuestCalendarReadModel> {
  return request<GuestCalendarReadModel>(`/groups/${groupId}/guest-calendar`, {
    data: { businessMonth },
  });
}

export function listGroupMembers(groupId: string): Promise<GroupMember[]> {
  return request<GroupMember[]>(`/groups/${groupId}/members`);
}

export function listGroupContacts(groupId: string): Promise<GroupMemberContact[]> {
  return request<GroupMemberContact[]>(`/groups/${groupId}/contacts`);
}

export function createLeaveRequest(
  groupId: string,
  input: CreateLeaveRequestInput,
): Promise<LeaveRequest> {
  return request<LeaveRequest>(`/groups/${groupId}/leave-requests`, {
    data: input,
    method: 'POST',
  });
}

export function listLeaveRequests(groupId: string): Promise<LeaveRequest[]> {
  return request<LeaveRequest[]>(`/groups/${groupId}/leave-requests`);
}

export function getLeaveAffectedShifts(
  groupId: string,
  input: LeaveAffectedShiftsInput,
): Promise<LeaveAffectedShift[]> {
  return request<LeaveAffectedShift[]>(`/groups/${groupId}/leave-requests/affected-shifts`, {
    data: input,
    method: 'POST',
  });
}

export function cancelLeaveRequest(
  groupId: string,
  leaveRequestId: string,
  input: LeaveRequestMutationInput,
): Promise<LeaveRequestMutationResult> {
  return request<LeaveRequestMutationResult>(
    `/groups/${groupId}/leave-requests/${leaveRequestId}/cancel`,
    {
      data: input,
      method: 'POST',
    },
  );
}

export function revokeLeaveRequest(
  groupId: string,
  leaveRequestId: string,
  input: LeaveRequestMutationInput,
): Promise<LeaveRequestMutationResult> {
  return request<LeaveRequestMutationResult>(
    `/groups/${groupId}/leave-requests/${leaveRequestId}/revoke`,
    {
      data: input,
      method: 'POST',
    },
  );
}

export function previewSwap(groupId: string, input: SwapPairInput): Promise<SwapPreview> {
  return request<SwapPreview>(`/groups/${groupId}/swaps/preview`, {
    data: input,
    method: 'POST',
  });
}

export function createSwapRequest(
  groupId: string,
  input: CreateSwapRequestInput,
): Promise<SwapRequest> {
  return request<SwapRequest>(`/groups/${groupId}/swaps`, {
    data: input,
    method: 'POST',
  });
}

export function createDirectSwapRequest(
  groupId: string,
  input: CreateDirectSwapInput,
): Promise<SwapRequest> {
  return request<SwapRequest>(`/groups/${groupId}/swaps/direct`, {
    data: input,
    method: 'POST',
  });
}

export function listSwapRequests(groupId: string): Promise<SwapRequest[]> {
  return request<SwapRequest[]>(`/groups/${groupId}/swaps`);
}

export function acceptSwapRequest(
  groupId: string,
  swapRequestId: string,
  input: SwapRequestMutationInput,
): Promise<SwapRequest> {
  return request<SwapRequest>(`/groups/${groupId}/swaps/${swapRequestId}/accept`, {
    data: input,
    method: 'POST',
  });
}

export function cancelSwapRequest(
  groupId: string,
  swapRequestId: string,
  input: SwapRequestMutationInput,
): Promise<SwapRequest> {
  return request<SwapRequest>(`/groups/${groupId}/swaps/${swapRequestId}/cancel`, {
    data: input,
    method: 'POST',
  });
}

export function revokeSwapRequest(
  groupId: string,
  swapRequestId: string,
  input: RevokeSwapRequestInput,
): Promise<SwapRequest> {
  return request<SwapRequest>(`/groups/${groupId}/swaps/${swapRequestId}/revoke`, {
    data: input,
    method: 'POST',
  });
}

export function previewDutyAdjustment(
  groupId: string,
  input: DutyAdjustmentPairInput,
): Promise<DutyAdjustmentPreview> {
  return request<DutyAdjustmentPreview>(`/groups/${groupId}/duty-adjustments/preview`, {
    data: input,
    method: 'POST',
  });
}

export function createDutyAdjustmentRequest(
  groupId: string,
  input: CreateDutyAdjustmentRequestInput,
): Promise<DutyAdjustmentRequest> {
  return request<DutyAdjustmentRequest>(`/groups/${groupId}/duty-adjustments`, {
    data: input,
    method: 'POST',
  });
}

export function createDirectDutyAdjustment(
  groupId: string,
  input: CreateDirectDutyAdjustmentInput,
): Promise<DutyAdjustmentRequest> {
  return request<DutyAdjustmentRequest>(`/groups/${groupId}/duty-adjustments/direct`, {
    data: input,
    method: 'POST',
  });
}

export function listDutyAdjustmentRequests(groupId: string): Promise<DutyAdjustmentRequest[]> {
  return request<DutyAdjustmentRequest[]>(`/groups/${groupId}/duty-adjustments`);
}

export function acceptDutyAdjustment(
  groupId: string,
  dutyAdjustmentId: string,
  input: DutyAdjustmentMutationInput,
): Promise<DutyAdjustmentRequest> {
  return request<DutyAdjustmentRequest>(
    `/groups/${groupId}/duty-adjustments/${dutyAdjustmentId}/accept`,
    {
      data: input,
      method: 'POST',
    },
  );
}

export function cancelDutyAdjustment(
  groupId: string,
  dutyAdjustmentId: string,
  input: DutyAdjustmentMutationInput,
): Promise<DutyAdjustmentRequest> {
  return request<DutyAdjustmentRequest>(
    `/groups/${groupId}/duty-adjustments/${dutyAdjustmentId}/cancel`,
    {
      data: input,
      method: 'POST',
    },
  );
}

export function revokeDutyAdjustment(
  groupId: string,
  dutyAdjustmentId: string,
  input: RevokeDutyAdjustmentInput,
): Promise<DutyAdjustmentRequest> {
  return request<DutyAdjustmentRequest>(
    `/groups/${groupId}/duty-adjustments/${dutyAdjustmentId}/revoke`,
    {
      data: input,
      method: 'POST',
    },
  );
}

export function listLeaveRequestApprovals(groupId: string): Promise<LeaveRequest[]> {
  return request<LeaveRequest[]>(`/groups/${groupId}/leave-requests/approvals`);
}

export function previewLeaveRequestApproval(
  groupId: string,
  leaveRequestId: string,
  input: PreviewLeaveRequestInput,
): Promise<LeaveReflowPreview> {
  return request<LeaveReflowPreview>(
    `/groups/${groupId}/leave-requests/${leaveRequestId}/preview`,
    {
      data: input,
      method: 'POST',
    },
  );
}

export function approveLeaveRequest(
  groupId: string,
  leaveRequestId: string,
  input: ApproveLeaveRequestInput,
): Promise<ApprovedLeaveRequestResult> {
  return request<ApprovedLeaveRequestResult>(
    `/groups/${groupId}/leave-requests/${leaveRequestId}/approve`,
    {
      data: input,
      method: 'POST',
    },
  );
}

export function rejectLeaveRequest(
  groupId: string,
  leaveRequestId: string,
  input: RejectLeaveRequestInput,
): Promise<RejectedLeaveRequestResult> {
  return request<RejectedLeaveRequestResult>(
    `/groups/${groupId}/leave-requests/${leaveRequestId}/reject`,
    {
      data: input,
      method: 'POST',
    },
  );
}

export function getGroupSwapSettings(groupId: string): Promise<GroupSwapSettings> {
  return request<GroupSwapSettings>(`/groups/${groupId}/swaps/settings`);
}

export function updateGroupSwapSettings(
  groupId: string,
  input: UpdateGroupSwapSettingsInput,
): Promise<GroupSwapSettings> {
  return request<GroupSwapSettings>(`/groups/${groupId}/swaps/settings`, {
    data: input,
    method: 'PUT',
  });
}

export function getGroupDutyAdjustmentSettings(
  groupId: string,
): Promise<GroupDutyAdjustmentSettings> {
  return request<GroupDutyAdjustmentSettings>(`/groups/${groupId}/duty-adjustments/settings`);
}

export function updateGroupDutyAdjustmentSettings(
  groupId: string,
  input: UpdateGroupDutyAdjustmentSettingsInput,
): Promise<GroupDutyAdjustmentSettings> {
  return request<GroupDutyAdjustmentSettings>(`/groups/${groupId}/duty-adjustments/settings`, {
    data: input,
    method: 'PUT',
  });
}

export function getMySwapSettings(groupId: string): Promise<MemberSwapSettings> {
  return request<MemberSwapSettings>(`/groups/${groupId}/swaps/my-settings`);
}

export function getMyDutyAdjustmentSettings(groupId: string): Promise<MemberSwapSettings> {
  return request<MemberSwapSettings>(`/groups/${groupId}/duty-adjustments/my-settings`);
}

export function updateMySwapSettings(
  groupId: string,
  input: UpdateMemberSwapSettingsInput,
): Promise<MemberSwapSettings> {
  return request<MemberSwapSettings>(`/groups/${groupId}/swaps/my-settings`, {
    data: input,
    method: 'PUT',
  });
}

export function getLeaveReflowStrategy(groupId: string): Promise<GroupLeaveReflowStrategy> {
  return request<GroupLeaveReflowStrategy>(`/groups/${groupId}/leave-reflow-strategy`);
}

export function updateLeaveReflowStrategy(
  groupId: string,
  input: UpdateGroupLeaveReflowStrategyInput,
): Promise<GroupLeaveReflowStrategy> {
  return request<GroupLeaveReflowStrategy>(`/groups/${groupId}/leave-reflow-strategy`, {
    data: input,
    method: 'PUT',
  });
}

export function listSwapApprovals(groupId: string): Promise<SwapRequest[]> {
  return request<SwapRequest[]>(`/groups/${groupId}/swaps/approvals`);
}

export function approveSwapRequest(
  groupId: string,
  swapRequestId: string,
  input: SwapRequestMutationInput,
): Promise<SwapRequest> {
  return request<SwapRequest>(`/groups/${groupId}/swaps/${swapRequestId}/approve`, {
    data: input,
    method: 'POST',
  });
}

export function rejectSwapRequest(
  groupId: string,
  swapRequestId: string,
  input: SwapRequestMutationInput,
): Promise<SwapRequest> {
  return request<SwapRequest>(`/groups/${groupId}/swaps/${swapRequestId}/reject`, {
    data: input,
    method: 'POST',
  });
}

export function listDutyAdjustmentApprovals(groupId: string): Promise<DutyAdjustmentRequest[]> {
  return request<DutyAdjustmentRequest[]>(`/groups/${groupId}/duty-adjustments/approvals`);
}

export function approveDutyAdjustment(
  groupId: string,
  dutyAdjustmentId: string,
  input: DutyAdjustmentMutationInput,
): Promise<DutyAdjustmentRequest> {
  return request<DutyAdjustmentRequest>(
    `/groups/${groupId}/duty-adjustments/${dutyAdjustmentId}/approve`,
    {
      data: input,
      method: 'POST',
    },
  );
}

export function rejectDutyAdjustment(
  groupId: string,
  dutyAdjustmentId: string,
  input: DutyAdjustmentMutationInput,
): Promise<DutyAdjustmentRequest> {
  return request<DutyAdjustmentRequest>(
    `/groups/${groupId}/duty-adjustments/${dutyAdjustmentId}/reject`,
    {
      data: input,
      method: 'POST',
    },
  );
}

export function listEvents(
  groupId: string,
  query: Omit<ScheduleEventQuery, 'groupId'>,
): Promise<ScheduleEventPage> {
  return requestEndpoint(buildScheduleEventListEndpoint(groupId, query));
}

export function listVisitorAccessLogs(
  groupId: string,
  cursor?: string,
  pageSize = 50,
): Promise<VisitorAccessLogPage> {
  return request<VisitorAccessLogPage>(`/groups/${groupId}/visitor-access-logs`, {
    data: {
      ...(cursor === undefined ? {} : { cursor }),
      pageSize,
    },
  });
}

export function listNotifications(cursor?: string, pageSize = 30): Promise<NotificationPage> {
  return request<NotificationPage>('/notifications', {
    data: {
      ...(cursor === undefined ? {} : { cursor }),
      pageSize,
    },
  });
}

export function getUnreadCount(): Promise<{ readonly unreadCount: number }> {
  return request<{ readonly unreadCount: number }>('/notifications/unread-count');
}

export function markNotificationRead(notificationId: string): Promise<NotificationRecord> {
  return request<NotificationRecord>(`/notifications/${notificationId}/read`, {
    method: 'POST',
  });
}

export function markAllNotificationsRead(): Promise<{ readonly count: number }> {
  return request<{ readonly count: number }>('/notifications/read-all', {
    method: 'POST',
  });
}

export function getMyNotificationPreferences(
  groupId: string,
): Promise<MemberNotificationPreferences> {
  return request<MemberNotificationPreferences>(`/groups/${groupId}/notification-preferences/mine`);
}

export function updateMyNotificationPreferences(
  groupId: string,
  input: UpdateMemberNotificationPreferencesInput,
): Promise<MemberNotificationPreferences> {
  return request<MemberNotificationPreferences>(
    `/groups/${groupId}/notification-preferences/mine`,
    {
      data: input,
      method: 'PUT',
    },
  );
}

export function getGroupNotificationSettings(groupId: string): Promise<GroupNotificationSettings> {
  return request<GroupNotificationSettings>(`/groups/${groupId}/notification-settings`);
}

export function updateGroupNotificationSettings(
  groupId: string,
  input: UpdateGroupNotificationSettingsInput,
): Promise<GroupNotificationSettings> {
  return request<GroupNotificationSettings>(`/groups/${groupId}/notification-settings`, {
    data: input,
    method: 'PUT',
  });
}

export function createGroup(input: CreateGroupRequest): Promise<GroupSummary> {
  return request<GroupSummary>('/groups', { data: input, method: 'POST' });
}

export function listGroupCatalog(): Promise<GroupCatalogEntry[]> {
  return request<GroupCatalogEntry[]>('/groups/catalog');
}

export function joinGroupAsGuest(groupId: string): Promise<GroupSummary> {
  return request<GroupSummary>(`/groups/${encodeURIComponent(groupId)}/join-guest`, {
    method: 'POST',
  });
}

export function leaveGroup(groupId: string): Promise<void> {
  return request<void>(`/groups/${encodeURIComponent(groupId)}/leave`, { method: 'POST' });
}

export function updateGroupName(
  groupId: string,
  input: UpdateGroupNameRequest,
): Promise<GroupSummary> {
  return request<GroupSummary>(`/groups/${encodeURIComponent(groupId)}/name`, {
    data: input,
    method: 'PUT',
  });
}

export function regenerateGroupCode(
  groupId: string,
  input: RegenerateGroupCodeRequest = {},
): Promise<GroupSummary> {
  return request<GroupSummary>(`/groups/${encodeURIComponent(groupId)}/group-code`, {
    data: input,
    method: 'PUT',
  });
}

export function regenerateVisitorKey(groupId: string): Promise<VisitorKeyChangedResponse> {
  return request<VisitorKeyChangedResponse>(`/groups/${encodeURIComponent(groupId)}/visitor-key`, {
    method: 'PUT',
  });
}

export function listDissolvedGroups(): Promise<DissolvedGroup[]> {
  return request<DissolvedGroup[]>('/groups/dissolved');
}

export function restoreGroup(groupId: string): Promise<void> {
  return request<void>(`/groups/${encodeURIComponent(groupId)}/restore`, { method: 'POST' });
}

export function deleteGroup(groupId: string): Promise<void> {
  return request<void>(`/groups/${encodeURIComponent(groupId)}`, { method: 'DELETE' });
}

export function transferGroupOwnership(
  groupId: string,
  input: TransferGroupOwnershipRequest,
): Promise<GroupSummary> {
  return request<GroupSummary>(`/groups/${encodeURIComponent(groupId)}/owner-transfer`, {
    data: input,
    method: 'POST',
  });
}

export function addRosterEntries(
  groupId: string,
  input: AddRosterEntriesRequest,
): Promise<AddRosterEntriesResponse> {
  return request<AddRosterEntriesResponse>(
    `/groups/${encodeURIComponent(groupId)}/roster-entries`,
    { data: input, method: 'POST' },
  );
}

export function convertRosterEntries(
  groupId: string,
  input: ConvertPendingRosterRequest,
): Promise<ConvertPendingRosterResponse> {
  return request<ConvertPendingRosterResponse>(
    `/groups/${encodeURIComponent(groupId)}/roster-entries/convert`,
    { data: input, method: 'POST' },
  );
}

export function updateGroupMemberRole(
  groupId: string,
  membershipId: string,
  input: UpdateGroupMemberRoleRequest,
): Promise<GroupMember> {
  return request<GroupMember>(
    `/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(membershipId)}/role`,
    { data: input, method: 'PUT' },
  );
}

export function deleteGroupMember(groupId: string, membershipId: string): Promise<void> {
  return request<void>(
    `/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(membershipId)}`,
    { method: 'DELETE' },
  );
}

export function createInviteLink(
  groupId: string,
  input: CreateInviteLinkRequest,
): Promise<CreateInviteLinkResponse> {
  return request<CreateInviteLinkResponse>(`/groups/${encodeURIComponent(groupId)}/invite-links`, {
    data: input,
    method: 'POST',
  });
}

export function revokeInviteLink(groupId: string, token: string): Promise<void> {
  return request<void>(
    `/groups/${encodeURIComponent(groupId)}/invite-links/${encodeURIComponent(token)}/revoke`,
    { method: 'POST' },
  );
}

export function getSchedulingConfig(groupId: string): Promise<SchedulingConfig> {
  return request<SchedulingConfig>(`/groups/${encodeURIComponent(groupId)}/scheduling-config`);
}

export function createScheduleRole(
  groupId: string,
  input: CreateScheduleRoleRequest,
): Promise<ScheduleRole> {
  return request<ScheduleRole>(`/groups/${encodeURIComponent(groupId)}/schedule-roles`, {
    data: input,
    method: 'POST',
  });
}

export function deleteScheduleRole(groupId: string, roleId: string): Promise<void> {
  return request<void>(
    `/groups/${encodeURIComponent(groupId)}/schedule-roles/${encodeURIComponent(roleId)}`,
    { method: 'DELETE' },
  );
}

export function replaceScheduleRoleMembers(
  groupId: string,
  roleId: string,
  input: ReplaceScheduleRoleMembersRequest,
): Promise<ScheduleRole> {
  return request<ScheduleRole>(
    `/groups/${encodeURIComponent(groupId)}/schedule-roles/${encodeURIComponent(roleId)}/members`,
    { data: input, method: 'PUT' },
  );
}

export function createShiftType(
  groupId: string,
  input: CreateShiftTypeRequest,
): Promise<ShiftType> {
  return request<ShiftType>(`/groups/${encodeURIComponent(groupId)}/shift-types`, {
    data: input,
    method: 'POST',
  });
}

export function updateShiftType(
  groupId: string,
  shiftTypeId: string,
  input: UpdateShiftTypeRequest,
): Promise<ShiftType> {
  return request<ShiftType>(
    `/groups/${encodeURIComponent(groupId)}/shift-types/${encodeURIComponent(shiftTypeId)}`,
    { data: input, method: 'PUT' },
  );
}

export function deleteShiftType(groupId: string, shiftTypeId: string): Promise<void> {
  return request<void>(
    `/groups/${encodeURIComponent(groupId)}/shift-types/${encodeURIComponent(shiftTypeId)}`,
    { method: 'DELETE' },
  );
}

export function getSchedulePublishMode(groupId: string): Promise<GroupSchedulePublishMode> {
  return request<GroupSchedulePublishMode>(
    `/groups/${encodeURIComponent(groupId)}/schedule-publish-mode`,
  );
}

export function updateSchedulePublishMode(
  groupId: string,
  input: UpdateGroupSchedulePublishModeRequest,
): Promise<GroupSchedulePublishMode> {
  return request<GroupSchedulePublishMode>(
    `/groups/${encodeURIComponent(groupId)}/schedule-publish-mode`,
    { data: input, method: 'PUT' },
  );
}

export function listScheduleDrafts(groupId: string): Promise<ScheduleDraftSummary[]> {
  return request<ScheduleDraftSummary[]>(`/groups/${encodeURIComponent(groupId)}/schedule-periods`);
}

export function listSchedulePeriodHistory(groupId: string): Promise<SchedulePeriodHistoryItem[]> {
  return request<SchedulePeriodHistoryItem[]>(
    `/groups/${encodeURIComponent(groupId)}/schedule-periods/history`,
  );
}

export function getScheduleDraftPreview(
  groupId: string,
  schedulePeriodId: string,
): Promise<ScheduleGenerationPreview> {
  return request<ScheduleGenerationPreview>(
    `/groups/${encodeURIComponent(groupId)}/schedules/${encodeURIComponent(
      schedulePeriodId,
    )}/preview`,
  );
}

export function previewScheduleChange(
  groupId: string,
  schedulePeriodId: string,
  action: 'publish' | 'withdraw',
): Promise<ScheduleChangeImpactPreview> {
  return request<ScheduleChangeImpactPreview>(
    `/groups/${encodeURIComponent(groupId)}/schedules/${encodeURIComponent(
      schedulePeriodId,
    )}/change-impact?action=${encodeURIComponent(action)}`,
  );
}

export function publishSchedulePeriod(
  groupId: string,
  schedulePeriodId: string,
  input: PublishSchedulePeriodRequest,
): Promise<PublishSchedulePeriodResult> {
  return request<PublishSchedulePeriodResult>(
    `/groups/${encodeURIComponent(groupId)}/schedules/${encodeURIComponent(
      schedulePeriodId,
    )}/publish`,
    { data: input, method: 'POST' },
  );
}

export function publishScheduleDraftBatch(
  groupId: string,
  input: PublishSchedulePeriodBatchRequest,
): Promise<PublishSchedulePeriodBatchResult> {
  return request<PublishSchedulePeriodBatchResult>(
    `/groups/${encodeURIComponent(groupId)}/schedules/publish-batch`,
    { data: input, method: 'POST' },
  );
}

export function withdrawSchedulePeriod(
  groupId: string,
  schedulePeriodId: string,
  input: SchedulePeriodMutationRequest,
): Promise<SchedulePeriodMutationResult> {
  return request<SchedulePeriodMutationResult>(
    `/groups/${encodeURIComponent(groupId)}/schedules/${encodeURIComponent(
      schedulePeriodId,
    )}/withdraw`,
    { data: input, method: 'POST' },
  );
}

export function deleteScheduleDraft(groupId: string, schedulePeriodId: string): Promise<void> {
  return request<void>(
    `/groups/${encodeURIComponent(groupId)}/schedules/${encodeURIComponent(schedulePeriodId)}`,
    { method: 'DELETE' },
  );
}

export function listManualScheduleTemplates(groupId: string): Promise<ManualScheduleTemplate[]> {
  return request<ManualScheduleTemplate[]>(
    `/groups/${encodeURIComponent(groupId)}/manual-schedule-templates`,
  );
}

export function createManualScheduleTemplate(
  groupId: string,
  input: CreateManualScheduleTemplateRequest,
): Promise<ManualScheduleTemplate> {
  return request<ManualScheduleTemplate>(
    `/groups/${encodeURIComponent(groupId)}/manual-schedule-templates`,
    { data: input, method: 'POST' },
  );
}

export function updateManualScheduleTemplate(
  groupId: string,
  templateId: string,
  input: UpdateManualScheduleTemplateRequest,
): Promise<ManualScheduleTemplate> {
  return request<ManualScheduleTemplate>(
    `/groups/${encodeURIComponent(groupId)}/manual-schedule-templates/${encodeURIComponent(
      templateId,
    )}`,
    { data: input, method: 'PUT' },
  );
}

export function deleteManualScheduleTemplate(groupId: string, templateId: string): Promise<void> {
  return request<void>(
    `/groups/${encodeURIComponent(groupId)}/manual-schedule-templates/${encodeURIComponent(
      templateId,
    )}`,
    { method: 'DELETE' },
  );
}

export function previewManualTemplateApply(
  groupId: string,
  templateId: string,
  input: PreviewManualTemplateApplyRequest,
): Promise<ManualApplyPreview> {
  return request<ManualApplyPreview>(
    `/groups/${encodeURIComponent(groupId)}/manual-schedule-templates/${encodeURIComponent(
      templateId,
    )}/apply-preview`,
    { data: input, method: 'POST' },
  );
}

export function applyManualScheduleTemplate(
  groupId: string,
  templateId: string,
  input: ApplyManualScheduleTemplateRequest,
): Promise<AppliedManualScheduleTemplateResult> {
  return request<AppliedManualScheduleTemplateResult>(
    `/groups/${encodeURIComponent(groupId)}/manual-schedule-templates/${encodeURIComponent(
      templateId,
    )}/apply`,
    { data: input, method: 'POST' },
  );
}

export function getMonthStatistics(
  groupId: string,
  businessMonth: string,
): Promise<MonthStatisticsSnapshot> {
  return request<MonthStatisticsSnapshot>(`/groups/${encodeURIComponent(groupId)}/statistics`, {
    data: { businessMonth },
  });
}

export function getYearStatistics(groupId: string, year: number): Promise<YearStatistics> {
  return request<YearStatistics>(`/groups/${encodeURIComponent(groupId)}/statistics/year`, {
    data: { year },
  });
}

export function refreshMonthStatistics(
  groupId: string,
  businessMonth: string,
): Promise<MonthStatisticsSnapshot> {
  return request<MonthStatisticsSnapshot>(
    `/groups/${encodeURIComponent(groupId)}/statistics/refresh`,
    { data: { businessMonth }, method: 'POST' },
  );
}

export function recalculateStatistics(
  groupId: string,
  businessMonth: string,
): Promise<StatisticsRecalculateCheckResult> {
  return request<StatisticsRecalculateCheckResult>(
    `/groups/${encodeURIComponent(groupId)}/statistics/recalculate-check`,
    { data: { businessMonth }, method: 'POST' },
  );
}

export function updateProfile(input: UpdateUserProfileRequest): Promise<UserProfile> {
  return request<UserProfile>('/users/me', {
    data: input,
    method: 'PATCH',
  });
}

export function deregisterAccount(): Promise<{ readonly id: string; readonly status: 'deleted' }> {
  return request<{ readonly id: string; readonly status: 'deleted' }>('/users/me/deregister', {
    method: 'POST',
  });
}

export function updateGroupMemberContact(
  groupId: string,
  membershipId: string,
  input: UpdateGroupMemberContactRequest,
): Promise<GroupMemberContact> {
  return request<GroupMemberContact>(
    `/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(membershipId)}/contact`,
    { data: input, method: 'PUT' },
  );
}

export function getHolidays(year: number): Promise<HolidayReadModel> {
  return request<HolidayReadModel>(`/holidays?year=${year}`);
}

export function getGuestHolidays(year: number): Promise<HolidayReadModel> {
  return request<HolidayReadModel>(`/guest/holidays?year=${year}`);
}

export function getSchedulePeriodCalendar(
  groupId: string,
  schedulePeriodId: string,
): Promise<CalendarReadModel> {
  return request<CalendarReadModel>(
    `/groups/${encodeURIComponent(groupId)}/calendar/periods/${encodeURIComponent(
      schedulePeriodId,
    )}`,
  );
}

export function listPastSchedulePeriods(groupId: string): Promise<PastSchedulePeriod[]> {
  return request<PastSchedulePeriod[]>(`/groups/${encodeURIComponent(groupId)}/past-schedules`);
}

export function listPastScheduleAssignments(
  groupId: string,
  schedulePeriodId: string,
): Promise<PastScheduleAssignment[]> {
  return request<PastScheduleAssignment[]>(
    `/groups/${encodeURIComponent(groupId)}/past-schedules/${encodeURIComponent(
      schedulePeriodId,
    )}/assignments`,
  );
}

export function listPastScheduleBackfillRecords(
  groupId: string,
): Promise<PastScheduleBackfillRecord[]> {
  return request<PastScheduleBackfillRecord[]>(
    `/groups/${encodeURIComponent(groupId)}/past-schedules/backfill-records`,
  );
}

export function createPastScheduleAssignment(
  groupId: string,
  input: CreatePastScheduleAssignmentInput,
): Promise<UpdatePastScheduleAssignmentResult> {
  return request<UpdatePastScheduleAssignmentResult>(
    `/groups/${encodeURIComponent(groupId)}/past-schedules/assignments`,
    { data: input, method: 'POST' },
  );
}

export function updatePastScheduleAssignment(
  groupId: string,
  schedulePeriodId: string,
  assignmentId: string,
  input: UpdatePastScheduleAssignmentInput,
): Promise<UpdatePastScheduleAssignmentResult> {
  return request<UpdatePastScheduleAssignmentResult>(
    `/groups/${encodeURIComponent(groupId)}/past-schedules/${encodeURIComponent(
      schedulePeriodId,
    )}/assignments/${encodeURIComponent(assignmentId)}`,
    { data: input, method: 'PUT' },
  );
}

export function createExportJob(
  groupId: string,
  input: CreateScheduleExportInput,
): Promise<ScheduleExportJob> {
  return request<ScheduleExportJob>(`/groups/${encodeURIComponent(groupId)}/exports`, {
    data: input,
    method: 'POST',
  });
}

export function getExportJob(groupId: string, exportJobId: string): Promise<ScheduleExportJob> {
  return request<ScheduleExportJob>(
    `/groups/${encodeURIComponent(groupId)}/exports/${encodeURIComponent(exportJobId)}`,
  );
}

export function getPlatformMe(): Promise<{ readonly isPlatformAdmin: boolean }> {
  return request<{ readonly isPlatformAdmin: boolean }>('/platform/me');
}

export function getPlatformJobs(): Promise<PlatformJobStatusPage> {
  return request<PlatformJobStatusPage>('/platform/jobs');
}

export function getPlatformBackups(): Promise<PlatformBackupList> {
  return request<PlatformBackupList>('/platform/backups');
}

export function restorePlatformGroup(groupId: string): Promise<{ readonly restored: boolean }> {
  return request<{ readonly restored: boolean }>(
    `/platform/groups/${encodeURIComponent(groupId)}/restore`,
    { method: 'POST' },
  );
}

export function setPlatformUserStatus(
  userId: string,
  input: UpdatePlatformUserStatusInput,
): Promise<unknown> {
  return request<unknown>(`/platform/users/${encodeURIComponent(userId)}/status`, {
    data: input,
    method: 'PUT',
  });
}

export function previewHolidayImport(input: {
  readonly dates: readonly {
    readonly date: string;
    readonly holidayName: string;
    readonly isOffDay: boolean;
    readonly isWorkday: boolean;
  }[];
  readonly year: number;
}): Promise<HolidayImportPreview> {
  return request<HolidayImportPreview>('/holidays/import-preview', {
    data: input,
    method: 'POST',
  });
}

export function importHolidays(input: {
  readonly dates: readonly {
    readonly date: string;
    readonly holidayName: string;
    readonly isOffDay: boolean;
    readonly isWorkday: boolean;
  }[];
  readonly year: number;
}): Promise<HolidayImportResult> {
  return request<HolidayImportResult>('/holidays/import', {
    data: input,
    method: 'POST',
  });
}

export function listHolidayVersions(year: number): Promise<HolidayCalendarVersion[]> {
  return request<HolidayCalendarVersion[]>(`/holidays/versions?year=${year}`);
}

export function confirmHolidayVersion(
  calendarVersionId: string,
): Promise<{ readonly confirmedAt: string; readonly status: 'confirmed' }> {
  return request<{ readonly confirmedAt: string; readonly status: 'confirmed' }>(
    `/holidays/versions/${encodeURIComponent(calendarVersionId)}/confirm`,
    { method: 'POST' },
  );
}

export function getHolidayCoverage(): Promise<HolidayCoverage> {
  return request<HolidayCoverage>('/holidays/coverage');
}
