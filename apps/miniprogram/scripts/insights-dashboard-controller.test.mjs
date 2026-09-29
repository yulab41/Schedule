import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const groupId = '11111111-1111-4111-8111-111111111111';
const mocks = vi.hoisted(() => ({
  ClientCapabilityDisabledError: class ClientCapabilityDisabledError extends Error {},
  getMonthStatisticsV2: vi.fn(),
  getYearStatisticsV2: vi.fn(),
  listEvents: vi.fn(),
  requireClientCapability: vi.fn(),
}));

vi.mock('../src/app/client-capability-store.ts', () => ({
  ClientCapabilityDisabledError: mocks.ClientCapabilityDisabledError,
  requireClientCapability: mocks.requireClientCapability,
}));

vi.mock('../src/platform/client-core-calendar.ts', () => ({
  createRuntimeInsightsReadClient: () => ({
    getMonthStatisticsV2: mocks.getMonthStatisticsV2,
    getYearStatisticsV2: mocks.getYearStatisticsV2,
    listEvents: mocks.listEvents,
  }),
}));

vi.mock('../src/platform/wechat-identity.ts', () => ({
  getStoredWechatToken: () => 'token',
  getWechatRequestAuthentication: () => undefined,
}));

const summary = {
  actualCount: 9,
  byRole: [
    { actualCount: 9, plannedCount: 10, scheduleRoleId: 'role-1', scheduleRoleName: '住院总' },
  ],
  byShiftType: [
    { actualCount: 9, plannedCount: 10, shiftTypeId: 'shift-1', shiftTypeName: '全天班' },
  ],
  countedActualCount: 8,
  countedPlannedCount: 8,
  deductionCount: 1,
  holidayCount: 3,
  leaveCoverCount: 2,
  manualAdjustmentCount: 4,
  members: [member('member-b', 'B 医生', 2), member('member-a', 'A 医生', 5)],
  netDutyAdjustment: 2,
  overtimeCount: 3,
  plannedCount: 10,
  swapCount: 5,
  weekendCount: 6,
};

