import { wechatLogin } from '../../api/endpoints.js';
import { getStoredToken } from '../../api/client.js';
import { sessionStore } from '../../store/session.js';

interface LoginPageData {
  readonly errorMessage: string;
  readonly loggingIn: boolean;
}

Page({
  data: {
    errorMessage: '',
    loggingIn: false,
  } as LoginPageData,

  onShow() {
    if (getStoredToken() !== undefined) {
      wx.reLaunch({ url: '/pages/workbench/workbench' });
    }
  },

  async handleLogin(): Promise<void> {
    if (this.data.loggingIn) {
      return;
    }
    this.setData({ errorMessage: '', loggingIn: true });
    try {
      const code = await loginCode();
      const result = await wechatLogin(code);
      sessionStore.setSession(result.token, result.profile?.id);
      if (result.isNewUser) {
        wx.reLaunch({ url: '/pages/register/register' });
      } else {
        wx.reLaunch({ url: '/pages/workbench/workbench' });
      }
    } catch (error) {
      this.setData({
        errorMessage:
          error instanceof Error && error.message.length > 0
            ? error.message
            : '登录失败，请稍后重试。',
      });
    } finally {
      this.setData({ loggingIn: false });
    }
  },
});

function loginCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    wx.login({
      success: (result) => {
        if (result.code !== undefined && result.code.length > 0) {
          resolve(result.code);
        } else {
          reject(new Error('微信登录凭证获取失败，请重试。'));
        }
      },
      fail: () => reject(new Error('微信登录凭证获取失败，请重试。')),
    });
  });
}
