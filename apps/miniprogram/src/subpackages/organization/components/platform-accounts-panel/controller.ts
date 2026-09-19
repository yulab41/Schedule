import {
  ClientCoreError,
  type OrganizationReadClient,
  type PlatformIdentityWriteClient,
  type PlatformAccountClient,
} from '@schedule/client-core';
import {
  getClientCapabilitySnapshot,
  requireClientCapability,
} from '../../../../app/client-capability-store.js';
import type { PlatformAdminUserDetails as PlatformAdminUserAccount } from '@schedule/contracts';
import {
  createRuntimeOrganizationReadClient,
  createRuntimePlatformIdentityWriteClient,
  createRuntimePlatformAccountClient,
} from '../../../../platform/client-core-calendar.js';
import {
  getStoredWechatToken,
  getStoredWechatProfile,
  clearWechatSession,
  getWechatRequestAuthentication,
} from '../../../../platform/wechat-identity.js';
import { recordMiniTelemetryBoundary } from '../../../../platform/telemetry.js';
import {
  clearInfoMessageTimer,
  scheduleInfoMessageExpiry,
} from '../../../../platform/info-message-lifetime.js';

interface ValueInputEvent {
  readonly detail?: { readonly value?: unknown };
}

interface TapEvent {
  readonly currentTarget: { readonly dataset: Record<string, string | undefined> };
}

interface AccountCardView {
  readonly id: string;
  readonly idLabel: string;
  readonly username: string;
  readonly usernameLabel: string;
  readonly statusLabel: string;
  readonly passwordLabel: string;
  readonly hasPassword: boolean;
  readonly authVersion: number;
  readonly realName: string;
  readonly mobilePhone: string;
  readonly kindLabel: string;
}

interface PlatformAccountsPageData {
  readonly state: 'error' | 'loading' | 'ready';
  readonly errorMessage: string;
  readonly infoMessage: string;
  readonly infoTone: 'success' | 'info' | 'error';
  readonly managementError: string;
  readonly managementInfo: string;
  readonly managementState: 'error' | 'loading' | 'ready';
  readonly organizationEnabled: boolean;
  readonly canManage: boolean;
  readonly accounts: readonly AccountCardView[];
  readonly totalCount: number;
  readonly configuredCount: number;
  readonly pendingCount: number;
  readonly editorOpen: boolean;
  readonly selectedAccountId: string;
  readonly selectedAccountLabel: string;
  readonly usernameDraft: string;
  readonly realNameDraft: string;
  readonly mobilePhoneDraft: string;
  readonly newPasswordDraft: string;
  readonly passwordVisible: boolean;
  readonly bindingUrl: string;
  readonly bindingExpiresAt: string;
  readonly largeText: boolean;
  readonly pageScrollStyle: string;
  readonly shellHeaderStyle: string;
  readonly viewportClass: string;
}

interface PlatformAccountsPageInstance {
  readonly data: PlatformAccountsPageData;
  _organizationReadClient: OrganizationReadClient;
  _accountClient: PlatformAccountClient;
  _passwordOperationId: string | undefined;
  _disposed: boolean;
  _platformIdentityWriteClient: PlatformIdentityWriteClient;
  _accounts: readonly PlatformAdminUserAccount[];
  _selectedAccount: PlatformAdminUserAccount | undefined;
  _operationIds: Map<string, string>;
  __infoMessageTimer?: unknown;
  __infoMessageToken?: object;
  setData(patch: Partial<PlatformAccountsPageData>, callback?: () => void): void;
}

const organizationReadClient = createRuntimeOrganizationReadClient(
  getStoredWechatToken,
  getWechatRequestAuthentication(),
);
const platformIdentityWriteClient = createRuntimePlatformIdentityWriteClient(
  getStoredWechatToken,
  getWechatRequestAuthentication(),
);
const accountClient = createRuntimePlatformAccountClient(
  getStoredWechatToken,
  getWechatRequestAuthentication(),
);

