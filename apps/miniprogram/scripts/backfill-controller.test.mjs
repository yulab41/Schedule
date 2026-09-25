import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  holidayApiGoldenResponse,
  pastScheduleBackfillBatchGoldenResult,
} from '@schedule/client-core/testing';
import { enableTestClientCapabilities } from './test-client-capabilities.mjs';

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
      getStorageInfoSync: vi.fn(() => ({ keys: [] })),
      getStorageSync: vi.fn((key) =>
        key === 'schedule.wechat.session' ? validSession() : undefined,
      ),
      getWindowInfo: () => ({ statusBarHeight: 24, windowWidth: 390 }),
      navigateBack: vi.fn(),
      request: vi.fn(),
      setStorageSync: vi.fn(),
    });
    await import('../src/subpackages/scheduling/pages/backfill/index.ts');
    await enableTestClientCapabilities();
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
    expect(instance._staged.size).toBe(1);
    definition.handleDateTap.call(instance, {
      currentTarget: { dataset: { date: '2026-07-02', month: '2026-07' } },
    });
    expect(instance._staged.size).toBe(0);
  });

  it.each([false, true])(
    'connects WXML selection and nested calendar events (existing=%s)',
    async (existing) => {
      const read = (file) => readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
      const pageXml = read('subpackages/scheduling/pages/backfill/index.wxml');
      const node = (xml, tag, marker = '') => {
        const tags = [...xml.matchAll(new RegExp(`<${tag}\\b[^>]*>`, 'gu'))]
          .map(([text]) => text)
          .filter((text) => text.includes(marker));
        expect(tags).toHaveLength(1);
        return Object.fromEntries(
          [...tags[0].matchAll(/([\w:-]+)="([^"]*)"/gu)].map(([, key, value]) => [key, value]),
        );
      };
      const dispatch = (host, attrs, event, detail = {}, dataset = {}) => {
        const handler = attrs[`bind:${event}`] ?? attrs[`bind${event}`];
        expect(typeof host[handler]).toBe('function');
        host[handler].call(host, { detail, currentTarget: { dataset } });
      };
      let cellDef, monthDef;
      vi.stubGlobal('Component', (value) => {
        cellDef = value;
      });
      await import('../src/components/calendar/calendar-cell/index.ts');
      vi.stubGlobal('Component', (value) => {
        monthDef = value;
      });
      await import('../src/components/calendar/calendar-month/index.ts');
      const page = createPageInstance(definition);
      Object.assign(page.data, { activeMemberId: '', activeShiftTypeId: '' });
      const date = '2026-07-02';
      page._calendarByKey.get('role-1:2026-07').assignments = existing
        ? [
            {
              id: 'original',
              businessDate: date,
              scheduleRoleId: 'role-1',
              slotPosition: 1,
              actualMembershipId: 'old-member',
              actualMemberName: '原人员',
              shiftTypeId: 'shift-a',
              shiftTypeAbbreviation: '白',
              shiftTypeName: '白班',
            },
          ]
        : [];
      const shiftNode = node(pageXml, 'view', 'shift-type-button');
      const memberNode = node(pageXml, 'view', 'member-button');
      const monthNode = node(pageXml, 'calendar-month', 'id="backfill-month"');
      const cellNode = node(read('components/calendar/calendar-month/index.wxml'), 'calendar-cell');
      const cellRoot = node(
        read('components/calendar/calendar-cell/index.wxml'),
        'view',
        'class="calendar-cell ',
      );
      const month = {
        ...monthDef.methods,
        triggerEvent: (event, detail) => dispatch(page, monthNode, event, detail),
      };
      const tapDate = () => {
        const cell = page.data.monthPanels
          .find((panel) => panel.relative === 0)
          .cells.find((cell) => cell.businessDate === date);
        dispatch(
          {
            ...cellDef.methods,
            properties: {
              businessDate: cell.businessDate,
              isCurrentMonth: cell.isCurrentMonth,
              disabled: cell.disabled,
            },
            triggerEvent: (event, detail) => dispatch(month, cellNode, event, detail),
          },
          cellRoot,
          'tap',
        );
      };
      expect(memberNode['data-id']).toBe('{{item.membershipId}}');
      expect(shiftNode['data-id']).toBe('{{item.id}}');
      dispatch(page, memberNode, 'tap', {}, { id: page.data.members[0].membershipId });
      tapDate();
      expect(page.data.pendingCount).toBe(0);
      expect(page.data.paintStatusText).toBe('还需选择班种');
      dispatch(page, shiftNode, 'tap', {}, { id: page.data.shiftTypes[0].id });
      tapDate();
      expect(page.data.pendingCount).toBe(1);
      const duties = page.data.monthPanels
        .find((panel) => panel.relative === 0)
        .cells.find((cell) => cell.businessDate === date).duties;
      expect(duties.map(({ name, state }) => [name, state])).toEqual(
        existing
          ? [
              ['原人员', 'normal'],
              ['林医生', 'added'],
            ]
          : [['林医生', 'added']],
      );
      expect(pageXml).toMatch(/:\s*paintStatusText/u);
      definition.onUnload.call(page);
    },
  );

  it('stages a removal for an existing member+shift and only writes it on confirm', async () => {
    const instance = createPageInstance(definition);
    instance._currentGroupId = 'group-1';
    instance._calendarByKey.get('role-1:2026-07').assignments = [
      {
        id: 'slot-1',
        businessDate: '2026-07-02',
        scheduleRoleId: 'role-1',
        slotPosition: 1,
        actualMembershipId: 'member-1',
        actualMemberName: '林医生',
        shiftTypeId: 'shift-a',
        shiftTypeAbbreviation: '白',
        shiftTypeName: '白班',
      },
    ];

    definition.handleDateTap.call(instance, {
      currentTarget: { dataset: { date: '2026-07-02', month: '2026-07' } },
    });
    expect(instance._staged.size).toBe(1);
    const [stagedValue] = [...instance._staged.values()];
    expect(stagedValue).toMatchObject({ assignmentId: 'slot-1', kind: 'remove' });
    expect(stagedValue).not.toHaveProperty('actualMembershipId', 'member-1');
    const duties = instance.data.calendarCells.find(
      (cell) => cell.businessDate === '2026-07-02',
    ).duties;
    expect(duties.map((duty) => [duty.name, duty.state])).toEqual([['林医生', 'removed']]);

    const requests = [];
    let requestCount = 0;
    globalThis.wx.request.mockImplementation((options) => {
      requests.push(options);
      requestCount += 1;
      if (requestCount === 1) {
        options.success({ data: pastScheduleBackfillBatchGoldenResult, statusCode: 200 });
      } else {
        options.success({ data: holidayApiGoldenResponse, statusCode: 200 });
      }
    });
    definition.handleConfirm.call(instance);
    await vi.waitFor(() => expect(instance.data.isBusy).toBe(false));
    expect(requests[0].data.items).toEqual([]);
    expect(requests[0].data.removals).toEqual([
      { assignmentId: 'slot-1', businessDate: '2026-07-02', scheduleRoleId: 'role-1' },
    ]);
    expect(instance.data.infoMessage).toContain('1 条移除');
    definition.onUnload.call(instance);
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

  it('previews only the first changed shift and retains its brush across months and roles', () => {
    const instance = createPageInstance(definition);
    const base = {
      businessDate: '2026-07-02',
      scheduleRoleId: 'role-1',
      actualMemberName: '原人员',
      plannedMemberName: '原人员',
      shiftTypeAbbreviation: '全',
    };
    instance._calendarByKey.get('role-1:2026-07').assignments = [
      { ...base, id: 'slot-2', slotPosition: 2, actualMemberName: '另一班' },
      { ...base, id: 'slot-1', slotPosition: 1 },
      {
        ...base,
        id: 'other-role',
        scheduleRoleId: 'role-2',
        slotPosition: 1,
        actualMemberName: '其他岗位',
      },
    ];
    definition.handleDateTap.call(instance, {
      currentTarget: { dataset: { date: '2026-07-02', month: '2026-07' } },
    });
    const lines = instance.data.calendarCells.find(
      (cell) => cell.businessDate === '2026-07-02',
    ).duties;
    expect(lines.map((line) => [line.name, line.state])).toEqual([
      ['原人员', 'normal'],
      ['另一班', 'normal'],
      ['林医生', 'added'],
    ]);
    instance.selectComponent = () => ({ finishPeriodShift() {} });
    definition.handleCalendarMonthChange.call(instance, { detail: { delta: -1, current: 0 } });
    expect(instance._staged.size).toBe(1);
    instance.data.roleId = 'role-2';
    definition.handleCalendarMonthChange.call(instance, { detail: { delta: 1, current: 1 } });
    expect(instance.data.pendingCount).toBe(1);
    expect(instance.data.calendarCells.every((cell) => cell.disabled)).toBe(true);
    definition.handleDateTap.call(instance, {
      currentTarget: { dataset: { date: '2026-07-02', month: '2026-07' } },
    });
    expect(instance._staged.size).toBe(1);
  });

  it('uses the whole published month, then limits the view and match check to the selected role', () => {
    const source = readFileSync(
      new URL('../src/subpackages/scheduling/pages/backfill/index.ts', import.meta.url),
      'utf8',
    );
    expect(source).toContain('workbenchClient.getCalendar(page._currentGroupId, businessMonth)');
    expect(source).not.toContain('publicationClient.getPeriodCalendar');
    const instance = createPageInstance(definition);
    instance._calendarByKey.get('role-1:2026-07').assignments = [
      {
        id: 'other-role',
        businessDate: '2026-07-02',
        scheduleRoleId: 'role-2',
        slotPosition: 1,
        actualMembershipId: 'member-1',
        shiftTypeId: 'shift-a',
        shiftTypeAbbreviation: '全',
        shiftTypeName: '全天班',
        actualMemberName: '其他岗位',
      },
      {
        id: 'published-role',
        businessDate: '2026-07-02',
        scheduleRoleId: 'role-1',
        slotPosition: 1,
        actualMembershipId: 'old-member',
        shiftTypeId: 'shift-a',
        shiftTypeAbbreviation: '全',
        shiftTypeName: '全天班',
        actualMemberName: '正式排班',
      },
    ];
    instance._calendar = instance._calendarByKey.get('role-1:2026-07');
    definition.handleDateTap.call(instance, {
      currentTarget: { dataset: { date: '2026-07-02', month: '2026-07' } },
    });
    expect(
      instance.data.calendarCells
        .find((cell) => cell.businessDate === '2026-07-02')
        .duties.map((duty) => duty.name),
    ).toEqual(['正式排班', '林医生']);
    expect(instance._staged.size).toBe(1);
  });

  it('does not allow calendar writes while a submission remains in flight', () => {
    const instance = createPageInstance(definition);
    instance._submitting = true;
    instance.data.isBusy = false;
    definition.handleDateTap.call(instance, {
      currentTarget: { dataset: { date: '2026-07-02', month: '2026-07' } },
    });
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
      assignmentId: '',
      actualMembershipId: 'member-1',
      businessDate: '2026-07-02',
      kind: 'add',
      scheduleRoleId: 'role-1',
      shiftTypeId: 'shift-a',
    });
    instance._staged.set('role-1:2026-07-01', {
      assignmentId: '',
      actualMembershipId: 'member-1',
      businessDate: '2026-07-01',
      kind: 'add',
      scheduleRoleId: 'role-1',
      shiftTypeId: 'shift-a',
    });
    instance.data.pendingCount = 2;
    instance.data.reason = '  实际值班人员更正  ';

    definition.handleConfirm.call(instance);
    await vi.waitFor(() => expect(instance.data.isBusy).toBe(false));
    definition.handleConfirm.call(instance);
    await vi.waitFor(() => expect(requests).toHaveLength(6));

    expect(requests[0].url).toContain('/groups/group-1/past-schedules/backfill-batches');
    expect(requests[0].data.items.map((item) => item.businessDate)).toEqual([
      '2026-07-01',
      '2026-07-02',
    ]);
    expect(requests[0].data.reason).toBe('实际值班人员更正');
    expect(requests[5].header['Idempotency-Key']).toBe(requests[0].header['Idempotency-Key']);
    expect(requests[5].data.operationId).toBe(requests[0].data.operationId);
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
      assignmentId: '',
      actualMembershipId: 'member-1',
      businessDate: '2026-07-02',
      kind: 'add',
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

  it('browses seven-day backfill panels when the group prefers weeks', () => {
    const instance = createPageInstance(definition);
    instance.data.viewMode = 'week';
    instance.data.weekStart = '2026-07-27';
    instance.selectComponent = () => ({ finishPeriodShift() {} });
    definition.handleCalendarMonthChange.call(instance, { detail: { delta: 1, current: 2 } });
    expect(instance.data.weekStart).toBe('2026-08-03');
    expect(instance.data.businessMonth).toBe('2026-08');
    expect(instance.data.monthPanels[2].cells.map((cell) => cell.businessDate)).toEqual([
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
      '2026-08-06',
      '2026-08-07',
      '2026-08-08',
      '2026-08-09',
    ]);
    expect(instance.data.monthLabel).toContain('8月');
  });

  it('keeps loaded past backfill weekdays white and marks future weekdays gray', () => {
    const instance = createPageInstance(definition);
    instance.data.viewMode = 'week';
    instance.data.weekStart = '2026-07-27';
    definition.handleShiftTap.call(instance, { currentTarget: { dataset: { id: 'shift-a' } } });
    const days = instance.data.monthPanels[1].days;
    expect(days.find((day) => day.businessDate === '2026-07-27')).toMatchObject({
      disabled: false,
      isPast: false,
      isFuture: false,
    });
    expect(days.find((day) => day.businessDate === '2026-08-01')).toMatchObject({
      disabled: true,
      isFuture: true,
    });
  });

  it('allows a loaded adjacent-month day visible in the active week', () => {
    const instance = createPageInstance(definition);
    instance.data.viewMode = 'week';
    instance.data.weekStart = '2026-07-27';
    instance.data.today = '2026-09-01';
    instance._calendarByKey.set('role-1:2026-08', {
      assignments: [],
      businessMonth: '2026-08',
      groupId: 'group-1',
      members: [],
      roles: [],
      shiftTypes: [],
    });
    definition.handleDateTap.call(instance, {
      currentTarget: { dataset: { date: '2026-08-01', month: '2026-08' } },
    });
    expect(instance._staged.size).toBe(1);
  });

  it('keeps same-month week swipes on the loaded calendar without a read flash', () => {
    const instance = createPageInstance(definition);
    instance.data.viewMode = 'week';
    instance._calendar = { businessMonth: '2026-07', assignments: [] };
    definition.handleCalendarMonthSettled.call(instance, { detail: { continues: false } });
    expect(globalThis.wx.request).not.toHaveBeenCalled();
    expect(instance.data.isBusy).toBe(false);
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
    _calendarByKey: new Map([
      [
        'role-1:2026-07',
        {
          assignments: [],
          businessMonth: '2026-07',
          groupId: 'group-1',
          members: [],
          roles: [{ id: 'role-1', name: '一线' }],
          shiftTypes: [],
        },
      ],
    ]),
    _config: undefined,
    _currentGroupId: '',
    _holidays: new Map(),
    _initialPeriodId: '',
    _loadSerial: 0,
    _periods: [],
    _records: [],
    _staged: new Map(),
    data,
    setData(patch, callback) {
      Object.assign(data, patch);
      callback?.();
    },
  };
  return instance;
}

function validSession() {
  return {
    clientVersion: 'test',
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    profile: { id: 'user-1', realName: '林医生', version: 1 },
    token: 'test-token',
  };
}
