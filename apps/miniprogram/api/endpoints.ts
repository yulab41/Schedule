import type {
  AcceptInviteResponse,
  CalendarReadModel,
  CreateDutyAdjustmentRequestInput,
  CreateLeaveRequestInput,
  CreateSwapRequestInput,
  DutyAdjustmentPreview,
  DutyAdjustmentRequest,
  GroupQrResponse,
  GuestCalendarReadModel,
  GroupMember,
  GroupMemberContact,
  GroupSummary,
  LeaveAffectedShift,
  LeaveAffectedShiftsInput,
  LeaveRequest,
  LeaveRequestMutationResult,
  LeaveRequestMutationInput,
  ResolveInviteResponse,
  RevokeDutyAdjustmentInput,
  RevokeSwapRequestInput,
  SwapPairInput,
  SwapPreview,
  SwapRequest,
  UserProfile,
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
