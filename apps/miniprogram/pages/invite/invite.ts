import type { ResolveInviteResponse } from '@schedule/contracts';

import { acceptInvite, getCurrentProfile, resolveInvite } from '../../api/endpoints.js';
import { getStoredToken } from '../../api/client.js';
import { sessionStore } from '../../store/session.js';

interface InvitePageData {
  readonly confirmRealName: string;
  readonly errorMessage: string;
  readonly infoMessage: string;
  readonly invite: ResolveInviteResponse | undefined;
  readonly submitting: boolean;
  readonly token: string;
}

Page({
  data: {
    confirmRealName: '',
    errorMessage: '',
    infoMessage: '',
    invite: undefined,
    submitting: false,
    token: '',
  } as InvitePageData,

  onLoad(options: Record<string, string | undefined>) {
    const token = options.token ?? '';
    if (token.length === 0) {
      this.setData({ errorMessage: '邀请链接参数无效。' });
      return;
    }
    this.setData({ token });
    if (getStoredToken() === undefined) {
      sessionStore.setPendingInviteToken(token);
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    void this.loadInvite(token);
  },

  async loadInvite(token: string): Promise<void> {
    this.setData({ errorMessage: '' });
    try {
      const invite = await resolveInvite(token);
      const profile = await getCurrentProfile().catch(() => undefined);
      this.setData({
        confirmRealName: profile?.realName ?? invite.inviteeRealName,
        invite,
      });
    } catch (error) {
      this.setData({ errorMessage: toMessage(error, '邀请解析失败，可能已失效。') });
    }
  },

  onNameInput(event: WechatMiniprogram.Input) {
    this.setData({ confirmRealName: event.detail.value });
  },

  async handleAccept(): Promise<void> {
    const name = this.data.confirmRealName.trim();
    if (name.length === 0) {
      this.setData({ errorMessage: '请填写并确认你的真实姓名。' });
      return;
    }
    this.setData({ errorMessage: '', infoMessage: '', submitting: true });
    try {
      const result = await acceptInvite(this.data.token, name);
      if (result.token !== undefined) {
        sessionStore.setSession(result.token);
      }
      sessionStore.setPendingInviteToken(undefined);
      wx.showToast({ icon: 'success', title: '已加入群组' });
      wx.reLaunch({ url: '/pages/workbench/workbench' });
    } catch (error) {
      this.setData({ errorMessage: toMessage(error, '接受邀请失败。') });
    } finally {
      this.setData({ submitting: false });
    }
  },
});

function toMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.length > 0 ? error.message : fallback;
}
