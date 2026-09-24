import { buildInfo } from '../../platform/build-info.js';
import {
  ClientCapabilityDisabledError,
  requireClientCapability,
} from '../../app/client-capability-store.js';
import {
  clearInfoMessageTimer,
  scheduleInfoMessageExpiry,
  type InfoMessageHost,
} from '../../platform/info-message-lifetime.js';
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
  readonly expiresAtLabel: string;
  readonly loading: boolean;
  readonly mode: AdminBindingMode;
  readonly realNameMasked: string;
  readonly usernameMasked: string;
  readonly realName: string;
  readonly employeeCode: string;
  readonly isMemberQr: boolean;
  readonly infoMessage: string;
  readonly infoTone: 'error' | 'success';
}

interface AdminBindingPageInstance extends InfoMessageHost {
  _disposed?: boolean;
  _ticket: string | undefined;
  data: AdminBindingPageData;
  setData(patch: Partial<AdminBindingPageData>): void;
}

function authenticatedPatch(result: WechatAuthenticatedResult): Partial<AdminBindingPageData> {
  persistWechatSession(result);
  return { loading: false, mode: 'authenticated' };
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
    expiresAtLabel: '限时有效',
    loading: false,
    mode: 'loading' as AdminBindingMode,
    realNameMasked: '',
    usernameMasked: '',
    realName: '',
    employeeCode: '',
    isMemberQr: false,
    infoMessage: '',
    infoTone: 'success',
  },

  handleConfirm(this: AdminBindingPageInstance): void {
    const ticket = this._ticket;
    if (ticket === undefined) return;
    updateAdminBindingPage(this, { loading: true });
    void confirmAdminBinding(ticket)
      .then((result) => {
        this.setData(authenticatedPatch(result));
        wx.showToast?.({ title: '绑定成功', icon: 'success' });
        wx.reLaunch({ url: '/pages/workbench/index' });
      })
      .catch((error: unknown) => {
        const message = getIdentityErrorMessage(error);
        updateAdminBindingPage(
          this,
          {
            loading: false,
            mode: 'error',
          },
          message,
          'error',
        );
      });
  },

  handleBackToLogin(this: AdminBindingPageInstance): void {
    clearInfoMessageTimer(this);
    wx.reLaunch({ url: '/pages/identity/index?forceLogin=1' });
  },

  onLoad(
    this: AdminBindingPageInstance,
    options: { readonly scene?: string; readonly ticket?: string } = {},
  ): void {
    this._disposed = false;
    const scene = typeof options.scene === 'string' ? decodeScene(options.scene) : undefined;
    const ticket =
      typeof options.ticket === 'string'
        ? options.ticket
        : scene?.startsWith('b=')
          ? scene.slice(2)
          : undefined;
    this._ticket = ticket;
    if (ticket === undefined || ticket.length === 0) {
      updateAdminBindingPage(
        this,
        { loading: false, mode: 'error' },
        '没有找到绑定链接。',
        'error',
      );
      return;
    }
    updateAdminBindingPage(this, { loading: true, mode: 'loading' });
    void requireClientCapability('core')
      .then(() =>
        previewMemberBinding(ticket).catch((error: unknown) => {
          if (error instanceof WechatIdentityClientError && error.code === 'NOT_FOUND') {
            return previewAdminBinding(ticket);
          }
          throw error;
        }),
      )
      .then((result) =>
        updateAdminBindingPage(this, previewPatch(result), '绑定信息已读取。', 'success'),
      )
      .catch((error: unknown) => setAdminBindingCapabilityError(this, error));
  },

  onUnload(this: AdminBindingPageInstance): void {
    this._disposed = true;
    clearInfoMessageTimer(this);
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
  const message =
    error instanceof ClientCapabilityDisabledError ? error.message : getIdentityErrorMessage(error);
  updateAdminBindingPage(page, { loading: false, mode: 'error' }, message, 'error');
}

function updateAdminBindingPage(
  page: AdminBindingPageInstance,
  patch: Partial<AdminBindingPageData>,
  message?: string,
  tone: 'error' | 'success' = 'success',
): void {
  clearInfoMessageTimer(page);
  page.setData({ ...patch, infoMessage: message ?? '', infoTone: tone });
  if (message) scheduleInfoMessageExpiry(page, message, () => !page._disposed);
}
