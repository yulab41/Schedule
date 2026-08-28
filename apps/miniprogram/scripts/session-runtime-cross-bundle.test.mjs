import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const DAY = 24 * 60 * 60 * 1_000;

describe('Mini session runtime across bundled entry points', () => {
  let app;
  let storage;

  beforeEach(() => {
    vi.resetModules();
    app = { globalData: {} };
    storage = new Map();
    vi.stubGlobal('__MINIPROGRAM_API_BASE_URL__', 'https://example.test/api');
    vi.stubGlobal('__MINIPROGRAM_BUILD_COMMIT__', 'test');
    vi.stubGlobal('__MINIPROGRAM_BUILD_PROFILE__', 'production');
    vi.stubGlobal('__MINIPROGRAM_BUILD_VERSION__', 'test');
    vi.stubGlobal(
      'getApp',
      vi.fn(() => app),
    );
    vi.stubGlobal('wx', {
      getStorageInfoSync: vi.fn(() => ({ keys: [...storage.keys()] })),
      getStorageSync: vi.fn((key) => storage.get(key)),
      removeStorageSync: vi.fn((key) => storage.delete(key)),
      setStorageSync: vi.fn((key, value) => storage.set(key, value)),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lets a profile bundle observe a new account persisted by the identity bundle after sign-out', async () => {
    const profileBundle = await import('../src/platform/wechat-identity.ts');
    profileBundle.clearWechatSession(true);

    vi.resetModules();
    const identityBundle = await import('../src/platform/wechat-identity.ts');
    identityBundle.persistPasswordSession(authenticated('user-d0468', 'D0468', 3));

    expect(profileBundle.getStoredWechatProfile()).toEqual({
      id: 'user-d0468',
      realName: 'D0468',
      version: 3,
    });
    expect(profileBundle.getStoredWechatAuthMethod()).toBe('password');
    expect(profileBundle.getWechatSessionGeneration()).toBe(2);
    expect(identityBundle.getWechatSessionGeneration()).toBe(2);
  });
});

function authenticated(id, realName, version) {
  return {
    expiresAt: new Date(Date.now() + 30 * DAY).toISOString(),
    profile: { id, realName, version },
    status: 'authenticated',
    token: `token-${id}`,
  };
}
