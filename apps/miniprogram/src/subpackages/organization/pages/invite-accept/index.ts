import type {
  AcceptInviteRequest,
  AcceptInviteResponse,
  ResolveInviteResponse,
} from '@schedule/contracts';
import {
  createRuntimeInviteVisitorWriteClient,
  createRuntimeOrganizationReadClient,
} from '../../../../platform/client-core-calendar.js';
import {
  awaitWechatSessionRecovery,
  finalizeWechatUnauthorized,
  getStoredWechatToken,
  getWechatSessionGeneration,
  refreshWechatSessionAfterInvite,
} from '../../../../platform/wechat-identity.js';
import { writeStoredWorkbenchGroupId } from '../../../../platform/workbench-read.js';

interface InviteData {
  state: 'loading' | 'login' | 'ready' | 'error' | 'accepted';
  busy: boolean;
  errorMessage: string;
  groupName: string;
  inviteeName: string;
  roleLabel: string;
  scheduleRoleName: string;
  confirmName: string;
  invitationAccepted: boolean;
}
interface InvitePage {
  _disposed: boolean;
  _serial: number;
  _token: string;
  _generation: number;
  _refreshed: boolean;
  _preview?: ResolveInviteResponse;
  _request?: AcceptInviteRequest;
  _accepted?: AcceptInviteResponse;
  data: InviteData;
  setData(patch: Partial<InviteData>): void;
}
Page({
  data: {
    state: 'loading',
    busy: false,
    errorMessage: '',
    groupName: '',
    inviteeName: '',
    roleLabel: '',
    scheduleRoleName: '',
    confirmName: '',
    invitationAccepted: false,
  },
  onLoad(this: InvitePage, options: { t?: string }) {
    this._disposed = false;
    this._serial = 0;
    this._refreshed = false;
    this._token =
      typeof options.t === 'string' && /^[a-zA-Z0-9_-]{1,200}$/u.test(options.t) ? options.t : '';
  },
  onShow(this: InvitePage) {
    if (this.data.invitationAccepted && !this._accepted) {
      if (getStoredWechatToken()) openAcceptedWorkbench(this);
      else this.setData({ state: 'login', busy: false });
      return;
    }
    if (this._request && this._generation !== getWechatSessionGeneration()) {
      delete this._request;
      delete this._preview;
      this.setData({ confirmName: '' });
    }
    if (!this.data.busy && !this._accepted) void resolve(this);
  },
  onUnload(this: InvitePage) {
    this._disposed = true;
    this._serial += 1;
    this._token = '';
    delete this._request;
    delete this._accepted;
    delete this._preview;
  },
  handleLogin() {
    wx.navigateTo({ url: '/pages/identity/index?returnTo=invite' });
  },
  handleNameInput(this: InvitePage, event: { detail: { value: string } }) {
    if (!this.data.busy && !this._request) this.setData({ confirmName: event.detail.value });
  },
  handleRetry(this: InvitePage) {
    if (this.data.busy) return;
    if (this._accepted) void finish(this);
    else if (this.data.invitationAccepted) openAcceptedWorkbench(this);
    else if (this._request) void accept(this);
    else void resolve(this);
  },
  handleAccept(this: InvitePage) {
    if (!this.data.busy) void accept(this);
  },
});

async function resolve(page: InvitePage): Promise<void> {
  const serial = ++page._serial;
  if (!page._token) {
    page.setData({ state: 'error', errorMessage: '邀请链接无效，请向管理员重新获取。' });
    return;
  }
  page.setData({ state: 'loading', busy: true, errorMessage: '' });
  let context: { token: string; generation: number } | undefined;
  try {
    await awaitWechatSessionRecovery();
    if (page._disposed || serial !== page._serial) return;
    const token = getStoredWechatToken();
    if (!token) {
      page.setData({ state: 'login', busy: false });
      return;
    }
    page._generation = getWechatSessionGeneration();
    context = { token, generation: page._generation };
    const preview = await createRuntimeOrganizationReadClient(() => token).resolveInvite(
      page._token,
    );
    if (page._disposed || serial !== page._serial) return;
    if (context.generation !== getWechatSessionGeneration()) {
      resetForSessionChange(page);
      return;
    }
    page._preview = preview;
    page.setData({
      state: 'ready',
      busy: false,
      groupName: preview.groupName,
      inviteeName: preview.inviteeRealName,
      roleLabel: preview.permissionRole === 'administrator' ? '管理员' : '成员',
      scheduleRoleName: preview.scheduleRoleName ?? '未指定岗位',
    });
  } catch (error) {
    if (!page._disposed && serial === page._serial) reportError(page, error, context);
  }
}

