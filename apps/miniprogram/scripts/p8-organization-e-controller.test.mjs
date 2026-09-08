import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enableTestClientCapabilities } from './test-client-capabilities.mjs';

const userId = '00000000-0000-4000-8000-000000000001';
let authVersion = 4;
let includeAccount = true;

describe('P8-E native platform accounts controller', () => {
  let definition;
  let requests;

  beforeEach(async () => {
    vi.resetModules();
    requests = [];
    authVersion = 4;
    includeAccount = true;
    vi.stubGlobal('__MINIPROGRAM_API_BASE_URL__', 'https://example.test/api');
    vi.stubGlobal('__MINIPROGRAM_BUILD_COMMIT__', 'test');
    vi.stubGlobal('__MINIPROGRAM_BUILD_PROFILE__', 'production');
    vi.stubGlobal('__MINIPROGRAM_BUILD_VERSION__', 'test');
    vi.stubGlobal('wx', {
      getStorageSync: vi.fn((key) => (key === 'schedule.wechat.session' ? session() : undefined)),
      getWindowInfo: () => ({ statusBarHeight: 24, windowHeight: 844, windowWidth: 390 }),
      request: vi.fn((options) => {
        requests.push(options);
        if (options.url.endsWith('/platform-admin/users/details') && options.method === 'GET') {
          options.success({ data: { users: includeAccount ? [account()] : [] }, statusCode: 200 });
          return;
        }
        if (
          options.url.endsWith(`/platform-admin/users/${userId}/password-identity`) &&
          options.method === 'PUT'
        ) {
          authVersion += 1;
          options.success({
            data: { authVersion, passwordConfigured: false, username: options.data.username },
            statusCode: 200,
          });
          return;
        }
        if (
          options.url.endsWith(
            `/platform-admin/users/${userId}/wechat-miniprogram-binding-links`,
          ) &&
          options.method === 'POST'
        ) {
          options.success({
            data: {
              authVersion,
              expiresAt: '2026-08-25T12:00:00.000Z',
              urlLink: 'https://example.test/bind/in-memory',
            },
            statusCode: 201,
          });
          return;
        }
        if (options.url.endsWith('/profile') && options.method === 'PUT') {
          options.success({ data: { accountVersion: 2, profileVersion: 2 }, statusCode: 200 });
          return;
        }
        if (options.url.endsWith('/password') && options.method === 'PUT') {
          authVersion += 1;
          options.success({ data: { authVersion, passwordConfigured: true }, statusCode: 200 });
          return;
        }
        throw new Error(`unexpected request ${options.method} ${options.url}`);
      }),
    });
    const module =
      await import('../src/subpackages/organization/components/platform-accounts-panel/controller.ts');
    definition = module.createPlatformAccountsPanelControllerDefinition();
    await enableTestClientCapabilities();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads only the platform account status fields returned by the server', async () => {
    const page = createPageInstance(definition);
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));
    expect(page.data).toMatchObject({
      accounts: [expect.objectContaining({ idLabel: '00000000…0001', passwordLabel: '待设置' })],
      canManage: true,
      organizationEnabled: true,
      totalCount: 1,
    });
  });

  it('uses authVersion and one idempotency key for username and binding writes', async () => {
    const page = await loadReadyPage(definition);
    definition.handleOpenEditor.call(page, { currentTarget: { dataset: { accountId: userId } } });
    definition.handleUsernameInput.call(page, { detail: { value: 'doctor.lin' } });
    definition.handleSaveUsername.call(page);
    await vi.waitFor(() => expect(page.data.managementInfo).toContain('用户名已保存'));
    const usernameRequest = requests.find((request) => request.method === 'PUT');
    expect(usernameRequest?.header['Idempotency-Key']).toBe(usernameRequest?.data.operationId);
    expect(usernameRequest?.data.expectedAuthVersion).toBe(4);

    definition.handleGenerateBinding.call(page);
    await vi.waitFor(() => expect(page.data.bindingUrl).toContain('in-memory'));
    const bindingRequest = requests.find((request) => request.method === 'POST');
    expect(bindingRequest?.header['Idempotency-Key']).toBe(bindingRequest?.data.operationId);
    expect(bindingRequest?.data.expectedAuthVersion).toBe(5);
    expect(page.data).not.toHaveProperty('bindingTicket');
  });

  it('clears the editor and secret when the selected account disappears', async () => {
    const page = await loadReadyPage(definition);
    definition.handleOpenEditor.call(page, { currentTarget: { dataset: { accountId: userId } } });
    definition.handlePasswordInput.call(page, { detail: { value: 'discarded-secret' } });
    includeAccount = false;
    definition.handleRefresh.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));
    expect(page.data).toMatchObject({
      editorOpen: false,
      newPasswordDraft: '',
      realNameDraft: '',
      mobilePhoneDraft: '',
    });
    expect(page._selectedAccount).toBeUndefined();
  });

  it('saves global profile details and clears password input without retaining it in operation keys', async () => {
    const page = await loadReadyPage(definition);
    definition.handleOpenEditor.call(page, { currentTarget: { dataset: { accountId: userId } } });
    definition.handleRealNameInput.call(page, { detail: { value: '医生甲' } });
    definition.handleMobilePhoneInput.call(page, { detail: { value: '13800001111' } });
    definition.handleSaveProfile.call(page);
    await vi.waitFor(() => expect(page.data.managementInfo).toContain('所有群组'));
    const profile = requests.find((request) => request.url.endsWith('/profile'));
    expect(profile.data).toMatchObject({
      expectedAccountVersion: 1,
      expectedProfileVersion: 1,
      realName: '医生甲',
      mobilePhone: '13800001111',
    });
    await vi.waitFor(() => expect(page.data.managementState).toBe('ready'));
    definition.handlePasswordInput.call(page, { detail: { value: 'new-synthetic-password' } });
    definition.handleSavePassword.call(page);
    await vi.waitFor(() => expect(page.data.managementInfo).toContain('旧登录已失效'));
    expect(page.data.newPasswordDraft).toBe('');
    expect([...page._operationIds.keys()].join()).not.toContain('new-synthetic-password');
    definition.handlePasswordInput.call(page, { detail: { value: 'discard-on-hide' } });
    definition.handleSecretCleanup.call(page);
    expect(page.data.newPasswordDraft).toBe('');
  });
});

async function loadReadyPage(controller) {
  const page = createPageInstance(controller);
  controller.lifetimes.attached.call(page);
  await vi.waitFor(() => expect(page.data.state).toBe('ready'));
  return page;
}

function createPageInstance(controller) {
  const page = {
    data: { ...controller.data },
    setData(patch) {
      this.data = { ...this.data, ...patch };
    },
  };
  return page;
}

function account() {
  return {
    authVersion,
    hasPassword: false,
    id: userId,
    status: 'active',
    accountVersion: 1,
    profileVersion: 1,
    realName: '医生甲',
    accountKind: 'password',
  };
}

function session() {
  return {
    clientVersion: 'test',
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    profile: { id: 'admin-1', realName: '平台管理员', version: 1 },
    token: 'session-token',
  };
}
