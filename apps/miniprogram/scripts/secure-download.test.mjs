import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireClientCapability: vi.fn(),
}));

vi.mock('../src/app/client-capability-store.ts', () => ({
  requireClientCapability: mocks.requireClientCapability,
}));

describe('Mini secure export download bridge', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.stubGlobal('__MINIPROGRAM_API_BASE_URL__', 'https://example.test/api');
    vi.stubGlobal('wx', {
      downloadFile: vi.fn(() => undefined),
    });
    mocks.requireClientCapability.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('rejects when wx never calls success or fail', async () => {
    const { downloadScheduleExport } = await import('../src/platform/secure-download.ts');
    const download = downloadScheduleExport(() => 'token', undefined, 'group/1', 'job/1');
    const outcome = Promise.race([
      download.then(
        () => 'resolved',
        () => 'rejected',
      ),
      new Promise((resolve) => setTimeout(() => resolve('pending'), 30_001)),
    ]);

    await vi.advanceTimersByTimeAsync(30_001);

    await expect(outcome).resolves.toBe('rejected');
    expect(globalThis.wx.downloadFile).toHaveBeenCalledWith(
      expect.objectContaining({
        timeout: 30_000,
        url: 'https://example.test/api/groups/group%2F1/exports/job%2F1/download',
      }),
    );
  });
  it('bounds capability preflight and never downloads after it expires', async () => {
    let resolveCapability;
    mocks.requireClientCapability.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveCapability = resolve;
        }),
    );
    const { downloadScheduleExport } = await import('../src/platform/secure-download.ts');
    let error;
    void downloadScheduleExport(() => 'token', undefined, 'g', 'j').catch((value) => {
      error = value;
    });
    await vi.advanceTimersByTimeAsync(30_001);
    expect(error?.category).toBe('timeout');
    resolveCapability();
    await vi.advanceTimersByTimeAsync(0);
    expect(globalThis.wx.downloadFile).not.toHaveBeenCalled();
  });
  it('does not issue a native download when the page was invalidated during session recovery', async () => {
    let finishSession;
    let current = true;
    const { downloadScheduleExport } = await import('../src/platform/secure-download.ts');
    const result = downloadScheduleExport(
      () => undefined,
      {
        awaitAccessToken: () =>
          new Promise((resolve) => {
            finishSession = resolve;
          }),
      },
      'g',
      'j',
      () => current,
    ).catch((error) => error);
    await vi.advanceTimersByTimeAsync(0);
    current = false;
    finishSession('token');
    await vi.advanceTimersByTimeAsync(0);
    expect(globalThis.wx.downloadFile).not.toHaveBeenCalled();
    expect(await result).toBeInstanceOf(Error);
  });

  it('settles the first download callback once and clears the JS timeout', async () => {
    let callbacks;
    globalThis.wx.downloadFile.mockImplementation((options) => {
      callbacks = options;
    });

    const { downloadScheduleExport } = await import('../src/platform/secure-download.ts');
    const download = downloadScheduleExport(() => 'token', undefined, 'group-1', 'job-1');
    await vi.waitFor(() => expect(callbacks).toBeDefined());
    callbacks.success({ statusCode: 200, tempFilePath: 'wxfile://export.csv' });
    callbacks.fail(new Error('late failure'));

    await expect(download).resolves.toBe('wxfile://export.csv');
    await vi.advanceTimersByTimeAsync(30_000);
    expect(mocks.requireClientCapability).toHaveBeenCalledWith('insights');
  });

  it.each([
    ['downloadFile:fail url not in domain list https://secret.invalid/token', 'domain'],
    ['downloadFile:fail timeout https://secret.invalid/token', 'timeout'],
    ['downloadFile:fail SSL certificate error', 'tls'],
    ['downloadFile:fail network disconnected', 'network'],
    ['downloadFile:fail unknown secret-token', 'unknown'],
  ])('classifies native failure without retaining raw details: %s', async (errMsg, category) => {
    globalThis.wx.downloadFile.mockImplementation((options) => options.fail({ errMsg }));
    const { downloadScheduleExport } = await import('../src/platform/secure-download.ts');
    const error = await downloadScheduleExport(() => 'token', undefined, 'g', 'j').catch((e) => e);
    expect(error.category).toBe(category);
    expect(JSON.stringify(error) + error.message + error.stack).not.toMatch(
      /secret|invalid\/token/,
    );
  });

  it.each([401, 403, 404, 410, 426, 500])(
    'preserves safe HTTP %s and removes error-body temp file',
    async (statusCode) => {
      const unlink = vi.fn();
      globalThis.wx.getFileSystemManager = () => ({ unlink });
      globalThis.wx.downloadFile.mockImplementation((options) =>
        options.success({ statusCode, tempFilePath: 'wxfile://error' }),
      );
      const { downloadScheduleExport } = await import('../src/platform/secure-download.ts');
      await expect(
        downloadScheduleExport(() => 'token', undefined, 'g', 'j'),
      ).rejects.toMatchObject({ category: 'http', statusCode });
      expect(unlink).toHaveBeenCalledWith(expect.objectContaining({ filePath: 'wxfile://error' }));
    },
  );

  it('removes a late success after timeout and aborts the native task', async () => {
    let callbacks;
    const abort = vi.fn();
    const unlink = vi.fn();
    globalThis.wx.getFileSystemManager = () => ({ unlink });
    globalThis.wx.downloadFile.mockImplementation((options) => {
      callbacks = options;
      return { abort };
    });
    const { downloadScheduleExport } = await import('../src/platform/secure-download.ts');
    const result = downloadScheduleExport(() => 'token', undefined, 'g', 'j').catch((e) => e);
    await vi.advanceTimersByTimeAsync(30_001);
    expect((await result).category).toBe('timeout');
    expect(abort).toHaveBeenCalledTimes(1);
    callbacks.success({ statusCode: 200, tempFilePath: 'wxfile://late' });
    expect(unlink).toHaveBeenCalledWith(expect.objectContaining({ filePath: 'wxfile://late' }));
  });

  it('shares only on explicit invocation, preserves wx receiver and treats cancel neutrally', async () => {
    globalThis.wx.shareFileMessage = vi.fn(function (options) {
      expect(this).toBe(globalThis.wx);
      options.fail({ errMsg: 'shareFileMessage:fail cancel' });
    });
    const { shareScheduleExport } = await import('../src/platform/secure-download.ts');
    expect(globalThis.wx.shareFileMessage).not.toHaveBeenCalled();
    await expect(shareScheduleExport('wxfile://csv', 'schedule.csv')).resolves.toBe('cancelled');
    expect(globalThis.wx.shareFileMessage).toHaveBeenCalledWith(
      expect.objectContaining({ filePath: 'wxfile://csv', fileName: 'schedule.csv' }),
    );
  });

  it('waits for the login token and sends it only in authenticated headers', async () => {
    const authentication = { awaitAccessToken: vi.fn().mockResolvedValue('private-token') };
    globalThis.wx.downloadFile.mockImplementation(function (options) {
      expect(this).toBe(globalThis.wx);
      expect(options.header.Authorization).toBe('Bearer private-token');
      expect(options.url).not.toContain('private-token');
      expect(options.header['X-Schedule-Client-Platform']).toBe('miniprogram');
      options.success({ statusCode: 200, tempFilePath: 'wxfile://csv' });
    });
    const { downloadScheduleExport } = await import('../src/platform/secure-download.ts');
    await expect(downloadScheduleExport(() => undefined, authentication, 'g', 'j')).resolves.toBe(
      'wxfile://csv',
    );
    expect(authentication.awaitAccessToken).toHaveBeenCalledTimes(1);
  });

  it('does not download if capability or login is unavailable', async () => {
    const { downloadScheduleExport } = await import('../src/platform/secure-download.ts');
    mocks.requireClientCapability.mockRejectedValueOnce(new Error('disabled'));
    await expect(downloadScheduleExport(() => 'token', undefined, 'g', 'j')).rejects.toThrow(
      'disabled',
    );
    await expect(downloadScheduleExport(() => undefined, undefined, 'g', 'j')).rejects.toThrow(
      '请先登录',
    );
    expect(globalThis.wx.downloadFile).not.toHaveBeenCalled();
  });

  it('never leaks native share failures and reports unsupported clients safely', async () => {
    const { shareScheduleExport } = await import('../src/platform/secure-download.ts');
    await expect(shareScheduleExport('wxfile://private', 'file.csv')).rejects.toThrow(
      '不支持发送文件',
    );
    globalThis.wx.shareFileMessage = (options) =>
      options.fail({ errMsg: 'https://private.example/token secret-token' });
    const error = await shareScheduleExport('wxfile://private', 'file.csv').catch((e) => e);
    expect(error.message + JSON.stringify(error)).not.toMatch(/private|token/);
  });
});
