import type { ResolveInviteResponse } from '@schedule/contracts';

import { resolveInvite } from '../../api/endpoints.js';
import {
  getSessionLandingTarget,
  loginRoute,
  readInviteToken,
  workbenchRoute,
} from '../../features/auth/auth-flow.js';
import { navigateForCurrentSession } from '../../features/auth/auth-runtime.js';
import { sessionStore } from '../../store/session.js';

Page({
  data: {
    acceptCommitted: false,
    accepting: false,
    errorMessage: '',
    loading: true,
    invite: undefined as ResolveInviteResponse | undefined,
    refreshing: false,
  },
  onLoad(query: Record<string, string | undefined>): void {
    const token = readInviteToken(query);
    if (token !== undefined) sessionStore.setPendingInviteToken(token);
  },
  async onShow(): Promise<void> {
    const currentState = sessionStore.state;
    if (currentState.status === 'invite-refresh-required') {
      this.setData({
        acceptCommitted: true,
        errorMessage: currentState.errorMessage ?? '群组资料尚未刷新，请重试。',
        loading: false,
      });
      return;
    }
    const target = getSessionLandingTarget(
      currentState.status,
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
    this.setData({ acceptCommitted: false, errorMessage: '', invite: undefined, loading: true });
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
      const result = await sessionStore.consumePendingInvite();
      if (result.status === 'reconciled') wx.switchTab({ url: workbenchRoute });
      else if (result.status === 'committed-refresh-failed')
        this.setData({ acceptCommitted: true, errorMessage: result.errorMessage });
      else if (result.status === 'session-expired') wx.reLaunch({ url: loginRoute });
      else navigateForCurrentSession();
    } catch (error) {
      this.setData({ errorMessage: error instanceof Error ? error.message : '接受邀请失败。' });
    } finally {
      this.setData({ accepting: false });
    }
  },
  handleAbandon(): void {
    if (sessionStore.state.status === 'invite-refresh-required') return;
    sessionStore.setPendingInviteToken(undefined);
    wx.switchTab({ url: workbenchRoute });
  },
  handleLeaveAfterCommit(): void {
    if (sessionStore.state.status !== 'invite-refresh-required') return;
    sessionStore.clear();
    wx.reLaunch({ url: loginRoute });
  },
  async handleRetryContext(): Promise<void> {
    if (this.data.refreshing) return;
    this.setData({ errorMessage: '', refreshing: true });
    try {
      const result = await sessionStore.retryInviteContextRefresh();
      if (result.status === 'reconciled') wx.switchTab({ url: workbenchRoute });
      else if (result.status === 'committed-refresh-failed')
        this.setData({ acceptCommitted: true, errorMessage: result.errorMessage });
      else if (result.status === 'session-expired') wx.reLaunch({ url: loginRoute });
      else navigateForCurrentSession();
    } catch (error) {
      if (sessionStore.state.status !== 'invite-refresh-required') {
        navigateForCurrentSession();
        return;
      }
      this.setData({
        errorMessage: error instanceof Error ? error.message : '群组资料刷新失败。',
      });
    } finally {
      this.setData({ refreshing: false });
    }
  },
});
