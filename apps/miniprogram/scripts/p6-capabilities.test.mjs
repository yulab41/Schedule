import { readFileSync } from 'node:fs';

import { groupMobilePhoneConsentGoldenResponse } from '@schedule/client-core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const BUILD_VERSION = '0.1.0-p6.20260824.79';
const enabledCapabilities = Object.freeze({
  core: true,
  externalMessages: false,
  global: true,
  guest: false,
  insights: false,
  organization: false,
  platform: 'miniprogram',
  version: BUILD_VERSION,
  workflows: false,
});

function stubBuildGlobals() {
  vi.stubGlobal('__MINIPROGRAM_API_BASE_URL__', 'https://example.test/api');
  vi.stubGlobal('__MINIPROGRAM_BUILD_COMMIT__', '0123456789abcdef');
  vi.stubGlobal('__MINIPROGRAM_BUILD_PROFILE__', 'production');
  vi.stubGlobal('__MINIPROGRAM_BUILD_VERSION__', BUILD_VERSION);
}

function createSessionStorage() {
  const storage = new Map([
    [
      'schedule.wechat.session',
      {
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        profile: { id: 'user-1', realName: '测试成员', version: 1 },
        token: 'mini-token',
      },
    ],
  ]);
  return {
    getStorageInfoSync: vi.fn(() => ({ keys: [...storage.keys()] })),
    getStorageSync: vi.fn((key) => storage.get(key)),
    removeStorageSync: vi.fn((key) => storage.delete(key)),
    setStorageSync: vi.fn((key, value) => storage.set(key, value)),
    storage,
  };
}

async function seedRuntimeCapabilities(response) {
  const store = await import('../src/app/client-capability-store.ts');
  store.configureRuntimeClientCapabilityReader(() => Promise.resolve(response));
  await store.refreshClientCapabilities({ force: true });
  return store;
}

