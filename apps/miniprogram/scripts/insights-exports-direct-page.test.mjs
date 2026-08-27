import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const groupId = '11111111-1111-4111-8111-111111111111';
const mocks = vi.hoisted(() => ({
  exports: {
    attached: vi.fn(),
    detached: vi.fn(),
    handleBack: vi.fn(),
  },
  insights: {
    attached: vi.fn(),
    detached: vi.fn(),
    handleBack: vi.fn(),
  },
  recordBoundary: vi.fn(),
}));

vi.mock('../src/platform/telemetry.ts', () => ({
  recordMiniTelemetryBoundary: mocks.recordBoundary,
}));

vi.mock('../src/subpackages/insights/components/insights-dashboard-panel/controller.ts', () => ({
  createInsightsDashboardPanelControllerDefinition: () => ({
    data: { groupId: '', state: 'loading' },
    lifetimes: {
      attached: mocks.insights.attached,
      detached: mocks.insights.detached,
    },
    methods: { handleBack: mocks.insights.handleBack },
  }),
}));

vi.mock('../src/subpackages/insights/components/exports-panel/controller.ts', () => ({
  createExportsPanelControllerDefinition: () => ({
    data: { groupId: '', state: 'loading' },
    lifetimes: {
      attached: mocks.exports.attached,
      detached: mocks.exports.detached,
    },
    methods: { handleBack: mocks.exports.handleBack },
  }),
}));

describe('remaining P9 direct Page registration', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal('Page', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    {
      importPath: '../src/subpackages/insights/pages/insights/index.ts',
      marker: 'insights:page-onload',
      panel: mocks.insights,
    },
    {
      importPath: '../src/subpackages/insights/pages/exports/index.ts',
      marker: 'exports:page-onload',
      panel: mocks.exports,
    },
  ])('mounts $marker directly without a custom-component boundary', async (testCase) => {
    await import(testCase.importPath);

    expect(globalThis.Page).toHaveBeenCalledTimes(1);
    const definition = globalThis.Page.mock.calls[0][0];
    const instance = {
      data: { ...definition.data },
      setData(patch) {
        this.data = { ...this.data, ...patch };
      },
    };

    definition.onLoad.call(instance, { groupId: encodeURIComponent(groupId) });

    expect(instance.properties).toEqual({ groupId });
    expect(mocks.recordBoundary).toHaveBeenCalledWith(testCase.marker);
    expect(testCase.panel.attached.mock.instances[0]).toBe(instance);
    definition.handleBack.call(instance);
    expect(testCase.panel.handleBack.mock.instances[0]).toBe(instance);

    definition.onUnload.call(instance);
    expect(testCase.panel.detached.mock.instances[0]).toBe(instance);
  });
});
