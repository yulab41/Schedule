import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enableTestClientCapabilities } from './test-client-capabilities.mjs';
import { groupMobilePhoneConsentGoldenResponse } from '@schedule/client-core/testing';

const key = 'schedule.wechat.session',
  preferences = 'schedule.directory.preferences.v1:owner:group:v1';
const version = '2.0.0';
let storage, identity, pending, app;
const authenticated = (id = 'owner') => ({
  status: 'authenticated',
  token: 'new-' + id,
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
  profile: { id, realName: '合成成员', version: 1 },
});
function seed(marker = '1.0.0', authMethod = 'wechat') {
  storage.set(key, {
    ...authenticated(),
    token: 'old-token',
    authMethod,
    ...(marker === undefined ? {} : { clientVersion: marker }),
  });
  storage.set(preferences, { sort: 'name' });
}
beforeEach(async () => {
  vi.resetModules();
  storage = new Map();
  pending = [];
  app = { globalData: {} };
  vi.stubGlobal('__MINIPROGRAM_API_BASE_URL__', 'https://example.test/api');
  vi.stubGlobal('__MINIPROGRAM_BUILD_VERSION__', version);
  vi.stubGlobal('__MINIPROGRAM_BUILD_COMMIT__', 'synthetic');
  vi.stubGlobal('__MINIPROGRAM_BUILD_PROFILE__', 'production');
  vi.stubGlobal('getApp', () => app);
  vi.stubGlobal('wx', {
    getStorageSync: vi.fn((k) => storage.get(k)),
    getStorageInfoSync: () => ({ keys: [...storage.keys()] }),
    setStorageSync: vi.fn((k, v) => storage.set(k, v)),
    removeStorageSync: vi.fn((k) => storage.delete(k)),
    login: vi.fn((o) => o.success({ code: 'synthetic-fresh-code' })),
    request: vi.fn((o) => pending.push(o)),
  });
  identity = await import('../src/platform/wechat-identity.ts');
  await enableTestClientCapabilities(version);
});
afterEach(() => vi.unstubAllGlobals());

