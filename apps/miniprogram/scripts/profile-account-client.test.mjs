import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enableTestClientCapabilities } from './test-client-capabilities.mjs';

describe('Mini profile account client', () => {
  let login;
  let request;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal('__MINIPROGRAM_API_BASE_URL__', 'https://example.test/api');
    vi.stubGlobal('__MINIPROGRAM_BUILD_COMMIT__', 'test');
    vi.stubGlobal('__MINIPROGRAM_BUILD_PROFILE__', 'production');
    vi.stubGlobal('__MINIPROGRAM_BUILD_VERSION__', 'test');
    login = vi.fn((options) => options.success({ code: 'fresh-proof-code' }));
    request = vi.fn((options) => {
      if (options.url.endsWith('/me/wechat/miniprogram/binding')) {
        options.success({ data: { bound: true, canUnbind: true }, statusCode: 200 });
        return;
      }
      if (options.url.endsWith('/me/password')) {
        options.success({ data: { passwordChanged: true }, statusCode: 200 });
        return;
      }
      throw new Error(`unexpected request ${options.method} ${options.url}`);
    });
    vi.stubGlobal('wx', { login, request });
    await enableTestClientCapabilities();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns only the current AppID binding booleans', async () => {
    const { createProfileAccountClient } = await import('../src/platform/profile-account.ts');
    const client = createProfileAccountClient(() => 'bearer-token');

    await expect(client.getWechatBinding()).resolves.toEqual({ bound: true, canUnbind: true });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        header: expect.objectContaining({ Authorization: 'Bearer bearer-token' }),
        method: 'GET',
        url: 'https://example.test/api/me/wechat/miniprogram/binding',
      }),
    );
  });

  it('uses current-password proof without calling wx.login', async () => {
    const { createProfileAccountClient } = await import('../src/platform/profile-account.ts');
    const client = createProfileAccountClient(() => 'bearer-token');

    await expect(
      client.changePassword({
        authMethod: 'password',
        currentPassword: 'old-password',
        newPassword: 'new-password',
      }),
    ).resolves.toEqual({ passwordChanged: true });
    expect(login).not.toHaveBeenCalled();
    expect(request).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: { currentPassword: 'old-password', newPassword: 'new-password' },
        method: 'PUT',
      }),
    );
  });

  it('uses one fresh WeChat code proof and does not retry an ambiguous write', async () => {
    const { createProfileAccountClient } = await import('../src/platform/profile-account.ts');
    const client = createProfileAccountClient(() => 'bearer-token');

    await expect(
      client.changePassword({ authMethod: 'wechat', newPassword: 'new-password' }),
    ).resolves.toEqual({ passwordChanged: true });
    expect(login).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: { code: 'fresh-proof-code', newPassword: 'new-password' },
        method: 'PUT',
      }),
    );

    request.mockImplementationOnce((options) => options.fail(new Error('offline')));
    await expect(
      client.changePassword({ authMethod: 'wechat', newPassword: 'another-password' }),
    ).rejects.toThrow('密码没有修改');
    expect(request).toHaveBeenCalledTimes(2);
  });
});
