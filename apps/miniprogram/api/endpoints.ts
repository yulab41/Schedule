import type {
  AcceptInviteResponse,
  ApproveLeaveRequestInput,
  CalendarReadModel,
  CreateDutyAdjustmentRequestInput,
  CreateLeaveRequestInput,
  CreateSwapRequestInput,
  DutyAdjustmentPreview,
  DutyAdjustmentRequest,
  DutyAdjustmentMutationInput,
  GroupQrResponse,
  GuestCalendarReadModel,
  GroupMember,
  GroupMemberContact,
  GroupNotificationSettings,
  GroupSummary,
  LeaveAffectedShift,
  LeaveAffectedShiftsInput,
  LeaveReflowPreview,
  LeaveRequest,
  LeaveRequestMutationResult,
  LeaveRequestMutationInput,
  MemberNotificationPreferences,
  NotificationPage,
  NotificationRecord,
  ResolveInviteResponse,
  RevokeDutyAdjustmentInput,
  RevokeSwapRequestInput,
  ScheduleEventPage,
  SwapPairInput,
  SwapPreview,
  SwapRequest,
  SwapRequestMutationInput,
  UpdateGroupNotificationSettingsInput,
  UpdateMemberNotificationPreferencesInput,
  UserProfile,
  VisitorAccessLogPage,
  VisitorResolveResponse,
  WechatLoginResponse,
} from '@schedule/contracts';

import { request } from './client.js';

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

export function listSwapRequests(groupId: string): Promise<SwapRequest[]> {
  return request<SwapRequest[]>(`/groups/${groupId}/swaps`);
}

export function acceptSwapRequest(
  groupId: string,
  swapRequestId: string,
  input: LeaveRequestMutationInput,
): Promise<SwapRequest> {
  return request<SwapRequest>(`/groups/${groupId}/swaps/${swapRequestId}/accept`, {
    data: input,
    method: 'POST',
  });
}

export function cancelSwapRequest(
  groupId: string,
  swapRequestId: string,
  input: LeaveRequestMutationInput,
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
  input: { coveredAssignmentId: string; overtimeMembershipId: string },
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

export function listDutyAdjustmentRequests(groupId: string): Promise<DutyAdjustmentRequest[]> {
  return request<DutyAdjustmentRequest[]>(`/groups/${groupId}/duty-adjustments`);
}

export function acceptDutyAdjustment(
  groupId: string,
  dutyAdjustmentId: string,
  input: LeaveRequestMutationInput,
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
  input: LeaveRequestMutationInput,
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
  strategy: 'keep-original-order' | 'shift-forward',
): Promise<LeaveReflowPreview> {
  return request<LeaveReflowPreview>(
    `/groups/${groupId}/leave-requests/${leaveRequestId}/preview`,
    {
      data: { strategy },
      method: 'POST',
    },
  );
}

export function approveLeaveRequest(
  groupId: string,
  leaveRequestId: string,
  input: ApproveLeaveRequestInput,
): Promise<LeaveRequest> {
  return request<LeaveRequest>(`/groups/${groupId}/leave-requests/${leaveRequestId}/approve`, {
    data: input,
    method: 'POST',
  });
}

export function rejectLeaveRequest(
  groupId: string,
  leaveRequestId: string,
  input: LeaveRequestMutationInput,
): Promise<LeaveRequest> {
  return request<LeaveRequest>(`/groups/${groupId}/leave-requests/${leaveRequestId}/reject`, {
    data: input,
    method: 'POST',
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
  cursor?: string,
  pageSize = 50,
): Promise<ScheduleEventPage> {
  return request<ScheduleEventPage>(`/groups/${groupId}/events`, {
    data: {
      ...(cursor === undefined ? {} : { cursor }),
      pageSize,
    },
  });
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
