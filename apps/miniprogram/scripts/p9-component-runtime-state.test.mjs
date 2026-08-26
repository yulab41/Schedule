import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const groupId = '11111111-1111-4111-8111-111111111111';

describe('P9 native component runtime state', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('__MINIPROGRAM_API_BASE_URL__', 'https://example.test/api');
    vi.stubGlobal('__MINIPROGRAM_BUILD_COMMIT__', 'test');
    vi.stubGlobal('__MINIPROGRAM_BUILD_PROFILE__', 'production');
    vi.stubGlobal('__MINIPROGRAM_BUILD_VERSION__', 'test');
    vi.stubGlobal('wx', {
      getStorageSync: vi.fn(() => undefined),
      getWindowInfo: () => ({ statusBarHeight: 24, windowHeight: 844, windowWidth: 390 }),
      request: vi.fn(() => undefined),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('settles every P9 panel when its capability is disabled without private-field injection', async () => {
    const capabilities = await import('../src/app/client-capability-store.ts');
    capabilities.configureRuntimeClientCapabilityReader(
      () =>
        Promise.resolve({
          core: true,
          externalMessages: false,
          global: true,
          guest: true,
          insights: false,
          organization: true,
          platform: 'miniprogram',
          version: 'test',
          workflows: true,
        }),
      'test',
    );
    await capabilities.refreshClientCapabilities({ force: true });

    const cases = [
      {
        importPath: '../src/subpackages/insights/components/visitor-access-panel/controller.ts',
        properties: { groupId },
      },
      {
        importPath: '../src/subpackages/insights/components/insights-dashboard-panel/controller.ts',
        properties: { groupId },
      },
      {
        importPath: '../src/subpackages/insights/components/notifications-panel/controller.ts',
        properties: { groupId, mode: 'notifications' },
      },
      {
        importPath: '../src/subpackages/insights/components/notifications-panel/controller.ts',
        properties: { groupId, mode: 'settings' },
      },
    ];

    for (const testCase of cases) {
      const module = await import(testCase.importPath);
      const factory = Object.values(module).find(
        (value) => typeof value === 'function' && value.name.startsWith('create'),
      );
      expect(factory).toBeTypeOf('function');
      const definition = factory();
      const page = createPageInstance(definition, testCase.properties);
      definition.lifetimes.attached.call(page);
      await vi.waitFor(() => expect(page.data.state).toBe('disabled'));
    }
  });
});

function createPageInstance(controller, properties) {
  return {
    data: { ...controller.data },
    properties,
    setData(patch) {
      this.data = { ...this.data, ...patch };
    },
  };
}
