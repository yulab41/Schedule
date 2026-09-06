import { readFileSync, existsSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearLegacyWorkbenchStorage } from '../src/platform/private-storage.ts';
afterEach(() => vi.unstubAllGlobals());
describe('photo retirement', () => {
  it('ignores invalid legacy photo metadata without expiring the valid login session', async () => {
    vi.stubGlobal('__MINIPROGRAM_API_BASE_URL__', 'https://example.test/api');
    vi.stubGlobal('__MINIPROGRAM_BUILD_COMMIT__', 'test');
    vi.stubGlobal('__MINIPROGRAM_BUILD_PROFILE__', 'production');
    vi.stubGlobal('__MINIPROGRAM_BUILD_VERSION__', 'test');
    const removeStorageSync = vi.fn();
    const now = Date.now();
    vi.stubGlobal('wx', {
      getStorageSync: () => ({
        authMethod: 'wechat',
        expiresAt: new Date(now + 3600000).toISOString(),
        token: 'synthetic-session',
        profile: {
          id: 'owner',
          realName: '成员甲',
          version: 1,
          avatarVersion: 'retired-invalid-value',
          avatarUrl: 'https://example.invalid/photo',
        },
      }),
      removeStorageSync,
    });
    const { getStoredWechatProfile } = await import('../src/platform/wechat-identity.ts');
    expect(getStoredWechatProfile(now)).toEqual({ id: 'owner', realName: '成员甲', version: 1 });
    expect(removeStorageSync).not.toHaveBeenCalled();
  });
  it('cleans only retired photo metadata and preserves files/session/preferences', () => {
    const keys = [
      'schedule.profile.avatar.v1:owner',
      'schedule.wechat.session',
      'schedule.directory.preferences.v1:owner:group',
      'unrelated',
    ];
    const storage = new Map(keys.map((k) => [k, {}]));
    const files = vi.fn();
    vi.stubGlobal('wx', {
      getStorageInfoSync: () => ({ keys: [...storage.keys()] }),
      removeStorageSync: (k) => storage.delete(k),
      getFileSystemManager: files,
    });
    clearLegacyWorkbenchStorage();
    expect([...storage.keys()]).toEqual(keys.slice(1));
    expect(files).not.toHaveBeenCalled();
  });
  it('uses ordinary login action with no photo selection or image account rows', () => {
    const source = readFileSync(
      new URL('../src/pages/identity/index.wxml', import.meta.url),
      'utf8',
    );
    expect(source).toContain('bind:press="handleWechatLogin"');
    expect(source).not.toContain('chooseAvatar');
    expect(existsSync(new URL('../src/platform/profile-media.ts', import.meta.url))).toBe(false);
    const profile = readFileSync(
      new URL('../src/components/profile-panel/index.wxml', import.meta.url),
      'utf8',
    );
    expect(profile).not.toContain('avatarPath');
    expect(profile).not.toContain('微信头像');
  });
});
