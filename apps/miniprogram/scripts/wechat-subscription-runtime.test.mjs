import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ snapshot: vi.fn() }));
vi.mock('../src/platform/subscription-diagnostics.ts', () => ({
  captureSubscriptionDiagnosticRecorder: () => () => {},
}));
vi.mock('../src/app/client-capability-store.ts', () => ({
  getClientCapabilitySnapshot: mocks.snapshot,
  ClientCapabilityDisabledError: class extends Error {},
  requireClientCapability: async () => undefined,
}));

describe('WeChat subscription user gesture boundary', () => {
  beforeEach(() => {
    mocks.snapshot.mockReturnValue({ global: true, externalMessages: true });
    vi.stubGlobal('wx', { requestSubscribeMessage: vi.fn() });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('invokes native subscription before the click stack returns', async () => {
    const { requestWechatSubscriptions } = await import('../src/platform/wechat-subscription.ts');
    const pending = requestWechatSubscriptions(['template']);
    expect(globalThis.wx.requestSubscribeMessage).toHaveBeenCalledTimes(1);
    globalThis.wx.requestSubscribeMessage.mock.calls[0][0].success({ template: 'accept' });
    await expect(pending).resolves.toMatchObject([{ status: 'accepted' }]);
  });

  it('fails closed without a loaded enabled capability snapshot', async () => {
    const { requestWechatSubscriptions } = await import('../src/platform/wechat-subscription.ts');
    mocks.snapshot.mockReturnValue({ global: false, externalMessages: false });
    await expect(requestWechatSubscriptions(['template'])).rejects.toThrow();
    expect(globalThis.wx.requestSubscribeMessage).not.toHaveBeenCalled();
  });

  it.each([20004, 10005, 10002])('preserves only safe classified error code %s', async (code) => {
    const { requestWechatSubscriptions } = await import('../src/platform/wechat-subscription.ts');
    const pending = requestWechatSubscriptions(['template']);
    await Promise.resolve();
    globalThis.wx.requestSubscribeMessage.mock.calls[0][0].fail({
      errCode: code,
      errMsg: 'private runtime detail should not escape',
    });
    await expect(pending).rejects.toMatchObject({ code });
    await expect(pending).rejects.not.toThrow('private runtime detail');
  });
});
