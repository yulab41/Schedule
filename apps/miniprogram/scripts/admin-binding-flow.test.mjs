import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  confirm: vi.fn(),
  memberPreview: vi.fn(),
  legacyPreview: vi.fn(),
  persist: vi.fn(),
}));
vi.mock('../src/platform/wechat-identity.ts', () => ({
  confirmAdminBinding: mocks.confirm,
  getIdentityErrorMessage: (error) => String(error),
  persistWechatSession: mocks.persist,
  previewAdminBinding: mocks.legacyPreview,
  previewMemberBinding: mocks.memberPreview,
  WechatIdentityClientError: class WechatIdentityClientError extends Error {},
}));
vi.mock('../src/app/client-capability-store.ts', () => ({
  ClientCapabilityDisabledError: class ClientCapabilityDisabledError extends Error {},
  requireClientCapability: () => Promise.resolve(),
}));

let definition;
let runtime;
beforeEach(async () => {
  vi.resetModules();
  mocks.confirm.mockReset();
  mocks.memberPreview.mockReset();
  mocks.legacyPreview.mockReset();
  mocks.persist.mockReset();
  runtime = { reLaunch: vi.fn(), navigateTo: vi.fn() };
  vi.stubGlobal('wx', runtime);
  vi.stubGlobal('Page', (value) => {
    definition = value;
  });
  for (const key of ['API_BASE_URL', 'BUILD_COMMIT', 'BUILD_PROFILE', 'BUILD_VERSION']) {
    vi.stubGlobal(`__MINIPROGRAM_${key}__`, 'test');
  }
  await import('../src/pages/admin-bind/preview.ts');
});
afterEach(() => vi.unstubAllGlobals());

function page() {
  return {
    ...definition,
    _ticket: 'member-ticket',
    data: { ...definition.data },
    setData(patch) {
      Object.assign(this.data, patch);
    },
  };
}

describe('member binding page', () => {
  it('shows full QR identity and completes binding with one confirmation', async () => {
    mocks.memberPreview.mockResolvedValue({
      realName: '测试医生',
      employeeCode: 'D123',
      expiresAt: '2026-09-25T00:00:00.000Z',
    });
    mocks.confirm.mockResolvedValue({ status: 'authenticated', token: 'test' });
    const instance = page();
    instance.onLoad({ ticket: 'member-ticket' });
    await vi.waitFor(() => expect(instance.data.mode).toBe('preview'));
    expect(instance.data).toMatchObject({ realName: '测试医生', employeeCode: 'D123' });
    instance.handleConfirm();
    await vi.waitFor(() => expect(runtime.reLaunch).toHaveBeenCalledOnce());
    expect(mocks.confirm).toHaveBeenCalledOnce();
    expect(runtime.reLaunch).toHaveBeenCalledWith({ url: '/pages/workbench/index' });
  });

  it('opens the guest-code entry from the decline or error state', () => {
    const instance = page();
    instance.handleGuest();
    expect(runtime.navigateTo).toHaveBeenCalledWith({ url: '/pages/guest-entry/index' });
  });
});
