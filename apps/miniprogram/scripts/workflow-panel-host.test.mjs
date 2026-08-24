import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('workflow panel host transient status', () => {
  let definition;
  let registerWorkflowPanel;

  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.stubGlobal('Component', (value) => {
      definition = value;
    });
    ({ registerWorkflowPanel } =
      await import('../src/subpackages/workflows/components/controller-host.ts'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('clears a non-empty operation result after three seconds', () => {
    registerWorkflowPanel(() => ({ data: { infoMessage: '' } }));
    const instance = createHostInstance('换班已完成。');

    definition.observers.infoMessage.call(instance, '换班已完成。');
    vi.advanceTimersByTime(2_999);
    expect(instance.data.infoMessage).toBe('换班已完成。');
    vi.advanceTimersByTime(1);
    expect(instance.data.infoMessage).toBe('');
  });

  it('cancels the pending clear when the component detaches', () => {
    registerWorkflowPanel(() => ({ data: { infoMessage: '' } }));
    const instance = createHostInstance('加扣班已完成。');

    definition.observers.infoMessage.call(instance, '加扣班已完成。');
    definition.lifetimes.detached.call(instance);
    vi.runAllTimers();
    expect(instance.data.infoMessage).toBe('加扣班已完成。');
  });

  function createHostInstance(infoMessage) {
    const data = { infoMessage };
    return {
      __attached: true,
      __controller: undefined,
      __infoMessageTimer: undefined,
      __loadedGroupId: '',
      data,
      properties: { embedded: true, groupId: '' },
      setData(patch) {
        Object.assign(data, patch);
      },
    };
  }
});