describe('new Mini build migrates only version-bound WeChat sessions', () => {
  it('rejects a delayed old 401 before it can clear a newly signed-in password account', async () => {
    seed(version);
    const { executeWxJsonRequest } = await import('../src/platform/wx-request-executor.ts');
    const request = executeWxJsonRequest({
      capability: 'core',
      url: 'https://example.test/api/groups',
      method: 'GET',
      request: (o) => globalThis.wx.request(o),
      authentication: {
        accessToken: 'old-token',
        ...identity.getWechatRequestAuthentication(),
        sessionGeneration: identity.getWechatSessionGeneration(),
      },
    });
    const rejected = expect(request).rejects.toThrow();
    await vi.waitFor(() => expect(pending).toHaveLength(1));
    identity.persistPasswordSession(authenticated('other'));
    pending[0].success({ statusCode: 401, data: { error: { code: 'AUTHENTICATION_REQUIRED' } } });
    await rejected;
    expect(storage.get(key).profile.id).toBe('other');
    expect(globalThis.wx.login).not.toHaveBeenCalled();
  });
  it.each(['success', 'failure'])(
    'does not let an old 401 recovery %s overwrite or clear a newer login',
    async (outcome) => {
      seed(version);
      const recovery = identity.recoverWechatSession('old-token');
      await vi.waitFor(() => expect(pending).toHaveLength(1));
      identity.persistPasswordSession(authenticated('other'));
      if (outcome === 'success') pending[0].success({ statusCode: 200, data: authenticated() });
      else pending[0].fail({ errMsg: 'offline' });
      await recovery;
      expect(storage.get(key).profile.id).toBe('other');
    },
  );
  it.each(['disabled', 'retired', 'pending'])(
    'preserves exact privacy status/revoke while migration is %s',
    async (mode) => {
      seed();
      expect(identity.getStoredWechatToken()).toBeUndefined();
      const store = await import('../src/app/client-capability-store.ts');
      let migration;
      if (mode === 'pending') {
        migration = identity.awaitWechatSessionRecovery();
        await vi.waitFor(() => expect(pending).toHaveLength(1));
      }
      store.configureRuntimeClientCapabilityReader(async () => {
        if (mode === 'retired') throw { status: 426, code: 'CLIENT_VERSION_UNSUPPORTED' };
        return {
          platform: 'miniprogram',
          version,
          global: false,
          core: false,
          guest: false,
          workflows: false,
          organization: false,
          insights: false,
          externalMessages: false,
        };
      }, version);
      await store.refreshClientCapabilities({ force: true });
      globalThis.wx.request.mockImplementation((o) =>
        o.success({ statusCode: 200, data: groupMobilePhoneConsentGoldenResponse }),
      );
      const { createRuntimeGroupMobilePhoneConsentClient } =
        await import('../src/platform/client-core-calendar.ts');
      const client = createRuntimeGroupMobilePhoneConsentClient(
        identity.getStoredWechatToken,
        identity.getWechatRequestAuthentication(),
      );
      const groupId = groupMobilePhoneConsentGoldenResponse.groupId;
      const input = {
        consented: false,
        expectedContactVersion: 3,
        noticeVersion: 'v1',
        operationId: 'synthetic-revoke',
      };
      await client.getStatus(groupId);
      await client.update(groupId, input);
      for (const call of globalThis.wx.request.mock.calls.slice(mode === 'pending' ? 1 : 0))
        expect(call[0].header.Authorization).toBe('Bearer old-token');
      const count = globalThis.wx.request.mock.calls.length;
      await expect(client.update(groupId, { ...input, consented: true })).rejects.toBeDefined();
      expect(globalThis.wx.request).toHaveBeenCalledTimes(count);
      expect(storage.has(preferences)).toBe(true);
      if (migration) {
        const failure = expect(migration).rejects.toThrow();
        pending[0].fail({ errMsg: 'offline' });
        await failure;
      }
      expect(globalThis.wx.login).toHaveBeenCalledTimes(mode === 'pending' ? 1 : 0);
    },
  );

  it('privacy errors retain preferences and unbind uses its own fresh code without login migration', async () => {
    seed();
    const { configureRuntimeClientCapabilityReader, refreshClientCapabilities } =
      await import('../src/app/client-capability-store.ts');
    configureRuntimeClientCapabilityReader(async () => {
      throw { status: 426, code: 'CLIENT_VERSION_UNSUPPORTED' };
    }, version);
    await refreshClientCapabilities({ force: true });
    globalThis.wx.request.mockImplementation((o) =>
      o.success({
        statusCode: 401,
        data: { error: { code: 'AUTHENTICATION_REQUIRED', message: 'synthetic' } },
      }),
    );
    await expect(identity.unbindWechatIdentity('synthetic-operation')).rejects.toThrow();
    expect(globalThis.wx.request).toHaveBeenCalledTimes(1);
    expect(globalThis.wx.request.mock.calls[0][0].url).toMatch(/\/unbind$/);
    expect(globalThis.wx.request.mock.calls[0][0].header.Authorization).toBe('Bearer old-token');
    expect(storage.has(preferences)).toBe(true);
  });
  it.each(['1.0.0', undefined])(
    'hides old business token %s, single-flights login and preserves same-owner preferences',
    async (marker) => {
      seed(marker);
      if (marker === undefined) delete storage.get(key).clientVersion;
      expect(identity.getStoredWechatToken()).toBeUndefined();
      const first = identity.awaitWechatSessionRecovery(),
        second = identity.awaitWechatSessionRecovery();
      await vi.waitFor(() => expect(pending).toHaveLength(1));
      expect(pending[0].url).toMatch(/auth\/wechat\/login$/);
      pending[0].success({ statusCode: 200, data: authenticated() });
      expect(await first).toBe('new-owner');
      expect(await second).toBe('new-owner');
      expect(storage.get(key)).toMatchObject({ clientVersion: version, token: 'new-owner' });
      expect(storage.get(preferences)).toEqual({ sort: 'name' });
    },
  );

  it('retains raw identity and settings after a network failure, then retries', async () => {
    seed();
    const attempt = identity.awaitWechatSessionRecovery();
    const failed = expect(attempt).rejects.toThrow();
    await vi.waitFor(() => expect(pending).toHaveLength(1));
    pending[0].fail({ errMsg: 'synthetic offline' });
    await failed;
    expect(storage.get(key).token).toBe('old-token');
    expect(storage.has(preferences)).toBe(true);
    expect(identity.getStoredWechatToken()).toBeUndefined();
    const retry = identity.awaitWechatSessionRecovery();
    await vi.waitFor(() => expect(pending).toHaveLength(2));
    pending[1].success({ statusCode: 200, data: authenticated() });
    expect(await retry).toBe('new-owner');
  });

  it('asks for login on link-required without repeating migration or clearing preferences', async () => {
    seed();
    const attempt = identity.awaitWechatSessionRecovery();
    await vi.waitFor(() => expect(pending).toHaveLength(1));
    pending[0].success({
      statusCode: 200,
      data: {
        status: 'link_required',
        linkToken: 'synthetic',
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      },
    });
    expect(await attempt).toBeUndefined();
    expect(identity.getStoredWechatProfile()).toBeUndefined();
    expect(await identity.awaitWechatSessionRecovery()).toBeUndefined();
    expect(pending).toHaveLength(1);
    expect(storage.has(preferences)).toBe(true);
    identity.persistWechatSession(authenticated());
    expect(storage.has(preferences)).toBe(true);
  });

  it.each(['logout', 'new-login'])(
    'does not resurrect a late migration after %s',
    async (action) => {
      seed();
      const attempt = identity.awaitWechatSessionRecovery();
      await vi.waitFor(() => expect(pending).toHaveLength(1));
      if (action === 'logout') identity.clearWechatSession(true);
      else identity.persistPasswordSession(authenticated('other'));
      pending[0].success({ statusCode: 200, data: authenticated() });
      await attempt;
      if (action === 'logout') expect(storage.has(key)).toBe(false);
      else expect(storage.get(key).profile.id).toBe('other');
    },
  );

  it('clears previous-owner private state if fresh WeChat identity is a different owner', async () => {
    seed();
    const attempt = identity.awaitWechatSessionRecovery();
    await vi.waitFor(() => expect(pending).toHaveLength(1));
    pending[0].success({ statusCode: 200, data: authenticated('other') });
    expect(await attempt).toBe('new-other');
    expect(storage.has(preferences)).toBe(false);
  });

  it('leaves current WeChat and password sessions usable without a new login', async () => {
    for (const [marker, method] of [
      [version, 'wechat'],
      ['1.0.0', 'password'],
    ]) {
      seed(marker, method);
      expect(identity.getStoredWechatToken()).toBe('old-token');
      await identity.awaitWechatSessionRecovery();
      expect(pending).toHaveLength(0);
    }
  });

  it('shares an upgrade flight across bundled entry points', async () => {
    seed();
    const first = identity.awaitWechatSessionRecovery();
    await vi.waitFor(() => expect(pending).toHaveLength(1));
    vi.resetModules();
    const otherBundle = await import('../src/platform/wechat-identity.ts');
    const second = otherBundle.awaitWechatSessionRecovery();
    pending[0].success({ statusCode: 200, data: authenticated() });
    expect(await first).toBe('new-owner');
    expect(await second).toBe('new-owner');
    expect(pending).toHaveLength(1);
  });
});
