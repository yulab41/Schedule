import { buildInfo } from '../../platform/build-info.js';
import {
  clearWechatSession,
  getStoredWechatAuthMethod,
  getStoredWechatProfile,
} from '../../platform/wechat-identity.js';
import { flushPendingProfileAvatarForStoredSession } from '../../platform/profile-avatar-runtime.js';

type ProfileMode = 'missing' | 'ready';

interface ProfilePanelData {
  readonly authMethodLabel: string;
  readonly buildLabel: string;
  readonly canUnbindWechat: boolean;
  readonly embedded: boolean;
  readonly initial: string;
  readonly largeText: boolean;
  readonly mode: ProfileMode;
  readonly profileVersion: string;
  readonly realName: string;
}

interface ProfilePanelInstance {
  data: ProfilePanelData;
  setData(patch: Partial<ProfilePanelData>): void;
}

export function createProfilePanelControllerDefinition(embedded = false) {
  return {
    data: {
      authMethodLabel: '微信快捷登录',
      buildLabel: buildInfo.buildLabel,
      canUnbindWechat: false,
      embedded,
      initial: '我',
      largeText: false,
      mode: 'missing' as ProfileMode,
      profileVersion: '—',
      realName: '当前账号',
    } satisfies ProfilePanelData,

    onLoad(this: ProfilePanelInstance): void {
      const windowInfo = wx.getWindowInfo();
      const fontSizeSetting = (windowInfo as unknown as { readonly fontSizeSetting?: number })
        .fontSizeSetting;
      this.setData({ largeText: (fontSizeSetting ?? 16) >= 20 });
      loadProfile(this);
    },

    onShow(this: ProfilePanelInstance): void {
      loadProfile(this);
      void flushPendingProfileAvatarForStoredSession().then(() => loadProfile(this));
    },

    handleBack(): void {
      wx.navigateBack({ delta: 1 });
    },

    handleUnbind(): void {
      wx.navigateTo({ url: '/pages/identity/unbind' });
    },

    handleSwitchLogin(this: ProfilePanelInstance): void {
      clearWechatSession(true);
      this.setData({ mode: 'missing' });
      wx.navigateTo({ url: '/pages/identity/index' });
    },

    handleSignOut(this: ProfilePanelInstance): void {
      clearWechatSession(true);
      this.setData({ mode: 'missing' });
      wx.navigateTo({ url: '/pages/identity/index' });
    },
  };
}

function loadProfile(panel: ProfilePanelInstance): void {
  const profile = getStoredWechatProfile();
  if (profile === undefined) {
    panel.setData({
      canUnbindWechat: false,
      mode: 'missing',
      realName: '当前账号',
      initial: '我',
      profileVersion: '—',
    });
    return;
  }
  const name = profile.realName.trim() || '未完善资料';
  const authMethod = getStoredWechatAuthMethod() ?? 'wechat';
  panel.setData({
    authMethodLabel: authMethod === 'password' ? '账号密码登录' : '微信快捷登录',
    canUnbindWechat: authMethod === 'wechat',
    initial: [...name][0] ?? '我',
    mode: 'ready',
    profileVersion: `资料版本 ${profile.version}`,
    realName: name,
  });
}
