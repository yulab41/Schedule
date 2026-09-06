import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('UX-CLEANUP-10 diagnostics access', () => {
  beforeEach(() => {
    vi.resetModules();
    for (const [key, value] of Object.entries({
      API_BASE_URL: 'https://example.test/api',
      BUILD_COMMIT: 'test',
      BUILD_DESCRIPTION: 'test',
      BUILD_DIRTY: false,
      BUILD_PROFILE: 'production',
      BUILD_TIME: '2026-09-06T00:00:00Z',
      BUILD_VERSION: 'test',
    }))
      vi.stubGlobal(`__MINIPROGRAM_${key}__`, value);
  });
  afterEach(() => {
    vi.doUnmock('../src/platform/diagnostics-access.ts');
    vi.unstubAllGlobals();
  });
  it('all diagnostic handlers deny a revoked page and old device results cannot enter a renewed grant', async () => {
    let definition;
    let allowed = true;
    let listener;
    const network = [];
    vi.doMock('../src/platform/diagnostics-access.ts', () => ({
      canUseDiagnostics: () => allowed,
      refreshDiagnosticsAccess: async () => allowed,
      subscribeDiagnosticsPermission: (callback) => {
        listener = callback;
        return () => {};
      },
    }));
    const clipboard = vi.fn();
    const navigate = vi.fn();
    vi.stubGlobal('Page', (value) => {
      definition = value;
    });
    vi.stubGlobal('wx', {
      getAccountInfoSync: () => ({ miniProgram: { envVersion: 'trial' } }),
      getStorageSync: () => undefined,
      getDeviceInfo: () => ({}),
      getAppBaseInfo: () => ({}),
      getWindowInfo: () => ({}),
      getNetworkType: (options) => network.push(options),
      setClipboardData: clipboard,
      navigateTo: navigate,
      showToast: vi.fn(),
      redirectTo: vi.fn(),
    });
    await import('../src/subpackages/diagnostics/pages/test-tools/index.ts');
    const host = {
      data: { ...definition.data },
      setData(patch) {
        Object.assign(this.data, patch);
      },
    };
    definition.onLoad.call(host);
    await vi.waitFor(() => expect(host.data.authorized).toBe(true));
    allowed = false;
    listener(false);
    for (const [name, method] of Object.entries(definition)) {
      if (!name.startsWith('handle') || ['handleBack', 'handleOpenWorkspace'].includes(name))
        continue;
      method.call(host, { currentTarget: { dataset: {} }, detail: {} });
    }
    expect(clipboard).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(host.data.deviceRows).toEqual([]);
    allowed = true;
    definition.onShow.call(host);
    await vi.waitFor(() => expect(host.data.authorized).toBe(true));
    network[0].success({ networkType: 'old-network' });
    await Promise.resolve();
    await Promise.resolve();
    expect(host.data.networkType).not.toBe('old-network');
    network[1].success({ networkType: 'new-network' });
    await vi.waitFor(() => expect(host.data.networkType).toBe('new-network'));
    definition.onUnload.call(host);
  });
  it('a direct trial page visit must not collect diagnostics before trusted admin authorization', async () => {
    let definition;
    const device = vi.fn(() => ({}));
    vi.stubGlobal('Page', (value) => {
      definition = value;
    });
    vi.stubGlobal('wx', {
      getAccountInfoSync: () => ({ miniProgram: { envVersion: 'trial' } }),
      getStorageSync: () => undefined,
      getDeviceInfo: device,
      getAppBaseInfo: () => ({}),
      getWindowInfo: () => ({}),
      showToast: vi.fn(),
      redirectTo: vi.fn(),
    });
    await import('../src/subpackages/diagnostics/pages/test-tools/index.ts');
    const host = {
      data: { ...definition.data },
      setData(patch) {
        Object.assign(this.data, patch);
      },
    };
    definition.onLoad.call(host);
    await Promise.resolve();
    expect(device).not.toHaveBeenCalled();
    expect(host.data.buildRows).toEqual([]);
  });
});
