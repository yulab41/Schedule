import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('Feedback16 export Page module boundary', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.stubGlobal('Page', vi.fn());
    vi.stubGlobal('wx', { navigateBack: vi.fn() });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('registers a Page without importing the business controller', async () => {
    await expect(
      import('../src/subpackages/insights/pages/exports/index.ts'),
    ).resolves.toBeDefined();

    expect(globalThis.Page).toHaveBeenCalledTimes(1);
    const definition = globalThis.Page.mock.calls[0][0];
    const page = {
      data: structuredClone(definition.data),
      setData(patch) {
        Object.assign(this.data, patch);
      },
    };

    definition.onLoad.call(page, { groupId: 'group-1' });
    expect(page.data.panelReady).toBe(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(page.data.panelReady).toBe(true);
    expect(page.data.startupError).toBe('');
    definition.handlePanelStartupReady.call(page);
    definition.onUnload.call(page);
    expect(page.data.panelReady).toBe(true);
  });
});
