import { buildInfo } from '../../platform/build-info.js';
import {
  ClientCapabilityDisabledError,
  requireClientCapability,
} from '../../app/client-capability-store.js';
import {
  getIdentityErrorMessage,
  getStoredWechatAuthMethod,
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

type IdentityMode = 'authenticated' | 'choice' | 'login' | 'password' | 'register';

interface InputEvent {
  readonly detail: { readonly value: string };
}

interface IdentityPageData {
  readonly authMethod: IdentityAuthMethod;
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

function authenticatedPatch(
  result: WechatAuthenticatedResult,
  authMethod: IdentityAuthMethod,
): Partial<IdentityPageData> {
  if (authMethod === 'password') persistPasswordSession(result);
  else persistWechatSession(result);
  return {
    authMethod,
    errorMessage: '',
    linkToken: '',
    loading: false,
    mode: 'authenticated',
    password: '',
  };
}

Page({
  data: {
    authMethod: 'wechat' as IdentityAuthMethod,
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
      this.setData({
        authMethod: getStoredWechatAuthMethod() ?? 'wechat',
        mode: 'authenticated',
      });
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
      .then((result) => this.setData(authenticatedPatch(result, 'wechat')))
      .catch((error: unknown) =>
        this.setData({ errorMessage: getIdentityErrorMessage(error), loading: false }),
      );
  },

  handlePasswordLogin(this: IdentityPageInstance): void {
    const username = normalizeUsername(this.data.username);
    if (!isValidUsername(username) || this.data.password.length === 0) {
      this.setData({ errorMessage: '请输入有效账号和密码。' });
      return;
    }
    this.setData({ errorMessage: '', loading: true });
    void loginWithPassword(username, this.data.password)
      .then((result) => this.setData(authenticatedPatch(result, 'password')))
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
      .then((result) => this.setData(authenticatedPatch(result, 'wechat')))
      .catch((error: unknown) =>
        this.setData({ errorMessage: getIdentityErrorMessage(error), loading: false }),
      );
  },

  handleWechatLogin(this: IdentityPageInstance): void {
    this.setData({ errorMessage: '', loading: true });
    void loginWithWechat()
      .then((result) => {
        if (result.status === 'authenticated') {
          this.setData(authenticatedPatch(result, 'wechat'));
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

async function guardIdentityCapability(page: IdentityPageInstance): Promise<void> {
  try {
    await requireClientCapability('core');
  } catch (error) {
    if (error instanceof ClientCapabilityDisabledError) {
      page.setData({ errorMessage: error.message, loading: false });
    }
  }
}
