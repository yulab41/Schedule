import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireClientCapability: vi.fn(),
}));

vi.mock('../src/app/client-capability-store.ts', () => ({
  requireClientCapability: mocks.requireClientCapability,
}));

const PNG_BYTES = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);
const JPEG_BYTES = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

function toArrayBuffer(bytes) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function createWxRuntime() {
  const storage = new Map();
  const files = new Map();
  const unlinked = [];
  const request = vi.fn();
  const downloadFile = vi.fn();
  const fileSystem = {
    access: vi.fn(({ fail, path, success }) => {
      if (files.has(path)) success();
      else fail(new Error('missing'));
    }),
    getFileInfo: vi.fn(({ fail, filePath, success }) => {
      const bytes = files.get(filePath);
      if (bytes === undefined) fail(new Error('missing'));
      else success({ size: bytes.byteLength });
    }),
    readFile: vi.fn(({ fail, filePath, success }) => {
      const bytes = files.get(filePath);
      if (bytes === undefined) fail(new Error('missing'));
      else success({ data: toArrayBuffer(bytes) });
    }),
    unlink: vi.fn(({ fail, filePath, success }) => {
      unlinked.push(filePath);
      if (files.delete(filePath)) success();
      else fail(new Error('missing'));
    }),
    unlinkSync: vi.fn((filePath) => {
      unlinked.push(filePath);
      files.delete(filePath);
    }),
    writeFile: vi.fn(({ data, fail, filePath, success }) => {
      if (!(data instanceof ArrayBuffer)) {
        fail(new Error('invalid data'));
        return;
      }
      files.set(filePath, new Uint8Array(data.slice(0)));
      success();
    }),
  };
  const wx = {
    downloadFile,
    env: { USER_DATA_PATH: 'wxfile://usr' },
    getFileSystemManager: vi.fn(() => fileSystem),
    getStorageInfoSync: vi.fn(() => ({ keys: [...storage.keys()] })),
    getStorageSync: vi.fn((key) => storage.get(key)),
    removeStorageSync: vi.fn((key) => storage.delete(key)),
    request,
    setStorageSync: vi.fn((key, value) => storage.set(key, value)),
  };
  return { downloadFile, fileSystem, files, request, storage, unlinked, wx };
}

