import type { ResolveInviteResponse } from '@schedule/contracts';

import { resolveInvite } from '../../api/endpoints.js';
import { getSessionLandingTarget, readInviteToken } from '../../features/auth/auth-flow.js';
import { navigateForCurrentSession } from '../../features/auth/auth-runtime.js';
import { sessionStore } from '../../store/session.js';

Page({
  data: {
    accepting: false,
    errorMessage: '',
    loading: true,
    invite: undefined as ResolveInviteResponse | undefined,
  },
  onLoad(query: Record<string, string | undefined>): void {
    const token = readInviteToken(query);
    if (token !== undefined) sessionStore.setPendingInviteToken(token);
  },
  async onShow(): Promise<void> {
    const target = getSessionLandingTarget(
      sessionStore.state.status,
      sessionStore.getPendingInviteToken() !== undefined,
    );
    if (target.kind !== 'reLaunch' || target.url !== '/pages/invite/invite') {
      navigateForCurrentSession();
      return;
    }
    const token = sessionStore.getPendingInviteToken();
    if (token === undefined) {
      this.setData({ errorMessage: '缺少邀请凭证。', loading: false });
      return;
    }
    this.setData({ errorMessage: '', loading: true });
    try {
      this.setData({ invite: await resolveInvite(token) });
    } catch (error) {
      this.setData({ errorMessage: error instanceof Error ? error.message : '邀请解析失败。' });
    } finally {
      this.setData({ loading: false });
    }
  },
  async handleAccept(): Promise<void> {
    if (this.data.accepting) return;
    this.setData({ accepting: true, errorMessage: '' });
    try {
      await sessionStore.consumePendingInvite();
      wx.switchTab({ url: '/pages/workbench/index' });
    } catch (error) {
      this.setData({ errorMessage: error instanceof Error ? error.message : '接受邀请失败。' });
    } finally {
      this.setData({ accepting: false });
    }
  },
});
