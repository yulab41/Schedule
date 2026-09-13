import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const groupId = '11111111-1111-4111-8111-111111111111';

describe('Feedback17 real export Page native shell lifecycle', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.stubGlobal('Page', vi.fn());
    vi.stubGlobal(
      'getApp',
      vi.fn(() => ({ globalData: { runtimeDiagnostics: { performance: [] } } })),
    );
    vi.stubGlobal('wx', { navigateBack: vi.fn() });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('keeps the native shell before the panel mounts and records the boundary lifecycle', async () => {
    const { definition, page, stages } = await realPage();

    definition.onLoad.call(page, { groupId: encodeURIComponent(groupId) });
    expect(page.data.panelReady).toBe(false);
    definition.onShow.call(page);
    definition.onReady.call(page);
    await vi.advanceTimersByTimeAsync(0);

    expect(page.data.panelReady).toBe(true);
    definition.handlePanelStartupReady.call(page);
    expect(page._panelAttached).toBe(true);
    expect(stages()).toEqual([
      'module-registered',
      'page-load',
      'page-show',
      'page-ready',
      'panel-mount-requested',
      'panel-component-attached',
    ]);

    definition.onUnload.call(page);
    expect(vi.getTimerCount()).toBe(0);
    expect(stages()).toContain('page-unload');
  });

  it('does not mutate a Page-reserved read-only properties object on direct entry', async () => {
    const { definition, page } = await realPage();
    Object.defineProperty(page, 'properties', {
      configurable: false,
      value: Object.freeze({}),
      writable: false,
    });

    expect(() => definition.onLoad.call(page, { groupId })).not.toThrow();
    expect(page.data.groupId).toBe(groupId);
  });

  it('turns a direct cold entry without a group query into a visible retryable error', async () => {
    const { definition, page } = await realPage();

    definition.onLoad.call(page);

    expect(page.data.panelReady).toBe(false);
    expect(page.data.startupError).toContain('群组信息缺失');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('shows a retryable timeout when the child component does not report attached', async () => {
    const { definition, page } = await realPage();

    definition.onLoad.call(page, { groupId });
    await vi.advanceTimersByTimeAsync(0);
    expect(page.data.panelReady).toBe(true);
    await vi.advanceTimersByTimeAsync(5000);

    expect(page.data.panelReady).toBe(false);
    expect(page.data.startupError).toContain('组件未完成装载');
    definition.handleRetry.call(page);
    expect(page.data.startupError).toBe('');
    await vi.advanceTimersByTimeAsync(0);
    expect(page.data.panelReady).toBe(true);
    definition.onUnload.call(page);
  });

  it('ignores the queued panel mount after unload', async () => {
    const { definition, page } = await realPage();
    definition.onLoad.call(page, { groupId });
    definition.onUnload.call(page);
    await vi.advanceTimersByTimeAsync(5000);
    expect(page.data.panelReady).toBe(false);
    expect(page.data.startupError).toBe('');
    expect(vi.getTimerCount()).toBe(0);
  });
});

async function realPage() {
  const diagnostics = { performance: [] };
  globalThis.getApp.mockReturnValue({ globalData: { runtimeDiagnostics: diagnostics } });
  await import('../src/subpackages/insights/pages/exports/index.ts');
  expect(globalThis.Page).toHaveBeenCalledTimes(1);
  const definition = globalThis.Page.mock.calls[0][0];
  const page = {
    data: structuredClone(definition.data),
    setData(patch) {
      Object.assign(this.data, patch);
    },
  };
  return { definition, page, stages: () => diagnostics.performance.map((entry) => entry.metric) };
}