describe('Mini profile media client', () => {
  let app;
  let runtime;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal('__MINIPROGRAM_API_BASE_URL__', 'https://example.test/api');
    vi.stubGlobal('__MINIPROGRAM_BUILD_PROFILE__', 'production');
    app = { globalData: {} };
    runtime = createWxRuntime();
    vi.stubGlobal('getApp', () => app);
    vi.stubGlobal('wx', runtime.wx);
    mocks.requireClientCapability.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps the pending chooseAvatar path in shared process memory only', async () => {
    const first = await import('../src/platform/profile-media.ts');
    first.rememberPendingProfileAvatar('wxfile://tmp/chosen.png');
    expect(first.hasPendingProfileAvatar()).toBe(true);
    expect(runtime.storage.size).toBe(0);

    vi.resetModules();
    const second = await import('../src/platform/profile-media.ts');
    expect(second.hasPendingProfileAvatar()).toBe(true);
    second.clearPendingProfileAvatar();
    expect(first.hasPendingProfileAvatar()).toBe(false);
  });

  it('uploads raw validated bytes once, caches by owner/version, and never persists the temp path', async () => {
    runtime.files.set('wxfile://tmp/chosen', PNG_BYTES);
    runtime.request.mockImplementation((options) => {
      options.success({ data: { avatarVersion: 4 }, statusCode: 200 });
    });
    const media = await import('../src/platform/profile-media.ts');
    media.rememberPendingProfileAvatar('wxfile://tmp/chosen');

    const result = await media
      .createProfileMediaClient(() => 'bearer-token')
      .flushPending('user-1');

    expect(result).toMatchObject({ avatarVersion: 4, status: 'uploaded' });
    expect(media.hasPendingProfileAvatar()).toBe(false);
    expect(runtime.request).toHaveBeenCalledTimes(1);
    expect(runtime.request).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.any(ArrayBuffer),
        header: expect.objectContaining({
          Authorization: 'Bearer bearer-token',
          'content-type': 'image/png',
        }),
        method: 'PUT',
        url: 'https://example.test/api/users/me/avatar',
      }),
    );
    expect(JSON.stringify([...runtime.storage.values()])).not.toContain('wxfile://tmp/chosen');
    expect(runtime.files.get(result.localPath)).toEqual(PNG_BYTES);

    const cached = await media.createProfileMediaClient(() => 'bearer-token').resolve('user-1', 4);
    expect(cached).toBe(result.localPath);
    expect(runtime.downloadFile).not.toHaveBeenCalled();
  });

  it('serializes avatar selections so the later selection is the final cached version', async () => {
    runtime.files.set('wxfile://tmp/first', PNG_BYTES);
    runtime.files.set('wxfile://tmp/second', JPEG_BYTES);
    const callbacks = [];
    runtime.request.mockImplementation((options) => callbacks.push(options));
    const media = await import('../src/platform/profile-media.ts');
    const client = media.createProfileMediaClient(() => 'bearer-token');

    media.rememberPendingProfileAvatar('wxfile://tmp/first');
    const first = client.flushPending('user-1');
    media.rememberPendingProfileAvatar('wxfile://tmp/second');
    const second = client.flushPending('user-1');
    await vi.waitFor(() => expect(callbacks).toHaveLength(1));
    callbacks[0].success({ data: { avatarVersion: 8 }, statusCode: 200 });
    await vi.waitFor(() => expect(callbacks).toHaveLength(2));
    callbacks[1].success({ data: { avatarVersion: 9 }, statusCode: 200 });

    await expect(first).resolves.toMatchObject({ avatarVersion: 8, status: 'uploaded' });
    const latest = await second;
    expect(latest).toMatchObject({ avatarVersion: 9, status: 'uploaded' });
    expect(callbacks[0].header['content-type']).toBe('image/png');
    expect(callbacks[1].header['content-type']).toBe('image/jpeg');
    expect(await client.resolve('user-1', 9)).toBe(latest.localPath);
  });

  it('clears a failed pending upload without retrying or replacing an existing cache', async () => {
    runtime.files.set('wxfile://tmp/chosen', PNG_BYTES);
    runtime.request.mockImplementation((options) => options.fail(new Error('offline')));
    const media = await import('../src/platform/profile-media.ts');
    media.rememberPendingProfileAvatar('wxfile://tmp/chosen');
    const client = media.createProfileMediaClient(() => 'bearer-token');

    await expect(client.flushPending('user-1')).resolves.toEqual({
      message: '本次头像未更新。',
      status: 'failed',
    });
    await expect(client.flushPending('user-1')).resolves.toEqual({ status: 'empty' });
    expect(runtime.request).toHaveBeenCalledTimes(1);
    expect(media.hasPendingProfileAvatar()).toBe(false);
  });

  it('isolates caches by owner and replaces a stale version through an authenticated download', async () => {
    runtime.files.set('wxfile://tmp/seed', PNG_BYTES);
    runtime.request.mockImplementation((options) => {
      options.success({ data: { avatarVersion: 2 }, statusCode: 200 });
    });
    const media = await import('../src/platform/profile-media.ts');
    const client = media.createProfileMediaClient(() => 'bearer-token');
    media.rememberPendingProfileAvatar('wxfile://tmp/seed');
    const seeded = await client.flushPending('user-1');

    runtime.files.set('wxfile://tmp/downloaded', JPEG_BYTES);
    runtime.downloadFile.mockImplementation((options) => {
      options.success({
        header: { 'Content-Type': 'image/jpeg' },
        statusCode: 200,
        tempFilePath: 'wxfile://tmp/downloaded',
      });
    });
    const downloaded = await client.resolve('user-2', 3);

    expect(downloaded).not.toBe(seeded.localPath);
    expect(runtime.downloadFile).toHaveBeenCalledWith(
      expect.objectContaining({
        header: expect.objectContaining({ Authorization: 'Bearer bearer-token' }),
        url: 'https://example.test/api/users/me/avatar',
      }),
    );
    expect(runtime.files.get(downloaded)).toEqual(JPEG_BYTES);
    expect(await client.resolve('user-1', 2)).toBe(seeded.localPath);
  });

  it('uses the recovered session generation for a single authenticated download replay', async () => {
    runtime.files.set('wxfile://tmp/downloaded', JPEG_BYTES);
    let generation = 3;
    runtime.downloadFile
      .mockImplementationOnce((options) => {
        options.success({ header: {}, statusCode: 401, tempFilePath: '' });
      })
      .mockImplementationOnce((options) => {
        options.success({
          header: { 'content-type': 'image/jpeg' },
          statusCode: 200,
          tempFilePath: 'wxfile://tmp/downloaded',
        });
      });
    const authentication = {
      awaitAccessToken: vi.fn(async () => undefined),
      finalizeUnauthorized: vi.fn(),
      getSessionGeneration: vi.fn(() => generation),
      recoverAccessToken: vi.fn(async () => {
        generation += 1;
        return 'recovered-token';
      }),
    };
    const media = await import('../src/platform/profile-media.ts');

    const result = await media
      .createProfileMediaClient(() => 'expired-token', authentication)
      .resolve('user-1', 7);

    expect(result).toContain('user-1-7.jpg');
    expect(runtime.downloadFile).toHaveBeenCalledTimes(2);
    expect(runtime.downloadFile.mock.calls[1][0].header.Authorization).toBe(
      'Bearer recovered-token',
    );
    expect(authentication.finalizeUnauthorized).not.toHaveBeenCalled();
  });

  it('deletes the server avatar idempotently and clears only that owner local cache', async () => {
    runtime.files.set('wxfile://tmp/seed', PNG_BYTES);
    runtime.request.mockImplementation((options) => {
      const data = options.method === 'PUT' ? { avatarVersion: 2 } : { removed: false };
      options.success({ data, statusCode: 200 });
    });
    const media = await import('../src/platform/profile-media.ts');
    const client = media.createProfileMediaClient(() => 'bearer-token');
    media.rememberPendingProfileAvatar('wxfile://tmp/seed');
    const seeded = await client.flushPending('user-1');

    await expect(client.remove('user-1')).resolves.toEqual({ removed: false });
    expect(runtime.request).toHaveBeenLastCalledWith(expect.objectContaining({ method: 'DELETE' }));
    expect(runtime.files.has(seeded.localPath)).toBe(false);
    expect(await client.resolve('user-1', undefined)).toBeUndefined();
  });

  it('removes every persisted local avatar when private session storage is cleared', async () => {
    runtime.files.set('wxfile://tmp/first', PNG_BYTES);
    runtime.files.set('wxfile://tmp/second', JPEG_BYTES);
    let version = 10;
    runtime.request.mockImplementation((options) => {
      options.success({ data: { avatarVersion: version++ }, statusCode: 200 });
    });
    const media = await import('../src/platform/profile-media.ts');
    const client = media.createProfileMediaClient(() => 'bearer-token');
    media.rememberPendingProfileAvatar('wxfile://tmp/first');
    const first = await client.flushPending('user-1');
    media.rememberPendingProfileAvatar('wxfile://tmp/second');
    const second = await client.flushPending('user-2');
    media.rememberPendingProfileAvatar('wxfile://tmp/never-uploaded');

    const { clearPrivateBusinessStorage } = await import('../src/platform/private-storage.ts');
    clearPrivateBusinessStorage();

    expect(runtime.files.has(first.localPath)).toBe(false);
    expect(runtime.files.has(second.localPath)).toBe(false);
    expect(
      [...runtime.storage.keys()].some((key) => key.startsWith(media.PROFILE_AVATAR_CACHE_PREFIX)),
    ).toBe(false);
    expect(media.hasPendingProfileAvatar()).toBe(false);
  });
});
