import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enableTestClientCapabilities } from './test-client-capabilities.mjs';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PNG_BYTES = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);

function read(relativePath) {
  return readFileSync(path.join(appRoot, relativePath), 'utf8');
}

function toArrayBuffer(bytes) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

describe('Mini chooseAvatar login bridge', () => {
  let app;
  let componentDefinition;
  let files;
  let requestMode;
  let showToast;
  let storage;

  beforeEach(async () => {
    vi.resetModules();
    app = { globalData: {} };
    files = new Map([['wxfile://tmp/avatar', PNG_BYTES]]);
    requestMode = 'success';
    showToast = vi.fn();
    storage = new Map([
      [
        'schedule.wechat.session',
        {
          authMethod: 'wechat',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1_000).toISOString(),
          profile: { id: 'user-1', realName: '成员甲', version: 2 },
          token: 'bearer-token',
        },
      ],
    ]);
    vi.stubGlobal('__MINIPROGRAM_API_BASE_URL__', 'https://example.test/api');
    vi.stubGlobal('__MINIPROGRAM_BUILD_COMMIT__', 'test');
    vi.stubGlobal('__MINIPROGRAM_BUILD_PROFILE__', 'production');
    vi.stubGlobal('__MINIPROGRAM_BUILD_VERSION__', 'test');
    vi.stubGlobal('getApp', () => app);
    vi.stubGlobal(
      'Component',
      vi.fn((definition) => {
        componentDefinition = definition;
      }),
    );
    vi.stubGlobal('wx', {
      env: { USER_DATA_PATH: 'wxfile://usr' },
      getFileSystemManager: vi.fn(() => ({
        access: ({ fail, path: filePath, success }) =>
          files.has(filePath) ? success() : fail(new Error('missing')),
        getFileInfo: ({ fail, filePath, success }) => {
          const value = files.get(filePath);
          if (value === undefined) fail(new Error('missing'));
          else success({ size: value.byteLength });
        },
        readFile: ({ fail, filePath, success }) => {
          const value = files.get(filePath);
          if (value === undefined) fail(new Error('missing'));
          else success({ data: toArrayBuffer(value) });
        },
        unlink: ({ fail, filePath, success }) =>
          files.delete(filePath) ? success() : fail(new Error('missing')),
        unlinkSync: (filePath) => files.delete(filePath),
        writeFile: ({ data, filePath, success }) => {
          files.set(filePath, new Uint8Array(data.slice(0)));
          success();
        },
      })),
      getStorageInfoSync: vi.fn(() => ({ keys: [...storage.keys()] })),
      getStorageSync: vi.fn((key) => storage.get(key)),
      removeStorageSync: vi.fn((key) => storage.delete(key)),
      request: vi.fn((options) => {
        if (requestMode === 'failure') {
          options.fail(new Error('offline'));
          return;
        }
        options.success({ data: { avatarVersion: 5 }, statusCode: 200 });
      }),
      setStorageSync: vi.fn((key, value) => storage.set(key, value)),
      showToast,
    });
    await enableTestClientCapabilities();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses a native chooseAvatar leaf while ordinary tap immediately emits login', async () => {
    await import('../src/components/profile-avatar-login-button/index.ts');
    const media = await import('../src/platform/profile-media.ts');
    const events = [];
    const instance = {
      properties: { disabled: false, loading: false },
      triggerEvent: (name, detail) => events.push({ detail, name }),
    };

    media.rememberPendingProfileAvatar('wxfile://tmp/obsolete');
    componentDefinition.methods.handlePress.call(instance);
    expect(events).toEqual([{ detail: undefined, name: 'press' }]);
    expect(media.hasPendingProfileAvatar()).toBe(false);

    componentDefinition.methods.handleChooseAvatar.call(instance, {
      detail: { avatarUrl: 'wxfile://tmp/avatar' },
    });
    expect(media.hasPendingProfileAvatar()).toBe(true);
    expect(storage.has('schedule.profile.avatar.pending')).toBe(false);
  });

  it('flushes only after a stored WeChat session, persists the new version, and reports one failure once', async () => {
    const media = await import('../src/platform/profile-media.ts');
    const runtime = await import('../src/platform/profile-avatar-runtime.ts');
    media.rememberPendingProfileAvatar('wxfile://tmp/avatar');

    await expect(runtime.flushPendingProfileAvatarForStoredSession()).resolves.toMatchObject({
      avatarVersion: 5,
      status: 'uploaded',
    });
    expect(storage.get('schedule.wechat.session').profile.avatarVersion).toBe(5);
    expect(showToast).not.toHaveBeenCalled();

    requestMode = 'failure';
    media.rememberPendingProfileAvatar('wxfile://tmp/avatar');
    await expect(runtime.flushPendingProfileAvatarForStoredSession()).resolves.toEqual({
      message: '本次头像未更新。',
      status: 'failed',
    });
    await expect(runtime.flushPendingProfileAvatarForStoredSession()).resolves.toEqual({
      status: 'empty',
    });
    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ title: '本次头像未更新' }));
  });

  it('retains a selected avatar across link-required flow until a session exists', async () => {
    storage.delete('schedule.wechat.session');
    const media = await import('../src/platform/profile-media.ts');
    const runtime = await import('../src/platform/profile-avatar-runtime.ts');
    media.rememberPendingProfileAvatar('wxfile://tmp/avatar');

    await expect(runtime.flushPendingProfileAvatarForStoredSession()).resolves.toEqual({
      status: 'empty',
    });
    expect(media.hasPendingProfileAvatar()).toBe(true);

    storage.set('schedule.wechat.session', {
      authMethod: 'wechat',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1_000).toISOString(),
      profile: { id: 'user-linked', realName: '已绑定成员', version: 1 },
      token: 'linked-token',
    });
    await expect(runtime.flushPendingProfileAvatarForStoredSession()).resolves.toMatchObject({
      avatarVersion: 5,
      status: 'uploaded',
    });
    expect(storage.get('schedule.wechat.session').profile.avatarVersion).toBe(5);
  });

  it('registers the leaf and keeps password versus WeChat refresh semantics explicit', () => {
    const pageConfig = JSON.parse(read('src/pages/identity/index.json'));
    const identity = read('src/pages/identity/index.ts');
    const template = read('src/pages/identity/index.wxml');
    const leaf = read('src/components/profile-avatar-login-button/index.wxml');
    const styles = read('src/components/profile-avatar-login-button/index.wxss');
    const workbench = read('src/pages/workbench/index.ts');
    const profile = read('src/components/profile-panel/controller.ts');

    expect(pageConfig.usingComponents['profile-avatar-login-button']).toBe(
      '/components/profile-avatar-login-button/index',
    );
    expect(template).toContain('<profile-avatar-login-button');
    expect(template).toContain('bind:press="handleWechatLogin"');
    expect(leaf).toContain('open-type="chooseAvatar"');
    expect(leaf).toContain('bindchooseavatar="handleChooseAvatar"');
    expect(leaf).toContain('bindtap="handlePress"');
    expect(styles).toContain('min-height: var(--ui-touch-target-minimum)');
    expect(styles).toContain('button::after');

    const passwordStart = identity.indexOf('handlePasswordLogin');
    const passwordEnd = identity.indexOf('handlePasswordInput');
    const passwordBody = identity.slice(passwordStart, passwordEnd);
    expect(passwordBody).toContain('clearPendingProfileAvatar()');
    expect(passwordBody.indexOf('clearPendingProfileAvatar()')).toBeLessThan(
      passwordBody.indexOf('loginWithPassword('),
    );
    expect(workbench).toContain('flushPendingProfileAvatarForStoredSession');
    expect(profile).toContain('flushPendingProfileAvatarForStoredSession');
  });
});
