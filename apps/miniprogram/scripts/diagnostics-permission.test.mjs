import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('trusted diagnostics permission for the current session', () => {
  let owner;
  let generation;
  let response;
  let app;
  beforeEach(() => {
    vi.resetModules();
    owner = 'synthetic-admin';
    generation = 1;
    app = { globalData: {} };
    vi.stubGlobal('getApp', () => app);
    vi.stubGlobal('__MINIPROGRAM_API_BASE_URL__', 'https://example.test/api');
    vi.stubGlobal('__MINIPROGRAM_BUILD_PROFILE__', 'production');
    vi.stubGlobal('wx', {
      getAccountInfoSync: () => ({ miniProgram: { envVersion: 'trial' } }),
      getStorageSync: () => undefined,
      removeStorageSync: vi.fn(),
    });
    response = vi.fn().mockResolvedValue({ statusCode: 200, data: { allowed: true } });
    vi.doMock('../src/platform/wechat-identity.ts', () => ({
      awaitWechatSessionRecovery: async () => undefined,
      getStoredWechatProfile: () => (owner ? { id: owner } : undefined),
      getStoredWechatToken: () => (owner ? 'synthetic-session' : undefined),
      getWechatSessionGeneration: () => generation,
      getWechatRequestAuthentication: () => ({}),
    }));
    vi.doMock('../src/platform/wx-request-executor.ts', () => ({
      executeWxJsonRequest: (...args) => response(...args),
    }));
  });
  afterEach(() => {
    vi.doUnmock('../src/platform/wechat-identity.ts');
    vi.doUnmock('../src/platform/wx-request-executor.ts');
    vi.unstubAllGlobals();
  });
  it('starts denied, grants only trusted positive response, revokes synchronously on invalidation', async () => {
    const api = await import('../src/platform/diagnostics-access.ts');
    const state = await import('../src/platform/diagnostics-permission-state.ts');
    expect(api.canUseDiagnostics()).toBe(false);
    expect(await api.refreshDiagnosticsAccess()).toBe(true);
    expect(api.canUseDiagnostics()).toBe(true);
    expect(response.mock.calls[0][0]).toMatchObject({
      capability: 'core',
      method: 'GET',
      url: 'https://example.test/api/me/diagnostics-access',
    });
    const changed = vi.fn();
    const unsubscribe = api.subscribeDiagnosticsPermission(changed);
    state.invalidateDiagnosticsPermission();
    expect(api.canUseDiagnostics()).toBe(false);
    expect(changed).toHaveBeenCalledWith(false);
    expect(app.globalData.runtimeDiagnostics).toBeUndefined();
    unsubscribe();
  });
  it('a broken listener cannot block revocation or leave diagnostic payloads behind', async () => {
    const api = await import('../src/platform/diagnostics-access.ts');
    const state = await import('../src/platform/diagnostics-permission-state.ts');
    await api.refreshDiagnosticsAccess();
    api.subscribeDiagnosticsPermission(() => {
      throw new Error('broken page');
    });
    const healthy = vi.fn();
    api.subscribeDiagnosticsPermission(healthy);
    expect(() => state.invalidateDiagnosticsPermission()).not.toThrow();
    expect(healthy).toHaveBeenCalledWith(false);
    expect(app.globalData.runtimeDiagnostics).toBeUndefined();
  });
  it('uses the actual app launch provenance rather than authorization time', async () => {
    app.globalData.diagnosticsLaunch = {
      appLaunchAt: 12345,
      launchObserved: true,
      initialShowPending: false,
      warmResumeObserved: true,
    };
    const api = await import('../src/platform/diagnostics-access.ts');
    await api.refreshDiagnosticsAccess();
    expect(app.globalData.runtimeDiagnostics).toMatchObject({
      appLaunchAt: 12345,
      launchObserved: true,
      warmResumeObserved: true,
    });
  });
  it('an older same-account grant cannot overwrite a later denial', async () => {
    const api = await import('../src/platform/diagnostics-access.ts');
    let complete;
    response.mockReturnValueOnce(
      new Promise((resolve) => {
        complete = resolve;
      }),
    );
    const old = api.refreshDiagnosticsAccess();
    await vi.waitFor(() => expect(response).toHaveBeenCalledTimes(1));
    response.mockResolvedValueOnce({ statusCode: 200, data: { allowed: false } });
    expect(await api.refreshDiagnosticsAccess()).toBe(false);
    complete({ statusCode: 200, data: { allowed: true } });
    expect(await old).toBe(false);
    expect(api.canUseDiagnostics()).toBe(false);
  });
  it.each([401, 403, 426, 503])('denies HTTP %s without collecting data', async (statusCode) => {
    response.mockResolvedValue({ statusCode, data: { allowed: true } });
    const api = await import('../src/platform/diagnostics-access.ts');
    expect(await api.refreshDiagnosticsAccess()).toBe(false);
    expect(app.globalData.runtimeDiagnostics).toBeUndefined();
  });
  it.each([false, undefined, 'true'])('denies a non-true server grant %s', async (allowed) => {
    response.mockResolvedValue({ statusCode: 200, data: { allowed } });
    const api = await import('../src/platform/diagnostics-access.ts');
    expect(await api.refreshDiagnosticsAccess()).toBe(false);
  });
  it('never requests as anonymous and ignores the old account response', async () => {
    const api = await import('../src/platform/diagnostics-access.ts');
    owner = undefined;
    expect(await api.refreshDiagnosticsAccess()).toBe(false);
    expect(response).not.toHaveBeenCalled();
    owner = 'synthetic-admin';
    let complete;
    response.mockReturnValue(
      new Promise((resolve) => {
        complete = resolve;
      }),
    );
    const pending = api.refreshDiagnosticsAccess();
    await vi.waitFor(() => expect(response).toHaveBeenCalledTimes(1));
    owner = 'synthetic-member';
    generation += 1;
    complete({ statusCode: 200, data: { allowed: true } });
    expect(await pending).toBe(false);
    expect(api.canUseDiagnostics()).toBe(false);
  });
});