describe('insights dashboard shared parity controller', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-08-26T04:00:00.000Z'));
    vi.stubGlobal('wx', {
      getWindowInfo: () => ({ statusBarHeight: 24, windowHeight: 844, windowWidth: 390 }),
      navigateBack: vi.fn(),
    });
    mocks.requireClientCapability.mockResolvedValue(undefined);
    mocks.listEvents.mockResolvedValue({
      events: [scheduleEvent('event-1', '2026-08-25T16:30:00.000Z')],
      nextCursor: 'cursor-1',
    });
    mocks.getMonthStatisticsV2.mockResolvedValue({
      businessMonth: '2026-08',
      computedAt: '2026-08-26T00:00:00.000Z',
      groupId,
      summary,
      version: 1,
    });
    mocks.getYearStatisticsV2.mockResolvedValue({ months: [], summary, year: 2026 });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('loads exact Web event presentation and the complete statistics ledger', async () => {
    const definition = await controllerDefinition();
    const page = pageFor(definition);

    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));

    expect(page.data.activeTab).toBe('statistics');
    expect(mocks.listEvents).toHaveBeenCalledWith(groupId, {
      pageSize: 50,
      includeOperatorName: true,
    });
    expect(page.data.eventGroups[0]).toMatchObject({
      countLabel: '1 条',
      label: '8月26日 周三',
    });
    expect(page.data.eventGroups[0].events[0]).toMatchObject({
      detailLabel: '排班版本 · 涉及 1 个班次、1 名成员',
      eventStatusLabel: '已完成',
      eventTone: 'schedule',
      eventTypeLabel: '排班已发布',
      occurredAtLabel: '00:30',
    });
    expect(page.data.primaryStatistics.map((item) => item.label)).toEqual(['计划', '实际']);
    expect(page.data.secondaryStatistics).toHaveLength(5);
    expect(page.data.memberRows.map((item) => item.name)).toEqual(['A 医生', 'B 医生']);
    expect(page.data.roleRows[0]).toMatchObject({ name: '住院总', ratio: 90 });
    expect(page.data.shiftTypeRows[0]).toMatchObject({ name: '全天班', ratio: 90 });
  });

  it('expands all seven shift metrics locally, preserving rest detail and unchanged totals', async () => {
    const detail = (shiftTypeId, counted, actual, planned) => ({
      shiftTypeId,
      shiftTypeName: shiftTypeId,
      countsTowardStatistics: counted,
      plannedCount: planned,
      actualCount: actual,
      weekendCount: 0,
      holidayCount: 0,
      swapCount: 1,
      overtimeCount: 1,
      deductionCount: 0,
    });
    const shifts = [detail('A', true, 6, 5), detail('N', true, 4, 5), detail('休', false, 2, 2)];
    mocks.getMonthStatisticsV2.mockResolvedValueOnce({
      schemaVersion: 2,
      summary: {
        ...summary,
        byShiftType: shifts,
        members: [{ ...member('nurse', '测试护士', 10), byShiftType: shifts }],
      },
    });
    const definition = await controllerDefinition(),
      page = pageFor(definition);
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));
    const totals = structuredClone(page.data.primaryStatistics);
    expect(page.data.memberRows[0].expanded).toBe(false);
    expect(page.data.memberRows[0].details.map((row) => row.difference)).toEqual([
      '多1班',
      '少1班',
      '与计划一致',
    ]);
    expect(page.data.memberRows[0].details[2].name).toContain('不计入总数');
    expect(page.data.memberRows[0].details.every((row) => row.metrics.length === 7)).toBe(true);
    definition.methods.handleMemberDetails.call(page, {
      currentTarget: { dataset: { id: 'nurse' } },
    });
    expect(page.data.memberRows[0].expanded).toBe(true);
    expect(page.data.primaryStatistics).toEqual(totals);
    expect(mocks.getMonthStatisticsV2).toHaveBeenCalledTimes(1);
  });

  it('loads another event cursor and switches to the shared year summary', async () => {
    const definition = await controllerDefinition();
    const page = pageFor(definition);
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));

    mocks.listEvents.mockResolvedValueOnce({
      events: [scheduleEvent('event-2', '2026-08-24T16:30:00.000Z')],
      nextCursor: undefined,
    });
    definition.methods.handleLoadMoreEvents.call(page);
    await vi.waitFor(() => expect(page.data.eventsLoadingMore).toBe(false));
    expect(mocks.listEvents).toHaveBeenLastCalledWith(groupId, {
      cursor: 'cursor-1',
      pageSize: 50,
      includeOperatorName: true,
    });
    expect(page.data.eventGroups).toHaveLength(2);

    definition.methods.handleStatisticsMode.call(page, {
      currentTarget: { dataset: { mode: 'year' } },
    });
    await vi.waitFor(() => expect(page.data.statisticsBusy).toBe(false));
    expect(mocks.getYearStatisticsV2).toHaveBeenCalledWith(groupId, 2026);
    expect(page.data.statisticsPeriodLabel).toBe('2026年');
  });

  it('shows operator names and distinguishes system events from unavailable profiles', async () => {
    mocks.listEvents.mockResolvedValueOnce({
      events: [
        {
          ...scheduleEvent('named', '2026-09-24T01:00:00.000Z'),
          operatorUserId: 'user-a',
          operatorName: '操作甲',
        },
        { ...scheduleEvent('missing', '2026-09-24T02:00:00.000Z'), operatorUserId: 'user-b' },
        scheduleEvent('system', '2026-09-24T03:00:00.000Z'),
      ],
    });
    const definition = await controllerDefinition();
    const page = pageFor(definition);
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));
    const cards = new Map(
      page.data.eventGroups.flatMap((group) => group.events).map((event) => [event.id, event]),
    );
    expect(cards.get('named').actorLabel).toBe('操作甲');
    expect(cards.get('missing').actorLabel).toBe('原操作者');
    expect(cards.get('system').actorLabel).toBe('系统');
    expect(mocks.listEvents).toHaveBeenCalledWith(groupId, {
      pageSize: 50,
      includeOperatorName: true,
    });
  });

  it('lets the latest statistics mode win while an older read is still pending', async () => {
    const definition = await controllerDefinition();
    const page = pageFor(definition);
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));

    let resolveYear;
    mocks.getYearStatisticsV2.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveYear = resolve;
        }),
    );
    definition.methods.handleStatisticsMode.call(page, {
      currentTarget: { dataset: { mode: 'year' } },
    });
    await vi.waitFor(() => expect(mocks.getYearStatisticsV2).toHaveBeenCalledTimes(1));

    definition.methods.handleStatisticsMode.call(page, {
      currentTarget: { dataset: { mode: 'month' } },
    });
    await vi.waitFor(() => expect(mocks.getMonthStatisticsV2).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(page.data.statisticsBusy).toBe(false));
    expect(page.data.statisticsPeriodLabel).toBe('2026年8月');

    resolveYear({ months: [], summary: { ...summary, actualCount: 999 }, year: 2026 });
    await Promise.resolve();
    expect(page.data.primaryStatistics[1].value).toBe('9');
  });

  it('does not commit a pending dashboard response after detaching', async () => {
    let resolveEvents;
    let resolveStatistics;
    mocks.listEvents.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveEvents = resolve;
        }),
    );
    mocks.getMonthStatisticsV2.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveStatistics = resolve;
        }),
    );
    const definition = await controllerDefinition();
    const page = pageFor(definition);
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(mocks.listEvents).toHaveBeenCalledTimes(1));
    definition.lifetimes.detached.call(page);
    resolveEvents({ events: [scheduleEvent('stale-event', '2026-08-25T16:30:00.000Z')] });
    resolveStatistics({
      summary,
      businessMonth: '2026-08',
      computedAt: '2026-08-26T00:00:00.000Z',
      groupId,
      version: 1,
    });
    await flushPromises();

    expect(page.data.state).toBe('loading');
    expect(page.data.eventGroups).toEqual([]);
    expect(page.data.primaryStatistics).toEqual([]);
  });

  it('closes the dashboard when a later statistics read loses the insights capability', async () => {
    const definition = await controllerDefinition();
    const page = pageFor(definition);
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));

    mocks.requireClientCapability.mockRejectedValueOnce(
      new mocks.ClientCapabilityDisabledError('insights'),
    );
    definition.methods.handleStatisticsMode.call(page, {
      currentTarget: { dataset: { mode: 'year' } },
    });
    await vi.waitFor(() => expect(page.data.statisticsBusy).toBe(false));

    expect(page.data.state).toBe('disabled');
    expect(page.data.eventGroups).toEqual([]);
    expect(page.data.memberRows).toEqual([]);
  });

  it('marks the dashboard as large text when the system font setting requests it', async () => {
    globalThis.wx.getWindowInfo = () => ({
      fontSizeSetting: 20,
      statusBarHeight: 24,
      windowHeight: 844,
      windowWidth: 390,
    });
    const definition = await controllerDefinition();
    const page = pageFor(definition);
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));

    expect(page.data.largeText).toBe(true);
  });
});