export function createPlatformAccountsPanelControllerDefinition() {
  return {
    data: {
      state: 'loading',
      errorMessage: '',
      infoMessage: '',
      infoTone: 'info',
      managementError: '',
      managementInfo: '',
      managementState: 'loading',
      organizationEnabled: false,
      canManage: false,
      accounts: [],
      totalCount: 0,
      configuredCount: 0,
      pendingCount: 0,
      editorOpen: false,
      selectedAccountId: '',
      selectedAccountLabel: '',
      usernameDraft: '',
      realNameDraft: '',
      mobilePhoneDraft: '',
      newPasswordDraft: '',
      passwordVisible: false,
      bindingUrl: '',
      bindingExpiresAt: '',
      largeText: false,
      pageScrollStyle: 'height:calc(100% - 76px);',
      shellHeaderStyle: 'height:76px;min-height:76px;padding-top:24px;',
      viewportClass: '',
    } satisfies PlatformAccountsPageData,

    _organizationReadClient: organizationReadClient,
    _platformIdentityWriteClient: platformIdentityWriteClient,
    _accounts: [],
    _selectedAccount: undefined,
    _operationIds: new Map<string, string>(),

    lifetimes: {
      attached(this: PlatformAccountsPageInstance): void {
        this._disposed = false;
        recordMiniTelemetryBoundary('platform-accounts:controller-attached');
        applyPanelLayout(this);
        void loadAccounts(this);
      },
    },

    handleSecretCleanup(this: PlatformAccountsPageInstance): void {
      this._passwordOperationId = undefined;
      this.setData({ newPasswordDraft: '', passwordVisible: false });
    },
    handleDispose(this: PlatformAccountsPageInstance): void {
      clearInfoMessageTimer(this);
      this._disposed = true;
      this._passwordOperationId = undefined;
      this._operationIds?.clear();
      this._accounts = [];
      this._selectedAccount = undefined;
      this.setData({ newPasswordDraft: '', passwordVisible: false });
    },
    handleBack(): void {
      wx.navigateBack({ delta: 1 });
    },

    preventTouchMove(): void {},

    handleRetry(this: PlatformAccountsPageInstance): void {
      void loadAccounts(this);
    },

    handleRefresh(this: PlatformAccountsPageInstance): void {
      void loadAccounts(this);
    },

    handleOpenEditor(this: PlatformAccountsPageInstance, event: TapEvent): void {
      const accountId = event.currentTarget.dataset.accountId;
      if (accountId === undefined) return;
      const account = this._accounts.find((candidate) => candidate.id === accountId);
      if (account === undefined) return;
      this._selectedAccount = account;
      this.setData({
        editorOpen: true,
        selectedAccountId: account.id,
        selectedAccountLabel: account.realName ?? shortUserId(account.id),
        realNameDraft: account.realName ?? '',
        mobilePhoneDraft: account.mobilePhone ?? '',
        newPasswordDraft: '',
        passwordVisible: false,
        usernameDraft: account.username ?? '',
        bindingUrl: '',
        bindingExpiresAt: '',
      });
      clearManagementFeedback(this);
    },

    handleCloseEditor(this: PlatformAccountsPageInstance): void {
      if (this.data.managementState === 'loading') return;
      this._selectedAccount = undefined;
      this._passwordOperationId = undefined;
      this.setData({
        editorOpen: false,
        selectedAccountId: '',
        usernameDraft: '',
        bindingUrl: '',
        newPasswordDraft: '',
        passwordVisible: false,
      });
    },

    handleUsernameInput(this: PlatformAccountsPageInstance, event: ValueInputEvent): void {
      if (!this.data.canManage || !this.data.organizationEnabled) return;
      this.setData({ usernameDraft: readString(event) });
    },

    handleSaveUsername(this: PlatformAccountsPageInstance): void {
      void saveUsername(this);
    },

    handleRealNameInput(this: PlatformAccountsPageInstance, event: ValueInputEvent): void {
      this.setData({ realNameDraft: readString(event) });
    },
    handleMobilePhoneInput(this: PlatformAccountsPageInstance, event: ValueInputEvent): void {
      this.setData({ mobilePhoneDraft: readString(event) });
    },
    handlePasswordInput(this: PlatformAccountsPageInstance, event: ValueInputEvent): void {
      this._passwordOperationId = undefined;
      this.setData({ newPasswordDraft: readString(event) });
    },
    handleTogglePassword(this: PlatformAccountsPageInstance): void {
      this.setData({ passwordVisible: !this.data.passwordVisible });
    },
    handleSaveProfile(this: PlatformAccountsPageInstance): void {
      void saveProfile(this);
    },
    handleSavePassword(this: PlatformAccountsPageInstance): void {
      void savePassword(this);
    },
    handleGenerateBinding(this: PlatformAccountsPageInstance): void {
      void generateBinding(this);
    },
  };
}

