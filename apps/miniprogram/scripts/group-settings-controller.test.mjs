import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const groupId = '11111111-1111-4111-8111-111111111111';
const membershipId = '22222222-2222-4222-8222-222222222222';

describe('P5 native group mobile-phone consent controller', () => {
  let definition;
  let requests;
  let statusResponses;
  let updateResponses;
  let windowWidth;

  beforeEach(async () => {
    vi.resetModules();
    requests = [];
    statusResponses = [status({ state: 'not-consented' })];
    updateResponses = [];
    windowWidth = 390;
    vi.stubGlobal('Page', (value) => {
      definition = value;
    });
    vi.stubGlobal('__MINIPROGRAM_API_BASE_URL__', 'https://example.test/api');
    vi.stubGlobal('__MINIPROGRAM_BUILD_COMMIT__', 'test');
    vi.stubGlobal('__MINIPROGRAM_BUILD_PROFILE__', 'production');
    vi.stubGlobal('__MINIPROGRAM_BUILD_VERSION__', 'test');
    vi.stubGlobal('wx', {
      getStorageSync: vi.fn((key) =>
        key === 'schedule.wechat.session'
          ? {
              expiresAt: '2026-09-24T00:00:00.000Z',
              profile: { id: 'user-1', realName: '林恩宇', version: 1 },
              token: 'test-token',
            }
          : groupId,
      ),
      getWindowInfo: () => ({ statusBarHeight: 24, windowHeight: 844, windowWidth }),
      navigateBack: vi.fn(),
      navigateTo: vi.fn(),
      request: vi.fn((options) => {
        requests.push(options);
        if (options.url.endsWith('/groups') && options.method === 'GET') {
          options.success({
            data: [
              { groupCode: '2608', id: groupId, name: '头颈外科医生', role: 'member', version: 1 },
            ],
            statusCode: 200,
          });
          return;
        }
        if (options.url.endsWith(`/groups/${groupId}/mobile-phone-consent`)) {
          if (options.method === 'GET') {
            const response = statusResponses.shift();
            if (response instanceof Error) options.fail(response);
            else options.success({ data: response, statusCode: 200 });
            return;
          }
          const response = updateResponses.shift();
          if (response?.kind === 'conflict') {
            options.success({
              data: {
                error: {
                  code: 'CONFLICT',
                  message: '联系方式已变化，请刷新。',
                  requestId: 'request-conflict',
                },
              },
              statusCode: 409,
            });
          } else if (response instanceof Error || response === undefined) {
            options.fail(response ?? new Error('network result unknown'));
          } else {
            options.success({ data: response, statusCode: 200 });
          }
          return;
        }
        throw new Error(`unexpected request ${options.method} ${options.url}`);
      }),
    });
    await import('../src/subpackages/organization/pages/group-settings/index.ts');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads the direct group, profile, masked phone, and compact-safe ready state', async () => {
    const instance = createPageInstance(definition);
    definition.onLoad.call(instance, { groupId: encodeURIComponent(groupId) });
    await vi.waitFor(() => expect(instance.data.state).toBe('ready'));

    expect(instance.data).toMatchObject({
      actionLabel: '保存同意',
      canSave: false,
      consentState: 'not-consented',
      currentGroupCodeDigits: [
        { key: 'digit-0', value: '2' },
        { key: 'digit-1', value: '6' },
        { key: 'digit-2', value: '0' },
        { key: 'digit-3', value: '8' },
      ],
      currentGroupName: '头颈外科医生',
      currentGroupRole: '成员',
      desiredConsent: false,
      maskedMobilePhone: '138 **** 7926',
      profileInitial: '林',
      profileName: '林恩宇',
      viewportClass: '',
    });
    expect(globalThis.wx.setStorageSync).toBeUndefined();
  });

  it('uses the explicit compact class at the 320px boundary', async () => {
    windowWidth = 320;
    const instance = await loadReadyInstance(definition);
    expect(instance.data.viewportClass).toBe('is-compact');
  });

  it('recovers an initial status failure through the explicit retry action', async () => {
    statusResponses = [new Error('offline'), status({ state: 'not-consented' })];
    const instance = createPageInstance(definition);
    definition.onLoad.call(instance, { groupId });
    await vi.waitFor(() => expect(instance.data.state).toBe('error'));

    definition.handleRetry.call(instance);
    await vi.waitFor(() => expect(instance.data.state).toBe('ready'));
    expect(statusRequests()).toHaveLength(2);
  });

  it('reuses one frozen payload and operation id after an ambiguous failure', async () => {
    updateResponses.push(new Error('network lost'), new Error('network lost again'));
    const instance = await loadReadyInstance(definition);

    definition.handleConsentToggle.call(instance);
    definition.handleSave.call(instance);
    await vi.waitFor(() => expect(instance.data.isSaving).toBe(false));
    definition.handleSave.call(instance);
    await vi.waitFor(() => expect(updateRequests()).toHaveLength(2));

    const [first, second] = updateRequests();
    expect(second.data).toEqual(first.data);
    expect(second.header['Idempotency-Key']).toBe(first.header['Idempotency-Key']);
    for (const request of [first, second]) {
      expect(request.header['Idempotency-Key']).toBe(request.data.operationId);
      expect(request.data).toMatchObject({
        consented: true,
        expectedContactVersion: 3,
        noticeVersion: 'v1',
      });
    }
    expect(instance.data.errorMessage).toContain('可直接重试');
  });

  it('changes the operation id after the desired choice changes', async () => {
    updateResponses.push(new Error('first failure'), new Error('second failure'));
    const instance = await loadReadyInstance(definition);

    definition.handleConsentToggle.call(instance);
    definition.handleSave.call(instance);
    await vi.waitFor(() => expect(instance.data.isSaving).toBe(false));
    const firstKey = updateRequests()[0].header['Idempotency-Key'];

    definition.handleConsentToggle.call(instance);
    definition.handleConsentToggle.call(instance);
    definition.handleSave.call(instance);
    await vi.waitFor(() => expect(updateRequests()).toHaveLength(2));

    expect(updateRequests()[1].header['Idempotency-Key']).not.toBe(firstKey);
  });

  it('submits a revoke and atomically replaces the saved response', async () => {
    statusResponses = [status({ consentedAt: '2026-08-24T01:00:00.000Z', state: 'consented' })];
    updateResponses.push(status({ state: 'not-consented' }));
    const instance = await loadReadyInstance(definition);

    definition.handleConsentToggle.call(instance);
    expect(instance.data).toMatchObject({ actionLabel: '撤回同意', canSave: true });
    definition.handleSave.call(instance);
    await vi.waitFor(() => expect(instance.data.isSaving).toBe(false));

    expect(updateRequests()[0].data.consented).toBe(false);
    expect(instance.data).toMatchObject({
      actionLabel: '保存同意',
      canSave: false,
      consentState: 'not-consented',
      desiredConsent: false,
      infoMessage: '已撤回当前群组的手机号公开同意。',
    });
  });

  it('reloads a 409 status and uses its new contact version with a new operation id', async () => {
    statusResponses = [
      status({ state: 'not-consented' }),
      status({ contactVersion: 4, state: 'stale' }),
    ];
    updateResponses.push({ kind: 'conflict' }, new Error('network remains ambiguous'));
    const instance = await loadReadyInstance(definition);

    definition.handleConsentToggle.call(instance);
    definition.handleSave.call(instance);
    await vi.waitFor(() => expect(instance.data.consentState).toBe('stale'));
    const conflictKey = updateRequests()[0].header['Idempotency-Key'];
    expect(instance.data).toMatchObject({
      canSave: false,
      contactVersion: 4,
      desiredConsent: false,
    });

    definition.handleConsentToggle.call(instance);
    definition.handleSave.call(instance);
    await vi.waitFor(() => expect(updateRequests()).toHaveLength(2));
    expect(updateRequests()[1].data.expectedContactVersion).toBe(4);
    expect(updateRequests()[1].header['Idempotency-Key']).not.toBe(conflictKey);
    expect(statusRequests()).toHaveLength(2);
  });

  it('fails closed when the status reload after a 409 is unavailable', async () => {
    statusResponses = [status({ state: 'not-consented' }), new Error('reload unavailable')];
    updateResponses.push({ kind: 'conflict' });
    const instance = await loadReadyInstance(definition);

    definition.handleConsentToggle.call(instance);
    definition.handleSave.call(instance);
    await vi.waitFor(() => expect(instance.data.state).toBe('error'));

    expect(instance.data).toMatchObject({
      canSave: false,
      isSaving: false,
      saveDisabled: true,
      switchDisabled: true,
    });
    definition.handleConsentToggle.call(instance);
    definition.handleSave.call(instance);
    expect(updateRequests()).toHaveLength(1);
  });

  it('fails closed when the member has no mobile phone', async () => {
    statusResponses = [
      status({ contactVersion: 0, maskedMobilePhone: undefined, state: 'missing-phone' }),
    ];
    const instance = await loadReadyInstance(definition);

    definition.handleConsentToggle.call(instance);
    definition.handleSave.call(instance);

    expect(instance.data).toMatchObject({
      actionLabel: '保存同意',
      canSave: false,
      consentState: 'missing-phone',
      desiredConsent: false,
    });
    expect(updateRequests()).toHaveLength(0);
  });

  function updateRequests() {
    return requests.filter((request) => request.method === 'PUT');
  }

  function statusRequests() {
    return requests.filter(
      (request) => request.method === 'GET' && request.url.endsWith('/mobile-phone-consent'),
    );
  }
});

function createPageInstance(definition) {
  const data = structuredClone(definition.data);
  return {
    ...definition,
    _consentDraft: undefined,
    _consentStatus: undefined,
    _currentGroupId: '',
    _loadSerial: 0,
    data,
    setData(patch, callback) {
      Object.assign(data, patch);
      callback?.();
    },
  };
}

async function loadReadyInstance(definition) {
  const instance = createPageInstance(definition);
  definition.onLoad.call(instance, { groupId });
  await vi.waitFor(() => expect(instance.data.state).toBe('ready'));
  return instance;
}

function status(overrides = {}) {
  return {
    contactVersion: 3,
    groupId,
    maskedMobilePhone: '138 **** 7926',
    membershipId,
    noticeVersion: 'v1',
    state: 'not-consented',
    ...overrides,
  };
}
