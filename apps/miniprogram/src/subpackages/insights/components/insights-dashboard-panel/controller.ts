import { ClientCoreError, type InsightsReadClient } from '@schedule/client-core';
import type {
  ScheduleEvent,
  StatisticsMemberRow,
  StatisticsRoleCount,
  StatisticsShiftTypeCount,
  StatisticsSummary,
} from '@schedule/contracts';
import { addBusinessMonths } from '@schedule/presentation-core';
import {
  buildEventDateGroups,
  formatEventTime,
  getEventImpactCount,
  getEventStatusLabel,
  getEventTone,
  getEventTypeLabel,
  type EventTone,
} from '@schedule/presentation-core/event';
import {
  formatNetDutyAdjustment,
  formatStatisticsPeriodLabel,
  getCompletionPercentage,
  getCurrentStatisticsMonth,
  getMemberActualVsPlannedCount,
  getStatisticsSummaryItems,
  sortMembersByActualCount,
  type StatisticsPeriodMode,
  type StatisticsSummaryItem,
} from '@schedule/presentation-core/statistics';
import {
  ClientCapabilityDisabledError,
  requireClientCapability,
} from '../../../../app/client-capability-store.js';
import { createRuntimeInsightsReadClient } from '../../../../platform/client-core-calendar.js';
import {
  getStoredWechatToken,
  getWechatRequestAuthentication,
} from '../../../../platform/wechat-identity.js';

type DashboardState = 'disabled' | 'error' | 'loading' | 'ready';
type DashboardTab = 'events' | 'statistics';

interface EventCard {
  readonly actorLabel: string;
  readonly detailLabel: string;
  readonly eventStatusLabel: string;
  readonly eventTone: EventTone;
  readonly eventTypeLabel: string;
  readonly id: string;
  readonly occurredAt: string;
  readonly occurredAtLabel: string;
}

interface EventGroupCard {
  readonly businessDate: string;
  readonly countLabel: string;
  readonly events: readonly EventCard[];
  readonly label: string;
}

interface BreakdownCard {
  readonly actualLabel: string;
  readonly id: string;
  readonly name: string;
  readonly plannedLabel: string;
  readonly ratio: number;
}

interface MemberStatisticsCard {
  readonly adjustmentLabel: string;
  readonly comparisonLabel: string;
  readonly countLabel: string;
  readonly id: string;
  readonly name: string;
  readonly shiftLabel: string;
  readonly workflowLabel: string;
}

interface InsightsDashboardData {
  readonly activeTab: DashboardTab;
  readonly businessMonth: string;
  readonly errorMessage: string;
  readonly eventCountLabel: string;
  readonly eventDateGroupCountLabel: string;
  readonly eventGroups: readonly EventGroupCard[];
  readonly eventsLoadingMore: boolean;
  readonly groupId: string;
  readonly hasMoreEvents: boolean;
  readonly largeText: boolean;
  readonly memberRows: readonly MemberStatisticsCard[];
  readonly pageScrollStyle: string;
  readonly primaryStatistics: readonly StatisticsSummaryItem[];
  readonly roleRows: readonly BreakdownCard[];
  readonly secondaryStatistics: readonly StatisticsSummaryItem[];
  readonly shellHeaderStyle: string;
  readonly shiftTypeRows: readonly BreakdownCard[];
  readonly state: DashboardState;
  readonly statisticsBusy: boolean;
  readonly statisticsErrorMessage: string;
  readonly statisticsMode: StatisticsPeriodMode;
  readonly statisticsPeriodLabel: string;
  readonly statisticsYear: number;
  readonly viewportClass: string;
}

interface InsightsDashboardInstance {
  readonly data: InsightsDashboardData;
  readonly properties: { readonly groupId: string };
  _eventCards: EventCard[];
  _eventsNextCursor: string | undefined;
  _insightsReadClient: InsightsReadClient;
  _loadedGroupId: string;
  _requestSerial: number;
  _statisticsSerial: number;
  setData(patch: Partial<InsightsDashboardData>, callback?: () => void): void;
}

const insightsReadClient = createRuntimeInsightsReadClient(
  getStoredWechatToken,
  getWechatRequestAuthentication(),
);
const initialBusinessMonth = getCurrentStatisticsMonth(new Date());
const initialStatisticsYear = Number(initialBusinessMonth.slice(0, 4));

