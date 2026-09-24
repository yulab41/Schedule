import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ recovery: vi.fn() }));
vi.mock('../src/platform/wechat-identity.ts', () => ({
  WechatIdentityClientError: class WechatIdentityClientError extends Error {},
  awaitWechatSessionRecovery: mocks.recovery,
  getStoredWechatToken: () => 'stored-token',
  getStoredWechatProfile: () => ({ id: 'user-id', realName: '成员', version: 1 }),
  getWechatSessionGeneration: () => 1,
  getIdentityErrorMessage: () => '操作失败。',
  linkWechatPassword: vi.fn(),
  loginWithPassword: vi.fn(),
  loginWithWechat: vi.fn(),
  persistPasswordSession: vi.fn(),
  persistWechatSession: vi.fn(),
}));
vi.mock('../src/app/client-capability-store.ts', () => ({
  ClientCapabilityDisabledError: class ClientCapabilityDisabledError extends Error {},
  requireClientCapability: () => Promise.resolve(),
}));

let definition;
let runtime;
beforeEach(async () => {
  vi.resetModules();
  mocks.recovery.mockReset();
  runtime = { reLaunch: vi.fn() };
  vi.stubGlobal('wx', runtime);
  vi.stubGlobal('Page', (value) => {
    definition = value;
  });
  for (const key of ['API_BASE_URL', 'BUILD_COMMIT', 'BUILD_PROFILE', 'BUILD_VERSION']) {
    vi.stubGlobal(`__MINIPROGRAM_${key}__`, 'test');
  }
  await import('../src/pages/identity/index.ts');
});
afterEach(() => vi.unstubAllGlobals());

function page() {
  return {
    ...definition,
    data: { ...definition.data },
    setData(patch) {
      Object.assign(this.data, patch);
    },
  };
}

describe('identity page forced login entry', () => {
  it('keeps the login form open when returning from a binding page with a stored session', async () => {
    const instance = page();
    instance.onLoad({ forceLogin: '1' });
    await Promise.resolve();

    expect(instance._forceLogin).toBe(true);
    expect(instance.data.loading).toBe(false);
    expect(mocks.recovery).not.toHaveBeenCalled();
    expect(runtime.reLaunch).not.toHaveBeenCalled();
  });

  it('preserves the default authenticated startup behavior', () => {
    const instance = page();
    instance.onLoad();

    expect(runtime.reLaunch).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/pages/workbench/index' }),
    );
  });
});
