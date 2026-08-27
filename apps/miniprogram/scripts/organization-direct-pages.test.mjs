import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const groupId = '11111111-1111-4111-8111-111111111111';
const mocks = vi.hoisted(() => ({
  directoryAttached: vi.fn(),
  directoryDetached: vi.fn(),
  directoryFactory: vi.fn(),
  directoryHandleBack: vi.fn(),
  groupFactory: vi.fn(),
  groupHandleBack: vi.fn(),
  groupOnLoad: vi.fn(),
  groupOnShow: vi.fn(),
  inviteAttached: vi.fn(),
  inviteFactory: vi.fn(),
  inviteHandleBack: vi.fn(),
  platformAttached: vi.fn(),
  platformFactory: vi.fn(),
  platformHandleBack: vi.fn(),
  schedulingAttached: vi.fn(),
  schedulingFactory: vi.fn(),
  schedulingHandleBack: vi.fn(),
  schedulingHandleRetry: vi.fn(),
  schedulingHandleSaveRole: vi.fn(),
}));

vi.mock('../src/subpackages/organization/components/directory-panel/controller.ts', () => ({
  createDirectoryPanelControllerDefinition: mocks.directoryFactory,
}));

vi.mock('../src/subpackages/organization/components/group-settings-panel/controller.ts', () => ({
  createGroupSettingsPanelControllerDefinition: mocks.groupFactory,
}));

vi.mock('../src/subpackages/organization/components/invite-visitor-panel/controller.ts', () => ({
  createInviteVisitorPanelControllerDefinition: mocks.inviteFactory,
}));

vi.mock('../src/subpackages/organization/components/platform-accounts-panel/controller.ts', () => ({
  createPlatformAccountsPanelControllerDefinition: mocks.platformFactory,
}));

vi.mock('../src/subpackages/organization/components/scheduling-config-panel/controller.ts', () => ({
  createSchedulingConfigPanelControllerDefinition: mocks.schedulingFactory,
}));

function read(relativePath) {
  return readFileSync(path.join(appRoot, relativePath), 'utf8');
}

