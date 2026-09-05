import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('workflow toast scheduling regressions', () => {
  let api;
  let panel;

  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.stubGlobal('Component', (value) => {
      panel = value;
    });
    api = await import('../src/subpackages/workflows/components/controller-host.ts');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function mount(kind) {
    const factory = () => ({ data: { infoMessage: '', errorMessage: '保留错误' } });
    const host = {
      data: {},
      properties: { active: true, embedded: kind === 'panel', groupId: 'a' },
      writes: [],
      setData(patch, callback) {
        this.writes.push(patch);
        Object.assign(this.data, patch);
        if (kind === 'panel' && Object.hasOwn(patch, 'infoMessage')) {
          panel.observers.infoMessage.call(this, patch.infoMessage);
        }
        callback?.();
      },
    };
    if (kind === 'panel') {
      api.registerWorkflowPanel(factory);
      panel.lifetimes.attached.call(host);
      return {
        host,
        hide: () => panel.pageLifetimes.hide.call(host),
        show: () => panel.pageLifetimes.show.call(host),
        unload: () => panel.lifetimes.detached.call(host),
      };
    }
    const page = api.createWorkflowPageDefinition(factory);
    page.onLoad.call(host, {});
    return {
      host,
      hide: () => page.onHide.call(host),
      show: () => page.onShow.call(host),
      unload: () => page.onUnload.call(host),
    };
  }

  for (const kind of ['page', 'panel']) {
    it(`${kind}: replaces messages and restarts identical messages with one timer`, () => {
      const { host, unload } = mount(kind);
      for (const message of ['第一条', '第二条', '第二条']) {
        host.setData({ infoMessage: message });
        expect(vi.getTimerCount()).toBe(1);
        vi.advanceTimersByTime(1_500);
        expect(host.data.infoMessage).toBe(message);
      }
      vi.advanceTimersByTime(499);
      expect(host.data.infoMessage).toBe('第二条');
      vi.advanceTimersByTime(1);
      expect(host.data.infoMessage).toBe('');
      expect(host.data.errorMessage).toBe('保留错误');
      expect(vi.getTimerCount()).toBe(0);
      unload();
    });

    it(`${kind}: cancels a pending clear on navigation and discards hidden feedback on return`, () => {
      const { host, hide, show, unload } = mount(kind);
      host.setData({ infoMessage: '完成' });
      hide();
      expect(vi.getTimerCount()).toBe(0);
      const writes = host.writes.length;
      vi.advanceTimersByTime(3_000);
      expect(host.writes).toHaveLength(writes);
      show();
      expect(host.data.infoMessage).toBe('');
      host.setData({ infoMessage: '返回后的新操作' });
      expect(vi.getTimerCount()).toBe(1);
      unload();
      const afterUnload = host.writes.length;
      vi.runAllTimers();
      expect(host.writes).toHaveLength(afterUnload);
      expect(vi.getTimerCount()).toBe(0);
    });

    it(`${kind}: a cancelled callback already queued cannot clear an identical replacement`, () => {
      const timeout = vi.spyOn(globalThis, 'setTimeout');
      const { host, unload } = mount(kind);
      host.setData({ infoMessage: '完成' });
      const staleCallback = timeout.mock.calls.at(-1)[0];
      host.setData({ infoMessage: '完成' });
      staleCallback();
      expect(host.data.infoMessage).toBe('完成');
      expect(vi.getTimerCount()).toBe(1);
      vi.advanceTimersByTime(2_000);
      expect(host.data.infoMessage).toBe('');
      unload();
    });
  }

  it('does not create a timer from a late detached component observer', () => {
    const { host, unload } = mount('panel');
    unload();
    panel.observers.infoMessage.call(host, '旧结果');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('drops old asynchronous success after a group replacement and after unload', async () => {
    const { host, unload } = mount('panel');
    const task = api.captureWorkflowControllerTask(host);
    let resolve;
    const pending = new Promise((done) => {
      resolve = done;
    });
    const continuation = pending.then(() => {
      if (task.isCurrent()) host.setData({ infoMessage: '旧操作完成' });
    });
    host.properties.groupId = 'b';
    panel.observers.groupId.call(host);
    host.setData({ infoMessage: '新群组操作完成' });
    resolve();
    await continuation;
    expect(host.data.infoMessage).toBe('新群组操作完成');
    const current = api.captureWorkflowControllerTask(host);
    unload();
    expect(current.isCurrent()).toBe(false);
    expect(task.isCurrent()).toBe(false);
  });
});