export function createInsightsDashboardPanelControllerDefinition() {
  return {
    data: {
      activeTab: 'events' as DashboardTab,
      businessMonth: initialBusinessMonth,
      errorMessage: '',
      eventCountLabel: '0 条事件',
      eventDateGroupCountLabel: '0 个日期',
      eventGroups: [],
      eventsLoadingMore: false,
      groupId: '',
      hasMoreEvents: false,
      largeText: false,
      memberRows: [],
      pageScrollStyle: 'height:calc(100% - 76px);',
      primaryStatistics: [],
      roleRows: [],
      secondaryStatistics: [],
      shellHeaderStyle: 'height:76px;min-height:76px;padding-top:24px;',
      shiftTypeRows: [],
      state: 'loading' as DashboardState,
      statisticsBusy: false,
      statisticsErrorMessage: '',
      statisticsMode: 'month' as StatisticsPeriodMode,
      statisticsPeriodLabel: formatStatisticsPeriodLabel(
        'month',
        initialBusinessMonth,
        initialStatisticsYear,
      ),
      statisticsYear: initialStatisticsYear,
      viewportClass: '',
    } satisfies InsightsDashboardData,

    properties: { groupId: { type: String, value: '' } },
    _eventCards: [] as EventCard[],
    _eventsNextCursor: undefined as string | undefined,
    _insightsReadClient: insightsReadClient,
    _loadedGroupId: '',
    _requestSerial: 0,
    _statisticsSerial: 0,

    observers: {
      groupId(this: InsightsDashboardInstance): void {
        startLoad(this);
      },
    },

    lifetimes: {
      attached(this: InsightsDashboardInstance): void {
        const windowInfo = wx.getWindowInfo();
        const statusBarHeight = Math.max(0, windowInfo.statusBarHeight ?? 0);
        const headerHeight = statusBarHeight + 52;
        this.setData({
          pageScrollStyle: `height:calc(100% - ${headerHeight}px);`,
          shellHeaderStyle: `height:${headerHeight}px;min-height:${headerHeight}px;padding-top:${statusBarHeight}px;`,
          largeText:
            ((windowInfo as unknown as { readonly fontSizeSetting?: number }).fontSizeSetting ??
              16) >= 20,
          viewportClass: windowInfo.windowWidth <= 340 ? 'is-compact' : '',
        });
        startLoad(this);
      },
      detached(this: InsightsDashboardInstance): void {
        initializeRuntimeState(this);
        invalidateDashboardRequests(this);
        this._loadedGroupId = '';
        this._eventCards = [];
        this._eventsNextCursor = undefined;
      },
    },

    methods: {
      handleBack(): void {
        wx.navigateBack({ delta: 1 });
      },
      handleLoadMoreEvents(this: InsightsDashboardInstance): void {
        void loadMoreEvents(this);
      },
      handleNextPeriod(this: InsightsDashboardInstance): void {
        shiftStatisticsPeriod(this, 1);
      },
      handlePreviousPeriod(this: InsightsDashboardInstance): void {
        shiftStatisticsPeriod(this, -1);
      },
      handleRetry(this: InsightsDashboardInstance): void {
        void loadDashboard(this);
      },
      handleStatisticsMode(this: InsightsDashboardInstance, event: TapEvent): void {
        const mode = event.currentTarget.dataset.mode;
        if (mode !== 'month' && mode !== 'year') return;
        if (mode === this.data.statisticsMode) return;
        this.setData({
          statisticsMode: mode,
          statisticsPeriodLabel: formatStatisticsPeriodLabel(
            mode,
            this.data.businessMonth,
            this.data.statisticsYear,
          ),
        });
        void loadStatistics(this);
      },
      handleTabChange(this: InsightsDashboardInstance, event: TapEvent): void {
        const tab = event.currentTarget.dataset.tab;
        if (tab === 'events' || tab === 'statistics') this.setData({ activeTab: tab });
      },
    },
  };
}

interface TapEvent {
  readonly currentTarget: { readonly dataset: Record<string, string | undefined> };
}

