import { listGroupContacts, listGroupMembers } from '../../api/endpoints.js';
import { navigateForCurrentSession } from '../../features/auth/auth-runtime.js';
import { loadOwnGroupContacts } from '../../features/profile/profile-logic.js';
import { sessionStore } from '../../store/session.js';

let requestVersion = 0;
Page({
  data: {
    errorMessage: '',
    loading: false,
    profile: undefined as typeof sessionStore.state.profile,
    summaries: [] as Awaited<ReturnType<typeof loadOwnGroupContacts>>,
  },
  async onShow(): Promise<void> {
    const state = sessionStore.state;
    if (state.status !== 'authenticated' || state.profile === undefined) {
      navigateForCurrentSession();
      return;
    }
    const version = ++requestVersion;
    this.setData({ errorMessage: '', loading: true, profile: state.profile });
    try {
      const summaries = await loadOwnGroupContacts(state.groups, {
        listGroupContacts,
        listGroupMembers,
      });
      if (version === requestVersion) this.setData({ summaries });
    } catch (error) {
      if (version === requestVersion)
        this.setData({ errorMessage: error instanceof Error ? error.message : '联系人加载失败。' });
    } finally {
      if (version === requestVersion) this.setData({ loading: false });
    }
  },
  handleLogout(): void {
    sessionStore.clear();
    wx.reLaunch({ url: '/pages/auth/login/index' });
  },
});
