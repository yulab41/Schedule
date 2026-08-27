import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const groupId = '11111111-1111-4111-8111-111111111111';
const mocks = vi.hoisted(() => ({
  attached: vi.fn(),
  detached: vi.fn(),
  handleBack: vi.fn(),
  recordBoundary: vi.fn(),
}));

vi.mock('../src/platform/telemetry.ts', () => ({
  recordMiniTelemetryBoundary: mocks.recordBoundary,
}));

vi.mock('../src/subpackages/insights/components/visitor-access-panel/controller.ts', () => ({
  createVisitorAccessPanelControllerDefinition: () => ({
    data: { groupId: '', state: 'loading' },
    lifetimes: {
      attached: mocks.attached,
      detached: mocks.detached,
    },
    methods: { handleBack: mocks.handleBack },
  }),
}));

describe('visitor access direct Page registration', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal('Page', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('mounts the existing panel controller directly without a custom-component boundary', async () => {
    await import('../src/subpackages/insights/pages/visitor-access/index.ts');

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
    expect(mocks.recordBoundary).toHaveBeenCalledWith('visitor-access:page-onload');
    expect(mocks.attached.mock.instances[0]).toBe(instance);
    definition.handleBack.call(instance);
    expect(mocks.handleBack.mock.instances[0]).toBe(instance);

    definition.onUnload.call(instance);
    expect(mocks.detached.mock.instances[0]).toBe(instance);
  });
});
