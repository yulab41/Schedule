import { readFileSync } from 'node:fs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const cases = [
  ['swap', 'handleGroupApprovalToggle', 'requiresApproval', 'updateGroupSwapSettings'],
  ['swap', 'handleAutoAcceptToggle', 'autoAcceptSwaps', 'updateMySwapSettings'],
  ['duty', 'handleGroupApprovalToggle', 'requiresApproval', 'updateGroupDutyAdjustmentSettings'],
  ['duty', 'handleAutoAcceptToggle', 'autoAcceptSwaps', 'updateMySwapSettings'],
];

describe('workflow switch feedback without whole-row disabled flashing', () => {
  let api;

  beforeEach(() => {
    vi.resetModules();
    vi.setSystemTime(new Date('2026-08-25T04:00:00Z'));
    vi.stubGlobal('__MINIPROGRAM_API_BASE_URL__', 'https://example.test/api');
    vi.stubGlobal('__MINIPROGRAM_BUILD_PROFILE__', 'production');
    vi.stubGlobal('__MINIPROGRAM_BUILD_COMMIT__', 'test');
    vi.stubGlobal('__MINIPROGRAM_BUILD_VERSION__', 'test');
    vi.stubGlobal('wx', { getStorageSync: () => undefined });
    api = {
      updateGroupSwapSettings: vi.fn(),
      updateGroupDutyAdjustmentSettings: vi.fn(),
      updateMySwapSettings: vi.fn(),
    };
    vi.doMock('../src/platform/client-core-calendar.ts', async (importOriginal) => ({
      ...(await importOriginal()),
      createRuntimeWorkflowClient: () => api,
    }));
  });

  afterEach(() => {
    vi.doUnmock('../src/platform/client-core-calendar.ts');
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  async function mount(kind, field, initial) {
    const module =
      kind === 'swap'
        ? await import('../src/subpackages/workflows/components/workflow-swap-panel/controller.ts')
        : await import('../src/subpackages/workflows/components/workflow-duty-panel/controller.ts');
    const definition =
      kind === 'swap'
        ? module.createSwapPanelControllerDefinition(true)
        : module.createDutyPanelControllerDefinition(true);
    const host = {
      ...definition,
      __workflowLifecycleManaged: true,
      __attached: true,
      __controller: definition,
      __workflowControllerToken: {},
      _currentGroupId: 'fixture-group',
      data: { ...definition.data, canApprove: true, state: 'ready', [field]: initial },
      writes: [],
      setData(patch) {
        this.writes.push(patch);
        Object.assign(this.data, patch);
      },
    };
    return { definition, host };
  }

  function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((done, fail) => {
      resolve = done;
      reject = fail;
    });
    return { promise, resolve, reject };
  }

  for (const [kind, handler, field, method] of cases) {
    it.each([false, true])(
      `${kind} ${field}: previews the clicked value once and keeps siblings/content stable from %s`,
      async (initial) => {
        const pending = deferred();
        api[method].mockReturnValue(pending.promise);
        const { definition, host } = await mount(kind, field, initial);
        const otherField = field === 'requiresApproval' ? 'autoAcceptSwaps' : 'requiresApproval';
        const otherValue = host.data[otherField];
        const list = host.data.incomingRequests;
        definition[handler].call(host, { detail: { checked: !initial } });
        expect(host.data[field]).toBe(!initial);
        expect(host.data.settingsBusy).toBe(true);
        expect(host.data[otherField]).toBe(otherValue);
        expect(host.data.incomingRequests).toBe(list);
        definition[handler].call(host, { detail: { checked: initial } });
        const otherHandler =
          handler === 'handleAutoAcceptToggle'
            ? 'handleGroupApprovalToggle'
            : 'handleAutoAcceptToggle';
        definition[otherHandler].call(host, { detail: { checked: !otherValue } });
        expect(Object.values(api).reduce((count, mock) => count + mock.mock.calls.length, 0)).toBe(
          1,
        );
        expect(api[method]).toHaveBeenCalledWith('fixture-group', { [field]: !initial });
        pending.resolve({ [field]: !initial });
        await vi.waitFor(() => expect(host.data.settingsBusy).toBe(false));
        expect(host.data[field]).toBe(!initial);
        expect(host.data[otherField]).toBe(otherValue);
        expect(host.data.infoMessage).not.toBe('');
        expect(host.writes.every((patch) => !Object.hasOwn(patch, 'state'))).toBe(true);
        expect(host.data.incomingRequests).toBe(list);
      },
    );

    it(`${kind} ${field}: rolls back only the pending value on failure and releases the existing lock`, async () => {
      const pending = deferred();
      api[method].mockReturnValue(pending.promise);
      const { definition, host } = await mount(kind, field, false);
      definition[handler].call(host, { detail: { value: true } });
      expect(host.data[field]).toBe(true);
      pending.reject(new Error('synthetic failure'));
      await vi.waitFor(() => expect(host.data.settingsBusy).toBe(false));
      expect(host.data[field]).toBe(false);
      expect(host.data.errorMessage).toBe('synthetic failure');
      expect(host.data.infoMessage).toBe('');
      expect(
        host.writes.filter((patch) => Object.hasOwn(patch, field)).map((patch) => patch[field]),
      ).toEqual([true, false]);
    });

    it.each(['resolve', 'reject'])(
      `${kind} ${field}: ignores a late %s after the controller changes`,
      async (completion) => {
        const pending = deferred();
        api[method].mockReturnValue(pending.promise);
        const { definition, host } = await mount(kind, field, false);
        definition[handler].call(host, { detail: { checked: true } });
        host.__workflowControllerToken = {};
        host.setData({ [field]: false, settingsBusy: false });
        const writes = host.writes.length;
        if (completion === 'resolve') pending.resolve({ [field]: true });
        else pending.reject(new Error('stale failure'));
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(host.writes).toHaveLength(writes);
        expect(host.data[field]).toBe(false);
      },
    );
  }

  it.each(['swap', 'duty'])(
    'uses the shared stable switch for both %s controls in standalone and embedded hosts',
    (kind) => {
      const base = `../src/subpackages/workflows/components/workflow-${kind}-panel/`;
      const template = readFileSync(new URL(`${base}index.wxml`, import.meta.url), 'utf8');
      const switches = template.match(/<ui-switch\b[\s\S]*?\/>/gu);
      expect(switches).toHaveLength(2);
      expect(template).not.toMatch(/<switch\b/u);
      for (const control of switches) {
        expect(control).toContain('loading="{{settingsBusy}}"');
        expect(control).not.toContain('disabled="{{settingsBusy}}"');
        expect(control).toContain('color="#1F5AA6"');
        expect(control).toContain('label=');
      }
      for (const config of [
        `${base}index.json`,
        `../src/subpackages/workflows/pages/${kind}/index.json`,
      ]) {
        expect(
          JSON.parse(readFileSync(new URL(config, import.meta.url), 'utf8')).usingComponents[
            'ui-switch'
          ],
        ).toBe('/components/ui/ui-switch/index');
      }
    },
  );

  it('does not disguise a saving notification preference as a permanently disabled switch', () => {
    const source = readFileSync(
      new URL(
        '../src/subpackages/insights/components/notifications-panel/index.wxml',
        import.meta.url,
      ),
      'utf8',
    );
    const control = source.match(/<ui-switch\b[\s\S]*?<\/ui-switch>/u)[0];
    expect(control).toContain('loading="{{busy}}"');
    expect(control).not.toContain('disabled="{{busy}}"');
  });
});
