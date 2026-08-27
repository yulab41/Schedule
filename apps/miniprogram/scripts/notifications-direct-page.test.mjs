import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const groupId = '11111111-1111-4111-8111-111111111111';
const mocks = vi.hoisted(() => ({
  attached: vi.fn(),
  detached: vi.fn(),
  handleBack: vi.fn(),
}));

vi.mock('../src/subpackages/insights/components/notifications-panel/controller.ts', () => ({
  createNotificationsPanelControllerDefinition: () => ({
    data: { groupId: '', mode: 'notifications', state: 'loading' },
    lifetimes: {
      attached: mocks.attached,
      detached: mocks.detached,
    },
    methods: { handleBack: mocks.handleBack },
  }),
}));

describe('notification direct Page registration', () => {
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
      importPath: '../src/subpackages/insights/pages/notifications/index.ts',
      mode: 'notifications',
    },
    {
      importPath: '../src/subpackages/insights/pages/notification-settings/index.ts',
      mode: 'settings',
    },
  ])('mounts $mode mode directly without notifications-panel injection', async (testCase) => {
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

    expect(instance.properties).toEqual({ embedded: false, groupId, mode: testCase.mode });
    expect(mocks.attached.mock.instances[0]).toBe(instance);
    definition.handleBack.call(instance);
    expect(mocks.handleBack.mock.instances[0]).toBe(instance);

    definition.onUnload.call(instance);
    expect(mocks.detached.mock.instances[0]).toBe(instance);
  });
});
