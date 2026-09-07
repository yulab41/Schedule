import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({
  allowed: true,
  owner: 'owner',
  generation: 1,
  templates: vi.fn(),
  inspect: vi.fn(),
  send: vi.fn(),
  subscribe: vi.fn(),
  save: vi.fn(),
}));
vi.mock('../src/platform/diagnostics-access.ts', () => ({ canUseDiagnostics: () => mock.allowed }));
vi.mock('../src/platform/wechat-identity.ts', () => ({
  getStoredWechatProfile: () => ({ id: mock.owner }),
  getWechatSessionGeneration: () => mock.generation,
  getStoredWechatToken: () => 'token',
  getWechatRequestAuthentication: () => ({}),
}));
vi.mock('../src/platform/workbench-selection.ts', () => ({
  readStoredWorkbenchGroupId: () => 'group',
}));
vi.mock('../src/app/client-capability-store.ts', () => ({
  getClientCapabilitySnapshot: () => ({ global: true, externalMessages: true }),
}));
vi.mock('../src/platform/wechat-notification-client.ts', () => ({
  loadWechatSubscriptionTemplates: mock.templates,
  inspectWechatNotifications: mock.inspect,
  sendWechatNotificationTest: mock.send,
  saveWechatReceivingPreference: mock.save,
  WechatDiagnosticHttpError: class extends Error {
    constructor(status) {
      super(`HTTP ${status}`);
      this.status = status;
    }
  },
}));
vi.mock('../src/platform/wechat-subscription.ts', () => ({
  requestWechatSubscriptions: mock.subscribe,
  WechatSubscriptionError: class extends Error {},
}));
vi.mock('../src/platform/subscription-diagnostics.ts', () => ({
  readSubscriptionDiagnostics: () => [],
  captureSubscriptionDiagnosticRecorder: () => () => {},
}));
vi.mock('../src/platform/client-core-calendar.ts', () => ({
  createRuntimeNotificationPreferencesClient: () => ({ updateMine: mock.save }),
}));
let module;
beforeEach(async () => {
  vi.clearAllMocks();
  mock.allowed = true;
  mock.owner = 'owner';
  mock.generation = 1;
  mock.templates.mockResolvedValue(['PRIVATE-TEMPLATE']);
  mock.inspect.mockResolvedValue({ deliveries: [], tests: [], identityMatches: true });
  mock.subscribe.mockResolvedValue([{ granted: true, status: 'accepted' }]);
  mock.save.mockResolvedValue({});
  mock.send.mockResolvedValue({ outcome: 'accepted', category: 'wechat-accepted', phase: 'send' });
  vi.stubGlobal('wx', {
    requestSubscribeMessage() {},
    getSetting(options) {
      options.success({
        subscriptionsSetting: { mainSwitch: true, itemSettings: { 'PRIVATE-TEMPLATE': 'reject' } },
      });
    },
  });
  module = await import('../src/subpackages/diagnostics/pages/test-tools/wechat-diagnostics.ts');
});
afterEach(() => vi.unstubAllGlobals());
const page = () => ({
  data: { ...module.wechatDiagnosticData },
  setData(patch) {
    Object.assign(this.data, patch);
  },
});
const flush = async () => {
  for (let i = 0; i < 15; i++) await Promise.resolve();
};
describe('self subscription diagnostic workflow', () => {
  it.each([400, 403, 429])(
    'reports explicit server refusal %s separately from unknown delivery',
    async (status) => {
      const { WechatDiagnosticHttpError } =
        await import('../src/platform/wechat-notification-client.ts');
      const host = page();
      await module.prepareWechatDiagnosticPage(host);
      host.data.wechatGranted = true;
      mock.send.mockRejectedValue(new WechatDiagnosticHttpError(status));
      module.wechatDiagnosticMethods.handleWechatTestSend.call(host);
      await flush();
      expect(host.data.wechatTestResult).toContain('明确拒绝');
      expect(host.data.wechatTestResult).toContain(String(status));
      expect(host.data.wechatTestResult).not.toContain('结果未知');
    },
  );
  it('shows remembered refusal and empty deliveries without exposing template identity', async () => {
    const host = page();
    await module.prepareWechatDiagnosticPage(host);
    const report = module.wechatDiagnosticReport(host);
    expect(report).toContain('记住拒绝');
    expect(report).toContain('暂无投递记录');
    expect(report).not.toContain('PRIVATE');
    expect(mock.send).not.toHaveBeenCalled();
  });
  it('requests synchronously, saves only acceptance, then sends only on a separate tap', async () => {
    const host = page();
    await module.prepareWechatDiagnosticPage(host);
    module.wechatDiagnosticMethods.handleWechatSubscribe.call(host);
    expect(mock.subscribe).toHaveBeenCalledTimes(1);
    expect(mock.send).not.toHaveBeenCalled();
    await flush();
    expect(host.data.wechatGranted).toBe(true);
    module.wechatDiagnosticMethods.handleWechatTestSend.call(host);
    module.wechatDiagnosticMethods.handleWechatTestSend.call(host);
    await flush();
    expect(mock.send).toHaveBeenCalledTimes(1);
    expect(host.data.wechatTestResult).toContain('已开始调用微信发送接口');
    expect(host.data.wechatReceived).toBe('尚未人工确认');
  });
  it('rejects late permission/account callbacks and ignores pre-send receipt clicks', async () => {
    const host = page();
    await module.prepareWechatDiagnosticPage(host);
    module.wechatDiagnosticMethods.handleWechatReceived.call(host);
    expect(host.data.wechatReceived).toBe('尚未人工确认');
    let resolve;
    mock.subscribe.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    module.wechatDiagnosticMethods.handleWechatSubscribe.call(host);
    mock.owner = 'another';
    mock.generation++;
    resolve([{ granted: true, status: 'accepted' }]);
    await flush();
    expect(mock.save).not.toHaveBeenCalled();
    expect(mock.send).not.toHaveBeenCalled();
  });
  it('never saves a rejection or repeats a failed send', async () => {
    const host = page();
    await module.prepareWechatDiagnosticPage(host);
    mock.subscribe.mockResolvedValue([{ granted: false, status: 'rejected' }]);
    module.wechatDiagnosticMethods.handleWechatSubscribe.call(host);
    await flush();
    expect(mock.save).not.toHaveBeenCalled();
    host.data.wechatGranted = true;
    mock.send.mockRejectedValue(new Error('PRIVATE'));
    module.wechatDiagnosticMethods.handleWechatTestSend.call(host);
    await flush();
    expect(host.data.wechatTestResult).toContain('结果未知');
    module.wechatDiagnosticMethods.handleWechatTestSend.call(host);
    expect(mock.send).toHaveBeenCalledTimes(1);
  });
});