async function controllerDefinition() {
  const module =
    await import('../src/subpackages/insights/components/insights-dashboard-panel/controller.ts');
  return module.createInsightsDashboardPanelControllerDefinition();
}

function pageFor(definition) {
  return {
    data: { ...definition.data },
    properties: { groupId },
    setData(patch) {
      this.data = { ...this.data, ...patch };
    },
  };
}

async function flushPromises() {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}

function member(membershipId, realName, actualCount) {
  return {
    actualCount,
    actualVsPlanned: [],
    byRole: [],
    byShiftType: [],
    countedActualCount: actualCount,
    countedPlannedCount: actualCount,
    deductionCount: 0,
    deltaCount: 0,
    holidayCount: 0,
    leaveCoverCount: 0,
    manualAdjustmentCount: 0,
    membershipId,
    netDutyAdjustment: 0,
    overtimeCount: 0,
    plannedCount: actualCount,
    realName,
    swapCount: 0,
    weekendCount: 0,
  };
}

function scheduleEvent(id, occurredAt) {
  return {
    affectedMembershipIds: ['member-1'],
    affectedShiftIds: ['shift-1'],
    eventStatus: 'completed',
    eventType: 'schedule_period_published',
    groupId,
    id,
    objectType: 'schedule_period',
    occurredAt,
    operationId: `operation-${id}`,
  };
}