function applyPanelLayout(page: PlatformAccountsPageInstance): void {
  const windowInfo = wx.getWindowInfo();
  const statusBarHeight = Math.max(0, windowInfo.statusBarHeight ?? 0);
  const headerHeight = statusBarHeight + 52;
  page.setData({
    pageScrollStyle: `height:calc(100% - ${headerHeight}px);`,
    shellHeaderStyle: `height:${headerHeight}px;min-height:${headerHeight}px;padding-top:${statusBarHeight}px;`,
    largeText:
      ((windowInfo as unknown as { readonly fontSizeSetting?: number }).fontSizeSetting ?? 16) >=
      20,
    viewportClass: windowInfo.windowWidth <= 340 ? 'is-compact' : '',
  });
}

async function loadAccounts(page: PlatformAccountsPageInstance): Promise<void> {
  initializeRuntimeState(page);
  clearManagementFeedback(page);
  page.setData({
    state: 'loading',
    errorMessage: '',
    managementError: '',
    managementState: 'loading',
  });
  try {
    await requireClientCapability('organization');
    const accounts = await page._accountClient.listDetails();
    if (page._disposed) return;
    page._accounts = accounts;
    const selected = page._selectedAccount;
    const selectedNext =
      selected === undefined ? undefined : accounts.find((account) => account.id === selected.id);
    if (selectedNext?.authVersion !== selected?.authVersion) page._passwordOperationId = undefined;
    page._selectedAccount = selectedNext;
    page.setData({
      state: 'ready',
      managementState: 'ready',
      organizationEnabled: getClientCapabilitySnapshot().organization,
      canManage: true,
      accounts: accounts.map(toAccountCard),
      totalCount: accounts.length,
      configuredCount: accounts.filter((account) => account.hasPassword).length,
      pendingCount: accounts.filter((account) => !account.hasPassword).length,
      ...(selectedNext === undefined
        ? {
            editorOpen: false,
            selectedAccountId: '',
            selectedAccountLabel: '',
            realNameDraft: '',
            mobilePhoneDraft: '',
            usernameDraft: '',
            newPasswordDraft: '',
            passwordVisible: false,
          }
        : {
            selectedAccountLabel: selectedNext.realName ?? shortUserId(selectedNext.id),
            realNameDraft: selectedNext.realName ?? '',
            mobilePhoneDraft: selectedNext.mobilePhone ?? '',
            usernameDraft: selectedNext.username ?? '',
          }),
    });
  } catch (error) {
    if (error instanceof ClientCoreError && error.status === 401) {
      returnToLogin(page);
      return;
    }
    if (error instanceof ClientCoreError && error.status === 403) {
      page._accounts = [];
      page._selectedAccount = undefined;
      page._passwordOperationId = undefined;
      page.setData({
        accounts: [],
        editorOpen: false,
        newPasswordDraft: '',
        passwordVisible: false,
      });
    }
    page.setData({
      state: 'error',
      managementState: 'error',
      organizationEnabled: getClientCapabilitySnapshot().organization,
      canManage: false,
      errorMessage: toUserMessage(error, '平台账号暂时无法加载，请稍后重试。'),
      managementError: '仅平台管理员可访问平台账号后台；服务端已拒绝非授权请求。',
    });
  }
}

function initializeRuntimeState(page: PlatformAccountsPageInstance): void {
  // Component ignores private factory keys; attach the API clients explicitly
  // before the first load and every retry.
  page._organizationReadClient = organizationReadClient;
  page._accountClient = accountClient;
  page._platformIdentityWriteClient = platformIdentityWriteClient;
  if (!Array.isArray(page._accounts)) page._accounts = [];
  if (!(page._operationIds instanceof Map)) page._operationIds = new Map();
}

