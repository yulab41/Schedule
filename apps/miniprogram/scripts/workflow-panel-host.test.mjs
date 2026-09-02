import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('workflow panel host transient status', () => {
  let definition;
  let createWorkflowPageDefinition;
  let registerWorkflowPanel;

  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.stubGlobal('Component', (value) => {
      definition = value;
    });
    ({ createWorkflowPageDefinition, registerWorkflowPanel } =
      await import('../src/subpackages/workflows/components/controller-host.ts'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('clears a non-empty operation result after two seconds', () => {
    registerWorkflowPanel(() => ({ data: { infoMessage: '' } }));
    const instance = createHostInstance('换班已完成。');

    definition.observers.infoMessage.call(instance, '换班已完成。');
    vi.advanceTimersByTime(1_999);
    expect(instance.data.infoMessage).toBe('换班已完成。');
    vi.advanceTimersByTime(1);
    expect(instance.data.infoMessage).toBe('');
  });

  it('closes every sibling picker before a new picker opens or the panel background is tapped', () => {
    registerWorkflowPanel(() => ({ data: { infoMessage: '' } }));
    const closeFromParent = vi.fn();
    const instance = createHostInstance('');
    instance.selectAllComponents = vi.fn(() => [{ closeFromParent }, { closeFromParent }]);

    definition.methods.handlePickerRequestOpen.call(instance);
    expect(closeFromParent).toHaveBeenCalledTimes(2);
    definition.methods.handlePanelBackgroundTap.call(instance);
    expect(closeFromParent).toHaveBeenCalledTimes(4);
  });

  it('cancels the pending clear when the component detaches', () => {
    registerWorkflowPanel(() => ({ data: { infoMessage: '' } }));
    const instance = createHostInstance('加扣班已完成。');

    definition.observers.infoMessage.call(instance, '加扣班已完成。');
    definition.lifetimes.detached.call(instance);
    vi.runAllTimers();
    expect(instance.data.infoMessage).toBe('加扣班已完成。');
  });

  it('uses active only to gate Page foreground refresh, not bottom-nav toggles', () => {
    const onShow = vi.fn();
    registerWorkflowPanel(() => ({ data: { infoMessage: '' }, onLoad() {}, onShow }));
    const instance = createHostInstance('');
    instance.properties = { active: false, embedded: true, groupId: 'group-1' };

    definition.lifetimes.attached.call(instance);
    expect(definition.observers.active).toBeUndefined();
    definition.pageLifetimes.show.call(instance);
    expect(onShow).not.toHaveBeenCalled();
    instance.properties.active = true;
    definition.pageLifetimes.show.call(instance);
    expect(onShow).toHaveBeenCalledTimes(1);
  });

  it('invalidates a mounted workflow controller when permission clears its group', () => {
    const onUnload = vi.fn();
    registerWorkflowPanel(() => ({ data: { infoMessage: '' }, onLoad() {}, onUnload }));
    const instance = createHostInstance('');
    instance.properties = { active: true, embedded: true, groupId: 'group-1' };

    definition.lifetimes.attached.call(instance);
    expect(instance.__controller).toBeDefined();
    instance.properties.groupId = '';
    definition.observers.groupId.call(instance);
    expect(onUnload).toHaveBeenCalledTimes(1);
    expect(instance.__controller).toBeUndefined();
    expect(instance.__loadedGroupId).toBe('');
  });

  it('adapts the same controller to Page while preserving receiver, picker, and timer behavior', () => {
    const onLoad = vi.fn();
    const onShow = vi.fn();
    const page = createWorkflowPageDefinition(() => ({
      data: { embedded: false, infoMessage: '' },
      handleComplete() {
        this.setData({ infoMessage: '请假已完成。' });
      },
      onLoad,
      onShow,
    }));
    const closeFromParent = vi.fn();
    const instance = createHostInstance('');
    instance.properties = { embedded: false, groupId: 'group-1' };
    instance.selectAllComponents = vi.fn(() => [{ closeFromParent }]);
    const query = { groupId: 'group-1' };

    page.onLoad.call(instance, query);
    expect(onLoad.mock.instances[0]).toBe(instance);
    expect(onLoad).toHaveBeenCalledWith(query);
    closeFromParent.mockClear();
    page.onShow.call(instance);
    expect(onShow.mock.instances[0]).toBe(instance);
    page.handlePickerRequestOpen.call(instance);
    expect(closeFromParent).toHaveBeenCalledTimes(1);
    page.handlePanelBackgroundTap.call(instance);
    expect(closeFromParent).toHaveBeenCalledTimes(2);
    page.handleComplete.call(instance);
    expect(instance.data.infoMessage).toBe('请假已完成。');
    vi.advanceTimersByTime(2_000);
    expect(instance.data.infoMessage).toBe('');
  });

  it('cleans the direct Page timer on unload without invoking it after teardown', () => {
    const page = createWorkflowPageDefinition(() => ({
      data: { embedded: false, infoMessage: '' },
      handleComplete() {
        this.setData({ infoMessage: '换班已完成。' });
      },
      onLoad() {},
    }));
    const instance = createHostInstance('');

    page.onLoad.call(instance, {});
    page.handleComplete.call(instance);
    page.onUnload.call(instance);
    vi.runAllTimers();
    expect(instance.data.infoMessage).toBe('换班已完成。');
    expect(instance.__attached).toBe(false);
  });

  it('creates isolated controller maps and arrays for every direct Page instance', () => {
    const page = createWorkflowPageDefinition(() => ({
      data: { embedded: false, infoMessage: '', requests: [] },
      _operationAttempts: new Map(),
      _requestPreview: [],
      onLoad() {},
    }));
    const first = createHostInstance('');
    const second = createHostInstance('');

    page.onLoad.call(first, { groupId: 'group-1' });
    page.onLoad.call(second, { groupId: 'group-2' });

    expect(first.__controller).not.toBe(second.__controller);
    expect(first._operationAttempts).toBeInstanceOf(Map);
    expect(second._operationAttempts).toBeInstanceOf(Map);
    expect(first._operationAttempts).not.toBe(second._operationAttempts);
    expect(first._requestPreview).not.toBe(second._requestPreview);
  });

  it('resets the direct Page message timer, preserves callbacks, and restores setData', () => {
    const callback = vi.fn();
    const page = createWorkflowPageDefinition(() => ({
      data: { embedded: false, infoMessage: '' },
      handleMessage(value) {
        this.setData({ infoMessage: value }, callback);
      },
      onLoad() {},
    }));
    const instance = createHostInstance('');
    const originalSetData = instance.setData;

    page.onLoad.call(instance, {});
    page.handleMessage.call(instance, '第一条');
    vi.advanceTimersByTime(1_500);
    page.handleMessage.call(instance, '第二条');
    vi.advanceTimersByTime(1_999);
    expect(instance.data.infoMessage).toBe('第二条');
    vi.advanceTimersByTime(1);
    expect(instance.data.infoMessage).toBe('');
    expect(callback).toHaveBeenCalledTimes(2);
    page.onUnload.call(instance);
    expect(instance.setData).toBe(originalSetData);
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
      setData(patch, callback) {
        Object.assign(data, patch);
        callback?.();
      },
    };
  }
});
