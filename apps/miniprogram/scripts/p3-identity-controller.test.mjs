import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enableTestClientCapabilities } from './test-client-capabilities.mjs';

const DAY = 24 * 60 * 60 * 1_000;

describe('P3 identity login controller', () => {
  let definition;
  let reLaunch;
  let requests;
  let storage;
  let wechatLoginResult;

  beforeEach(async () => {
    vi.resetModules();
    requests = [];
    storage = new Map();
    reLaunch = vi.fn();
    wechatLoginResult = authenticated('user-wechat', '微信成员', 2, 'wechat-token');
    vi.stubGlobal('__MINIPROGRAM_API_BASE_URL__', 'https://example.test/api');
    vi.stubGlobal('__MINIPROGRAM_BUILD_COMMIT__', 'test');
    vi.stubGlobal('__MINIPROGRAM_BUILD_PROFILE__', 'production');
    vi.stubGlobal('__MINIPROGRAM_BUILD_VERSION__', 'test');
    vi.stubGlobal(
      'Page',
      vi.fn((value) => {
        definition = value;
      }),
    );
    vi.stubGlobal('wx', {
      getStorageInfoSync: vi.fn(() => ({ keys: [...storage.keys()] })),
      getStorageSync: vi.fn((key) => storage.get(key)),
      getWindowInfo: vi.fn(() => ({ statusBarHeight: 24, windowHeight: 844, windowWidth: 390 })),
      login: vi.fn((options) => options.success({ code: 'fresh-code' })),
      reLaunch,
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
        if (options.url.endsWith('/auth/wechat/login')) {
          options.success({ data: wechatLoginResult, statusCode: 200 });
          return;
        }
        if (options.url.endsWith('/auth/wechat/link-password')) {
          options.success({
            data: authenticated('user-linked', '已绑定成员', 4, 'linked-token'),
            statusCode: 200,
          });
          return;
        }
        if (options.url.endsWith('/auth/wechat/register')) {
          options.success({
            data: authenticated('user-created', '新成员', 1, 'created-token'),
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

  it('opens binding directly, cancels without a write, and prevents duplicate login requests', async () => {
    wechatLoginResult = {
      status: 'link_required',
      linkToken: 'link-token',
      expiresAt: new Date(Date.now() + 600000).toISOString(),
    };
    const page = createPage(definition);
    definition.handleWechatLogin.call(page);
    definition.handleWechatLogin.call(page);
    await vi.waitFor(() => expect(page.data.bindingOpen).toBe(true));
    expect(requests).toHaveLength(1);
    expect(page.data.mode).toBeUndefined();
    definition.handlePasswordInput.call(page, { detail: { value: 'private-password' } });
    definition.handleBindingCancel.call(page);
    expect(page.data).toMatchObject({ bindingOpen: false, password: '', linkToken: '' });
    expect(requests).toHaveLength(1);
  });

  it('normalizes the Web-style account form, persists a password session, and opens home directly', async () => {
    const page = createPage(definition);

    definition.handleUsernameChange.call(page, { detail: { value: ' D0796 ' } });
    definition.handlePasswordInput.call(page, { detail: { value: 'password' } });
    definition.handlePasswordLogin.call(page);

    await vi.waitFor(() => expect(reLaunch).toHaveBeenCalledTimes(1));
    expect(requests).toHaveLength(1);
    expect(requests[0].data).toEqual({ password: 'password', username: 'd0796' });
    expect(storage.get('schedule.wechat.session')).toMatchObject({
      authMethod: 'password',
      profile: { id: 'user-d0796' },
      token: 'password-token',
    });
    expect(reLaunch).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/pages/workbench/index' }),
    );
  });

  it('opens home directly when the identity entry finds an existing valid session', () => {
    storage.set('schedule.wechat.session', storedSession('user-existing', '现有成员', 2));
    const page = createPage(definition);

    definition.onLoad.call(page);

    expect(reLaunch).toHaveBeenCalledTimes(1);
    expect(reLaunch).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/pages/workbench/index' }),
    );
  });

  it('opens home directly after authenticated WeChat login, password linking, and returns a linked session', async () => {
    const wechatPage = createPage(definition);
    definition.handleWechatLogin.call(wechatPage);
    await vi.waitFor(() => expect(reLaunch).toHaveBeenCalledTimes(1));
    expect(storage.get('schedule.wechat.session')).toMatchObject({
      authMethod: 'wechat',
      profile: { id: 'user-wechat' },
    });

    reLaunch.mockClear();
    const linkPage = createPage(definition, {
      linkToken: 'link-token',
      bindingOpen: true,
      linkExpiresAt: new Date(Date.now() + 600000).toISOString(),
      password: 'password',
      username: 'D0468',
    });
    definition.handleLinkPassword.call(linkPage);
    await vi.waitFor(() => expect(reLaunch).toHaveBeenCalledTimes(1));
    expect(storage.get('schedule.wechat.session')).toMatchObject({
      authMethod: 'wechat',
      profile: { id: 'user-linked' },
    });
  });

  it('opens the account binding sheet for an unknown WeChat identity', async () => {
    wechatLoginResult = {
      expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
      linkToken: 'link-token',
      status: 'link_required',
    };
    const page = createPage(definition);

    definition.handleWechatLogin.call(page);

    await vi.waitFor(() => expect(page.data.bindingOpen).toBe(true));
    expect(page.data.linkToken).toBe('link-token');
    expect(reLaunch).not.toHaveBeenCalled();
  });

  it('keeps the new session and shows a recovery message when reLaunch fails', async () => {
    reLaunch.mockImplementation((options) => options.fail({ errMsg: 'reLaunch:fail' }));
    const page = createPage(definition, { password: 'password', username: 'd0468' });

    definition.handlePasswordLogin.call(page);

    await vi.waitFor(() => expect(page.data.loading).toBe(false));
    expect(page.data.errorMessage).toBe('登录已完成，但主页未能打开，请重新打开小程序。');
    expect(storage.get('schedule.wechat.session')).toMatchObject({ token: 'password-token' });
    expect(reLaunch).toHaveBeenCalledTimes(1);
  });

  it('rejects expired binding credentials before making a binding request', () => {
    const page = createPage(definition, {
      bindingOpen: true,
      linkToken: 'expired',
      linkExpiresAt: new Date(Date.now() - 1000).toISOString(),
      username: 'user',
      password: 'private',
    });
    definition.handleLinkPassword.call(page);
    expect(requests).toHaveLength(0);
    expect(page.data).toMatchObject({ bindingOpen: false, linkToken: '', password: '' });
    expect(page.data.errorMessage).toContain('重新点击微信');
  });

  it.each(['password', 'network'])(
    'keeps failed %s binding in the sheet without persisting a session',
    async (failure) => {
      globalThis.wx.request.mockImplementation((options) => {
        if (failure === 'password')
          options.success({ data: { error: { code: 'UNAUTHORIZED' } }, statusCode: 401 });
        else options.fail({ errMsg: 'network unavailable' });
      });
      const page = createPage(definition, {
        bindingOpen: true,
        linkToken: 'link',
        linkExpiresAt: new Date(Date.now() + 600000).toISOString(),
        username: 'user',
        password: 'private',
      });
      definition.handleLinkPassword.call(page);
      definition.handleLinkPassword.call(page);
      await vi.waitFor(() => expect(page.data.loading).toBe(false));
      expect(globalThis.wx.request).toHaveBeenCalledTimes(1);
      expect(page.data.bindingOpen).toBe(true);
      expect(page.data.errorMessage.length).toBeGreaterThan(0);
      expect(storage.has('schedule.wechat.session')).toBe(false);
      expect(reLaunch).not.toHaveBeenCalled();
    },
  );
});

function createPage(definition, overrides = {}) {
  return {
    data: { ...definition.data, ...overrides },
    setData(patch) {
      this.data = { ...this.data, ...patch };
    },
  };
}

function authenticated(id, realName, version, token) {
  return {
    expiresAt: new Date(Date.now() + 30 * DAY).toISOString(),
    profile: { id, realName, version },
    status: 'authenticated',
    token,
  };
}

function storedSession(id, realName, version) {
  return {
    authMethod: 'password',
    expiresAt: new Date(Date.now() + 30 * DAY).toISOString(),
    profile: { id, realName, version },
    token: `token-${id}`,
  };
}
