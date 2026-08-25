import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enableTestClientCapabilities } from './test-client-capabilities.mjs';

const userId = '00000000-0000-4000-8000-000000000001';
let authVersion = 4;

describe('P8-E native platform accounts controller', () => {
  let definition;
  let requests;

  beforeEach(async () => {
    vi.resetModules();
    requests = [];
    authVersion = 4;
    vi.stubGlobal('__MINIPROGRAM_API_BASE_URL__', 'https://example.test/api');
    vi.stubGlobal('__MINIPROGRAM_BUILD_COMMIT__', 'test');
    vi.stubGlobal('__MINIPROGRAM_BUILD_PROFILE__', 'production');
    vi.stubGlobal('__MINIPROGRAM_BUILD_VERSION__', 'test');
    vi.stubGlobal('wx', {
      getStorageSync: vi.fn((key) => (key === 'schedule.wechat.session' ? session() : undefined)),
      getWindowInfo: () => ({ statusBarHeight: 24, windowHeight: 844, windowWidth: 390 }),
      request: vi.fn((options) => {
        requests.push(options);
        if (options.url.endsWith('/platform-admin/users') && options.method === 'GET') {
          options.success({ data: { users: [account()] }, statusCode: 200 });
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
    definition.onLoad.call(page);
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
});

async function loadReadyPage(controller) {
  const page = createPageInstance(controller);
  controller.onLoad.call(page);
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
  for (const [key, value] of Object.entries(controller)) if (key.startsWith('_')) page[key] = value;
  return page;
}

function account() {
  return { authVersion, hasPassword: false, id: userId, status: 'active' };
}

function session() {
  return {
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    profile: { id: 'admin-1', realName: '平台管理员', version: 1 },
    token: 'session-token',
  };
}
