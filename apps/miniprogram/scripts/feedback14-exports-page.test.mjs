import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const groupId = '11111111-1111-4111-8111-111111111111';
const config = { roles: [{ id: 'role-1', name: 'fixture role' }], shiftTypes: [] };
const members = [{ id: 'member-1', realName: 'fixture member', isPendingRoster: false }];
const mocks = vi.hoisted(() => ({
  requireClientCapability: vi.fn(),
  getSchedulingConfig: vi.fn(),
  listGroupMembers: vi.fn(),
  createExportJob: vi.fn(),
  getExportJob: vi.fn(),
}));

vi.mock('../src/app/client-capability-store.ts', () => ({
  ClientCapabilityDisabledError: class ClientCapabilityDisabledError extends Error {},
  requireClientCapability: mocks.requireClientCapability,
}));
vi.mock('../src/platform/client-core-calendar.ts', () => ({
  createRuntimeOrganizationReadClient: () => ({
    getSchedulingConfig: mocks.getSchedulingConfig,
    listGroupMembers: mocks.listGroupMembers,
  }),
  createRuntimeP9InsightsActionsClient: () => ({
    createExportJob: mocks.createExportJob,
    getExportJob: mocks.getExportJob,
  }),
}));
vi.mock('../src/platform/wechat-identity.ts', () => ({
  getStoredWechatToken: () => 'fixture-token',
  getWechatRequestAuthentication: () => undefined,
}));
vi.mock('../src/platform/secure-download.ts', () => ({
  downloadScheduleExport: vi.fn(),
  releaseTemporaryExport: vi.fn(),
  shareScheduleExport: vi.fn(),
}));

// This runs the real Page and controller in Node. It does not measure Skyline rendering.
describe('feedback14 real export Page first-entry lifecycle', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.stubGlobal('Page', vi.fn());
    vi.stubGlobal('wx', {
      getWindowInfo: () => ({ statusBarHeight: 32, windowWidth: 390, windowHeight: 844 }),
      navigateBack: vi.fn(),
    });
    mocks.requireClientCapability.mockResolvedValue(undefined);
    mocks.getSchedulingConfig.mockResolvedValue(config);
    mocks.listGroupMembers.mockResolvedValue(members);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('keeps shell data ready before options resolve through load/show/ready/hide/show/unload', async () => {
    const options = deferred();
    mocks.getSchedulingConfig.mockReturnValueOnce(options.promise);
    const { definition, page } = await realPage();

    definition.onLoad.call(page, { groupId: encodeURIComponent(groupId) });
    definition.onShow.call(page);
    definition.onReady.call(page);
    expectShell(page);
    expect(page.data.state).toBe('loading');
    await vi.advanceTimersByTimeAsync(0);
    definition.onHide.call(page);
    definition.onShow.call(page);
    expectShell(page);
    expect(page.data.state).toBe('loading');
    options.resolve(config);
    await vi.advanceTimersByTimeAsync(0);

    expect(page.data.state).toBe('idle');
    expect(page.data.roleOptions[1].label).toBe('fixture role');
    expect(mocks.getSchedulingConfig).toHaveBeenCalledTimes(1);
    expect(mocks.listGroupMembers).toHaveBeenCalledTimes(1);
    definition.handleBack.call(page);
    expect(globalThis.wx.navigateBack).toHaveBeenCalledWith({ delta: 1 });
    definition.onUnload.call(page);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['requireClientCapability', 'getSchedulingConfig', 'listGroupMembers'])(
    'keeps the shell while %s hangs, times out at 30 seconds, and ignores late completion',
    async (method) => {
      const pending = deferred();
      mocks[method].mockReturnValueOnce(pending.promise);
      const { definition, page } = await realPage();
      definition.onLoad.call(page, { groupId });
      definition.onShow.call(page);
      definition.onReady.call(page);
      await vi.advanceTimersByTimeAsync(29_999);
      expect(page.data.state).toBe('loading');
      expectShell(page);
      await vi.advanceTimersByTimeAsync(1);
      expect(page.data.state).toBe('error');
      expect(page.data.errorMessage).toContain('超时');
      const timedOutData = structuredClone(page.data);
      definition.onHide.call(page);
      definition.onShow.call(page);
      pending.resolve(method === 'getSchedulingConfig' ? config : members);
      await vi.advanceTimersByTimeAsync(0);
      expect(page.data).toEqual(timedOutData);
      if (method === 'requireClientCapability') {
        expect(mocks.getSchedulingConfig).not.toHaveBeenCalled();
        expect(mocks.listGroupMembers).not.toHaveBeenCalled();
      }
      definition.onUnload.call(page);
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it('does not mutate an unloaded Page or request options after a late capability result', async () => {
    const pending = deferred();
    mocks.requireClientCapability.mockReturnValueOnce(pending.promise);
    const { definition, page } = await realPage();
    definition.onLoad.call(page, { groupId });
    definition.onShow.call(page);
    definition.onReady.call(page);
    definition.onHide.call(page);
    definition.onUnload.call(page);
    const unloadedData = structuredClone(page.data);
    pending.resolve();
    await vi.advanceTimersByTimeAsync(30_001);
    expect(page.data).toEqual(unloadedData);
    expect(mocks.getSchedulingConfig).not.toHaveBeenCalled();
    expect(mocks.listGroupMembers).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});

async function realPage() {
  await import('../src/subpackages/insights/pages/exports/index.ts');
  expect(globalThis.Page).toHaveBeenCalledTimes(1);
  const definition = globalThis.Page.mock.calls[0][0];
  const page = {
    ...definition,
    data: structuredClone(definition.data),
    setData(patch) {
      Object.assign(this.data, patch);
    },
  };
  return { definition, page };
}

function expectShell(page) {
  expect(page.data.shellHeaderStyle).toBe('height:84px;min-height:84px;padding-top:32px;');
  expect(page.data.pageScrollStyle).toBe('height:calc(100% - 84px);');
  expect(page.properties.groupId).toBe(groupId);
  expect(typeof page.handleBack).toBe('function');
}

function deferred() {
  let resolve;
  const promise = new Promise((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}
