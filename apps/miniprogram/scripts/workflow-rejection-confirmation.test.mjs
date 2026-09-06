import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('workflow rejection confirmation outcomes', () => {
  let api;
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('__MINIPROGRAM_API_BASE_URL__', 'https://example.test/api');
    vi.stubGlobal('__MINIPROGRAM_BUILD_PROFILE__', 'production');
    vi.stubGlobal('__MINIPROGRAM_BUILD_COMMIT__', 'test');
    vi.stubGlobal('__MINIPROGRAM_BUILD_VERSION__', 'test');
    vi.stubGlobal('wx', { getStorageSync: () => undefined, showModal: vi.fn() });
    api = {
      rejectSwapRequest: vi.fn(() => new Promise(() => {})),
      rejectDutyAdjustment: vi.fn(() => new Promise(() => {})),
      rejectLeaveRequest: vi.fn(() => new Promise(() => {})),
    };
    vi.doMock('../src/platform/client-core-calendar.ts', async (original) => ({
      ...(await original()),
      createRuntimeWorkflowClient: () => api,
    }));
  });
  afterEach(() => {
    vi.doUnmock('../src/platform/client-core-calendar.ts');
    vi.unstubAllGlobals();
  });

  async function mount(kind) {
    const mod = await import(
      `../src/subpackages/workflows/components/workflow-${kind}-panel/controller.ts`
    );
    const factory =
      kind === 'swap'
        ? 'createSwapPanelControllerDefinition'
        : kind === 'duty'
          ? 'createDutyPanelControllerDefinition'
          : 'createLeavePanelControllerDefinition';
    const definition = mod[factory](true);
    const request = {
      id: 'synthetic-request',
      version: 7,
      status: 'pending_approval',
      memberName: '合成人员',
    };
    const host = {
      ...definition,
      __workflowLifecycleManaged: true,
      __attached: true,
      __controller: definition,
      __workflowControllerToken: {},
      _currentGroupId: 'synthetic-group',
      _rawMyRequests: [],
      _rawApprovals: [request],
      _approvalTarget: request,
      _operationAttempts: new Map(),
      data: { ...definition.data, canApprove: true, state: 'ready' },
      setData(patch) {
        Object.assign(this.data, patch);
      },
    };
    return {
      host,
      definition,
      reject:
        api[
          kind === 'swap'
            ? 'rejectSwapRequest'
            : kind === 'duty'
              ? 'rejectDutyAdjustment'
              : 'rejectLeaveRequest'
        ],
    };
  }

  for (const kind of ['swap', 'leave', 'duty']) {
    it(`${kind}: synchronous modal errors are surfaced without an unhandled rejection`, async () => {
      const { host, definition, reject } = await mount(kind);
      globalThis.wx.showModal.mockImplementation(() => {
        throw new Error('synthetic modal failure');
      });
      definition.handleReject.call(host, {
        currentTarget: { dataset: { id: 'synthetic-request' } },
      });
      await vi.waitFor(() =>
        expect(host.data.errorMessage || host.data.approvalErrorMessage || '').toContain(
          '确认窗口',
        ),
      );
      expect(reject).not.toHaveBeenCalled();
    });

    it(`${kind}: delayed confirmation callbacks cannot affect a detached controller`, async () => {
      const { host, definition, reject } = await mount(kind);
      let modal;
      globalThis.wx.showModal.mockImplementation((options) => {
        modal = options;
      });
      definition.handleReject.call(host, {
        currentTarget: { dataset: { id: 'synthetic-request' } },
      });
      expect(modal).toBeDefined();
      host.__attached = false;
      modal.fail({ errMsg: 'synthetic late failure' });
      await Promise.resolve();
      expect(host.data.errorMessage || host.data.approvalErrorMessage || '').toBe('');
      expect(reject).not.toHaveBeenCalled();
    });

    it(`${kind}: shows a retryable error when the native confirmation fails, without submitting`, async () => {
      const { host, definition, reject } = await mount(kind);
      globalThis.wx.showModal.mockImplementation(({ fail }) =>
        fail({ errMsg: 'synthetic unavailable' }),
      );
      definition.handleReject.call(host, {
        currentTarget: { dataset: { id: 'synthetic-request' } },
      });
      await vi.waitFor(() =>
        expect(host.data.errorMessage || host.data.approvalErrorMessage || '').toContain(
          '确认窗口',
        ),
      );
      expect(reject).not.toHaveBeenCalled();
    });

    it(`${kind}: cancellation stays quiet and explicit confirmation submits the exact version once`, async () => {
      const { host, definition, reject } = await mount(kind);
      globalThis.wx.showModal.mockImplementation(({ success }) =>
        success({ confirm: false, cancel: true }),
      );
      const event = { currentTarget: { dataset: { id: 'synthetic-request' } } };
      definition.handleReject.call(host, event);
      await Promise.resolve();
      expect(reject).not.toHaveBeenCalled();
      expect(host.data.errorMessage || host.data.approvalErrorMessage || '').toBe('');
      globalThis.wx.showModal.mockImplementation(({ success }) =>
        success({ confirm: true, cancel: false }),
      );
      definition.handleReject.call(host, event);
      await vi.waitFor(() => expect(reject).toHaveBeenCalledOnce());
      expect(reject).toHaveBeenCalledWith(
        'synthetic-group',
        'synthetic-request',
        expect.objectContaining({ expectedVersion: 7, operationId: expect.any(String) }),
      );
    });
  }
});
