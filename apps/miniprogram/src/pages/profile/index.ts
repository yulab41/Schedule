import { buildInfo } from '../../platform/build-info.js';
import {
  clearWechatSession,
  getStoredWechatAuthMethod,
  getStoredWechatProfile,
} from '../../platform/wechat-identity.js';

type ProfileMode = 'missing' | 'ready';

interface ProfilePageData {
  readonly authMethodLabel: string;
  readonly buildLabel: string;
  readonly initial: string;
  readonly largeText: boolean;
  readonly mode: ProfileMode;
  readonly profileVersion: string;
  readonly realName: string;
}

interface ProfilePageInstance {
  data: ProfilePageData;
  setData(patch: Partial<ProfilePageData>): void;
}

Page({
  data: {
    authMethodLabel: '微信快捷登录',
    buildLabel: buildInfo.buildLabel,
    initial: '我',
    largeText: false,
    mode: 'missing' as ProfileMode,
    profileVersion: '—',
    realName: '当前账号',
  },

  onLoad(this: ProfilePageInstance): void {
    const windowInfo = wx.getWindowInfo();
    const fontSizeSetting = (windowInfo as unknown as { readonly fontSizeSetting?: number })
      .fontSizeSetting;
    this.setData({ largeText: (fontSizeSetting ?? 16) >= 20 });
    loadProfile(this);
  },

  handleBack(): void {
    wx.navigateBack({ delta: 1 });
  },

  onShow(this: ProfilePageInstance): void {
    loadProfile(this);
  },

  handleUnbind(): void {
    wx.navigateTo({ url: '/pages/identity/unbind' });
  },

  handleSwitchLogin(this: ProfilePageInstance): void {
    clearWechatSession(true);
    this.setData({ mode: 'missing' });
    wx.navigateTo({ url: '/pages/identity/index' });
  },

  handleSignOut(this: ProfilePageInstance): void {
    clearWechatSession(true);
    this.setData({ mode: 'missing' });
    wx.navigateTo({ url: '/pages/identity/index' });
  },
});

function loadProfile(page: ProfilePageInstance): void {
  const profile = getStoredWechatProfile();
  if (profile === undefined) {
    page.setData({ mode: 'missing', realName: '当前账号', initial: '我', profileVersion: '—' });
    return;
  }
  const name = profile.realName.trim() || '未完善资料';
  page.setData({
    authMethodLabel: getStoredWechatAuthMethod() === 'password' ? '账号密码登录' : '微信快捷登录',
    initial: [...name][0] ?? '我',
    mode: 'ready',
    profileVersion: `资料版本 ${profile.version}`,
    realName: name,
  });
}
