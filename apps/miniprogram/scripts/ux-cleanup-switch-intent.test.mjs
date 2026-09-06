import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('UX-CLEANUP-10 latest switch intent', () => {
  let api;
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('__MINIPROGRAM_API_BASE_URL__', 'https://example.test/api');
    vi.stubGlobal('__MINIPROGRAM_BUILD_PROFILE__', 'production');
    vi.stubGlobal('__MINIPROGRAM_BUILD_COMMIT__', 'test');
    vi.stubGlobal('__MINIPROGRAM_BUILD_VERSION__', 'test');
    vi.stubGlobal('wx', { getStorageSync: () => undefined });
    api = {
      updateMySwapSettings: vi.fn(),
      getMySwapSettings: vi.fn(),
      getMyDutyAdjustmentSettings: vi.fn(),
    };
    vi.doMock('../src/platform/client-core-calendar.ts', async (original) => ({
      ...(await original()),
      createRuntimeWorkflowClient: () => api,
    }));
  });
  afterEach(() => {
    vi.doUnmock('../src/platform/client-core-calendar.ts');
    vi.unstubAllGlobals();
  });
  async function mount(kind) {
    const mod =
      kind === 'swap'
        ? await import('../src/subpackages/workflows/components/workflow-swap-panel/controller.ts')
        : await import('../src/subpackages/workflows/components/workflow-duty-panel/controller.ts');
    const definition =
      kind === 'swap'
        ? mod.createSwapPanelControllerDefinition(true)
        : mod.createDutyPanelControllerDefinition(true);
    const host = {
      ...definition,
      __workflowLifecycleManaged: true,
      __attached: true,
      __controller: definition,
      __workflowControllerToken: {},
      _currentGroupId: 'synthetic-group',
      data: {
        ...definition.data,
        state: 'ready',
        autoAcceptSwaps: false,
        infoMessage: '上次已保存',
      },
      patches: [],
      setData(patch) {
        this.patches.push(patch);
        Object.assign(this.data, patch);
      },
    };
    return host;
  }
  function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((yes, no) => {
      resolve = yes;
      reject = no;
    });
    return { promise, resolve, reject };
  }
  it('serializes the same setting across swap and duty hosts', async () => {
    const first = deferred();
    const second = deferred();
    api.updateMySwapSettings.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const swap = await mount('swap');
    const duty = await mount('duty');
    swap.handleAutoAcceptToggle({ detail: { checked: true } });
    duty.handleAutoAcceptToggle({ detail: { checked: false } });
    expect(api.updateMySwapSettings).toHaveBeenCalledTimes(1);
    first.resolve({ autoAcceptSwaps: true });
    await vi.waitFor(() => expect(api.updateMySwapSettings).toHaveBeenCalledTimes(2));
    second.resolve({ autoAcceptSwaps: false });
    await vi.waitFor(() => expect(duty.data.settingsBusy).toBe(false));
    expect(swap.data.autoAcceptSwaps).toBe(false);
    expect(duty.data.autoAcceptSwaps).toBe(false);
  });
  it('hide/show invalidates old feedback without cancelling the save', async () => {
    const first = deferred();
    api.updateMySwapSettings.mockReturnValueOnce(first.promise);
    const host = await mount('swap');
    host.handleAutoAcceptToggle({ detail: { checked: true } });
    const { createWorkflowPageDefinition } =
      await import('../src/subpackages/workflows/components/controller-host.ts');
    const lifecycle = createWorkflowPageDefinition(() => ({ data: {} }));
    lifecycle.onHide.call(host);
    host.__workflowPageHidden = false;
    first.resolve({ autoAcceptSwaps: true });
    await vi.waitFor(() => expect(host.data.settingsBusy).toBe(false));
    expect(host.data.infoMessage).toBe('');
    expect(host.data.autoAcceptSwaps).toBe(true);
  });
  it('a failed intermediate intent followed by success leaves no obsolete inline error', async () => {
    const first = deferred();
    const second = deferred();
    api.updateMySwapSettings.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    api.getMySwapSettings.mockResolvedValue({ autoAcceptSwaps: false });
    const host = await mount('swap');
    host.handleAutoAcceptToggle({ detail: { checked: true } });
    host.handleAutoAcceptToggle({ detail: { checked: false } });
    first.reject(new Error('old failure'));
    await vi.waitFor(() => expect(api.updateMySwapSettings).toHaveBeenCalledTimes(2));
    second.resolve({ autoAcceptSwaps: false });
    await vi.waitFor(() => expect(host.data.settingsBusy).toBe(false));
    expect(host.data.errorMessage).not.toContain('old failure');
    expect(host.data.infoMessage).toContain('已关闭');
  });
  it('pauses only the same source timer and resets exactly two seconds after final success', async () => {
    vi.useFakeTimers();
    try {
      const host = await mount('swap');
      const { publishWorkflowInfo, pauseWorkflowInfo } =
        await import('../src/subpackages/workflows/components/controller-host.ts');
      publishWorkflowInfo(host, 'confirmed', 'auto-accept');
      await vi.advanceTimersByTimeAsync(1500);
      pauseWorkflowInfo(host, 'auto-accept');
      await vi.advanceTimersByTimeAsync(3000);
      expect(host.data.infoMessage).toBe('confirmed');
      expect(host.data.infoMessageSaving).toBe(true);
      publishWorkflowInfo(host, 'latest', 'auto-accept');
      await vi.advanceTimersByTimeAsync(1999);
      expect(host.data.infoMessage).toBe('latest');
      await vi.advanceTimersByTimeAsync(1);
      expect(host.data.infoMessage).toBe('');
      publishWorkflowInfo(host, 'other setting', 'different-source');
      await vi.advanceTimersByTimeAsync(1000);
      pauseWorkflowInfo(host, 'auto-accept');
      await vi.advanceTimersByTimeAsync(1000);
      expect(host.data.infoMessage).toBe('');
    } finally {
      vi.useRealTimers();
    }
  });
  it('switching account invalidates old callbacks and never dispatches its pending intent as the new account', async () => {
    const first = deferred();
    api.updateMySwapSettings.mockReturnValueOnce(first.promise);
    const host = await mount('swap');
    host.handleAutoAcceptToggle({ detail: { checked: true } });
    host.handleAutoAcceptToggle({ detail: { checked: false } });
    const { getWechatSessionRuntimeState } =
      await import('../src/platform/wechat-session-runtime.ts');
    getWechatSessionRuntimeState().generation += 1;
    const count = host.patches.length;
    first.resolve({ autoAcceptSwaps: true });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(api.updateMySwapSettings).toHaveBeenCalledTimes(1);
    expect(host.patches).toHaveLength(count);
  });
  for (const kind of ['swap', 'duty']) {
    it(`${kind}: does not hide feedback and serially persists the newest pending value`, async () => {
      const first = deferred();
      const second = deferred();
      api.updateMySwapSettings
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise);
      const host = await mount(kind);
      host.handleAutoAcceptToggle({ detail: { checked: true } });
      expect(host.data.infoMessage).toBe('上次已保存');
      host.handleAutoAcceptToggle({ detail: { checked: false } });
      expect(host.data.autoAcceptSwaps).toBe(false);
      expect(api.updateMySwapSettings).toHaveBeenCalledTimes(1);
      first.resolve({ autoAcceptSwaps: true });
      await vi.waitFor(() => expect(api.updateMySwapSettings).toHaveBeenCalledTimes(2));
      expect(host.data.autoAcceptSwaps).toBe(false);
      expect(api.updateMySwapSettings.mock.calls[1]).toEqual([
        'synthetic-group',
        { autoAcceptSwaps: false },
      ]);
      second.resolve({ autoAcceptSwaps: false });
      await vi.waitFor(() => expect(host.data.settingsBusy).toBe(false));
      expect(host.data.infoMessage).toContain('已关闭');
      expect(host.patches.filter((patch) => patch.infoMessage === '')).toHaveLength(0);
    });
    it(`${kind}: failed writes reconcile the server state without replaying a stale rollback`, async () => {
      api.updateMySwapSettings.mockRejectedValueOnce(new Error('synthetic timeout'));
      api.getMySwapSettings.mockResolvedValue({ autoAcceptSwaps: true });
      api.getMyDutyAdjustmentSettings.mockResolvedValue({ autoAcceptSwaps: true });
      const host = await mount(kind);
      host.handleAutoAcceptToggle({ detail: { checked: true } });
      await vi.waitFor(() => expect(host.data.settingsBusy).toBe(false));
      expect(host.data.autoAcceptSwaps).toBe(true);
      expect(host.data.infoMessage).toContain('synthetic timeout');
      expect(host.data.infoMessageTone).toBe('error');
    });
  }
});
