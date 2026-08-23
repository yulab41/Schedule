import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { calendarApiGoldenResponse, holidayApiGoldenResponse } from '@schedule/client-core/testing';
import { enableTestClientCapabilities } from './test-client-capabilities.mjs';

const DAY = 24 * 60 * 60 * 1000;

function createStorageWx(initial = {}) {
  const storage = new Map(Object.entries(initial));
  return {
    getStorageInfoSync: vi.fn(() => ({ keys: [...storage.keys()] })),
    getStorageSync: vi.fn((key) => storage.get(key)),
    removeStorageSync: vi.fn((key) => storage.delete(key)),
    setStorageSync: vi.fn((key, value) => storage.set(key, value)),
    storage,
  };
}

async function importRuntime() {
  vi.stubGlobal('__MINIPROGRAM_API_BASE_URL__', 'https://example.test/api');
  vi.stubGlobal('__MINIPROGRAM_BUILD_PROFILE__', 'production');
  const modules = await Promise.all([
    import('../src/platform/wechat-identity.ts'),
    import('../src/platform/workbench-read.ts'),
    import('../src/platform/client-core-calendar.ts'),
  ]);
  await enableTestClientCapabilities();
  return modules;
}

describe('P6-A session, transport and private cache runtime', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects expired, malformed, future-overlong sessions and deletes private state', async () => {
    const now = Date.parse('2026-08-24T00:00:00.000Z');
    const cases = [
      { expiresAt: '2026-08-24T00:00:00.000Z', profile: profile('user-1'), token: 'expired' },
      { expiresAt: 'not-a-date', profile: profile('user-1'), token: 'broken' },
      { expiresAt: '2026-09-01', profile: profile('user-1'), token: 'date-only' },
      { expiresAt: '2026-09-01T08:00:00.000+08:00', profile: profile('user-1'), token: 'offset' },
      {
        expiresAt: new Date(now + 31 * DAY + 1).toISOString(),
        profile: profile('user-1'),
        token: 'overlong',
      },
    ];

    for (const value of cases) {
      const storageWx = createStorageWx({
        'schedule.wechat.session': value,
        'schedule.wechat.workbench.cache.v2:user-1:group-1:2026-08': { private: true },
        'schedule.wechat.workbench.current-group': { groupId: 'group-1', ownerId: 'user-1' },
      });
      vi.stubGlobal('wx', storageWx);
      const [identity] = await importRuntime();

      expect(identity.getStoredWechatToken(now)).toBeUndefined();
      expect(storageWx.storage.has('schedule.wechat.session')).toBe(false);
      expect(
        [...storageWx.storage.keys()].some((key) => key.includes('schedule.wechat.workbench')),
      ).toBe(false);
      vi.resetModules();
    }
  });

  it('keeps same-user cache while clearing every private cache before a cross-user session write', async () => {
    const now = Date.now();
    const storageWx = createStorageWx({
      'schedule.wechat.session': session('user-1', now),
      'schedule.wechat.workbench.cache.v2:user-1:group-1:2026-08': { private: true },
      'schedule.wechat.workbench.current-group': { groupId: 'group-1', ownerId: 'user-1' },
    });
    vi.stubGlobal('wx', storageWx);
    const [identity] = await importRuntime();

    identity.persistWechatSession(authenticated('user-1', now));
    expect(storageWx.storage.has('schedule.wechat.workbench.cache.v2:user-1:group-1:2026-08')).toBe(
      true,
    );

    identity.persistWechatSession(authenticated('user-2', now));
    expect(
      [...storageWx.storage.keys()].filter((key) => key.includes('schedule.wechat.workbench')),
    ).toEqual([]);
    expect(identity.getStoredWechatProfile(now)?.id).toBe('user-2');
  });

  it('coordinates 64 concurrent and later stale-token 401s through one wx.login', async () => {
    const now = Date.now();
    const storageWx = createStorageWx({ 'schedule.wechat.session': session('user-1', now, 'old') });
    let loginSuccess;
    const wxLogin = vi.fn((options) => {
      loginSuccess = options.success;
    });
    const request = vi.fn((options) => {
      if (options.url.endsWith('/auth/wechat/login')) {
        options.success({ data: authenticated('user-1', now, 'fresh'), statusCode: 200 });
        return;
      }
      if (options.header.Authorization === 'Bearer old') {
        options.success({ data: {}, statusCode: 401 });
        return;
      }
      options.success({ data: holidayApiGoldenResponse, statusCode: 200 });
    });
    vi.stubGlobal('wx', { ...storageWx, login: wxLogin, request });
    const [identity, , transportModule] = await importRuntime();
    const client = transportModule.createRuntimeCalendarReadClient(
      identity.getStoredWechatToken,
      identity.getWechatRequestAuthentication(),
    );

    const pending = Array.from({ length: 64 }, () => client.getHolidays(2026));
    await vi.waitFor(() => expect(wxLogin).toHaveBeenCalledTimes(1));
    loginSuccess({ code: 'fresh-code' });
    await expect(Promise.all(pending)).resolves.toHaveLength(64);
    expect(wxLogin).toHaveBeenCalledTimes(1);
    expect(
      request.mock.calls.filter(([options]) => options.url.endsWith('/auth/wechat/login')),
    ).toHaveLength(1);
    await expect(identity.recoverWechatSession('old')).resolves.toBe('fresh');
    expect(wxLogin).toHaveBeenCalledTimes(1);
  });

  it('clears session and private cache when silent login needs linking or final replay is 401', async () => {
    const now = Date.now();
    for (const mode of ['link-required', 'final-401']) {
      const storageWx = createStorageWx({
        'schedule.wechat.session': session('user-1', now, 'old'),
        'schedule.wechat.workbench.cache.v2:user-1:group-1:2026-08': { private: true },
      });
      const request = vi.fn((options) => {
        if (options.url.endsWith('/auth/wechat/login')) {
          options.success({
            data:
              mode === 'link-required'
                ? {
                    expiresAt: new Date(now + 10 * 60_000).toISOString(),
                    linkToken: 'link-token',
                    status: 'link_required',
                  }
                : authenticated('user-1', now, 'fresh'),
            statusCode: 200,
          });
          return;
        }
        options.success({ data: {}, statusCode: 401 });
      });
      vi.stubGlobal('wx', {
        ...storageWx,
        login: vi.fn((options) => options.success({ code: 'code' })),
        request,
      });
      const [identity, , transportModule] = await importRuntime();
      const client = transportModule.createRuntimeCalendarReadClient(
        identity.getStoredWechatToken,
        identity.getWechatRequestAuthentication(),
      );

      await expect(client.getHolidays(2026)).rejects.toMatchObject({ status: 401 });
      expect(storageWx.storage.has('schedule.wechat.session')).toBe(false);
      expect(
        [...storageWx.storage.keys()].some((key) => key.includes('schedule.wechat.workbench')),
      ).toBe(false);
      vi.resetModules();
    }
  });

  it('clears session, selected group and caches immediately after successful unbind', async () => {
    const now = Date.now();
    const storageWx = createStorageWx({
      'schedule.wechat.session': session('user-1', now),
      'schedule.wechat.workbench.cache.v2:user-1:group-1:2026-08': { private: true },
      'schedule.wechat.workbench.current-group': { groupId: 'group-1', ownerId: 'user-1' },
    });
    vi.stubGlobal('wx', {
      ...storageWx,
      login: vi.fn((options) => options.success({ code: 'unbind-code' })),
      request: vi.fn((options) => options.success({ data: { unbound: true }, statusCode: 200 })),
    });
    const [identity] = await importRuntime();

    await expect(identity.unbindWechatIdentity('operation-1')).resolves.toEqual({ unbound: true });
    expect([...storageWx.storage.keys()]).toEqual([]);
  });

  it('does not reinterpret a failed fresh-code proof as a bearer 401', async () => {
    const now = Date.now();
    const storageWx = createStorageWx({ 'schedule.wechat.session': session('user-1', now) });
    const login = vi.fn((options) => options.success({ code: 'fresh-proof-code' }));
    const request = vi.fn((options) =>
      options.success({
        data: {
          error: {
            code: 'WECHAT_LOGIN_FAILED',
            message: '微信 code 无效。',
            requestId: 'request-1',
          },
        },
        statusCode: 401,
      }),
    );
    vi.stubGlobal('wx', { ...storageWx, login, request });
    const [identity] = await importRuntime();

    await expect(identity.unbindWechatIdentity('operation-1')).rejects.toMatchObject({
      code: 'WECHAT_LOGIN_FAILED',
    });
    expect(login).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledTimes(1);
    expect(identity.getStoredWechatToken()).toBe('token-user-1');
  });

  it('keeps an invalidated session failed closed when physical storage removal throws', async () => {
    const now = Date.now();
    const storageWx = createStorageWx({ 'schedule.wechat.session': session('user-1', now) });
    storageWx.removeStorageSync.mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    vi.stubGlobal('wx', storageWx);
    const [identity] = await importRuntime();

    identity.clearWechatSession(true);
    expect(storageWx.storage.has('schedule.wechat.session')).toBe(true);
    expect(identity.getStoredWechatToken()).toBeUndefined();
  });

  it('rejects a successful response from an obsolete session generation', async () => {
    const now = Date.now();
    const storageWx = createStorageWx({ 'schedule.wechat.session': session('user-1', now, 'old') });
    let completeRequest;
    vi.stubGlobal('wx', {
      ...storageWx,
      login: vi.fn(),
      request: vi.fn((options) => {
        completeRequest = options.success;
      }),
    });
    const [identity, , transportModule] = await importRuntime();
    const client = transportModule.createRuntimeCalendarReadClient(
      identity.getStoredWechatToken,
      identity.getWechatRequestAuthentication(),
    );

    const pending = client.getHolidays(2026);
    await vi.waitFor(() => expect(completeRequest).toBeTypeOf('function'));
    identity.persistWechatSession(authenticated('user-2', now, 'new'));
    completeRequest({ data: holidayApiGoldenResponse, statusCode: 200 });
    await expect(pending).rejects.toMatchObject({ code: 'AUTHENTICATION_REQUIRED', status: 401 });
    expect(identity.getStoredWechatToken()).toBe('new');
  });

  it('uses owner-scoped v2 caches, removes unsafe entries, and prunes departed groups', async () => {
    const now = Date.parse('2026-08-24T00:00:00.000Z');
    const storageWx = createStorageWx();
    vi.stubGlobal('wx', storageWx);
    const [, workbench] = await importRuntime();

    workbench.writeWorkbenchCache(
      'user-1',
      'group-1',
      '2026-08',
      calendarApiGoldenResponse,
      holidayApiGoldenResponse,
      now,
    );
    const key = workbench.getWorkbenchCacheKey('user-1', 'group-1', '2026-08');
    expect(key).toContain('cache.v2:user-1:group-1:2026-08');
    expect(storageWx.storage.get(key).calendar.members[0]).not.toHaveProperty('mobilePhone');
    expect(
      workbench.readWorkbenchCache('user-1', 'group-1', '2026-08', now + DAY - 1),
    ).toBeDefined();
    expect(
      workbench.readWorkbenchCache('user-2', 'group-1', '2026-08', now + DAY - 1),
    ).toBeUndefined();

    expect(workbench.readWorkbenchCache('user-1', 'group-1', '2026-08', now + DAY)).toBeUndefined();
    expect(storageWx.storage.has(key)).toBe(false);

    storageWx.storage.set(key, { calendar: {}, holidays: {}, savedAt: now + 1 });
    expect(workbench.readWorkbenchCache('user-1', 'group-1', '2026-08', now)).toBeUndefined();
    expect(storageWx.storage.has(key)).toBe(false);

    storageWx.storage.set(key, 'corrupt');
    expect(workbench.readWorkbenchCache('user-1', 'group-1', '2026-08', now)).toBeUndefined();
    expect(storageWx.storage.has(key)).toBe(false);

    storageWx.setStorageSync.mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    expect(() =>
      workbench.writeWorkbenchCache(
        'user-1',
        'group-1',
        '2026-08',
        calendarApiGoldenResponse,
        holidayApiGoldenResponse,
        now,
      ),
    ).not.toThrow();
    storageWx.setStorageSync.mockImplementation((storageKey, value) =>
      storageWx.storage.set(storageKey, value),
    );

    workbench.writeWorkbenchCache(
      'user-1',
      'group-1',
      '2026-08',
      calendarApiGoldenResponse,
      holidayApiGoldenResponse,
      now,
    );
    workbench.writeWorkbenchCache(
      'user-1',
      'group-2',
      '2026-08',
      { ...calendarApiGoldenResponse, groupId: 'group-2' },
      holidayApiGoldenResponse,
      now,
    );
    workbench.pruneWorkbenchCaches('user-1', new Set(['group-2']));
    expect(
      storageWx.storage.has(workbench.getWorkbenchCacheKey('user-1', 'group-1', '2026-08')),
    ).toBe(false);
    expect(
      storageWx.storage.has(workbench.getWorkbenchCacheKey('user-1', 'group-2', '2026-08')),
    ).toBe(true);
  });

  it('stores a 24-hour owner-scoped group snapshot for true offline cold start', async () => {
    const now = Date.parse('2026-08-24T00:00:00.000Z');
    const storageWx = createStorageWx();
    vi.stubGlobal('wx', storageWx);
    const [, workbench] = await importRuntime();
    const groups = [
      { groupCode: '2608', id: 'group-1', name: '急诊科', role: 'member', version: 1 },
      { id: 'group-2', name: '手术室', role: 'owner', version: 2 },
    ];
    const sanitizedGroups = [
      { id: 'group-1', name: '急诊科', role: 'member', version: 1 },
      { id: 'group-2', name: '手术室', role: 'owner', version: 2 },
    ];

    workbench.writeWorkbenchGroupSnapshot('user-1', groups, now);
    expect(workbench.readWorkbenchGroupSnapshot('user-1', now + DAY - 1)).toEqual(sanitizedGroups);
    expect(workbench.readWorkbenchGroupSnapshot('user-2', now + DAY - 1)).toBeUndefined();
    expect(workbench.readWorkbenchGroupSnapshot('user-1', now + DAY)).toBeUndefined();
  });

  it('allows cache fallback only for network/502/503/504 and resolves active before neighbors', async () => {
    const storageWx = createStorageWx();
    vi.stubGlobal('wx', storageWx);
    const [, workbench] = await importRuntime();

    for (const error of [
      { code: 'NETWORK_ERROR' },
      { status: 502 },
      { status: 503 },
      { status: 504 },
    ]) {
      expect(workbench.canUseWorkbenchOfflineFallback(error)).toBe(true);
    }
    for (const error of [
      { code: 'AUTHENTICATION_REQUIRED', status: 401 },
      { code: 'FORBIDDEN', status: 403 },
      { code: 'SERVICE_UNAVAILABLE', status: 200 },
      { status: 500 },
    ]) {
      expect(workbench.canUseWorkbenchOfflineFallback(error)).toBe(false);
    }

    let resolveActive;
    let resolveNeighbor;
    const load = vi.fn(
      (key) =>
        new Promise((resolve) => {
          if (key === 'active') resolveActive = resolve;
          else resolveNeighbor = resolve;
        }),
    );
    const staged = workbench.loadActiveThenAdjacent(['neighbor', 'active'], 'active', load);
    resolveActive({ key: 'active' });
    await expect(staged.active).resolves.toEqual({ key: 'active' });
    let neighborsSettled = false;
    void staged.adjacent.then(() => {
      neighborsSettled = true;
    });
    await Promise.resolve();
    expect(neighborsSettled).toBe(false);
    resolveNeighbor({ key: 'neighbor' });
    await expect(staged.adjacent).resolves.toEqual([{ key: 'neighbor' }]);

    const fatal = workbench.loadActiveThenAdjacent(['active', 'forbidden'], 'active', (key) =>
      key === 'active' ? Promise.resolve({ key }) : Promise.reject({ status: 403 }),
    );
    await expect(fatal.active).resolves.toEqual({ key: 'active' });
    await expect(fatal.adjacent).rejects.toMatchObject({ status: 403 });
  });
});

function profile(id) {
  return { id, realName: `用户${id}`, version: 1 };
}

function session(id, now, token = `token-${id}`) {
  return {
    expiresAt: new Date(now + 30 * DAY).toISOString(),
    profile: profile(id),
    token,
  };
}

function authenticated(id, now, token = `token-${id}`) {
  return { ...session(id, now, token), status: 'authenticated' };
}
