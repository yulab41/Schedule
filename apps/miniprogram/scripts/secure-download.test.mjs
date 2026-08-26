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
});
