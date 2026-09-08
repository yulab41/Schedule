import { afterEach, describe, expect, it, vi } from 'vitest';
import { createClientCapabilityStore } from '../src/app/client-capability-store.ts';
import { createClientUpdateController } from '../src/platform/client-update.ts';
afterEach(() => vi.unstubAllGlobals());
describe('unsupported version feedback', () => {
  it('keeps a real 426 distinct from a disabled capability and recovers after refresh', async () => {
    let failure = { status: 426, code: 'CLIENT_VERSION_UNSUPPORTED' };
    const notify = vi.fn();
    const store = createClientCapabilityStore({
      platform: 'miniprogram',
      version: '2.0.0',
      onUnsupported: notify,
      read: async () => {
        if (failure) throw failure;
        return {
          platform: 'miniprogram',
          version: '2.0.0',
          global: true,
          core: true,
          guest: false,
          workflows: false,
          organization: false,
          insights: false,
          externalMessages: false,
        };
      },
    });
    await expect(store.require('core')).rejects.toMatchObject({
      code: 'CLIENT_VERSION_UNSUPPORTED',
    });
    expect(notify).toHaveBeenCalledTimes(1);
    failure = undefined;
    await store.refresh({ force: true });
    await expect(store.require('core')).resolves.toBeUndefined();
  });
  it.each([
    { status: 503, code: 'CLIENT_VERSION_UNSUPPORTED' },
    { status: 426, code: 'SERVICE_UNAVAILABLE' },
    new Error('offline'),
  ])('does not mistake other errors for version retirement: %j', async (error) => {
    const notify = vi.fn(),
      store = createClientCapabilityStore({
        platform: 'miniprogram',
        version: '2.0.0',
        onUnsupported: notify,
        read: async () => {
          throw error;
        },
      });
    await expect(store.require('core')).rejects.toMatchObject({
      code: 'CLIENT_CAPABILITY_DISABLED',
    });
    expect(notify).not.toHaveBeenCalled();
  });
});

describe('native update adapter (Node callback validation, not native runtime)', () => {
  it('shares native callbacks and prompts across independently bundled entry points', async () => {
    vi.resetModules();
    const app = { globalData: {} };
    const manager = { onUpdateReady: vi.fn(), onUpdateFailed: vi.fn(), applyUpdate: vi.fn() };
    vi.stubGlobal('getApp', () => app);
    vi.stubGlobal('wx', { getUpdateManager: vi.fn(() => manager), showModal: vi.fn() });
    const first = await import('../src/platform/client-update.ts');
    first.initializeClientUpdate();
    vi.resetModules();
    const second = await import('../src/platform/client-update-request.ts');
    first.requestClientUpdate();
    second.requestClientUpdate();
    expect(globalThis.wx.getUpdateManager).toHaveBeenCalledTimes(1);
    expect(manager.onUpdateReady).toHaveBeenCalledTimes(1);
    expect(globalThis.wx.showModal).toHaveBeenCalledTimes(1);
  });
  it('never applies before ready and only restarts after explicit confirmation', () => {
    let ready;
    const dialogs = [];
    const manager = {
      onUpdateReady: (cb) => {
        ready = cb;
      },
      onUpdateFailed: vi.fn(),
      applyUpdate: vi.fn(),
    };
    const update = createClientUpdateController({
      getManager: () => manager,
      showDialog: (o) => dialogs.push(o),
    });
    update.initialize();
    update.requestUpdate();
    update.requestUpdate();
    expect(dialogs).toHaveLength(1);
    expect(manager.applyUpdate).not.toHaveBeenCalled();
    ready();
    expect(dialogs).toHaveLength(1);
    dialogs[0].success({ confirm: true });
    expect(dialogs).toHaveLength(2);
    expect(manager.applyUpdate).not.toHaveBeenCalled();
    dialogs[1].success({ confirm: true });
    expect(manager.applyUpdate).toHaveBeenCalledTimes(1);
  });
  it('allows cancellation and remains usable without UpdateManager', () => {
    let ready;
    const dialogs = [];
    const manager = {
      onUpdateReady: (cb) => {
        ready = cb;
      },
      onUpdateFailed: vi.fn(),
      applyUpdate: vi.fn(),
    };
    const update = createClientUpdateController({
      getManager: () => manager,
      showDialog: (o) => dialogs.push(o),
    });
    update.initialize();
    ready();
    update.requestUpdate();
    dialogs[0].success({ confirm: false });
    expect(manager.applyUpdate).not.toHaveBeenCalled();
    const fallback = createClientUpdateController({
      getManager: () => undefined,
      showDialog: (o) => dialogs.push(o),
    });
    expect(() => fallback.requestUpdate()).not.toThrow();
    expect(dialogs.at(-1).showCancel).toBe(false);
  });
});
