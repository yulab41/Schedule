import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const groupId = '11111111-1111-4111-8111-111111111111';
const mocks = vi.hoisted(() => ({
  ClientCapabilityDisabledError: class ClientCapabilityDisabledError extends Error {},
  createExportJob: vi.fn(),
  downloadScheduleExport: vi.fn(),
  getExportJob: vi.fn(),
  getSchedulingConfig: vi.fn(),
  listGroupMembers: vi.fn(),
  requireClientCapability: vi.fn(),
}));

vi.mock('../src/app/client-capability-store.ts', () => ({
  ClientCapabilityDisabledError: mocks.ClientCapabilityDisabledError,
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

vi.mock('../src/platform/secure-download.ts', () => ({
  downloadScheduleExport: mocks.downloadScheduleExport,
}));

vi.mock('../src/platform/wechat-identity.ts', () => ({
  getStoredWechatToken: () => 'token',
  getWechatRequestAuthentication: () => undefined,
}));

describe('Mini export controller mirrors Web selection and polling', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal('wx', {
      getWindowInfo: () => ({ statusBarHeight: 24, windowHeight: 844, windowWidth: 390 }),
      navigateBack: vi.fn(),
      openDocument: vi.fn(),
    });
    mocks.requireClientCapability.mockResolvedValue(undefined);
    mocks.getSchedulingConfig.mockResolvedValue({
      groupMembers: [],
      roles: [{ id: 'role-1', name: '住院总' }],
      shiftTypes: [],
    });
    mocks.listGroupMembers.mockResolvedValue([
      { id: 'member-1', isPendingRoster: false, realName: 'A 医生' },
      { id: 'pending-1', isPendingRoster: true, realName: '待认领' },
    ]);
    mocks.createExportJob.mockResolvedValue(exportJob('pending'));
    mocks.getExportJob.mockResolvedValue(exportJob('completed'));
    mocks.downloadScheduleExport.mockResolvedValue('wxfile://export.csv');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('loads filters, reads native picker indexes, exports a year and opens the CSV safely', async () => {
    const definition = await controllerDefinition();
    const page = pageFor(definition);
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('idle'));

    expect(page.data.roleOptions.map((option) => option.label)).toEqual(['全部岗位', '住院总']);
    expect(page.data.memberOptions.map((option) => option.label)).toEqual(['全部成员', 'A 医生']);
    definition.methods.handleTypeChange.call(page, { detail: { value: '1' } });
    definition.methods.handlePeriodType.call(page, {
      currentTarget: { dataset: { periodType: 'year' } },
    });
    definition.methods.handleRoleChange.call(page, { detail: { value: '1' } });
    definition.methods.handleMemberChange.call(page, { detail: { value: '1' } });
    expect(page.data.selectionSummary).toBe('统计 · 2026年');

    definition.methods.handleCreate.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));
    expect(mocks.createExportJob).toHaveBeenCalledWith(groupId, {
      exportType: 'statistics',
      membershipId: 'member-1',
      period: '2026',
      roleId: 'role-1',
    });
    expect(mocks.getExportJob).toHaveBeenCalledWith(groupId, 'job-1');
    expect(page.data.fileLabel).toBe('statistics-export-2026.csv');

    definition.methods.handleDownload.call(page);
    await vi.waitFor(() => expect(mocks.downloadScheduleExport).toHaveBeenCalledTimes(1));
    expect(globalThis.wx.openDocument).toHaveBeenCalledWith(
      expect.objectContaining({ filePath: 'wxfile://export.csv', showMenu: false }),
    );
  });

  it('checks insights before loading role or member options', async () => {
    mocks.requireClientCapability.mockRejectedValueOnce(
      new mocks.ClientCapabilityDisabledError('insights'),
    );
    const definition = await controllerDefinition();
    const page = pageFor(definition);
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('disabled'));
    expect(mocks.getSchedulingConfig).not.toHaveBeenCalled();
    expect(mocks.listGroupMembers).not.toHaveBeenCalled();
  });

  it('continues the same timed-out job without creating a duplicate', async () => {
    const definition = await controllerDefinition();
    const page = await loadedPage(definition);
    vi.useFakeTimers();
    mocks.createExportJob.mockClear();
    mocks.getExportJob.mockClear();
    mocks.createExportJob.mockResolvedValue(exportJob('pending'));
    mocks.getExportJob.mockResolvedValue(exportJob('pending'));

    definition.methods.handleCreate.call(page);
    await flushPromises();
    await vi.advanceTimersByTimeAsync(90_001);
    await flushPromises();

    expect(page.data.state).toBe('timed_out');
    expect(mocks.createExportJob).toHaveBeenCalledTimes(1);

    mocks.getExportJob.mockResolvedValue(exportJob('completed'));
    definition.methods.handleContinue.call(page);
    await flushPromises();

    expect(page.data.state).toBe('ready');
    expect(mocks.createExportJob).toHaveBeenCalledTimes(1);
    expect(mocks.getExportJob).toHaveBeenLastCalledWith(groupId, 'job-1');
  });

  it('keeps the ready job retryable after download or document-open failure', async () => {
    const definition = await controllerDefinition();
    const page = await loadedPage(definition);

    mocks.downloadScheduleExport.mockRejectedValueOnce(new Error('download failed'));
    definition.methods.handleDownload.call(page);
    await vi.waitFor(() => expect(page.data.downloadBusy).toBe(false));
    expect(page.data.state).toBe('ready');
    expect(page.data.statusLabel).toBe('文件下载失败，可重新下载');

    mocks.downloadScheduleExport.mockResolvedValueOnce('wxfile://export.csv');
    definition.methods.handleDownload.call(page);
    await vi.waitFor(() => expect(globalThis.wx.openDocument).toHaveBeenCalledTimes(1));
    globalThis.wx.openDocument.mock.calls[0][0].fail();

    expect(page.data.downloadBusy).toBe(false);
    expect(page.data.errorMessage).toBe('文件已下载，但当前设备无法打开该文件。');
    expect(page.data.statusLabel).toBe('文件打开失败，可重新下载');
  });

  it('does not open a stale file after detaching or switching groups', async () => {
    const definition = await controllerDefinition();
    const page = await loadedPage(definition);
    let resolveDownload;
    mocks.downloadScheduleExport.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveDownload = resolve;
        }),
    );

    definition.methods.handleDownload.call(page);
    await vi.waitFor(() => expect(mocks.downloadScheduleExport).toHaveBeenCalledTimes(1));
    definition.lifetimes.detached.call(page);
    resolveDownload('wxfile://stale.csv');
    await flushPromises();
    expect(globalThis.wx.openDocument).not.toHaveBeenCalled();

    const nextDefinition = await controllerDefinition();
    const nextPage = await loadedPage(nextDefinition);
    let resolveNextDownload;
    mocks.downloadScheduleExport.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveNextDownload = resolve;
        }),
    );
    nextDefinition.methods.handleDownload.call(nextPage);
    await vi.waitFor(() => expect(mocks.downloadScheduleExport).toHaveBeenCalledTimes(2));
    nextPage.properties.groupId = '22222222-2222-4222-8222-222222222222';
    nextDefinition.observers.groupId.call(nextPage);
    resolveNextDownload('wxfile://stale-after-switch.csv');
    await flushPromises();
    expect(globalThis.wx.openDocument).not.toHaveBeenCalled();
    expect(nextPage.data.groupId).toBe('22222222-2222-4222-8222-222222222222');
  });
});

async function controllerDefinition() {
  const module = await import('../src/subpackages/insights/components/exports-panel/controller.ts');
  return module.createExportsPanelControllerDefinition();
}

function pageFor(definition) {
  return {
    data: { ...definition.data },
    properties: { groupId },
    setData(patch) {
      this.data = { ...this.data, ...patch };
    },
  };
}

async function loadedPage(definition) {
  const page = pageFor(definition);
  definition.lifetimes.attached.call(page);
  await vi.waitFor(() => expect(page.data.state).toBe('idle'));
  definition.methods.handleCreate.call(page);
  await vi.waitFor(() => expect(page.data.state).toBe('ready'));
  return page;
}

async function flushPromises() {
  for (let index = 0; index < 6; index += 1) await Promise.resolve();
}

function exportJob(status) {
  return {
    createdAt: '2026-08-26T00:00:00.000Z',
    exportType: 'statistics',
    groupId,
    id: 'job-1',
    period: '2026',
    periodType: 'year',
    status,
  };
}
