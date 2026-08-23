import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('P5 native schedule publication controller', () => {
  let definition;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal('Page', (value) => {
      definition = value;
    });
    vi.stubGlobal('__MINIPROGRAM_API_BASE_URL__', 'https://example.test/api');
    vi.stubGlobal('__MINIPROGRAM_BUILD_COMMIT__', 'test');
    vi.stubGlobal('__MINIPROGRAM_BUILD_PROFILE__', 'production');
    vi.stubGlobal('__MINIPROGRAM_BUILD_VERSION__', 'test');
    vi.stubGlobal('wx', {
      getStorageSync: vi.fn(() => ({ token: 'test-token' })),
      getWindowInfo: () => ({ statusBarHeight: 24, windowWidth: 390 }),
      request: vi.fn(),
    });
    await import('../src/subpackages/scheduling/pages/manual/index.ts');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reuses one publish operation id after an ambiguous failure', async () => {
    const requests = [];
    globalThis.wx.request.mockImplementation((options) => {
      requests.push(options);
      options.fail(new Error('network lost'));
    });
    const instance = createPageInstance(definition);

    definition.handlePublishBatch.call(instance, {
      currentTarget: { dataset: { batchKey: 'apply-operation' } },
    });
    await vi.waitFor(() => expect(instance.data.isBusy).toBe(false));
    definition.handlePublishBatch.call(instance, {
      currentTarget: { dataset: { batchKey: 'apply-operation' } },
    });
    await vi.waitFor(() => expect(requests).toHaveLength(2));

    expect(requests.map((request) => request.header['Idempotency-Key'])).toEqual([
      expect.any(String),
      expect.any(String),
    ]);
    expect(requests[0].header['Idempotency-Key']).toBe(requests[1].header['Idempotency-Key']);
    expect(requests[0].data.operationId).toBe(requests[1].data.operationId);
  });

  it('requires both acknowledgements for a republish containing past dates and impacts', () => {
    const instance = createPageInstance(definition);
    instance.data.releaseDialogKind = 'republish';
    instance.data.releaseRequiresAcknowledgement = true;
    instance.data.releaseHasPastDates = true;

    definition.handleReleaseAcknowledgement.call(instance, {
      currentTarget: { dataset: { field: 'impact' } },
      detail: { checked: true },
    });
    expect(instance.data.releaseConfirmDisabled).toBe(true);

    definition.handleReleaseAcknowledgement.call(instance, {
      currentTarget: { dataset: { field: 'past' } },
      detail: { checked: true },
    });
    expect(instance.data.releaseConfirmDisabled).toBe(false);
  });

  it('keeps draft delete inert until the explicit confirmation action', () => {
    const instance = createPageInstance(definition);
    definition.handleOpenDeleteDialog.call(instance, {
      currentTarget: { dataset: { batchKey: 'apply-operation' } },
    });

    expect(instance.data.releaseDialogKind).toBe('delete');
    expect(globalThis.wx.request).not.toHaveBeenCalled();
  });
});

function createPageInstance(definition) {
  const data = structuredClone(definition.data);
  data.isBusy = false;
  data.state = 'release';
  const instance = {
    ...definition,
    _currentGroupId: '11111111-1111-4111-8111-111111111111',
    _history: [
      {
        applyEndDate: '2026-08-30',
        applyStartDate: '2026-08-01',
        businessMonth: '2026-08',
        createdAt: '2026-08-23T00:00:00.000Z',
        id: '22222222-2222-4222-8222-222222222222',
        operationId: 'apply-operation',
        revision: 3,
        scheduleRoleId: 'role-1',
        scheduleRoleName: '一线',
        status: 'draft',
        version: 2,
      },
    ],
    _releaseMutationTargetId: '22222222-2222-4222-8222-222222222222',
    _releaseOperationIds: new Map(),
    data,
    setData(patch) {
      Object.assign(data, patch);
    },
  };
  return instance;
}