async function loadDashboard(page: InsightsDashboardInstance): Promise<void> {
  initializeRuntimeState(page);
  const groupId = page.data.groupId;
  if (groupId.length === 0) {
    invalidateDashboardRequests(page);
    page._loadedGroupId = '';
    page._eventCards = [];
    page._eventsNextCursor = undefined;
    page.setData({
      ...emptyDashboardDataPatch(),
      errorMessage: '当前群组信息缺失，请返回工作台后重试。',
      groupId: '',
      state: 'error',
    });
    return;
  }
  const requestSerial = page._requestSerial + 1;
  page._requestSerial = requestSerial;
  page._statisticsSerial += 1;
  page.setData({
    ...emptyDashboardDataPatch(),
    errorMessage: '',
    state: 'loading',
  });
  try {
    await requireClientCapability('insights');
    const period = {
      businessMonth: page.data.businessMonth,
      statisticsMode: page.data.statisticsMode,
      statisticsYear: page.data.statisticsYear,
    } as const;
    const [eventPage, statisticsResponse] = await Promise.all([
      page._insightsReadClient.listEvents(groupId, { pageSize: 50 }),
      period.statisticsMode === 'month'
        ? page._insightsReadClient.getMonthStatistics(groupId, period.businessMonth)
        : page._insightsReadClient.getYearStatistics(groupId, period.statisticsYear),
    ]);
    if (!isDashboardRequestCurrent(page, requestSerial, groupId)) return;
    page._eventCards = eventPage.events.map(toEventCard);
    page._eventsNextCursor = eventPage.nextCursor;
    page.setData({
      ...toEventPatch(page._eventCards, eventPage.nextCursor !== undefined),
      ...toStatisticsPatch(statisticsResponse.summary, period),
      state: 'ready',
    });
  } catch (error) {
    if (!isDashboardRequestCurrent(page, requestSerial, groupId)) return;
    if (error instanceof ClientCapabilityDisabledError) {
      setDashboardDisabled(page, error.message);
      return;
    }
    page.setData({
      errorMessage: toUserMessage(error, '事件与统计暂时无法加载，请稍后重试。'),
      state: 'error',
    });
  }
}

async function loadMoreEvents(page: InsightsDashboardInstance): Promise<void> {
  initializeRuntimeState(page);
  const cursor = page._eventsNextCursor;
  if (
    cursor === undefined ||
    page.data.eventsLoadingMore ||
    page.data.state !== 'ready' ||
    page.data.groupId.length === 0
  ) {
    return;
  }
  const requestSerial = page._requestSerial;
  const groupId = page.data.groupId;
  page.setData({ errorMessage: '', eventsLoadingMore: true });
  try {
    await requireClientCapability('insights');
    const eventPage = await page._insightsReadClient.listEvents(groupId, {
      cursor,
      pageSize: 50,
    });
    if (!isDashboardRequestCurrent(page, requestSerial, groupId)) return;
    page._eventCards = [...page._eventCards, ...eventPage.events.map(toEventCard)];
    page._eventsNextCursor = eventPage.nextCursor;
    page.setData({
      ...toEventPatch(page._eventCards, eventPage.nextCursor !== undefined),
      eventsLoadingMore: false,
    });
  } catch (error) {
    if (!isDashboardRequestCurrent(page, requestSerial, groupId)) return;
    if (error instanceof ClientCapabilityDisabledError) {
      setDashboardDisabled(page, error.message);
      return;
    }
    page.setData({
      errorMessage: toUserMessage(error, '事件数据暂时无法加载，请稍后重试。'),
      eventsLoadingMore: false,
    });
  }
}

async function loadStatistics(page: InsightsDashboardInstance): Promise<void> {
  initializeRuntimeState(page);
  const groupId = page.data.groupId;
  if (groupId.length === 0) return;
  const statisticsSerial = page._statisticsSerial + 1;
  page._statisticsSerial = statisticsSerial;
  const period = {
    businessMonth: page.data.businessMonth,
    statisticsMode: page.data.statisticsMode,
    statisticsYear: page.data.statisticsYear,
  } as const;
  page.setData({ statisticsBusy: true, statisticsErrorMessage: '' });
  try {
    await requireClientCapability('insights');
    const response =
      period.statisticsMode === 'month'
        ? await page._insightsReadClient.getMonthStatistics(groupId, period.businessMonth)
        : await page._insightsReadClient.getYearStatistics(groupId, period.statisticsYear);
    if (statisticsSerial !== page._statisticsSerial || groupId !== page.data.groupId) return;
    page.setData({
      ...toStatisticsPatch(response.summary, period),
      statisticsBusy: false,
    });
  } catch (error) {
    if (statisticsSerial !== page._statisticsSerial || groupId !== page.data.groupId) return;
    if (error instanceof ClientCapabilityDisabledError) {
      setDashboardDisabled(page, error.message);
      return;
    }
    page.setData({
      statisticsBusy: false,
      statisticsErrorMessage: toUserMessage(error, '统计数据暂时无法加载，请稍后重试。'),
    });
  }
}

