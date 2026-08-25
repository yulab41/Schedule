import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enableTestClientCapabilities } from './test-client-capabilities.mjs';

describe('P3 identity login controller', () => {
  let definition;
  let requests;
  let storage;

  beforeEach(async () => {
    vi.resetModules();
    requests = [];
    storage = new Map();
    vi.stubGlobal('__MINIPROGRAM_API_BASE_URL__', 'https://example.test/api');
    vi.stubGlobal('__MINIPROGRAM_BUILD_COMMIT__', 'test');
    vi.stubGlobal('__MINIPROGRAM_BUILD_PROFILE__', 'production');
    vi.stubGlobal('__MINIPROGRAM_BUILD_VERSION__', 'test');
    vi.stubGlobal('Page', vi.fn((value) => {
      definition = value;
    }));
    vi.stubGlobal('wx', {
      getStorageInfoSync: vi.fn(() => ({ keys: [...storage.keys()] })),
      getStorageSync: vi.fn((key) => storage.get(key)),
      getWindowInfo: vi.fn(() => ({ statusBarHeight: 24, windowHeight: 844, windowWidth: 390 })),
      removeStorageSync: vi.fn((key) => storage.delete(key)),
      request: vi.fn((options) => {
        requests.push(options);
        if (options.url.endsWith('/auth/password/login')) {
          options.success({
            data: {
              isNewUser: false,
              mustChangePassword: false,
              profile: { id: 'user-d0796', realName: 'D0796', version: 1 },
              token: 'password-token',
            },
            statusCode: 200,
          });
          return;
        }
        throw new Error(`unexpected request ${options.method} ${options.url}`);
      }),
      setStorageSync: vi.fn((key, value) => storage.set(key, value)),
    });
    await import('../src/pages/identity/index.ts');
    await enableTestClientCapabilities();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normalizes the Web-style account form and persists a password session', async () => {
    const page = {
      data: { ...definition.data },
      setData(patch) {
        this.data = { ...this.data, ...patch };
      },
    };

    definition.handleUsernameChange.call(page, { detail: { value: ' D0796 ' } });
    definition.handlePasswordInput.call(page, { detail: { value: 'password' } });
    definition.handlePasswordLogin.call(page);

    await vi.waitFor(() => expect(page.data.mode).toBe('authenticated'));
    expect(requests).toHaveLength(1);
    expect(requests[0].data).toEqual({ password: 'password', username: 'd0796' });
    expect(page.data.authMethod).toBe('password');
    expect(storage.get('schedule.wechat.session')).toMatchObject({
      authMethod: 'password',
      profile: { id: 'user-d0796' },
      token: 'password-token',
    });

    definition.handleSwitchLogin.call(page);
    expect(page.data.mode).toBe('login');
    expect(storage.has('schedule.wechat.session')).toBe(false);
  });
});
