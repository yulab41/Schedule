import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const groupId = '11111111-1111-4111-8111-111111111111';
const otherGroupId = '22222222-2222-4222-8222-222222222222';
const mocks = vi.hoisted(() => ({
  ClientCapabilityDisabledError: class ClientCapabilityDisabledError extends Error {},
  listAggregates: vi.fn(),
  listLogs: vi.fn(),
  requireClientCapability: vi.fn(),
}));

vi.mock('../src/app/client-capability-store.ts', () => ({
  ClientCapabilityDisabledError: mocks.ClientCapabilityDisabledError,
  requireClientCapability: mocks.requireClientCapability,
}));

vi.mock('../src/platform/client-core-calendar.ts', () => ({
  createRuntimeVisitorAccessReadClient: () => ({
    listAggregates: mocks.listAggregates,
    listLogs: mocks.listLogs,
  }),
}));

vi.mock('../src/platform/wechat-identity.ts', () => ({
  getStoredWechatToken: () => 'token',
  getWechatRequestAuthentication: () => undefined,
}));

describe('Mini visitor access controller parity', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal('wx', {
      getWindowInfo: () => ({ statusBarHeight: 24, windowHeight: 844, windowWidth: 390 }),
      navigateBack: vi.fn(),
    });
    mocks.requireClientCapability.mockResolvedValue(undefined);
    mocks.listAggregates.mockResolvedValue({
      aggregates: [
        { accessCount: '6', accessMonth: '2026-09', businessMonth: '2026-09' },
        { accessCount: '12', accessMonth: '2026-08', businessMonth: '2026-08' },
      ],
    });
    mocks.listLogs.mockResolvedValue({
      logs: [
        {
          businessMonth: '2026-08',
          clientIp: '203.0.113.10',
          createdAt: '2026-08-01T16:30:00.000Z',
          groupId,
          id: 'log-1',
          requestId: 'req-9a2b3c4d5e6f',
        },
      ],
      nextCursor: 'cursor-1',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads the Web-sized pages and presents aggregate/log values in Web order', async () => {
    const definition = await controllerDefinition();
    const page = pageFor(definition, groupId);
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));

    expect(mocks.listAggregates).toHaveBeenCalledWith(groupId);
    expect(mocks.listLogs).toHaveBeenCalledWith(groupId);
    expect(page.data.aggregateCountLabel).toBe('18 次');
    expect(page.data.aggregates.map((item) => item.accessMonth)).toEqual(['2026-08', '2026-09']);
    expect(page.data.logs[0]).toMatchObject({
      businessMonthLabel: '2026-08',
      createdAtLabel: '2026-08-02 00:30',
      ipLabel: '203.0.113.*',
      requestIdLabel: '请求 req-9a2…5e6f',
    });
  });

  it('loads the next log page with only the same cursor', async () => {
    const definition = await controllerDefinition();
    const page = pageFor(definition, groupId);
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));
    mocks.listLogs.mockResolvedValueOnce({
      logs: [
        {
          businessMonth: '2026-07',
          createdAt: '2026-07-31T16:00:00.000Z',
          groupId,
          id: 'log-2',
        },
      ],
    });

    definition.methods.handleLoadMore.call(page);
    await vi.waitFor(() => expect(page.data.loadingMore).toBe(false));

    expect(mocks.listLogs).toHaveBeenLastCalledWith(groupId, { cursor: 'cursor-1' });
    expect(page.data.logs).toHaveLength(2);
    expect(page.data.logCountLabel).toBe('2 条');
  });

  it('does not commit a pending response after the component detaches', async () => {
    let resolveAggregates;
    let resolveLogs;
    mocks.listAggregates.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveAggregates = resolve;
        }),
    );
    mocks.listLogs.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveLogs = resolve;
        }),
    );
    const definition = await controllerDefinition();
    const page = pageFor(definition, groupId);
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(mocks.listLogs).toHaveBeenCalledTimes(1));
    definition.lifetimes.detached.call(page);
    resolveAggregates({
      aggregates: [{ accessCount: '99', accessMonth: '2026-10', businessMonth: '2026-10' }],
    });
    resolveLogs({
      logs: [
        { businessMonth: '2026-10', createdAt: '2026-10-01T00:00:00.000Z', groupId, id: 'stale' },
      ],
    });
    await flushPromises();

    expect(page.data.state).toBe('loading');
    expect(page.data.logs).toEqual([]);
  });

  it('ignores a pending old-group response after a group switch', async () => {
    let resolveOldAggregates;
    let resolveOldLogs;
    mocks.listAggregates.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOldAggregates = resolve;
        }),
    );
    mocks.listLogs.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOldLogs = resolve;
        }),
    );
    const definition = await controllerDefinition();
    const page = pageFor(definition, groupId);
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(mocks.listLogs).toHaveBeenCalledTimes(1));
    mocks.listAggregates.mockImplementationOnce(() => new Promise(() => {}));
    mocks.listLogs.mockImplementationOnce(() => new Promise(() => {}));
    page.properties.groupId = otherGroupId;
    definition.observers.groupId.call(page);
    resolveOldAggregates({
      aggregates: [{ accessCount: '99', accessMonth: '2026-10', businessMonth: '2026-10' }],
    });
    resolveOldLogs({
      logs: [
        { businessMonth: '2026-10', createdAt: '2026-10-01T00:00:00.000Z', groupId, id: 'stale' },
      ],
    });
    await flushPromises();

    expect(page.data.groupId).toBe(otherGroupId);
    expect(page.data.logs).toEqual([]);
  });

  it('fails closed before issuing either read when insights is disabled', async () => {
    mocks.requireClientCapability.mockRejectedValueOnce(
      new mocks.ClientCapabilityDisabledError('insights'),
    );
    const definition = await controllerDefinition();
    const page = pageFor(definition, groupId);
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('disabled'));

    expect(mocks.listAggregates).not.toHaveBeenCalled();
    expect(mocks.listLogs).not.toHaveBeenCalled();
  });

  it('marks the page as large text when the system font setting requests it', async () => {
    globalThis.wx.getWindowInfo = () => ({
      fontSizeSetting: 20,
      statusBarHeight: 24,
      windowHeight: 844,
      windowWidth: 390,
    });
    const definition = await controllerDefinition();
    const page = pageFor(definition, groupId);
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));

    expect(page.data.largeText).toBe(true);
  });
});

async function controllerDefinition() {
  const module =
    await import('../src/subpackages/insights/components/visitor-access-panel/controller.ts');
  return module.createVisitorAccessPanelControllerDefinition();
}

function pageFor(definition, initialGroupId) {
  return {
    data: { ...definition.data },
    properties: { groupId: initialGroupId },
    setData(patch) {
      this.data = { ...this.data, ...patch };
    },
  };
}

async function flushPromises() {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}