async function saveUsername(page: PlatformAccountsPageInstance): Promise<void> {
  if (!(await ensureManage(page))) return;
  const account = page._selectedAccount;
  const username = page.data.usernameDraft.trim();
  if (account === undefined || username.length === 0) {
    showManagementFeedback(page, '请输入用户名。', 'error', { managementState: 'error' });
    return;
  }
  const key = `password-identity:${account.id}:${account.authVersion}:${username}`;
  clearManagementFeedback(page, { managementState: 'loading' });
  try {
    const result = await page._platformIdentityWriteClient.assignPasswordIdentity(account.id, {
      expectedAuthVersion: account.authVersion,
      operationId: resolveOperationId(page, key),
      username,
    });
    page._operationIds.delete(key);
    page._passwordOperationId = undefined;
    page._selectedAccount = {
      ...account,
      authVersion: result.authVersion,
      hasPassword: result.passwordConfigured,
      username: result.username,
    };
    await loadAccounts(page);
    if (!page._disposed)
      showManagementFeedback(page, '用户名已保存；用户可继续完成密码证明。', 'success', {
        managementState: 'ready',
      });
  } catch (error) {
    showManagementFeedback(
      page,
      `${toUserMessage(error, '用户名没有保存，请稍后重试。')} 可保持当前输入重试。`,
      'error',
      { managementState: 'error' },
    );
  }
}

async function generateBinding(page: PlatformAccountsPageInstance): Promise<void> {
  if (!(await ensureManage(page))) return;
  const account = page._selectedAccount;
  if (account === undefined) return;
  const key = `wechat-binding-link:${account.id}:${account.authVersion}`;
  clearManagementFeedback(page, {
    managementState: 'loading',
    bindingUrl: '',
  });
  try {
    const result = await page._platformIdentityWriteClient.createWechatBindingLink(account.id, {
      expectedAuthVersion: account.authVersion,
      operationId: resolveOperationId(page, key),
    });
    page._operationIds.delete(key);
    page.setData({ bindingUrl: result.urlLink, bindingExpiresAt: formatDate(result.expiresAt) });
    showManagementFeedback(page, '绑定链接已生成，仅在当前页面内存中展示。', 'success', {
      managementState: 'ready',
    });
  } catch (error) {
    showManagementFeedback(
      page,
      `${toUserMessage(error, '绑定链接没有生成，请稍后重试。')} 可保持当前账号重试。`,
      'error',
      { managementState: 'error' },
    );
  }
}

async function ensureManage(page: PlatformAccountsPageInstance): Promise<boolean> {
  try {
    await requireClientCapability('organization');
    return page.data.canManage;
  } catch (error) {
    showManagementFeedback(
      page,
      error instanceof Error ? error.message : '组织管理能力暂未开放。',
      'error',
      { managementState: 'error' },
    );
    return false;
  }
}

function toAccountCard(account: PlatformAdminUserAccount): AccountCardView {
  return {
    id: account.id,
    realName: account.realName ?? '未填写姓名',
    mobilePhone: account.mobilePhone ?? '未填写手机号',
    kindLabel: {
      password: '密码账号',
      wechat: '微信账号',
      'unbound-member': '待绑定成员',
      'history-member': '历史成员身份',
      incomplete: '未完成账号',
    }[account.accountKind],
    idLabel: shortUserId(account.id),
    username: account.username ?? '',
    usernameLabel: account.username ?? '未分配',
    statusLabel: account.status === 'active' ? '账号正常' : '账号已暂停',
    passwordLabel: account.hasPassword ? '已设置' : '待设置',
    hasPassword: account.hasPassword,
    authVersion: account.authVersion,
  };
}

function shortUserId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
}

function formatDate(value: string): string {
  return value.length >= 10 ? value.slice(0, 10) : value;
}

function readString(event: ValueInputEvent): string {
  return typeof event.detail?.value === 'string' ? event.detail.value : '';
}

