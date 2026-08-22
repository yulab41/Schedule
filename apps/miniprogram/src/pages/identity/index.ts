import { buildInfo } from '../../platform/build-info.js';
import {
  getIdentityErrorMessage,
  linkWechatPassword,
  loginWithWechat,
  persistWechatSession,
  registerWechat,
  type WechatAuthenticatedResult,
} from '../../platform/wechat-identity.js';

type IdentityMode = 'authenticated' | 'choice' | 'login' | 'password' | 'register';

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

function authenticatedPatch(result: WechatAuthenticatedResult): Partial<IdentityPageData> {
  persistWechatSession(result);
  return { errorMessage: '', loading: false, mode: 'authenticated' };
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
    if (this.data.username.trim().length === 0 || this.data.password.length === 0) {
      this.setData({ errorMessage: '请输入账号和密码。' });
      return;
    }
    this.setData({ errorMessage: '', loading: true });
    void linkWechatPassword(this.data.linkToken, this.data.username.trim(), this.data.password)
      .then((result) => this.setData(authenticatedPatch(result)))
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
      .then((result) => this.setData(authenticatedPatch(result)))
      .catch((error: unknown) =>
        this.setData({ errorMessage: getIdentityErrorMessage(error), loading: false }),
      );
  },

  handleWechatLogin(this: IdentityPageInstance): void {
    this.setData({ errorMessage: '', loading: true });
    void loginWithWechat()
      .then((result) => {
        if (result.status === 'authenticated') {
          this.setData(authenticatedPatch(result));
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
