import { buildInfo } from '../../platform/build-info.js';
import {
  ClientCapabilityDisabledError,
  requireClientCapability,
} from '../../app/client-capability-store.js';
import {
  confirmAdminBinding,
  getIdentityErrorMessage,
  persistWechatSession,
  previewAdminBinding,
  previewMemberBinding,
  WechatIdentityClientError,
  type WechatAdminBindingPreviewResult,
  type WechatMemberBindingPreviewResult,
  type WechatAuthenticatedResult,
} from '../../platform/wechat-identity.js';

type AdminBindingMode = 'authenticated' | 'error' | 'loading' | 'preview';

interface AdminBindingPageData {
  readonly buildLabel: string;
  readonly errorMessage: string;
  readonly expiresAtLabel: string;
  readonly loading: boolean;
  readonly mode: AdminBindingMode;
  readonly realNameMasked: string;
  readonly usernameMasked: string;
  readonly realName: string;
  readonly employeeCode: string;
  readonly isMemberQr: boolean;
}

interface AdminBindingPageInstance {
  _ticket: string | undefined;
  data: AdminBindingPageData;
  setData(patch: Partial<AdminBindingPageData>): void;
}

function authenticatedPatch(result: WechatAuthenticatedResult): Partial<AdminBindingPageData> {
  persistWechatSession(result);
  return { errorMessage: '', loading: false, mode: 'authenticated' };
}

function formatExpiry(expiresAt: string): string {
  const timestamp = Date.parse(expiresAt);
  if (!Number.isFinite(timestamp)) return '限时有效';
  const date = new Date(timestamp);
  const pad = (part: number) => String(part).padStart(2, '0');
  return `有效至 ${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function previewPatch(
  result: WechatAdminBindingPreviewResult | WechatMemberBindingPreviewResult,
): Partial<AdminBindingPageData> {
  const isMemberQr = 'realName' in result;
  return {
    errorMessage: '',
    expiresAtLabel: formatExpiry(result.expiresAt),
    loading: false,
    mode: 'preview',
    isMemberQr,
    realName: isMemberQr ? result.realName : '',
    employeeCode: isMemberQr ? result.employeeCode : '',
    realNameMasked: isMemberQr ? '' : result.realNameMasked,
    usernameMasked: isMemberQr ? '' : result.usernameMasked,
  };
}

Page({
  data: {
    buildLabel: buildInfo.buildLabel,
    errorMessage: '',
    expiresAtLabel: '限时有效',
    loading: false,
    mode: 'loading' as AdminBindingMode,
    realNameMasked: '',
    usernameMasked: '',
    realName: '',
    employeeCode: '',
    isMemberQr: false,
  },

  handleConfirm(this: AdminBindingPageInstance): void {
    const ticket = this._ticket;
    if (ticket === undefined) return;
    this.setData({ errorMessage: '', loading: true });
    void confirmAdminBinding(ticket)
      .then((result) => {
        this.setData(authenticatedPatch(result));
        wx.reLaunch({ url: '/pages/workbench/index' });
      })
      .catch((error: unknown) =>
        this.setData({
          errorMessage: getIdentityErrorMessage(error),
          loading: false,
          mode: 'error',
        }),
      );
  },

  handleGuest(): void {
    wx.navigateTo({ url: '/pages/guest-entry/index' });
  },

  onLoad(
    this: AdminBindingPageInstance,
    options: { readonly scene?: string; readonly ticket?: string } = {},
  ): void {
    const scene = typeof options.scene === 'string' ? decodeScene(options.scene) : undefined;
    const ticket =
      typeof options.ticket === 'string'
        ? options.ticket
        : scene?.startsWith('b=')
          ? scene.slice(2)
          : undefined;
    this._ticket = ticket;
    if (ticket === undefined || ticket.length === 0) {
      this.setData({ errorMessage: '没有找到绑定链接。', loading: false, mode: 'error' });
      return;
    }
    this.setData({ loading: true, mode: 'loading' });
    void requireClientCapability('core')
      .then(() =>
        previewMemberBinding(ticket).catch((error: unknown) => {
          if (error instanceof WechatIdentityClientError && error.code === 'NOT_FOUND') {
            return previewAdminBinding(ticket);
          }
          throw error;
        }),
      )
      .then((result) => this.setData(previewPatch(result)))
      .catch((error: unknown) => setAdminBindingCapabilityError(this, error));
  },

  onShow(this: AdminBindingPageInstance): void {
    void requireClientCapability('core').catch((error: unknown) =>
      setAdminBindingCapabilityError(this, error),
    );
  },
});

function decodeScene(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function setAdminBindingCapabilityError(page: AdminBindingPageInstance, error: unknown): void {
  page.setData({
    errorMessage:
      error instanceof ClientCapabilityDisabledError
        ? error.message
        : getIdentityErrorMessage(error),
    loading: false,
    mode: 'error',
  });
}
