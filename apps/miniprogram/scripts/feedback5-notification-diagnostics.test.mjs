import { afterEach, describe, expect, it, vi } from 'vitest';
const permissions = vi.hoisted(() => ({ allowed: false }));
vi.mock('../src/platform/diagnostics-access.ts', () => ({
  canUseDiagnostics: () => permissions.allowed,
}));
vi.mock('../src/platform/wechat-identity.ts', () => ({
  getStoredWechatProfile: () => undefined,
  getWechatSessionGeneration: () => 0,
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('feedback5 subscription diagnostic privacy', () => {
  it('uses the authorized App slot across separately bundled entries and stays off without it', async () => {
    const globalData = {};
    vi.stubGlobal('getApp', () => ({ globalData }));
    const { captureSubscriptionDiagnosticRecorder, readSubscriptionDiagnostics } =
      await import('../src/platform/subscription-diagnostics.ts');
    captureSubscriptionDiagnosticRecorder()({ stage: 'authorization', outcome: 'accepted' });
    expect(globalData.subscriptionDiagnostics).toBeUndefined();
    globalData.runtimeDiagnostics = {};
    captureSubscriptionDiagnosticRecorder()({ stage: 'authorization', outcome: 'accepted' });
    expect(readSubscriptionDiagnostics()).toHaveLength(1);
    const stale = captureSubscriptionDiagnosticRecorder();
    globalData.runtimeDiagnostics = {};
    stale({ stage: 'authorization', outcome: 'rejected' });
    expect(readSubscriptionDiagnostics()).toHaveLength(1);
    delete globalData.runtimeDiagnostics;
    expect(readSubscriptionDiagnostics()).toEqual([]);
  });
  it('discards an old callback after permission revoke and regrant in the same session', async () => {
    permissions.allowed = true;
    const globalData = { runtimeDiagnostics: {} };
    vi.stubGlobal('getApp', () => ({ globalData }));
    const { captureSubscriptionDiagnosticRecorder, readSubscriptionDiagnostics } =
      await import('../src/platform/subscription-diagnostics.ts');
    const old = captureSubscriptionDiagnosticRecorder();
    delete globalData.subscriptionDiagnostics;
    captureSubscriptionDiagnosticRecorder();
    old({ stage: 'authorization', outcome: 'accepted' });
    expect(readSubscriptionDiagnostics()).toEqual([]);
    permissions.allowed = false;
  });
  it('keeps only safe bounded subscription stages and clears on account change', async () => {
    const { createSubscriptionDiagnosticStore } =
      await import('../src/platform/subscription-diagnostics.ts');
    const store = createSubscriptionDiagnosticStore();
    for (let i = 0; i < 30; i++)
      store.record('account-a', {
        stage: 'authorization',
        outcome: 'accepted',
        durationMs: 8,
        errCode: 20004,
        raw: 'SECRET',
      });
    expect(store.read('account-a')).toHaveLength(12);
    expect(JSON.stringify(store.read('account-a'))).not.toContain('SECRET');
    expect(store.read('account-b')).toEqual([]);
    expect(store.read('account-a')).toEqual([]);
  });
  it('rejects unrecognized diagnostic values rather than copying arbitrary text', async () => {
    const { createSubscriptionDiagnosticStore } =
      await import('../src/platform/subscription-diagnostics.ts');
    const store = createSubscriptionDiagnosticStore();
    store.record('a', { stage: 'SECRET', outcome: 'SECRET' });
    expect(store.read('a')).toEqual([]);
  });
});