function createOperationId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/gu, (marker) => {
    const random = Math.floor(Math.random() * 16);
    return (marker === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
}

function resolveOperationId(page: PlatformAccountsPageInstance, key: string): string {
  const existing = page._operationIds.get(key);
  if (existing !== undefined) return existing;
  const operationId = createOperationId();
  page._operationIds.set(key, operationId);
  return operationId;
}

function toUserMessage(error: unknown, fallback: string): string {
  if (error instanceof ClientCoreError && error.message.length > 0) return error.message;
  return error instanceof Error && error.message.length > 0 ? error.message : fallback;
}

async function saveProfile(page: PlatformAccountsPageInstance): Promise<void> {
  if (page.data.managementState === 'loading' || !(await ensureManage(page))) return;
  const account = page._selectedAccount;
  if (account === undefined || page.data.realNameDraft.trim().length === 0) return;
  const payload = {
    expectedAccountVersion: account.accountVersion,
    expectedProfileVersion: account.profileVersion,
    realName: page.data.realNameDraft.trim(),
    mobilePhone: page.data.mobilePhoneDraft.trim() || null,
  };
  const key = 'profile:' + account.id + ':' + JSON.stringify(payload);
  clearManagementFeedback(page, { managementState: 'loading' });
  try {
    await page._accountClient.updateProfile(account.id, {
      ...payload,
      operationId: resolveOperationId(page, key),
    });
    page._operationIds.delete(key);
    if (page._disposed) return;
    await loadAccounts(page);
    if (!page._disposed)
      showManagementFeedback(page, '姓名与手机号已保存，手机号已同步至所有群组。', 'success', {
        managementState: 'ready',
      });
  } catch (error) {
    if (error instanceof ClientCoreError && error.status === 401) {
      returnToLogin(page);
      return;
    }
    if (!page._disposed)
      showManagementFeedback(page, toUserMessage(error, '资料没有保存，请刷新后重试。'), 'error', {
        managementState: 'error',
      });
  }
}

async function savePassword(page: PlatformAccountsPageInstance): Promise<void> {
  if (page.data.managementState === 'loading' || !(await ensureManage(page))) return;
  const account = page._selectedAccount;
  if (account === undefined || page.data.newPasswordDraft.length === 0) return;
  page._passwordOperationId ??= createOperationId();
  const request = {
    operationId: page._passwordOperationId,
    expectedAuthVersion: account.authVersion,
    newPassword: page.data.newPasswordDraft,
  };
  clearManagementFeedback(page, { managementState: 'loading' });
  try {
    await page._accountClient.resetPassword(account.id, request);
    page._passwordOperationId = undefined;
    if (page._disposed) return;
    page.setData({ newPasswordDraft: '', passwordVisible: false });
    if (account.id === getStoredWechatProfile()?.id) {
      returnToLogin(page);
      return;
    }
    await loadAccounts(page);
    if (!page._disposed)
      showManagementFeedback(page, '新密码已保存，该账号的旧登录已失效。', 'success', {
        managementState: 'ready',
      });
  } catch (error) {
    if (error instanceof ClientCoreError && error.status === 401) {
      returnToLogin(page);
      return;
    }
    if (!page._disposed)
      showManagementFeedback(page, toUserMessage(error, '密码没有保存，请刷新后重试。'), 'error', {
        managementState: 'error',
      });
  }
}

function returnToLogin(page: PlatformAccountsPageInstance): void {
  clearInfoMessageTimer(page);
  clearWechatSession(true);
  page._accounts = [];
  page._selectedAccount = undefined;
  page._passwordOperationId = undefined;
  page.setData({ editorOpen: false, accounts: [], newPasswordDraft: '', passwordVisible: false });
  wx.reLaunch({ url: '/pages/login/index' });
}

function clearManagementFeedback(
  page: PlatformAccountsPageInstance,
  patch: Partial<PlatformAccountsPageData> = {},
): void {
  clearInfoMessageTimer(page);
  page.setData({
    ...patch,
    infoMessage: '',
    managementError: '',
    managementInfo: '',
  });
}

function showManagementFeedback(
  page: PlatformAccountsPageInstance,
  message: string,
  tone: 'success' | 'info' | 'error',
  patch: Partial<PlatformAccountsPageData> = {},
): void {
  if (page._disposed) return;
  clearInfoMessageTimer(page);
  page.setData({
    ...patch,
    infoMessage: message,
    infoTone: tone,
    managementError: tone === 'error' ? message : '',
    managementInfo: tone === 'error' ? '' : message,
  });
  scheduleInfoMessageExpiry(page, message, () => !page._disposed);
}
