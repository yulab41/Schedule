import type {
  AcceptInviteResponse,
  GroupQrResponse,
  GuestCalendarReadModel,
  ResolveInviteResponse,
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