function shiftStatisticsPeriod(page: InsightsDashboardInstance, delta: -1 | 1): void {
  if (page.data.statisticsBusy) return;
  if (page.data.statisticsMode === 'month') {
    const businessMonth = addBusinessMonths(page.data.businessMonth, delta);
    page.setData({
      businessMonth,
      statisticsPeriodLabel: formatStatisticsPeriodLabel(
        'month',
        businessMonth,
        page.data.statisticsYear,
      ),
    });
  } else {
    const statisticsYear = page.data.statisticsYear + delta;
    page.setData({
      statisticsPeriodLabel: formatStatisticsPeriodLabel(
        'year',
        page.data.businessMonth,
        statisticsYear,
      ),
      statisticsYear,
    });
  }
  void loadStatistics(page);
}

function startLoad(page: InsightsDashboardInstance): void {
  initializeRuntimeState(page);
  const groupId = page.properties.groupId;
  if (groupId.length === 0) {
    invalidateDashboardRequests(page);
    page._loadedGroupId = '';
    page._eventCards = [];
    page._eventsNextCursor = undefined;
    page.setData({
      ...emptyDashboardDataPatch(),
      errorMessage: '当前群组信息缺失，请返回工作台后重试。',
      groupId: '',
      state: 'error',
    });
    return;
  }
  if (groupId === page._loadedGroupId) return;
  page._loadedGroupId = groupId;
  invalidateDashboardRequests(page);
  page._eventCards = [];
  page._eventsNextCursor = undefined;
  page.setData({
    ...emptyDashboardDataPatch(),
    errorMessage: '',
    groupId,
    state: 'loading',
  });
  void loadDashboard(page);
}

function initializeRuntimeState(page: InsightsDashboardInstance): void {
  page._insightsReadClient = insightsReadClient;
  if (!Array.isArray(page._eventCards)) page._eventCards = [];
  if (typeof page._loadedGroupId !== 'string') page._loadedGroupId = '';
  if (!Number.isFinite(page._requestSerial)) page._requestSerial = 0;
  if (!Number.isFinite(page._statisticsSerial)) page._statisticsSerial = 0;
}

function invalidateDashboardRequests(page: InsightsDashboardInstance): void {
  page._requestSerial += 1;
  page._statisticsSerial += 1;
}

function isDashboardRequestCurrent(
  page: InsightsDashboardInstance,
  requestSerial: number,
  groupId: string,
): boolean {
  return requestSerial === page._requestSerial && groupId === page.data.groupId;
}

function emptyDashboardDataPatch(): Pick<
  InsightsDashboardData,
  | 'eventCountLabel'
  | 'eventDateGroupCountLabel'
  | 'eventGroups'
  | 'eventsLoadingMore'
  | 'hasMoreEvents'
  | 'memberRows'
  | 'primaryStatistics'
  | 'roleRows'
  | 'secondaryStatistics'
  | 'shiftTypeRows'
  | 'statisticsBusy'
  | 'statisticsErrorMessage'
> {
  return {
    eventCountLabel: '0 条事件',
    eventDateGroupCountLabel: '0 个日期',
    eventGroups: [],
    eventsLoadingMore: false,
    hasMoreEvents: false,
    memberRows: [],
    primaryStatistics: [],
    roleRows: [],
    secondaryStatistics: [],
    shiftTypeRows: [],
    statisticsBusy: false,
    statisticsErrorMessage: '',
  };
}

function setDashboardDisabled(page: InsightsDashboardInstance, message: string): void {
  invalidateDashboardRequests(page);
  page._eventCards = [];
  page._eventsNextCursor = undefined;
  page.setData({
    ...emptyDashboardDataPatch(),
    errorMessage: message,
    state: 'disabled',
  });
}

