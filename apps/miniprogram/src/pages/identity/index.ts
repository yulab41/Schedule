import { buildInfo } from '../../platform/build-info.js';
import {
  ClientCapabilityDisabledError,
  requireClientCapability,
} from '../../app/client-capability-store.js';
import {
  getIdentityErrorMessage,
  getStoredWechatProfile,
  linkWechatPassword,
  loginWithPassword,
  loginWithWechat,
  persistPasswordSession,
  persistWechatSession,
  type IdentityAuthMethod,
  registerWechat,
  type WechatAuthenticatedResult,
} from '../../platform/wechat-identity.js';
import { clearPendingProfileAvatar } from '../../platform/profile-media.js';

type IdentityMode = 'choice' | 'login' | 'password' | 'register';

interface InputEvent {
  readonly detail: { readonly value: string };
}

interface IdentityPageData {
  readonly buildLabel: string;
  readonly errorMessage: string;
  readonly linkToken: string;
  readonly loading: boolean;
  readonly mode: IdentityMode;
  readonly password: string;
  readonly realName: string;
  readonly username: string;
}

interface IdentityPageInstance {
  data: IdentityPageData;
  setData(patch: Partial<IdentityPageData>): void;
}

function completeAuthentication(
  page: IdentityPageInstance,
  result: WechatAuthenticatedResult,
  authMethod: IdentityAuthMethod,
): void {
  if (authMethod === 'password') persistPasswordSession(result);
  else persistWechatSession(result);
  page.setData({
    errorMessage: '',
    linkToken: '',
    loading: true,
    password: '',
  });
  openWorkbench(page);
}

Page({
  data: {
    buildLabel: buildInfo.buildLabel,
    errorMessage: '',
    linkToken: '',
    loading: false,
    mode: 'login' as IdentityMode,
    password: '',
    realName: '',
    username: '',
  },

  onLoad(this: IdentityPageInstance): void {
    if (getStoredWechatProfile() !== undefined) {
      this.setData({ loading: true });
      openWorkbench(this);
      return;
    }
    void guardIdentityCapability(this);
  },

  onShow(this: IdentityPageInstance): void {
    void guardIdentityCapability(this);
  },

  handleBackToChoice(this: IdentityPageInstance): void {
    this.setData({ errorMessage: '', mode: 'choice' });
  },

  handleChoosePassword(this: IdentityPageInstance): void {
    this.setData({ errorMessage: '', mode: 'password' });
  },

  handleChooseRegister(this: IdentityPageInstance): void {
    this.setData({ errorMessage: '', mode: 'register' });
  },

  handleLinkPassword(this: IdentityPageInstance): void {
    const username = normalizeUsername(this.data.username);
    if (!isValidUsername(username) || this.data.password.length === 0) {
      this.setData({ errorMessage: '请输入账号和密码。' });
      return;
    }
    this.setData({ errorMessage: '', loading: true });
    void linkWechatPassword(this.data.linkToken, username, this.data.password)
      .then((result) => completeAuthentication(this, result, 'wechat'))
      .catch((error: unknown) =>
        this.setData({ errorMessage: getIdentityErrorMessage(error), loading: false }),
      );
  },

  handlePasswordLogin(this: IdentityPageInstance): void {
    clearPendingProfileAvatar();
    const username = normalizeUsername(this.data.username);
    if (!isValidUsername(username) || this.data.password.length === 0) {
      this.setData({ errorMessage: '请输入有效账号和密码。' });
      return;
    }
    this.setData({ errorMessage: '', loading: true });
    void loginWithPassword(username, this.data.password)
      .then((result) => completeAuthentication(this, result, 'password'))
      .catch((error: unknown) =>
        this.setData({ errorMessage: getIdentityErrorMessage(error), loading: false }),
      );
  },

  handlePasswordInput(this: IdentityPageInstance, event: InputEvent): void {
    this.setData({ password: event.detail.value });
  },

  handleRealNameChange(this: IdentityPageInstance, event: InputEvent): void {
    this.setData({ realName: event.detail.value });
  },

  handleRegister(this: IdentityPageInstance): void {
    if (this.data.realName.trim().length === 0) {
      this.setData({ errorMessage: '请输入真实姓名。' });
      return;
    }
    this.setData({ errorMessage: '', loading: true });
    void registerWechat(this.data.linkToken, this.data.realName.trim())
      .then((result) => completeAuthentication(this, result, 'wechat'))
      .catch((error: unknown) =>
        this.setData({ errorMessage: getIdentityErrorMessage(error), loading: false }),
      );
  },

  handleWechatLogin(this: IdentityPageInstance): void {
    this.setData({ errorMessage: '', loading: true });
    void loginWithWechat()
      .then((result) => {
        if (result.status === 'authenticated') {
          completeAuthentication(this, result, 'wechat');
          return;
        }
        this.setData({
          errorMessage: '',
          linkToken: result.linkToken,
          loading: false,
          mode: 'choice',
        });
      })
      .catch((error: unknown) =>
        this.setData({ errorMessage: getIdentityErrorMessage(error), loading: false }),
      );
  },

  handleUsernameChange(this: IdentityPageInstance, event: InputEvent): void {
    this.setData({ username: event.detail.value });
  },
});

function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

function isValidUsername(value: string): boolean {
  return value.length >= 3 && value.length <= 64 && /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value);
}

function openWorkbench(page: IdentityPageInstance): void {
  wx.reLaunch({
    fail: () =>
      page.setData({
        errorMessage: '登录已完成，但主页未能打开，请重新打开小程序。',
        loading: false,
      }),
    url: '/pages/workbench/index',
  });
}

async function guardIdentityCapability(page: IdentityPageInstance): Promise<void> {
  try {
    await requireClientCapability('core');
  } catch (error) {
    if (error instanceof ClientCapabilityDisabledError) {
      page.setData({ errorMessage: error.message, loading: false });
    }
  }
}
