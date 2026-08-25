import {
  ClientCoreError,
  type OrganizationReadClient,
  type PlatformIdentityWriteClient,
} from '@schedule/client-core';
import {
  ClientCapabilityDisabledError,
  getClientCapabilitySnapshot,
  requireClientCapability,
} from '../../../../app/client-capability-store.js';
import type { PlatformAdminUserAccount } from '@schedule/contracts';
import {
  createRuntimeOrganizationReadClient,
  createRuntimePlatformIdentityWriteClient,
} from '../../../../platform/client-core-calendar.js';
import {
  getStoredWechatToken,
  getWechatRequestAuthentication,
} from '../../../../platform/wechat-identity.js';

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
}

interface PlatformAccountsPageData {
  readonly state: 'error' | 'loading' | 'ready';
  readonly errorMessage: string;
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
  readonly bindingUrl: string;
  readonly bindingExpiresAt: string;
  readonly pageScrollStyle: string;
  readonly shellHeaderStyle: string;
  readonly viewportClass: string;
}

interface PlatformAccountsPageInstance {
  readonly data: PlatformAccountsPageData;
  readonly _organizationReadClient: OrganizationReadClient;
  readonly _platformIdentityWriteClient: PlatformIdentityWriteClient;
  _accounts: readonly PlatformAdminUserAccount[];
  _selectedAccount: PlatformAdminUserAccount | undefined;
  _operationIds: Map<string, string>;
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

export function createPlatformAccountsPanelControllerDefinition() {
  return {
    data: {
      state: 'loading',
      errorMessage: '',
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
      bindingUrl: '',
      bindingExpiresAt: '',
      pageScrollStyle: 'height:calc(100% - 76px);',
      shellHeaderStyle: 'height:76px;min-height:76px;padding-top:24px;',
      viewportClass: '',
    } satisfies PlatformAccountsPageData,

    _organizationReadClient: organizationReadClient,
    _platformIdentityWriteClient: platformIdentityWriteClient,
    _accounts: [],
    _selectedAccount: undefined,
    _operationIds: new Map<string, string>(),

    onLoad(this: PlatformAccountsPageInstance): void {
      const windowInfo = wx.getWindowInfo();
      const statusBarHeight = Math.max(0, windowInfo.statusBarHeight ?? 0);
      const headerHeight = statusBarHeight + 52;
      this.setData({
        pageScrollStyle: `height:calc(100% - ${headerHeight}px);`,
        shellHeaderStyle: `height:${headerHeight}px;min-height:${headerHeight}px;padding-top:${statusBarHeight}px;`,
        viewportClass: windowInfo.windowWidth <= 340 ? 'is-compact' : '',
      });
      void loadAccounts(this);
    },

    onShow(this: PlatformAccountsPageInstance): void {
      void requireClientCapability('core').catch((error: unknown) => {
        if (error instanceof ClientCapabilityDisabledError) {
          this.setData({ errorMessage: error.message, state: 'error' });
        }
      });
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
        selectedAccountLabel: shortUserId(account.id),
        usernameDraft: account.username ?? '',
        bindingUrl: '',
        bindingExpiresAt: '',
        managementError: '',
      });
    },

    handleCloseEditor(this: PlatformAccountsPageInstance): void {
      if (this.data.managementState === 'loading') return;
      this._selectedAccount = undefined;
      this.setData({ editorOpen: false, selectedAccountId: '', usernameDraft: '', bindingUrl: '' });
    },

    handleUsernameInput(this: PlatformAccountsPageInstance, event: ValueInputEvent): void {
      if (!this.data.canManage || !this.data.organizationEnabled) return;
      this.setData({ usernameDraft: readString(event) });
    },

    handleSaveUsername(this: PlatformAccountsPageInstance): void {
      void saveUsername(this);
    },

    handleGenerateBinding(this: PlatformAccountsPageInstance): void {
      void generateBinding(this);
    },
  };
}

async function loadAccounts(page: PlatformAccountsPageInstance): Promise<void> {
  page.setData({
    state: 'loading',
    errorMessage: '',
    managementError: '',
    managementState: 'loading',
  });
  try {
    await requireClientCapability('organization');
    const accounts = await page._organizationReadClient.listPlatformUserAccounts();
    page._accounts = accounts;
    const selected = page._selectedAccount;
    const selectedNext =
      selected === undefined ? undefined : accounts.find((account) => account.id === selected.id);
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
        ? {}
        : {
            selectedAccountLabel: shortUserId(selectedNext.id),
            usernameDraft: selectedNext.username ?? '',
          }),
    });
  } catch (error) {
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

async function saveUsername(page: PlatformAccountsPageInstance): Promise<void> {
  if (!(await ensureManage(page))) return;
  const account = page._selectedAccount;
  const username = page.data.usernameDraft.trim();
  if (account === undefined || username.length === 0) {
    page.setData({ managementError: '请输入用户名。', managementState: 'error' });
    return;
  }
  const key = `password-identity:${account.id}:${account.authVersion}:${username}`;
  page.setData({ managementError: '', managementInfo: '', managementState: 'loading' });
  try {
    const result = await page._platformIdentityWriteClient.assignPasswordIdentity(account.id, {
      expectedAuthVersion: account.authVersion,
      operationId: resolveOperationId(page, key),
      username,
    });
    page._operationIds.delete(key);
    page._selectedAccount = {
      ...account,
      authVersion: result.authVersion,
      hasPassword: result.passwordConfigured,
      username: result.username,
    };
    page.setData({
      managementInfo: '用户名已保存；用户可继续完成密码证明。',
      managementState: 'ready',
    });
    await loadAccounts(page);
  } catch (error) {
    page.setData({
      managementError: `${toUserMessage(error, '用户名没有保存，请稍后重试。')} 可保持当前输入重试。`,
      managementState: 'error',
    });
  }
}

async function generateBinding(page: PlatformAccountsPageInstance): Promise<void> {
  if (!(await ensureManage(page))) return;
  const account = page._selectedAccount;
  if (account === undefined) return;
  const key = `wechat-binding-link:${account.id}:${account.authVersion}`;
  page.setData({
    managementError: '',
    managementInfo: '',
    managementState: 'loading',
    bindingUrl: '',
  });
  try {
    const result = await page._platformIdentityWriteClient.createWechatBindingLink(account.id, {
      expectedAuthVersion: account.authVersion,
      operationId: resolveOperationId(page, key),
    });
    page._operationIds.delete(key);
    page.setData({
      bindingUrl: result.urlLink,
      bindingExpiresAt: formatDate(result.expiresAt),
      managementInfo: '绑定链接已生成，仅在当前页面内存中展示。',
      managementState: 'ready',
    });
  } catch (error) {
    page.setData({
      managementError: `${toUserMessage(error, '绑定链接没有生成，请稍后重试。')} 可保持当前账号重试。`,
      managementState: 'error',
    });
  }
}

async function ensureManage(page: PlatformAccountsPageInstance): Promise<boolean> {
  try {
    await requireClientCapability('organization');
    return page.data.canManage;
  } catch (error) {
    page.setData({
      managementError: error instanceof Error ? error.message : '组织管理能力暂未开放。',
      managementState: 'error',
    });
    return false;
  }
}

function toAccountCard(account: PlatformAdminUserAccount): AccountCardView {
  return {
    id: account.id,
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

function decodeGroupId(value: string | undefined): string {
  return value ?? '';
}

function toUserMessage(error: unknown, fallback: string): string {
  if (error instanceof ClientCoreError && error.message.length > 0) return error.message;
  return error instanceof Error && error.message.length > 0 ? error.message : fallback;
}
