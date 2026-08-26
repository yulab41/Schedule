import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const groupId = '11111111-1111-4111-8111-111111111111';
const mocks = vi.hoisted(() => ({
  getMonthStatistics: vi.fn(),
  getYearStatistics: vi.fn(),
  listEvents: vi.fn(),
}));

vi.mock('../src/app/client-capability-store.ts', () => ({
  ClientCapabilityDisabledError: class ClientCapabilityDisabledError extends Error {},
  requireClientCapability: vi.fn(async () => undefined),
}));

vi.mock('../src/platform/client-core-calendar.ts', () => ({
  createRuntimeInsightsReadClient: () => ({
    getMonthStatistics: mocks.getMonthStatistics,
    getYearStatistics: mocks.getYearStatistics,
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
    vi.stubGlobal('wx', {
      getWindowInfo: () => ({ statusBarHeight: 24, windowHeight: 844, windowWidth: 390 }),
      navigateBack: vi.fn(),
    });
    mocks.listEvents.mockResolvedValue({
      events: [scheduleEvent('event-1', '2026-08-25T16:30:00.000Z')],
      nextCursor: 'cursor-1',
    });
    mocks.getMonthStatistics.mockResolvedValue({
      businessMonth: '2026-08',
      computedAt: '2026-08-26T00:00:00.000Z',
      groupId,
      summary,
      version: 1,
    });
    mocks.getYearStatistics.mockResolvedValue({ months: [], summary, year: 2026 });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads exact Web event presentation and the complete statistics ledger', async () => {
    const definition = await controllerDefinition();
    const page = pageFor(definition);

    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));

    expect(mocks.listEvents).toHaveBeenCalledWith(groupId, { pageSize: 50 });
    expect(page.data.eventGroups[0]).toMatchObject({
      countLabel: '1 条',
      label: '8月26日 周三',
    });
    expect(page.data.eventGroups[0].events[0]).toMatchObject({
      detailLabel: 'schedule_period · 影响 2 项',
      eventStatusLabel: '已完成',
      eventTone: 'schedule',
      eventTypeLabel: '排班已发布',
      occurredAtLabel: '00:30',
    });
    expect(page.data.primaryStatistics.map((item) => item.label)).toEqual([
      '计划班次',
      '实际值班',
      '计值班次',
    ]);
    expect(page.data.secondaryStatistics).toHaveLength(7);
    expect(page.data.memberRows.map((item) => item.name)).toEqual(['A 医生', 'B 医生']);
    expect(page.data.roleRows[0]).toMatchObject({ name: '住院总', ratio: 90 });
    expect(page.data.shiftTypeRows[0]).toMatchObject({ name: '全天班', ratio: 90 });
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
    });
    expect(page.data.eventGroups).toHaveLength(2);

    definition.methods.handleStatisticsMode.call(page, {
      currentTarget: { dataset: { mode: 'year' } },
    });
    await vi.waitFor(() => expect(page.data.statisticsBusy).toBe(false));
    expect(mocks.getYearStatistics).toHaveBeenCalledWith(groupId, 2026);
    expect(page.data.statisticsPeriodLabel).toBe('2026年');
  });

  it('lets the latest statistics mode win while an older read is still pending', async () => {
    const definition = await controllerDefinition();
    const page = pageFor(definition);
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));

    let resolveYear;
    mocks.getYearStatistics.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveYear = resolve;
        }),
    );
    definition.methods.handleStatisticsMode.call(page, {
      currentTarget: { dataset: { mode: 'year' } },
    });
    await vi.waitFor(() => expect(mocks.getYearStatistics).toHaveBeenCalledTimes(1));

    definition.methods.handleStatisticsMode.call(page, {
      currentTarget: { dataset: { mode: 'month' } },
    });
    await vi.waitFor(() => expect(mocks.getMonthStatistics).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(page.data.statisticsBusy).toBe(false));
    expect(page.data.statisticsPeriodLabel).toBe('2026年8月');

    resolveYear({ months: [], summary: { ...summary, actualCount: 999 }, year: 2026 });
    await Promise.resolve();
    expect(page.data.primaryStatistics[1].value).toBe('9');
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
