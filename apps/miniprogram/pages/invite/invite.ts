import type { ResolveInviteResponse } from '@schedule/contracts';

import { ApiClientError } from '../../api/client.js';
import { acceptInvite, resolveInvite } from '../../api/endpoints.js';
import { sessionStore } from '../../store/session.js';

interface InvitePageData {
  readonly canAccept: boolean;
  readonly confirmRealName: string;
  readonly errorMessage: string;
  readonly invite: ResolveInviteResponse | undefined;
  readonly loading: boolean;
  readonly submitting: boolean;
}

let activeToken = '';

Page({
  data: {
    canAccept: false,
    confirmRealName: '',
    errorMessage: '',
    invite: undefined,
    loading: false,
    submitting: false,
  } as InvitePageData,

  onLoad(options: Record<string, string | undefined>) {
    const token = options.t;
    if (typeof token !== 'string' || token.length === 0) {
      this.setData({ errorMessage: '邀请链接无效，请联系群主重新获取。' });
      return;
    }
    activeToken = token;
    if (!sessionStore.state.isAuthenticated) {
      sessionStore.setPendingInviteToken(token);
      wx.redirectTo({ url: '/pages/login/login' });
      return;
    }
    sessionStore.setPendingInviteToken(undefined);
    void this.loadInvite();
  },

  onUnload() {
    activeToken = '';
  },

  async loadInvite(): Promise<void> {
    this.setData({ errorMessage: '', loading: true });
    try {
      const invite = await resolveInvite(activeToken);
      this.setData({ invite });
    } catch (error) {
      this.setData({ errorMessage: toInviteErrorMessage(error) });
    } finally {
      this.setData({ loading: false });
    }
  },

  handleConfirmNameInput(event: WechatMiniprogram.Input) {
    const confirmRealName = event.detail.value;
    this.setData({ confirmRealName, canAccept: matchesInvitee(confirmRealName, this.data.invite) });
  },

  async handleAccept(): Promise<void> {
    if (this.data.submitting || !this.data.canAccept) {
      return;
    }
    this.setData({ errorMessage: '', submitting: true });
    try {
      const result = await acceptInvite(activeToken, this.data.confirmRealName.trim());
      if (result.token !== undefined) {
        sessionStore.setSession(result.token);
      }
      sessionStore.setPendingInviteToken(undefined);
      activeToken = '';
      wx.showToast({ icon: 'success', title: '已加入群组' });
      setTimeout(() => {
        wx.switchTab({ url: '/pages/index/index' });
      }, 600);
    } catch (error) {
      this.setData({ errorMessage: toInviteErrorMessage(error) });
    } finally {
      this.setData({ submitting: false });
    }
  },
});

function matchesInvitee(
  confirmRealName: string,
  invite: ResolveInviteResponse | undefined,
): boolean {
  return (
    invite !== undefined &&
    confirmRealName.trim().length > 0 &&
    confirmRealName.trim() === invite.inviteeRealName
  );
}

function toInviteErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    switch (error.code) {
      case 'INVITE_INVALID':
        return '邀请链接无效，请联系群主重新生成。';
      case 'INVITE_USED':
        return '该邀请已被使用，请联系群主重新邀请。';
      case 'INVITE_EXPIRED':
        return '邀请已过期，请联系群主重新邀请。';
      default:
        return error.message;
    }
  }
  return error instanceof Error && error.message.length > 0
    ? error.message
    : '操作失败，请稍后重试。';
}
