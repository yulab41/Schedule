import { ApiClientError } from '../../api/client.js';
import { getCurrentProfile, wechatLogin } from '../../api/endpoints.js';
import { sessionStore } from '../../store/session.js';

interface LoginPageData {
  readonly errorMessage: string;
  readonly loading: boolean;
}

Page({
  data: {
    errorMessage: '',
    loading: false,
  } as LoginPageData,

  onLoad() {
    void this.restoreSession();
  },

  async restoreSession(): Promise<void> {
    const token = sessionStore.state.token;
    if (token === undefined) {
      return;
    }
    try {
      const profile = await getCurrentProfile();
      sessionStore.setNeedsProfile(false);
      wx.switchTab({ url: '/pages/index/index' });
      void profile;
    } catch (error) {
      if (error instanceof ApiClientError && error.code === 'NOT_FOUND') {
        sessionStore.setNeedsProfile(true);
        wx.redirectTo({ url: '/pages/register/register' });
        return;
      }
      sessionStore.clear();
      this.setData({ errorMessage: toErrorMessage(error, '登录状态已失效，请重新登录。') });
    }
  },

  async handleLogin(): Promise<void> {
    if (this.data.loading) {
      return;
    }
    this.setData({ errorMessage: '', loading: true });
    try {
      const { code } = await wxLogin();
      const session = await wechatLogin(code);
      sessionStore.setSession(session.token);
      if (session.isNewUser || session.profile === undefined) {
        sessionStore.setNeedsProfile(true);
        wx.redirectTo({ url: '/pages/register/register' });
        return;
      }
      sessionStore.setNeedsProfile(false);
      wx.switchTab({ url: '/pages/index/index' });
    } catch (error) {
      this.setData({ errorMessage: toErrorMessage(error, '微信登录失败，请重新尝试。') });
    } finally {
      this.setData({ loading: false });
    }
  },
});

function wxLogin(): Promise<{ readonly code: string }> {
  return new Promise((resolve, reject) => {
    wx.login({
      fail: () => reject(new Error('微信登录未返回有效凭证。')),
      success: (result) => {
        resolve({ code: result.code });
      },
    });
  });
}

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.length > 0 ? error.message : fallback;
}
