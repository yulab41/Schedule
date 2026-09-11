import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const groupId = '11111111-1111-4111-8111-111111111111';
const mocks = vi.hoisted(() => ({
  ClientCapabilityDisabledError: class ClientCapabilityDisabledError extends Error {},
  createExportJob: vi.fn(),
  downloadScheduleExport: vi.fn(),
  releaseTemporaryExport: vi.fn(),
  shareScheduleExport: vi.fn(),
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
  releaseTemporaryExport: mocks.releaseTemporaryExport,
  shareScheduleExport: mocks.shareScheduleExport,
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
    mocks.shareScheduleExport.mockResolvedValue('shared');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('runs the actual direct Page controller through cold entry, show, hide, unload and re-entry', async () => {
    vi.stubGlobal('Page', vi.fn());
    await import('../src/subpackages/insights/pages/exports/index.ts');
    const definition = globalThis.Page.mock.calls[0][0];
    for (let entry = 0; entry < 2; entry++) {
      const page = {
        data: structuredClone(definition.data),
        setData(patch) {
          Object.assign(this.data, patch);
        },
      };
      expect(() => definition.onLoad.call(page, { groupId })).not.toThrow();
      expect(() => definition.onShow.call(page)).not.toThrow();
      await vi.waitFor(() => expect(page.data.state).toBe('idle'));
      expect(page.data.roleOptions).toHaveLength(2);
      definition.onHide.call(page);
      expect(page._visible).toBe(false);
      definition.onShow.call(page);
      expect(page._visible).toBe(true);
      definition.onUnload.call(page);
      expect(page._attached).toBe(false);
    }
    expect(mocks.getSchedulingConfig).toHaveBeenCalledTimes(2);
  });

  it('shows load failures through the actual Page and recovers on retry', async () => {
    mocks.getSchedulingConfig.mockRejectedValueOnce(new Error('fixture'));
    vi.stubGlobal('Page', vi.fn());
    await import('../src/subpackages/insights/pages/exports/index.ts');
    const definition = globalThis.Page.mock.calls[0][0];
    const page = {
      data: structuredClone(definition.data),
      setData(patch) {
        Object.assign(this.data, patch);
      },
    };
    definition.onLoad.call(page, { groupId });
    definition.onShow.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('error'));
    expect(page.data.errorMessage).not.toBe('');
    definition.handleRetry.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('idle'));
    definition.onUnload.call(page);
  });

  it('loads filters, exports a year, downloads privately and only shares on a separate click', async () => {
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
    expect(page.data.state).toBe('downloaded');
    expect(globalThis.wx.openDocument).not.toHaveBeenCalled();
    expect(mocks.shareScheduleExport).not.toHaveBeenCalled();
    expect(JSON.stringify(page.data)).not.toContain('wxfile:');
    definition.methods.handleShare.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('shared'));
    expect(mocks.shareScheduleExport).toHaveBeenCalledWith(
      'wxfile://export.csv',
      'statistics-export-2026.csv',
    );
  });

  it('tracks system large text independently from the compact viewport', async () => {
    globalThis.wx.getWindowInfo = () => ({
      statusBarHeight: 24,
      windowHeight: 844,
      windowWidth: 320,
      fontSizeSetting: 20,
    });
    const definition = await controllerDefinition();
    const page = pageFor(definition);
    definition.lifetimes.attached.call(page);

    await vi.waitFor(() => expect(page.data.state).toBe('idle'));
    expect(page.data.largeText).toBe(true);
    expect(page.data.viewportClass).toBe('is-compact');
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
    definition.methods.handleReset.call(page);
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

  it('stops foreground waiting if a status request stalls after 26 successful polls', async () => {
    vi.useFakeTimers();
    const definition = await controllerDefinition();
    const page = pageFor(definition);
    definition.lifetimes.attached.call(page);
    await vi.advanceTimersByTimeAsync(0);
    let calls = 0;
    mocks.getExportJob.mockImplementation(() =>
      ++calls <= 26 ? Promise.resolve(exportJob('pending')) : new Promise(() => {}),
    );
    definition.methods.handleCreate.call(page);
    await vi.advanceTimersByTimeAsync(90_001);
    expect(page.data.state).toBe('timed_out');
    expect(page._jobId).toBe('job-1');
    expect(mocks.createExportJob).toHaveBeenCalledTimes(1);
  });

  it('bounds creation preflight even when capability checking never settles', async () => {
    vi.useFakeTimers();
    const definition = await controllerDefinition();
    const page = pageFor(definition);
    definition.lifetimes.attached.call(page);
    await vi.advanceTimersByTimeAsync(0);
    mocks.requireClientCapability.mockImplementationOnce(() => new Promise(() => {}));
    definition.methods.handleCreate.call(page);
    await vi.advanceTimersByTimeAsync(30_001);
    expect(page.data.state).toBe('timed_out');
    expect(mocks.createExportJob).not.toHaveBeenCalled();
  });
  it('allows safe retry when stopped before the create request was issued', async () => {
    vi.useFakeTimers();
    const definition = await controllerDefinition();
    const page = pageFor(definition);
    definition.lifetimes.attached.call(page);
    await vi.advanceTimersByTimeAsync(0);
    mocks.requireClientCapability.mockImplementationOnce(() => new Promise(() => {}));
    definition.methods.handleCreate.call(page);
    await vi.advanceTimersByTimeAsync(0);
    definition.methods.handleStopWaiting.call(page);
    await vi.advanceTimersByTimeAsync(0);
    expect(page.data.state).toBe('idle');
    definition.methods.handleCreate.call(page);
    await vi.advanceTimersByTimeAsync(0);
    expect(page.data.state).toBe('ready');
    expect(mocks.createExportJob).toHaveBeenCalledTimes(1);
  });
  it('does not offer another POST after a transport failure made creation uncertain', async () => {
    vi.useFakeTimers();
    const { ClientCoreError } = await import('@schedule/client-core');
    const definition = await controllerDefinition();
    const page = pageFor(definition);
    definition.lifetimes.attached.call(page);
    await vi.advanceTimersByTimeAsync(0);
    mocks.createExportJob.mockRejectedValueOnce(
      new ClientCoreError({ code: 'NETWORK_ERROR', message: '网络未知' }),
    );
    definition.methods.handleCreate.call(page);
    await vi.advanceTimersByTimeAsync(0);
    expect(page.data.state).toBe('timed_out');
    expect(page.data.canRetryCreate).toBe(false);
    definition.methods.handleCreate.call(page);
    expect(mocks.createExportJob).toHaveBeenCalledTimes(1);
  });

  it('stops immediately and ignores a late status result after checking the same job again', async () => {
    vi.useFakeTimers();
    const definition = await controllerDefinition();
    const page = pageFor(definition);
    definition.lifetimes.attached.call(page);
    await vi.advanceTimersByTimeAsync(0);
    let finishOld;
    mocks.getExportJob.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishOld = resolve;
        }),
    );
    definition.methods.handleCreate.call(page);
    await vi.advanceTimersByTimeAsync(0);
    definition.methods.handleStopWaiting.call(page);
    expect(page.data.state).toBe('paused');
    await vi.advanceTimersByTimeAsync(0);
    definition.methods.handleContinue.call(page);
    definition.methods.handleContinue.call(page);
    await vi.advanceTimersByTimeAsync(0);
    expect(page.data.state).toBe('ready');
    finishOld(exportJob('failed'));
    await vi.advanceTimersByTimeAsync(0);
    expect(page.data.state).toBe('ready');
    expect(mocks.createExportJob).toHaveBeenCalledTimes(1);
    expect(mocks.getExportJob).toHaveBeenCalledTimes(2);
  });

  it('pauses in the background and resumes one existing task on return', async () => {
    vi.useFakeTimers();
    const definition = await controllerDefinition();
    const page = pageFor(definition);
    definition.lifetimes.attached.call(page);
    await vi.advanceTimersByTimeAsync(0);
    mocks.getExportJob.mockResolvedValue(exportJob('pending'));
    definition.methods.handleCreate.call(page);
    await vi.advanceTimersByTimeAsync(2_000);
    definition.pageLifetimes.hide.call(page);
    const count = mocks.getExportJob.mock.calls.length;
    await vi.advanceTimersByTimeAsync(120_000);
    expect(page.data.state).toBe('paused');
    expect(mocks.getExportJob).toHaveBeenCalledTimes(count);
    mocks.getExportJob.mockResolvedValue(exportJob('completed'));
    definition.pageLifetimes.show.call(page);
    definition.pageLifetimes.show.call(page);
    await vi.advanceTimersByTimeAsync(0);
    expect(page.data.state).toBe('ready');
    expect(mocks.getExportJob).toHaveBeenCalledTimes(count + 1);
    expect(mocks.createExportJob).toHaveBeenCalledTimes(1);
    definition.lifetimes.detached.call(page);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('recovers a late create ID after timeout without reissuing the POST', async () => {
    vi.useFakeTimers();
    const definition = await controllerDefinition();
    const page = pageFor(definition);
    definition.lifetimes.attached.call(page);
    await vi.advanceTimersByTimeAsync(0);
    let finishCreate;
    mocks.createExportJob.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishCreate = resolve;
        }),
    );
    definition.methods.handleCreate.call(page);
    await vi.advanceTimersByTimeAsync(30_001);
    expect(page.data.state).toBe('timed_out');
    definition.methods.handleCreate.call(page);
    expect(mocks.createExportJob).toHaveBeenCalledTimes(1);
    finishCreate(exportJob('pending'));
    await vi.advanceTimersByTimeAsync(0);
    expect(page.data.canCheckJob).toBe(true);
    expect(page.data.state).toBe('timed_out');
    definition.methods.handleContinue.call(page);
    await vi.advanceTimersByTimeAsync(0);
    expect(page.data.state).toBe('ready');
  });

  it('closes a ready job when insights is disabled during status polling', async () => {
    const definition = await controllerDefinition();
    const page = await loadedPage(definition);
    mocks.getExportJob.mockRejectedValueOnce(
      new mocks.ClientCapabilityDisabledError('insights disabled'),
    );

    definition.methods.handleContinue.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('disabled'));

    expect(page.data.fileLabel).toBe('');
    expect(page.data.errorMessage).toBe('insights disabled');
    expect(page._jobId).toBeUndefined();
  });

  it('closes the ready file state when insights is disabled during download', async () => {
    const definition = await controllerDefinition();
    const page = await loadedPage(definition);
    mocks.downloadScheduleExport.mockRejectedValueOnce(
      new mocks.ClientCapabilityDisabledError('insights disabled'),
    );

    definition.methods.handleDownload.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('disabled'));

    expect(page.data.downloadBusy).toBe(false);
    expect(page.data.fileLabel).toBe('');
    expect(page.data.errorMessage).toBe('insights disabled');
    expect(page._jobId).toBeUndefined();
  });

  it('retries downloading the same generated job without contradictory success state', async () => {
    const definition = await controllerDefinition();
    const page = await loadedPage(definition);

    mocks.downloadScheduleExport.mockRejectedValueOnce(new Error('download failed'));
    definition.methods.handleDownload.call(page);
    await vi.waitFor(() => expect(page.data.downloadBusy).toBe(false));
    expect(page.data.state).toBe('download_failed');
    expect(page.data.statusLabel).toBe('文件下载失败，可重新下载');

    mocks.downloadScheduleExport.mockResolvedValueOnce('wxfile://export.csv');
    definition.methods.handleDownload.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('downloaded'));
    expect(page.data.downloadBusy).toBe(false);
    expect(page.data.errorMessage).toBe('');
    expect(mocks.createExportJob).toHaveBeenCalledTimes(1);
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
    expect(mocks.releaseTemporaryExport).toHaveBeenCalledWith('wxfile://stale.csv');

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
    expect(mocks.releaseTemporaryExport).toHaveBeenCalledWith('wxfile://stale-after-switch.csv');
  });

  it.each(['handleReset', 'detach', 'switch'])(
    'cleans a downloaded private file on %s',
    async (action) => {
      const definition = await controllerDefinition();
      const page = await loadedPage(definition);
      definition.methods.handleDownload.call(page);
      await vi.waitFor(() => expect(page.data.state).toBe('downloaded'));
      if (action === 'detach') definition.lifetimes.detached.call(page);
      else if (action === 'switch') {
        page.properties.groupId = '';
        definition.observers.groupId.call(page);
      } else definition.methods[action].call(page);
      expect(mocks.releaseTemporaryExport).toHaveBeenCalledWith('wxfile://export.csv');
      expect(page._tempFilePath).toBeUndefined();
    },
  );

  it('prevents duplicate download/share clicks and leaves cancelled sharing retryable', async () => {
    const definition = await controllerDefinition();
    const page = await loadedPage(definition);
    definition.methods.handleDownload.call(page);
    definition.methods.handleDownload.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('downloaded'));
    expect(mocks.downloadScheduleExport).toHaveBeenCalledTimes(1);
    let finishShare;
    mocks.shareScheduleExport.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishShare = resolve;
        }),
    );
    definition.methods.handleShare.call(page);
    definition.methods.handleShare.call(page);
    expect(mocks.shareScheduleExport).toHaveBeenCalledTimes(1);
    finishShare('cancelled');
    await vi.waitFor(() => expect(page.data.shareBusy).toBe(false));
    expect(page.data.state).toBe('downloaded');
    expect(page.data.feedbackTone).not.toBe('error');
    expect(mocks.createExportJob).toHaveBeenCalledTimes(1);
  });

  it('ignores an old create result after reset, even after another operation has started', async () => {
    const definition = await controllerDefinition();
    const page = pageFor(definition);
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('idle'));
    let finishOld;
    mocks.createExportJob.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishOld = resolve;
        }),
    );
    definition.methods.handleCreate.call(page);
    await vi.waitFor(() => expect(mocks.createExportJob).toHaveBeenCalledTimes(1));
    definition.methods.handleReset.call(page);
    mocks.createExportJob.mockResolvedValueOnce({ ...exportJob('pending'), id: 'new-job' });
    definition.methods.handleCreate.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));
    finishOld({ ...exportJob('pending'), id: 'old-job' });
    await flushPromises();
    expect(page._jobId).toBe('new-job');
    expect(mocks.getExportJob).not.toHaveBeenCalledWith(groupId, 'old-job');
  });

  it('clears transient errors after two seconds and invalidates share callbacks on detach', async () => {
    const definition = await controllerDefinition();
    const page = await loadedPage(definition);
    vi.useFakeTimers();
    mocks.downloadScheduleExport.mockRejectedValueOnce(new Error('safe download failure'));
    definition.methods.handleDownload.call(page);
    await flushPromises();
    expect(page.data.infoMessage).toBe('safe download failure');
    expect(page.data.feedbackTone).toBe('error');
    await vi.advanceTimersByTimeAsync(2_000);
    expect(page.data.infoMessage).toBe('');
    definition.methods.handleDownload.call(page);
    await flushPromises();
    let finishShare;
    mocks.shareScheduleExport.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishShare = resolve;
        }),
    );
    definition.methods.handleShare.call(page);
    definition.lifetimes.detached.call(page);
    const snapshot = { ...page.data };
    finishShare('shared');
    await flushPromises();
    expect(page.data).toEqual(snapshot);
    expect(mocks.releaseTemporaryExport).toHaveBeenCalledWith('wxfile://export.csv');
  });

  it('ignores late options after detaching or switching away and back to the same group', async () => {
    const definition = await controllerDefinition();
    const page = pageFor(definition);
    let finishOld;
    mocks.listGroupMembers.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishOld = resolve;
        }),
    );
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(mocks.listGroupMembers).toHaveBeenCalledTimes(1));
    page.properties.groupId = 'other-group';
    definition.observers.groupId.call(page);
    page.properties.groupId = groupId;
    definition.observers.groupId.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('idle'));
    finishOld([{ id: 'old', realName: 'OLD' }]);
    await flushPromises();
    expect(page.data.memberOptions.map((option) => option.label)).toEqual(['全部成员', 'A 医生']);
    definition.lifetimes.detached.call(page);
  });

  it('leaves failed file sharing retryable without downloading or generating again', async () => {
    const definition = await controllerDefinition();
    const page = await loadedPage(definition);
    definition.methods.handleDownload.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('downloaded'));
    mocks.shareScheduleExport.mockRejectedValueOnce(new Error('发送未完成'));
    definition.methods.handleShare.call(page);
    await vi.waitFor(() => expect(page.data.shareBusy).toBe(false));
    expect(page.data.state).toBe('downloaded');
    expect(page.data.feedbackTone).toBe('error');
    definition.methods.handleShare.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('shared'));
    expect(mocks.downloadScheduleExport).toHaveBeenCalledTimes(1);
    expect(mocks.createExportJob).toHaveBeenCalledTimes(1);
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
