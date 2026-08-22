import { buildInfo } from '../../platform/build-info.js';
import {
  confirmAdminBinding,
  getIdentityErrorMessage,
  persistWechatSession,
  previewAdminBinding,
  type WechatAdminBindingPreviewResult,
  type WechatAuthenticatedResult,
} from '../../platform/wechat-identity.js';

type AdminBindingMode = 'authenticated' | 'confirm' | 'error' | 'loading' | 'preview';

interface AdminBindingPageData {
  readonly buildLabel: string;
  readonly errorMessage: string;
  readonly expiresAtLabel: string;
  readonly loading: boolean;
  readonly mode: AdminBindingMode;
  readonly realNameMasked: string;
  readonly usernameMasked: string;
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
  const minutes = Math.max(1, Math.ceil((timestamp - Date.now()) / 60_000));
  return `还剩约 ${minutes} 分钟`;
}

function previewPatch(result: WechatAdminBindingPreviewResult): Partial<AdminBindingPageData> {
  return {
    errorMessage: '',
    expiresAtLabel: formatExpiry(result.expiresAt),
    loading: false,
    mode: 'preview',
    realNameMasked: result.realNameMasked,
    usernameMasked: result.usernameMasked,
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
  },

  handleConfirm(this: AdminBindingPageInstance): void {
    const ticket = this._ticket;
    if (ticket === undefined) return;
    this.setData({ errorMessage: '', loading: true });
    void confirmAdminBinding(ticket)
      .then((result) => this.setData(authenticatedPatch(result)))
      .catch((error: unknown) =>
        this.setData({
          errorMessage: getIdentityErrorMessage(error),
          loading: false,
          mode: 'error',
        }),
      );
  },

  handleContinue(this: AdminBindingPageInstance): void {
    this.setData({ errorMessage: '', loading: false, mode: 'confirm' });
  },

  onLoad(this: AdminBindingPageInstance, options: { readonly ticket?: string } = {}): void {
    const ticket = typeof options.ticket === 'string' ? options.ticket : undefined;
    this._ticket = ticket;
    if (ticket === undefined || ticket.length === 0) {
      this.setData({ errorMessage: '没有找到绑定链接。', loading: false, mode: 'error' });
      return;
    }
    this.setData({ loading: true, mode: 'loading' });
    void previewAdminBinding(ticket)
      .then((result) => this.setData(previewPatch(result)))
      .catch((error: unknown) =>
        this.setData({
          errorMessage: getIdentityErrorMessage(error),
          loading: false,
          mode: 'error',
        }),
      );
  },
});
