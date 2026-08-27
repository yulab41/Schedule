import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mocks = vi.hoisted(() => ({
  dutyFactory: vi.fn(),
  dutyOnLoad: vi.fn(),
  leaveFactory: vi.fn(),
  leaveOnLoad: vi.fn(),
  swapFactory: vi.fn(),
  swapOnLoad: vi.fn(),
}));

vi.mock('../src/subpackages/workflows/components/workflow-duty-panel/controller.ts', () => ({
  createDutyPanelControllerDefinition: mocks.dutyFactory,
}));
vi.mock('../src/subpackages/workflows/components/workflow-leave-panel/controller.ts', () => ({
  createLeavePanelControllerDefinition: mocks.leaveFactory,
}));
vi.mock('../src/subpackages/workflows/components/workflow-swap-panel/controller.ts', () => ({
  createSwapPanelControllerDefinition: mocks.swapFactory,
}));

function read(relativePath) {
  return readFileSync(path.join(appRoot, relativePath), 'utf8');
}

describe('workflow direct Page registration', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal('Page', vi.fn());
    mocks.dutyFactory.mockImplementation(() =>
      createControllerDefinition('duty', mocks.dutyOnLoad),
    );
    mocks.leaveFactory.mockImplementation(() =>
      createControllerDefinition('leave', mocks.leaveOnLoad),
    );
    mocks.swapFactory.mockImplementation(() =>
      createControllerDefinition('swap', mocks.swapOnLoad),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    {
      factory: 'dutyFactory',
      importPath: '../src/subpackages/workflows/pages/duty/index.ts',
      onLoad: 'dutyOnLoad',
      workflow: 'duty',
    },
    {
      factory: 'leaveFactory',
      importPath: '../src/subpackages/workflows/pages/leave/index.ts',
      onLoad: 'leaveOnLoad',
      workflow: 'leave',
    },
    {
      factory: 'swapFactory',
      importPath: '../src/subpackages/workflows/pages/swap/index.ts',
      onLoad: 'swapOnLoad',
      workflow: 'swap',
    },
  ])('adapts the $importPath controller definition directly onto Page', async (testCase) => {
    await import(testCase.importPath);

    expect(mocks[testCase.factory]).toHaveBeenCalledWith(false);
    const definition = globalThis.Page.mock.calls[0][0];
    expect(definition).not.toBe(mocks[testCase.factory].mock.results[0].value);
    const instance = {
      data: { ...definition.data },
      setData(patch) {
        Object.assign(this.data, patch);
      },
    };
    const query = { groupId: 'encoded-group' };
    definition.onLoad.call(instance, query);
    expect(mocks[testCase.onLoad].mock.instances[0]).toBe(instance);
    expect(mocks[testCase.onLoad]).toHaveBeenCalledWith(query);
    expect(definition.handlePickerRequestOpen).toBeTypeOf('function');
    expect(definition.handlePanelBackgroundTap).toBeTypeOf('function');
    expect(definition.onUnload).toBeTypeOf('function');
    for (const handler of readWorkflowHandlers(testCase.workflow)) {
      expect(definition[handler], `${testCase.workflow} is missing ${handler}`).toBeTypeOf(
        'function',
      );
    }
  });

  it.each(['duty', 'leave', 'swap'])(
    'renders %s without injecting the workflow panel component',
    (workflow) => {
      const root = `src/subpackages/workflows/pages/${workflow}`;
      const panel = `workflow-${workflow}-panel`;
      const config = JSON.parse(read(`${root}/index.json`));

      expect(config.usingComponents).toEqual({
        'workflow-picker': '/subpackages/workflows/components/workflow-picker/index',
      });
      expect(read(`${root}/index.wxml`).trim()).toBe(
        `<include src="../../components/${panel}/index.wxml" />`,
      );
      expect(read(`${root}/index.wxss`)).toContain(
        `@import '../../components/${panel}/index.wxss';`,
      );
    },
  );

  it('retains all three embedded workflow components required by the workbench', () => {
    const config = JSON.parse(read('src/pages/workbench/index.json'));
    const template = read('src/pages/workbench/index.wxml');
    for (const workflow of ['duty', 'leave', 'swap']) {
      const panel = `workflow-${workflow}-panel`;
      expect(config.usingComponents[panel]).toBe(
        `/subpackages/workflows/components/${panel}/index`,
      );
      expect(template).toContain(`<${panel}`);
    }
  });
});

function createControllerDefinition(workflow, onLoad) {
  const hostHandlers = new Set(['handlePanelBackgroundTap', 'handlePickerRequestOpen']);
  return {
    data: { embedded: false, infoMessage: '' },
    onLoad,
    ...Object.fromEntries(
      readWorkflowHandlers(workflow)
        .filter((handler) => !hostHandlers.has(handler))
        .map((handler) => [handler, vi.fn()]),
    ),
  };
}

function readWorkflowHandlers(workflow) {
  const template = read(
    `src/subpackages/workflows/components/workflow-${workflow}-panel/index.wxml`,
  );
  return [
    ...new Set(
      [...template.matchAll(/(?:bind|catch)(?::|[a-z]+)=['"]([A-Za-z][\w]*)['"]/gu)].map(
        (match) => match[1],
      ),
    ),
  ];
}
