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
  type WechatAuthenticatedResult,
} from '../../platform/wechat-identity.js';

interface InputEvent {
  readonly detail: { readonly value: string };
}

interface IdentityPageData {
  readonly buildLabel: string;
  readonly errorMessage: string;
  readonly linkToken: string;
  readonly loading: boolean;
  readonly bindingOpen: boolean;
  readonly linkExpiresAt: string;
  readonly password: string;
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
    bindingOpen: false,
    linkExpiresAt: '',
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
    bindingOpen: false,
    linkExpiresAt: '',
    password: '',
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

  handleBindingCancel(this: IdentityPageInstance): void {
    if (this.data.loading) return;
    this.setData({
      bindingOpen: false,
      linkToken: '',
      linkExpiresAt: '',
      password: '',
      errorMessage: '',
    });
  },

  handleLinkPassword(this: IdentityPageInstance): void {
    if (this.data.loading || !this.data.bindingOpen) return;
    if (
      !this.data.linkToken ||
      !Number.isFinite(Date.parse(this.data.linkExpiresAt)) ||
      Date.parse(this.data.linkExpiresAt) <= Date.now()
    ) {
      this.setData({
        bindingOpen: false,
        linkToken: '',
        password: '',
        errorMessage: '绑定已过期，请重新点击微信快捷登录。',
      });
      return;
    }
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
    if (this.data.loading || this.data.bindingOpen) return;
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

  handleWechatLogin(this: IdentityPageInstance): void {
    if (this.data.loading || this.data.bindingOpen) return;
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
          bindingOpen: true,
          password: '',
          linkExpiresAt: result.expiresAt,
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