async function accept(page: InvitePage): Promise<void> {
  if (!page._preview || page._accepted) return;
  if (!page._request && page.data.confirmName.trim() !== page._preview.inviteeRealName) {
    page.setData({ errorMessage: '请输入与受邀姓名一致的姓名。' });
    return;
  }
  const token = getStoredWechatToken();
  if (!token || page._generation !== getWechatSessionGeneration()) {
    page.setData({ state: 'login', errorMessage: '请重新登录并核对邀请。' });
    return;
  }
  page._request ??= {
    token: page._token,
    confirmRealName: page.data.confirmName.trim(),
    expectedVersion: page._preview.version,
    operationId: operationId(),
  };
  page.setData({ busy: true, errorMessage: '' });
  const context = { token, generation: page._generation };
  try {
    const result = await createRuntimeInviteVisitorWriteClient(() => token).acceptInvite(
      page._request,
    );
    if (page._disposed) return;
    if (context.generation !== getWechatSessionGeneration()) {
      resetForSessionChange(page);
      return;
    }
    page._accepted = result;
    page.setData({ invitationAccepted: true });
    page._token = '';
    delete page._request;
    await finish(page);
  } catch (error) {
    if (!page._disposed) reportError(page, error, context);
  }
}

async function finish(page: InvitePage): Promise<void> {
  if (!page._accepted) return;
  page.setData({ state: 'accepted', busy: true, errorMessage: '' });
  const context = { token: getStoredWechatToken() ?? '', generation: page._generation };
  try {
    if (page._refreshed) {
      if (page._generation !== getWechatSessionGeneration()) {
        resetForSessionChange(page);
        return;
      }
      openAcceptedWorkbench(page);
      return;
    }
    const session = await refreshWechatSessionAfterInvite(
      page._accepted.token,
      page._generation,
      () => !page._disposed,
    );
    if (page._disposed) return;
    if (session.generation !== getWechatSessionGeneration()) {
      resetForSessionChange(page);
      return;
    }
    page._generation = session.generation;
    page._refreshed = true;
    writeStoredWorkbenchGroupId(session.profile.id, page._accepted.group.id);
    openAcceptedWorkbench(page);
  } catch (error) {
    if (!page._disposed) reportError(page, error, context);
  }
}

function openAcceptedWorkbench(page: InvitePage): void {
  if (!getStoredWechatToken()) {
    page.setData({ state: 'login', busy: false });
    return;
  }
  page.setData({ busy: true });
  wx.reLaunch({
    url: '/pages/workbench/index',
    fail: () => {
      if (!page._disposed)
        page.setData({ busy: false, errorMessage: '邀请已接受，点击重试进入群组。' });
    },
  });
}

function resetForSessionChange(page: InvitePage): void {
  delete page._request;
  delete page._preview;
  delete page._accepted;
  page._refreshed = false;
  page.setData({
    busy: false,
    state: getStoredWechatToken() ? 'error' : 'login',
    confirmName: '',
    errorMessage: page.data.invitationAccepted
      ? '邀请已接受，登录账号已变化，请在我的群组中核对结果。'
      : '登录账号已变化，请重新核对邀请。',
  });
}

function reportError(
  page: InvitePage,
  error: unknown,
  context?: { token: string; generation: number },
): void {
  const failure = error as { code?: string; status?: number } | undefined;
  const code = failure?.code;
  if (
    context &&
    context.generation !== getWechatSessionGeneration() &&
    code !== 'INVITE_SESSION_REFRESH_UNAUTHORIZED'
  ) {
    resetForSessionChange(page);
    return;
  }
  if (code === 'INVITE_SESSION_CHANGED') {
    resetForSessionChange(page);
    return;
  }
  if (
    code === 'AUTHENTICATION_REQUIRED' ||
    code === 'UNAUTHORIZED' ||
    failure?.status === 401 ||
    code === 'INVITE_SESSION_REFRESH_UNAUTHORIZED'
  ) {
    if (context?.token) finalizeWechatUnauthorized(context.token);
    delete page._request;
    delete page._accepted;
    page._refreshed = false;
    page.setData({
      state: 'login',
      busy: false,
      errorMessage: page.data.invitationAccepted
        ? '邀请已接受，请重新登录后在群组列表核对结果。'
        : '登录已失效，请重新登录。',
    });
    return;
  }
  page.setData({
    state: page._accepted ? 'accepted' : 'error',
    busy: false,
    errorMessage: error instanceof Error ? error.message : '邀请暂时无法处理，请稍后重试。',
  });
}

function operationId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/gu, (marker) => {
    const value = Math.floor(Math.random() * 16);
    return (marker === 'x' ? value : (value & 3) | 8).toString(16);
  });
}
