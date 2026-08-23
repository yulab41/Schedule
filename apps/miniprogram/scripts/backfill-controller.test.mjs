import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  holidayApiGoldenResponse,
  pastScheduleBackfillBatchGoldenResult,
} from '@schedule/client-core/testing';

describe('P5 native atomic backfill controller', () => {
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
      navigateBack: vi.fn(),
      request: vi.fn(),
      setStorageSync: vi.fn(),
    });
    await import('../src/subpackages/scheduling/pages/backfill/index.ts');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('cancels palette selection and a staged date on the second tap', () => {
    const instance = createPageInstance(definition);

    definition.handleShiftTap.call(instance, { currentTarget: { dataset: { id: 'shift-a' } } });
    expect(instance.data.activeShiftTypeId).toBe('');
    definition.handleShiftTap.call(instance, { currentTarget: { dataset: { id: 'shift-a' } } });
    expect(instance.data.activeShiftTypeId).toBe('shift-a');

    definition.handleDateTap.call(instance, {
      currentTarget: { dataset: { date: '2026-07-02', month: '2026-07' } },
    });
    expect(instance._staged.has('role-1:2026-07-02')).toBe(true);
    definition.handleDateTap.call(instance, {
      currentTarget: { dataset: { date: '2026-07-02', month: '2026-07' } },
    });
    expect(instance._staged.has('role-1:2026-07-02')).toBe(false);
  });

  it('fails closed for today, future, and adjacent-month cells', () => {
    const instance = createPageInstance(definition);

    for (const detail of [
      { date: '2026-07-31', month: '2026-06' },
      { date: '2026-08-01', month: '2026-08' },
      { date: '2026-08-02', month: '2026-08' },
    ]) {
      definition.handleDateTap.call(instance, { currentTarget: { dataset: detail } });
    }

    expect(instance._staged.size).toBe(0);
  });

  it('freezes one sorted batch and reuses its operation id after a network failure', async () => {
    const requests = [];
    globalThis.wx.request.mockImplementation((options) => {
      requests.push(options);
      options.fail(new Error('network lost'));
    });
    const instance = createPageInstance(definition);
    instance._currentGroupId = 'group-1';
    instance._staged.set('role-1:2026-07-02', {
      actualMembershipId: 'member-1',
      businessDate: '2026-07-02',
      scheduleRoleId: 'role-1',
      shiftTypeId: 'shift-a',
    });
    instance._staged.set('role-1:2026-07-01', {
      actualMembershipId: 'member-1',
      businessDate: '2026-07-01',
      scheduleRoleId: 'role-1',
      shiftTypeId: 'shift-a',
    });
    instance.data.pendingCount = 2;
    instance.data.reason = '  实际值班人员更正  ';

    definition.handleConfirm.call(instance);
    await vi.waitFor(() => expect(instance.data.isBusy).toBe(false));
    definition.handleConfirm.call(instance);
    await vi.waitFor(() => expect(requests).toHaveLength(2));

    expect(requests[0].url).toContain('/groups/group-1/past-schedules/backfill-batches');
    expect(requests[0].data.items.map((item) => item.businessDate)).toEqual([
      '2026-07-01',
      '2026-07-02',
    ]);
    expect(requests[0].data.reason).toBe('实际值班人员更正');
    expect(requests[1].header['Idempotency-Key']).toBe(requests[0].header['Idempotency-Key']);
    expect(requests[1].data.operationId).toBe(requests[0].data.operationId);
    for (const request of requests) {
      expect(request.header['Idempotency-Key']).toBe(request.data.operationId);
    }
    expect(instance._staged.size).toBe(2);
  });

  it('keeps a successful batch committed when the follow-up records refresh fails', async () => {
    let requestCount = 0;
    globalThis.wx.request.mockImplementation((options) => {
      requestCount += 1;
      if (requestCount === 1) {
        options.success({ data: pastScheduleBackfillBatchGoldenResult, statusCode: 200 });
      } else if (requestCount === 2) {
        options.fail(new Error('records refresh failed'));
      } else {
        options.success({ data: holidayApiGoldenResponse, statusCode: 200 });
      }
    });
    const instance = createPageInstance(definition);
    instance._currentGroupId = 'group-1';
    instance._staged.set('role-1:2026-07-02', {
      actualMembershipId: 'member-1',
      businessDate: '2026-07-02',
      scheduleRoleId: 'role-1',
      shiftTypeId: 'shift-a',
    });
    instance.data.pendingCount = 1;

    definition.handleConfirm.call(instance);
    await vi.waitFor(() => expect(instance.data.isBusy).toBe(false));

    expect(instance._staged.size).toBe(0);
    expect(instance._confirmOperationId).toBe('');
    expect(instance.data.infoMessage).toContain('已确认补录 1 条');
    expect(instance.data.infoMessage).toContain('页面资料刷新失败');
    expect(instance.data.infoMessage).not.toContain('尚未确认');
  });

  it('does not enter a paint-ready state when the group has no schedule role', () => {
    const instance = createPageInstance(definition);
    instance.data.roleId = '';
    instance.data.activeShiftTypeId = '';

    definition.handleShiftTap.call(instance, { currentTarget: { dataset: { id: 'shift-a' } } });

    expect(instance.data.isPaintReady).toBe(false);
    expect(instance.data.paintStatusText).not.toContain('连续点选');
  });
});

function createPageInstance(definition) {
  const data = structuredClone(definition.data);
  Object.assign(data, {
    activeMemberId: 'member-1',
    activeShiftTypeId: 'shift-a',
    businessMonth: '2026-07',
    isBusy: false,
    members: [{ membershipId: 'member-1', realName: '林医生' }],
    pendingCount: 0,
    reason: '',
    roleId: 'role-1',
    shiftTypes: [{ id: 'shift-a', name: '白班' }],
    today: '2026-08-01',
  });
  const instance = {
    ...definition,
    _confirmFingerprint: '',
    _confirmOperationId: '',
    _calendar: undefined,
    _config: undefined,
    _currentGroupId: '',
    _holidays: new Map(),
    _initialPeriodId: '',
    _loadSerial: 0,
    _periods: [],
    _records: [],
    _staged: new Map(),
    data,
    setData(patch) {
      Object.assign(data, patch);
    },
  };
  return instance;
}
