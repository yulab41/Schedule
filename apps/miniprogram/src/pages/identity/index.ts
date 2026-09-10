import { buildInfo } from '../../platform/build-info.js';
import {
  ClientCapabilityDisabledError,
  requireClientCapability,
} from '../../app/client-capability-store.js';
import {
  WechatIdentityClientError,
  awaitWechatSessionRecovery,
  getStoredWechatToken,
  getWechatSessionGeneration,
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
  _disposed?: boolean;
  _loginAttempt?: number;
  _returnToInvite?: boolean;
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

  onLoad(this: IdentityPageInstance, options: { readonly returnTo?: string } = {}): void {
    this._disposed = false;
    this._returnToInvite = options.returnTo === 'invite';
    if (getStoredWechatToken() !== undefined && getStoredWechatProfile() !== undefined) {
      this.setData({ loading: true });
      openWorkbench(this);
      return;
    }
    this.setData({ loading: true });
    void awaitWechatSessionRecovery()
      .then(() => {
        if (this._disposed) return;
        if (getStoredWechatToken() !== undefined && getStoredWechatProfile() !== undefined)
          openWorkbench(this);
        else {
          this.setData({ loading: false });
          void guardIdentityCapability(this);
        }
      })
      .catch((error: unknown) => {
        if (!this._disposed)
          this.setData({ loading: false, errorMessage: getIdentityErrorMessage(error) });
      });
  },

  onUnload(this: IdentityPageInstance): void {
    this._disposed = true;
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
    const isCurrent = beginIdentityAttempt(this);
    void linkWechatPassword(this.data.linkToken, username, this.data.password)
      .then((result) => {
        if (isCurrent()) completeAuthentication(this, result, 'wechat');
      })
      .catch((error: unknown) => {
        if (!isCurrent()) return;
        const invalidCredential =
          error instanceof WechatIdentityClientError &&
          [
            'WECHAT_LINK_TOKEN_EXPIRED',
            'WECHAT_LINK_TOKEN_INVALID',
            'WECHAT_LINK_TOKEN_USED',
            'WECHAT_APP_ID_MISMATCH',
          ].includes(error.code ?? '');
        this.setData({
          errorMessage: getIdentityErrorMessage(error),
          loading: false,
          ...(invalidCredential
            ? { bindingOpen: false, linkToken: '', linkExpiresAt: '', password: '' }
            : {}),
        });
      });
  },

  handlePasswordLogin(this: IdentityPageInstance): void {
    if (this.data.loading || this.data.bindingOpen) return;
    const username = normalizeUsername(this.data.username);
    if (!isValidUsername(username) || this.data.password.length === 0) {
      this.setData({ errorMessage: '请输入有效账号和密码。' });
      return;
    }
    this.setData({ errorMessage: '', loading: true });
    const isCurrent = beginIdentityAttempt(this);
    void loginWithPassword(username, this.data.password)
      .then((result) => {
        if (isCurrent()) completeAuthentication(this, result, 'password');
      })
      .catch((error: unknown) => {
        if (isCurrent())
          this.setData({ errorMessage: getIdentityErrorMessage(error), loading: false });
      });
  },

  handlePasswordInput(this: IdentityPageInstance, event: InputEvent): void {
    this.setData({ password: event.detail.value });
  },

  handleWechatLogin(this: IdentityPageInstance): void {
    if (this.data.loading || this.data.bindingOpen) return;
    this.setData({ errorMessage: '', loading: true });
    const isCurrent = beginIdentityAttempt(this);
    void loginWithWechat()
      .then((result) => {
        if (!isCurrent()) return;
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
      .catch((error: unknown) => {
        if (isCurrent())
          this.setData({ errorMessage: getIdentityErrorMessage(error), loading: false });
      });
  },

  handleUsernameChange(this: IdentityPageInstance, event: InputEvent): void {
    this.setData({ username: event.detail.value });
  },
});

function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

function beginIdentityAttempt(page: IdentityPageInstance): () => boolean {
  const attempt = (page._loginAttempt ?? 0) + 1;
  page._loginAttempt = attempt;
  const generation = getWechatSessionGeneration();
  return () =>
    !page._disposed &&
    page._loginAttempt === attempt &&
    generation === getWechatSessionGeneration();
}

function isValidUsername(value: string): boolean {
  return value.length >= 3 && value.length <= 64 && /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value);
}

function openWorkbench(page: IdentityPageInstance): void {
  if (page._returnToInvite) {
    wx.navigateBack({
      delta: 1,
      fail: () => {
        if (!page._disposed)
          page.setData({ errorMessage: '登录已完成，请返回原邀请卡片继续。', loading: false });
      },
    });
    return;
  }
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