function toEventCard(event: ScheduleEvent): EventCard {
  return {
    actorLabel: '操作者已脱敏',
    detailLabel: `${event.objectType} · 影响 ${getEventImpactCount(event)} 项`,
    eventStatusLabel: getEventStatusLabel(event.eventStatus),
    eventTone: getEventTone(event.eventType),
    eventTypeLabel: getEventTypeLabel(event.eventType),
    id: event.id,
    occurredAt: event.occurredAt,
    occurredAtLabel: formatEventTime(event.occurredAt).slice(11),
  };
}

function toEventPatch(
  cards: readonly EventCard[],
  hasMoreEvents: boolean,
): Pick<
  InsightsDashboardData,
  'eventCountLabel' | 'eventDateGroupCountLabel' | 'eventGroups' | 'hasMoreEvents'
> {
  const eventGroups = buildEventDateGroups(cards).map((group) => ({
    businessDate: group.businessDate,
    countLabel: `${group.events.length} 条`,
    events: group.events,
    label: group.label,
  }));
  return {
    eventCountLabel: `${cards.length} 条事件`,
    eventDateGroupCountLabel: `${eventGroups.length} 个日期`,
    eventGroups,
    hasMoreEvents,
  };
}

function toStatisticsPatch(
  summary: StatisticsSummary,
  data: Pick<InsightsDashboardData, 'businessMonth' | 'statisticsMode' | 'statisticsYear'>,
): Pick<
  InsightsDashboardData,
  | 'memberRows'
  | 'primaryStatistics'
  | 'roleRows'
  | 'secondaryStatistics'
  | 'shiftTypeRows'
  | 'statisticsPeriodLabel'
> {
  const summaryItems = getStatisticsSummaryItems(summary);
  return {
    memberRows: sortMembersByActualCount(summary.members).map(toMemberStatisticsCard),
    primaryStatistics: summaryItems.filter((item) => item.emphasis === 'primary'),
    roleRows: summary.byRole.map(toRoleCard),
    secondaryStatistics: summaryItems.filter((item) => item.emphasis === 'secondary'),
    shiftTypeRows: summary.byShiftType.map(toShiftTypeCard),
    statisticsPeriodLabel: formatStatisticsPeriodLabel(
      data.statisticsMode,
      data.businessMonth,
      data.statisticsYear,
    ),
  };
}

function toMemberStatisticsCard(member: StatisticsMemberRow): MemberStatisticsCard {
  return {
    adjustmentLabel: `净值 ${formatNetDutyAdjustment(member.netDutyAdjustment)} · 增减 ${formatNetDutyAdjustment(member.deltaCount)}`,
    comparisonLabel: `原实对照 ${getMemberActualVsPlannedCount(member)}`,
    countLabel: `计划 ${member.plannedCount} · 实际 ${member.actualCount} · 计值班次 ${member.countedActualCount}`,
    id: member.membershipId,
    name: member.realName,
    shiftLabel: `周末 ${member.weekendCount} · 节假日 ${member.holidayCount}`,
    workflowLabel: `换班 ${member.swapCount} · 加班 ${member.overtimeCount} · 扣班 ${member.deductionCount}`,
  };
}

function toRoleCard(role: StatisticsRoleCount): BreakdownCard {
  return {
    actualLabel: String(role.actualCount),
    id: role.scheduleRoleId,
    name: role.scheduleRoleName,
    plannedLabel: String(role.plannedCount),
    ratio: getCompletionPercentage(role.actualCount, role.plannedCount),
  };
}

function toShiftTypeCard(shiftType: StatisticsShiftTypeCount): BreakdownCard {
  return {
    actualLabel: String(shiftType.actualCount),
    id: shiftType.shiftTypeId,
    name: shiftType.shiftTypeName,
    plannedLabel: String(shiftType.plannedCount),
    ratio: getCompletionPercentage(shiftType.actualCount, shiftType.plannedCount),
  };
}

function toUserMessage(error: unknown, fallback: string): string {
  if (error instanceof ClientCoreError && error.message.length > 0) return error.message;
  return error instanceof Error && error.message.length > 0 ? error.message : fallback;
}