describe('organization direct Page registration', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal('Page', vi.fn());
    mocks.directoryFactory.mockReturnValue({
      data: { directoryKind: 'internal', groupId: '', state: 'loading' },
      lifetimes: {
        attached: mocks.directoryAttached,
        detached: mocks.directoryDetached,
      },
      methods: {
        ...createHandlerMethods('directory-panel'),
        handleBack: mocks.directoryHandleBack,
      },
    });
    mocks.groupFactory.mockReturnValue({
      data: { embedded: false, state: 'loading' },
      _loadSerial: 0,
      ...createHandlerMethods('group-settings-panel'),
      handleBack: mocks.groupHandleBack,
      onLoad: mocks.groupOnLoad,
      onShow: mocks.groupOnShow,
    });
    mocks.inviteFactory.mockReturnValue({
      data: { state: 'loading' },
      _operationIds: new Map(),
      ...createHandlerMethods('invite-visitor-panel'),
      handleBack: mocks.inviteHandleBack,
      lifetimes: { attached: mocks.inviteAttached },
      observers: { groupId: vi.fn() },
      properties: { groupId: { type: String, value: '' } },
    });
    mocks.platformFactory.mockReturnValue({
      data: { state: 'loading' },
      _operationIds: new Map(),
      ...createHandlerMethods('platform-accounts-panel'),
      handleBack: mocks.platformHandleBack,
      lifetimes: { attached: mocks.platformAttached },
    });
    mocks.schedulingFactory.mockReturnValue({
      data: { state: 'loading' },
      _operationIds: new Map(),
      ...createHandlerMethods('scheduling-config-panel'),
      handleBack: mocks.schedulingHandleBack,
      handleRetry: mocks.schedulingHandleRetry,
      handleSaveRole: mocks.schedulingHandleSaveRole,
      lifetimes: { attached: mocks.schedulingAttached },
      observers: { groupId: vi.fn() },
      properties: { groupId: { type: String, value: '' } },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('mounts the directory controller directly and preserves attached/detached receivers', async () => {
    await import('../src/subpackages/organization/pages/directory/index.ts');

    const definition = globalThis.Page.mock.calls[0][0];
    const instance = { data: { ...definition.data }, setData: vi.fn() };
    definition.onLoad.call(instance, { groupId: encodeURIComponent(groupId) });

    expect(instance.properties).toEqual({ directoryKind: 'internal', groupId });
    expect(mocks.directoryAttached.mock.instances[0]).toBe(instance);
    definition.handleBack.call(instance);
    expect(mocks.directoryHandleBack.mock.instances[0]).toBe(instance);
    definition.onUnload.call(instance);
    expect(mocks.directoryDetached.mock.instances[0]).toBe(instance);
  });

  it('restores the group settings Page controller while retaining embedded=false', async () => {
    await import('../src/subpackages/organization/pages/group-settings/index.ts');

    expect(mocks.groupFactory).toHaveBeenCalledWith(false);
    const definition = globalThis.Page.mock.calls[0][0];
    expect(definition).not.toBe(mocks.groupFactory.mock.results[0].value);
    const instance = { data: { ...definition.data }, setData: vi.fn() };
    const query = { groupId: encodeURIComponent(groupId) };
    definition.onLoad.call(instance, query);

    expect(definition.data.embedded).toBe(false);
    expect(mocks.groupOnLoad.mock.instances[0]).toBe(instance);
    expect(mocks.groupOnLoad).toHaveBeenCalledWith(query);
    definition.onShow.call(instance);
    expect(mocks.groupOnShow.mock.instances[0]).toBe(instance);
    definition.handleBack.call(instance);
    expect(mocks.groupHandleBack.mock.instances[0]).toBe(instance);
  });

  it('mounts only scheduling controller functions and initializes the group before attached', async () => {
    await import('../src/subpackages/organization/pages/scheduling-config/index.ts');

    const definition = globalThis.Page.mock.calls[0][0];
    const instance = { data: { ...definition.data }, setData: vi.fn() };
    definition.onLoad.call(instance, { groupId: encodeURIComponent(groupId) });

    expect(instance.properties).toEqual({ groupId });
    expect(mocks.schedulingAttached.mock.instances[0]).toBe(instance);
    definition.handleBack.call(instance);
    expect(mocks.schedulingHandleBack.mock.instances[0]).toBe(instance);
    definition.handleRetry.call(instance);
    expect(mocks.schedulingHandleRetry.mock.instances[0]).toBe(instance);
    definition.handleSaveRole.call(instance);
    expect(mocks.schedulingHandleSaveRole.mock.instances[0]).toBe(instance);
    expect(Object.keys(definition).filter((key) => key.startsWith('_'))).toEqual([]);
    expect(definition.properties).toBeUndefined();
    expect(definition.observers).toBeUndefined();
  });

  it('mounts invite/visitor functions after injecting the decoded group', async () => {
    await import('../src/subpackages/organization/pages/invite-visitor/index.ts');

    const definition = globalThis.Page.mock.calls[0][0];
    const instance = { data: { ...definition.data }, setData: vi.fn() };
    definition.onLoad.call(instance, { groupId: encodeURIComponent(groupId) });

    expect(instance.properties).toEqual({ groupId });
    expect(mocks.inviteAttached.mock.instances[0]).toBe(instance);
    definition.handleBack.call(instance);
    expect(mocks.inviteHandleBack.mock.instances[0]).toBe(instance);
    expect(Object.keys(definition).filter((key) => key.startsWith('_'))).toEqual([]);
  });

  it('mounts platform account functions without carrying component configuration', async () => {
    await import('../src/subpackages/organization/pages/platform-accounts/index.ts');

    const definition = globalThis.Page.mock.calls[0][0];
    const instance = { data: { ...definition.data }, setData: vi.fn() };
    definition.onLoad.call(instance, {});

    expect(instance.setData).toHaveBeenCalledWith({ groupId: '' });
    expect(mocks.platformAttached.mock.instances[0]).toBe(instance);
    definition.handleBack.call(instance);
    expect(mocks.platformHandleBack.mock.instances[0]).toBe(instance);
    expect(Object.keys(definition).filter((key) => key.startsWith('_'))).toEqual([]);
    expect(definition.lifetimes).toBeUndefined();
  });

  it.each([
    {
      components: {
        'directory-entry-card': '/subpackages/organization/components/directory-entry-card/index',
        'ui-alert': '/components/ui/ui-alert/index',
        'ui-button': '/components/ui/ui-button/index',
        'ui-loading': '/components/ui/ui-loading/index',
      },
      page: 'directory',
      panel: 'directory-panel',
    },
    {
      components: {
        'ui-alert': '/components/ui/ui-alert/index',
        'ui-loading': '/components/ui/ui-loading/index',
      },
      page: 'group-settings',
      panel: 'group-settings-panel',
    },
    {
      components: {
        'ui-alert': '/components/ui/ui-alert/index',
        'ui-button': '/components/ui/ui-button/index',
        'ui-loading': '/components/ui/ui-loading/index',
        'ui-switch': '/components/ui/ui-switch/index',
      },
      page: 'scheduling-config',
      panel: 'scheduling-config-panel',
    },
    {
      components: {
        'ui-alert': '/components/ui/ui-alert/index',
        'ui-button': '/components/ui/ui-button/index',
        'ui-loading': '/components/ui/ui-loading/index',
      },
      page: 'invite-visitor',
      panel: 'invite-visitor-panel',
    },
    {
      components: {
        'ui-alert': '/components/ui/ui-alert/index',
        'ui-button': '/components/ui/ui-button/index',
        'ui-loading': '/components/ui/ui-loading/index',
      },
      page: 'platform-accounts',
      panel: 'platform-accounts-panel',
    },
  ])(
    'renders $page without injecting $panel as a required component',
    ({ components, page, panel }) => {
      const root = `src/subpackages/organization/pages/${page}`;
      const config = JSON.parse(read(`${root}/index.json`));
      const template = read(`${root}/index.wxml`);
      const styles = read(`${root}/index.wxss`);

      expect(config).toMatchObject({
        disableScroll: true,
        navigationStyle: 'custom',
        renderer: 'skyline',
        usingComponents: components,
      });
      expect(config.usingComponents[panel]).toBeUndefined();
      expect(template.trim()).toBe(`<include src="../../components/${panel}/index.wxml" />`);
      expect(styles).toContain(`@import '../../components/${panel}/index.wxss';`);
    },
  );

  it('retains the embedded group settings component required by the workbench', () => {
    const workbenchConfig = JSON.parse(read('src/pages/workbench/index.json'));
    const workbenchTemplate = read('src/pages/workbench/index.wxml');

    expect(workbenchConfig.usingComponents['group-settings-panel']).toBe(
      '/subpackages/organization/components/group-settings-panel/index',
    );
    expect(workbenchTemplate).toContain('<group-settings-panel');
  });

  it.each([
    {
      importPath: '../src/subpackages/organization/pages/directory/index.ts',
      panel: 'directory-panel',
    },
    {
      importPath: '../src/subpackages/organization/pages/group-settings/index.ts',
      panel: 'group-settings-panel',
    },
    {
      importPath: '../src/subpackages/organization/pages/invite-visitor/index.ts',
      panel: 'invite-visitor-panel',
    },
    {
      importPath: '../src/subpackages/organization/pages/platform-accounts/index.ts',
      panel: 'platform-accounts-panel',
    },
    {
      importPath: '../src/subpackages/organization/pages/scheduling-config/index.ts',
      panel: 'scheduling-config-panel',
    },
  ])('registers every $panel WXML event handler on the Page definition', async (testCase) => {
    await import(testCase.importPath);

    const definition = globalThis.Page.mock.calls[0][0];
    for (const handler of readPanelHandlers(testCase.panel)) {
      expect(definition[handler], `${testCase.panel} is missing ${handler}`).toBeTypeOf('function');
    }
  });
});

function createHandlerMethods(panel) {
  return Object.fromEntries(readPanelHandlers(panel).map((handler) => [handler, vi.fn()]));
}

function readPanelHandlers(panel) {
  const template = read(`src/subpackages/organization/components/${panel}/index.wxml`);
  return [
    ...new Set(
      [...template.matchAll(/(?:bind|catch)(?::|[a-z]+)=['"]([A-Za-z][\w]*)['"]/gu)].map(
        (match) => match[1],
      ),
    ),
  ];
}
