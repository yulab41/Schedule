import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  recordBoundary: vi.fn(),
  recordStage: vi.fn(),
}));

vi.mock('../src/platform/telemetry.ts', () => ({
  recordMiniTelemetryBoundary: mocks.recordBoundary,
}));

vi.mock('../src/platform/export-render-diagnostics.ts', () => ({
  endExportRenderDiagnostics: vi.fn(),
  measureExportFirstPaint: vi.fn(),
  recordExportRenderStage: mocks.recordStage,
}));

vi.mock('../src/subpackages/insights/components/exports-panel/controller.ts', () => {
  return {
    createExportsPanelControllerDefinition: () => {
      throw new Error('synthetic controller factory failure');
    },
  };
});

describe('Feedback16 export Page factory boundary', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal('Page', vi.fn());
    vi.stubGlobal('wx', { navigateBack: vi.fn() });
  });

  it('registers a Page and keeps a visible startup error when the controller factory fails', async () => {
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
    await new Promise((resolve) => setImmediate(resolve));
    for (let index = 0; index < 8; index += 1) await Promise.resolve();

    expect(page.data.startupError).toContain('页面暂时无法加载');
    expect(page.data.panelReady).toBe(false);
  });
});
