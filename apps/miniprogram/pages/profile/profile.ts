import type { UserProfile } from '@schedule/contracts';

import {
  deregisterAccount,
  getCurrentProfile,
  getPlatformMe,
  updateProfile,
} from '../../api/endpoints.js';
import { getStoredToken } from '../../api/client.js';
import { sessionStore } from '../../store/session.js';
import { syncTabBar } from '../../utils/tab-bar.js';

interface ProfilePageData {
  readonly editing: boolean;
  readonly errorMessage: string;
  readonly infoMessage: string;
  readonly isPlatformAdmin: boolean;
  readonly profile: UserProfile | undefined;
  readonly realNameInput: string;
}

Page({
  data: {
    editing: false,
    errorMessage: '',
    infoMessage: '',
    isPlatformAdmin: false,
    profile: undefined,
    realNameInput: '',
  } as ProfilePageData,

  onShow() {
    syncTabBar(this, 3);
    if (getStoredToken() === undefined) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    void this.loadProfile();
  },

  async loadProfile(): Promise<void> {
    this.setData({ errorMessage: '' });
    try {
      const [profile, platform] = await Promise.all([
        getCurrentProfile(),
        getPlatformMe().catch(() => ({ isPlatformAdmin: false })),
      ]);
      this.setData({
        isPlatformAdmin: platform.isPlatformAdmin,
        profile,
        realNameInput: profile.realName,
      });
    } catch (error) {
      this.setData({ errorMessage: toMessage(error, '资料加载失败。') });
    }
  },

  startEdit() {
    this.setData({ editing: true, realNameInput: this.data.profile?.realName ?? '' });
  },

  cancelEdit() {
    this.setData({ editing: false });
  },

  onNameInput(event: WechatMiniprogram.Input) {
    this.setData({ realNameInput: event.detail.value });
  },

  async saveName(): Promise<void> {
    const realName = this.data.realNameInput.trim();
    if (realName.length === 0) {
      this.setData({ errorMessage: '真实姓名不能为空。' });
      return;
    }
    this.setData({ errorMessage: '', infoMessage: '' });
    try {
      const profile = await updateProfile(realName);
      this.setData({ editing: false, infoMessage: '姓名已更新。', profile });
    } catch (error) {
      this.setData({ errorMessage: toMessage(error, '姓名保存失败。') });
    }
  },

  openContactEdit() {
    wx.navigateTo({ url: '/pages/group/contact-edit' });
  },

  openPlatform() {
    wx.navigateTo({ url: '/pages/platform/jobs' });
  },

  handleLogout() {
    wx.showModal({
      title: '退出登录',
      content: '退出后需重新微信登录。',
      success: (result) => {
        if (result.confirm) {
          sessionStore.clear();
          wx.reLaunch({ url: '/pages/login/login' });
        }
      },
    });
  },

  handleDeregister() {
    wx.showModal({
      title: '注销账号',
      content: '注销后账号数据将被删除且无法恢复，确定继续吗？',
      confirmColor: '#DC2626',
      success: (result) => {
        if (result.confirm) {
          void this.deregister();
        }
      },
    });
  },

  async deregister(): Promise<void> {
    this.setData({ errorMessage: '' });
    try {
      await deregisterAccount();
      sessionStore.clear();
      wx.reLaunch({ url: '/pages/login/login' });
    } catch (error) {
      this.setData({ errorMessage: toMessage(error, '注销失败，请稍后重试。') });
    }
  },
});

function toMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.length > 0 ? error.message : fallback;
}