describe('P6-B Mini capability bootstrap and guards', () => {
  beforeEach(() => {
    vi.resetModules();
    stubBuildGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps seven-dimensional capability state in memory, single-flights reads, and refreshes on demand', async () => {
    const { createClientCapabilityStore } = await import('../src/app/client-capability-store.ts');
    let resolveRead;
    const read = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveRead = resolve;
        }),
    );
    const storage = createSessionStorage();
    vi.stubGlobal('wx', storage);
    const store = createClientCapabilityStore({
      platform: 'miniprogram',
      read,
      version: BUILD_VERSION,
    });

    const first = store.refresh({ force: true });
    const concurrent = store.refresh({ force: true });
    await Promise.resolve();
    expect(read).toHaveBeenCalledTimes(1);
    resolveRead(enabledCapabilities);
    await expect(Promise.all([first, concurrent])).resolves.toEqual([
      enabledCapabilities,
      enabledCapabilities,
    ]);
    expect(store.isEnabled('core')).toBe(true);
    expect(store.isEnabled('unknown-capability')).toBe(false);
    expect(storage.getStorageSync).not.toHaveBeenCalled();
    expect(storage.setStorageSync).not.toHaveBeenCalled();

    read.mockResolvedValueOnce({ ...enabledCapabilities, core: false });
    await expect(store.refresh({ force: true })).resolves.toMatchObject({ core: false });
    expect(read).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['network', () => Promise.reject(new Error('offline'))],
    ['404', () => Promise.reject(Object.assign(new Error('missing'), { status: 404 }))],
    ['invalid', () => Promise.resolve({ ...enabledCapabilities, core: 'yes' })],
    ['wrong-version', () => Promise.resolve({ ...enabledCapabilities, version: '0.1.0-other.1' })],
  ])('fails closed for %s capability results', async (_label, read) => {
    const { createClientCapabilityStore } = await import('../src/app/client-capability-store.ts');
    const store = createClientCapabilityStore({
      platform: 'miniprogram',
      read,
      version: BUILD_VERSION,
    });

    await expect(store.refresh({ force: true })).resolves.toMatchObject({
      core: false,
      externalMessages: false,
      global: false,
      guest: false,
      insights: false,
      organization: false,
      workflows: false,
    });
    await expect(store.require('core')).rejects.toMatchObject({
      code: 'CLIENT_CAPABILITY_DISABLED',
    });
  });

  it('adds the signed build identity headers to every request and blocks disabled modules before wx.request', async () => {
    const request = vi.fn((options) => options.success({ data: { ok: true }, statusCode: 200 }));
    vi.stubGlobal('wx', { request });
    const { executeWxJsonRequest } = await import('../src/platform/wx-request-executor.ts');

    await executeWxJsonRequest({
      capability: 'bypass',
      method: 'GET',
      request: (options) => globalThis.wx.request(options),
      url: 'https://example.test/api/client-capabilities',
    });
    expect(request.mock.calls[0]?.[0].header).toMatchObject({
      'X-Schedule-Client-Platform': 'miniprogram',
      'X-Schedule-Client-Version': BUILD_VERSION,
    });

    const store = await seedRuntimeCapabilities({ ...enabledCapabilities, core: false });
    request.mockClear();
    await expect(
      executeWxJsonRequest({
        capability: 'core',
        method: 'GET',
        request: (options) => globalThis.wx.request(options),
        url: 'https://example.test/api/groups',
      }),
    ).rejects.toBeInstanceOf(store.ClientCapabilityDisabledError);
    expect(request).not.toHaveBeenCalled();
  });

  it('waits for an in-flight foreground refresh before allowing a previously enabled request', async () => {
    let resolveForeground;
    const read = vi
      .fn()
      .mockResolvedValueOnce(enabledCapabilities)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveForeground = resolve;
          }),
      );
    const store = await import('../src/app/client-capability-store.ts');
    store.configureRuntimeClientCapabilityReader(read, BUILD_VERSION);
    await store.refreshClientCapabilities({ force: true });

    const foreground = store.refreshClientCapabilities({ force: true });
    const request = vi.fn((options) => options.success({ data: { ok: true }, statusCode: 200 }));
    vi.stubGlobal('wx', { request });
    const { executeWxJsonRequest } = await import('../src/platform/wx-request-executor.ts');
    const guardedRequest = executeWxJsonRequest({
      capability: 'core',
      method: 'GET',
      request: (options) => globalThis.wx.request(options),
      url: 'https://example.test/api/groups',
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(request).not.toHaveBeenCalled();

    resolveForeground({ ...enabledCapabilities, core: false });
    await foreground;
    await expect(guardedRequest).rejects.toMatchObject({
      code: 'CLIENT_CAPABILITY_DISABLED',
    });
    expect(request).not.toHaveBeenCalled();
  });

  it('uses the App memory store across independently bundled page entrypoints', async () => {
    const store = await import('../src/app/client-capability-store.ts');
    const appStore = store.createClientCapabilityStore({
      platform: 'miniprogram',
      read: () => Promise.resolve(enabledCapabilities),
      version: BUILD_VERSION,
    });
    await appStore.refresh({ force: true });
    store.configureRuntimeClientCapabilityReader(
      () => Promise.resolve({ ...enabledCapabilities, core: false }),
      BUILD_VERSION,
    );
    await store.refreshClientCapabilities({ force: true });
    vi.stubGlobal('getApp', () => ({ globalData: { clientCapabilityStore: appStore } }));
    const request = vi.fn((options) => options.success({ data: { ok: true }, statusCode: 200 }));
    vi.stubGlobal('wx', { request });
    const { executeWxJsonRequest } = await import('../src/platform/wx-request-executor.ts');

    await expect(
      executeWxJsonRequest({
        capability: 'core',
        method: 'GET',
        request: (options) => globalThis.wx.request(options),
        url: 'https://example.test/api/groups',
      }),
    ).resolves.toMatchObject({ statusCode: 200 });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('bootstraps on launch, shares the launch/show flight, and forces the next foreground refresh', async () => {
    let appDefinition;
    const pending = [];
    const request = vi.fn((options) => {
      pending.push(options.success);
    });
    const storage = createSessionStorage();
    vi.stubGlobal('App', (definition) => {
      appDefinition = definition;
    });
    vi.stubGlobal('wx', { ...storage, request });
    await import('../src/app.ts');
    vi.stubGlobal('getApp', () => appDefinition);

    expect(appDefinition.globalData.clientCapabilityStore).toBeDefined();
    appDefinition.onLaunch();
    appDefinition.onShow();
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    expect(request.mock.calls[0]?.[0]).toMatchObject({
      header: {
        'X-Schedule-Client-Platform': 'miniprogram',
        'X-Schedule-Client-Version': BUILD_VERSION,
      },
      method: 'GET',
      url: `https://example.test/api/client-capabilities?platform=miniprogram&version=${BUILD_VERSION}`,
    });
    pending.shift()({ data: enabledCapabilities, statusCode: 200 });
    const store = await import('../src/app/client-capability-store.ts');
    await vi.waitFor(() => expect(store.getClientCapabilitySnapshot().core).toBe(true));

    appDefinition.onShow();
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    pending.shift()({ data: { ...enabledCapabilities, core: false }, statusCode: 200 });
  });

  it('keeps unbind and phone status/revoke available while core is disabled, but blocks phone grant', async () => {
    const storage = createSessionStorage();
    const request = vi.fn((options) => {
      if (options.url.endsWith('/me/wechat/miniprogram/unbind')) {
        options.success({ data: { unbound: true }, statusCode: 200 });
        return;
      }
      options.success({ data: groupMobilePhoneConsentGoldenResponse, statusCode: 200 });
    });
    vi.stubGlobal('wx', {
      ...storage,
      login: vi.fn((options) => options.success({ code: 'fresh-code' })),
      request,
    });
    const identity = await import('../src/platform/wechat-identity.ts');
    const clients = await import('../src/platform/client-core-calendar.ts');
    await seedRuntimeCapabilities({ ...enabledCapabilities, core: false, global: false });

    await expect(identity.unbindWechatIdentity('operation-unbind')).resolves.toEqual({
      unbound: true,
    });
    identity.persistWechatSession({
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      profile: { id: 'user-1', realName: '测试成员', version: 1 },
      status: 'authenticated',
      token: 'mini-token',
    });
    const consentClient = clients.createRuntimeGroupMobilePhoneConsentClient(
      identity.getStoredWechatToken,
      identity.getWechatRequestAuthentication(),
    );
    const groupId = groupMobilePhoneConsentGoldenResponse.groupId;
    const revoke = {
      consented: false,
      expectedContactVersion: 3,
      noticeVersion: 'v1',
      operationId: 'operation-revoke',
    };
    await expect(consentClient.getStatus(groupId)).resolves.toEqual(
      groupMobilePhoneConsentGoldenResponse,
    );
    await expect(consentClient.update(groupId, revoke)).resolves.toEqual(
      groupMobilePhoneConsentGoldenResponse,
    );
    const requestCount = request.mock.calls.length;
    await expect(
      consentClient.update(groupId, { ...revoke, consented: true, operationId: 'operation-grant' }),
    ).rejects.toMatchObject({ code: 'CLIENT_CAPABILITY_DISABLED' });
    expect(request).toHaveBeenCalledTimes(requestCount);
  });

  it('preserves the capability-disabled error when shutdown lands after wx.login starts', async () => {
    let finishLogin;
    const request = vi.fn();
    const storage = createSessionStorage();
    vi.stubGlobal('wx', {
      ...storage,
      login: vi.fn((options) => {
        finishLogin = options.success;
      }),
      request,
    });
    const identity = await import('../src/platform/wechat-identity.ts');
    const store = await seedRuntimeCapabilities(enabledCapabilities);
    const pendingLogin = identity.loginWithWechat();
    await vi.waitFor(() => expect(finishLogin).toBeTypeOf('function'));

    store.configureRuntimeClientCapabilityReader(
      () => Promise.resolve({ ...enabledCapabilities, core: false }),
      BUILD_VERSION,
    );
    await store.refreshClientCapabilities({ force: true });
    finishLogin({ code: 'fresh-code' });

    await expect(pendingLogin).rejects.toBeInstanceOf(store.ClientCapabilityDisabledError);
    expect(request).not.toHaveBeenCalled();
  });

  it('sends the build headers on login, password link, registration, admin preview, and confirm', async () => {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const authenticated = {
      expiresAt,
      profile: { id: 'user-1', realName: '测试成员', version: 1 },
      status: 'authenticated',
      token: 'mini-token',
    };
    const requests = [];
    const storage = createSessionStorage();
    vi.stubGlobal('wx', {
      ...storage,
      login: vi.fn((options) => options.success({ code: 'fresh-code' })),
      request: vi.fn((options) => {
        requests.push(options);
        if (options.url.endsWith('/auth/wechat/login')) {
          options.success({
            data: { expiresAt, linkToken: 'link-token', status: 'link_required' },
            statusCode: 200,
          });
          return;
        }
        if (options.url.endsWith('/auth/wechat/admin-bind/preview')) {
          options.success({
            data: {
              expiresAt,
              realNameMasked: '林**',
              usernameMasked: 'li***',
            },
            statusCode: 200,
          });
          return;
        }
        options.success({ data: authenticated, statusCode: 200 });
      }),
    });
    const identity = await import('../src/platform/wechat-identity.ts');
    await seedRuntimeCapabilities(enabledCapabilities);

    await identity.loginWithWechat();
    await identity.linkWechatPassword('link-token', 'lin', 'secret');
    await identity.registerWechat('link-token', '林医生');
    await identity.previewAdminBinding('binding-ticket');
    await identity.confirmAdminBinding('binding-ticket');

    expect(requests.map((options) => new URL(options.url).pathname)).toEqual([
      '/api/auth/wechat/login',
      '/api/auth/wechat/link-password',
      '/api/auth/wechat/register',
      '/api/auth/wechat/admin-bind/preview',
      '/api/auth/wechat/admin-bind/confirm',
    ]);
    for (const options of requests) {
      expect(options.header).toMatchObject({
        'X-Schedule-Client-Platform': 'miniprogram',
        'X-Schedule-Client-Version': BUILD_VERSION,
      });
    }
  });

  it('guards every current core deep-link page on load and show without changing its visual shell', () => {
    const pageSources = [
      'pages/identity/index.ts',
      'pages/admin-bind/preview.ts',
      'pages/workbench/index.ts',
      'subpackages/scheduling/pages/manual/index.ts',
      'subpackages/scheduling/pages/backfill/index.ts',
      'subpackages/organization/components/group-settings-panel/controller.ts',
    ].map((relativePath) => readSource(relativePath));

    for (const source of pageSources) {
      expect(source).toContain('requireClientCapability');
      expect(source).toMatch(/onLoad\s*\(/u);
      expect(source).toMatch(/onShow\s*\(/u);
      expect(source).toContain('ClientCapabilityDisabledError');
    }
  });

  it('fails closed for current core deep links and login actions without issuing business requests', async () => {
    const definitions = [];
    const request = vi.fn();
    const login = vi.fn();
    const storage = createSessionStorage();
    vi.stubGlobal('Page', (definition) => definitions.push(definition));
    vi.stubGlobal('wx', {
      ...storage,
      getMenuButtonBoundingClientRect: () => ({
        bottom: 56,
        height: 32,
        left: 300,
        right: 380,
        top: 24,
        width: 80,
      }),
      getWindowInfo: () => ({ statusBarHeight: 24, windowHeight: 844, windowWidth: 390 }),
      login,
      navigateBack: vi.fn(),
      navigateTo: vi.fn(),
      request,
    });
    await import('../src/pages/identity/index.ts');
    await import('../src/pages/admin-bind/preview.ts');
    await import('../src/pages/workbench/index.ts');
    await import('../src/subpackages/scheduling/pages/manual/index.ts');
    await import('../src/subpackages/scheduling/pages/backfill/index.ts');
    const { createGroupSettingsPanelControllerDefinition } =
      await import('../src/subpackages/organization/components/group-settings-panel/controller.ts');
    definitions.push(createGroupSettingsPanelControllerDefinition(false));
    await seedRuntimeCapabilities({ ...enabledCapabilities, core: false, global: false });

    const instances = definitions.map(createPageInstance);
    definitions[0].onLoad.call(instances[0]);
    definitions[0].onShow.call(instances[0]);
    definitions[1].onLoad.call(instances[1], { ticket: 'binding-ticket' });
    definitions[1].onShow.call(instances[1]);
    definitions[2].onLoad.call(instances[2]);
    definitions[2].onShow.call(instances[2]);
    definitions[3].onLoad.call(instances[3]);
    definitions[3].onShow.call(instances[3]);
    definitions[4].onLoad.call(instances[4], {});
    definitions[4].onShow.call(instances[4]);
    definitions[5].onLoad.call(instances[5], { groupId: 'group-1' });
    definitions[5].onShow.call(instances[5]);

    await vi.waitFor(() => {
      expect(instances[0].data.errorMessage).toContain('已暂停');
      expect(instances[1].data.mode).toBe('error');
      for (const instance of instances.slice(2)) expect(instance.data.state).toBe('error');
    });
    definitions[0].handleWechatLogin.call(instances[0]);
    await vi.waitFor(() => expect(instances[0].data.loading).toBe(false));
    expect(login).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();

    await seedRuntimeCapabilities(enabledCapabilities);
    definitions[2].onShow.call(instances[2]);
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));
  });

  it('invalidates an in-flight manual-page load when a foreground capability refresh disables core', () => {
    const source = readSource('subpackages/scheduling/pages/manual/index.ts');

    expect(source).toContain('const serial = ++page._loadSerial');
    expect(source).toContain('if (serial !== page._loadSerial) return;');
    expect(source).toMatch(/function setManualCapabilityError[\s\S]*page\._loadSerial \+= 1;/u);
  });

  it('does not persist capability payloads or create a second visual system', () => {
    const source = readSource('app/client-capability-store.ts');
    expect(source).not.toMatch(/getStorage|setStorage|removeStorage|localStorage|sessionStorage/u);
    expect(source).not.toMatch(/\bwindow\b|\bdocument\b|from ['"]node:/u);
  });
});

function readSource(relativePath) {
  return readFileSync(new URL(`../src/${relativePath}`, import.meta.url), 'utf8');
}

function createPageInstance(definition) {
  const instance = {
    ...definition,
    data: { ...definition.data },
  };
  instance.setData = (patch, callback) => {
    Object.assign(instance.data, patch);
    callback?.();
  };
  return instance;
}
