import { ClientCoreError, type InsightsReadClient } from '@schedule/client-core';
import type { ScheduleEvent, StatisticsSummary } from '@schedule/contracts';
import {
  ClientCapabilityDisabledError,
  requireClientCapability,
} from '../../../../app/client-capability-store.js';
import { createRuntimeInsightsReadClient } from '../../../../platform/client-core-calendar.js';
import {
  getStoredWechatToken,
  getWechatRequestAuthentication,
} from '../../../../platform/wechat-identity.js';

type DashboardState = 'disabled' | 'empty' | 'error' | 'loading' | 'ready';
type DashboardTab = 'events' | 'statistics';

interface EventCard {
  readonly actorLabel: string;
  readonly detailLabel: string;
  readonly eventTypeLabel: string;
  readonly id: string;
  readonly occurredAtLabel: string;
}

interface RoleCard {
  readonly actualLabel: string;
  readonly name: string;
  readonly plannedLabel: string;
  readonly ratio: number;
}

interface StatisticsCard {
  readonly label: string;
  readonly note: string;
  readonly value: string;
}

interface InsightsDashboardData {
  readonly activeTab: DashboardTab;
  readonly errorMessage: string;
  readonly eventCountLabel: string;
  readonly events: readonly EventCard[];
  readonly groupId: string;
  readonly pageScrollStyle: string;
  readonly roleRows: readonly RoleCard[];
  readonly shellHeaderStyle: string;
  readonly state: DashboardState;
  readonly statistics: readonly StatisticsCard[];
  readonly viewportClass: string;
}

interface InsightsDashboardInstance {
  readonly data: InsightsDashboardData;
  readonly properties: { readonly groupId: string };
  readonly _insightsReadClient: InsightsReadClient;
  _loadedGroupId: string;
  _requestSerial: number;
  setData(patch: Partial<InsightsDashboardData>, callback?: () => void): void;
}

const insightsReadClient = createRuntimeInsightsReadClient(
  getStoredWechatToken,
  getWechatRequestAuthentication(),
);

export function createInsightsDashboardPanelControllerDefinition() {
  return {
    data: {
      activeTab: 'events' as DashboardTab,
      errorMessage: '',
      eventCountLabel: '0 条',
      events: [],
      groupId: '',
      pageScrollStyle: 'height:calc(100% - 76px);',
      roleRows: [],
      shellHeaderStyle: 'height:76px;min-height:76px;padding-top:24px;',
      state: 'loading' as DashboardState,
      statistics: [],
      viewportClass: '',
    } satisfies InsightsDashboardData,

    properties: { groupId: { type: String, value: '' } },
    _insightsReadClient: insightsReadClient,
    _loadedGroupId: '',
    _requestSerial: 0,

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
          viewportClass: windowInfo.windowWidth <= 340 ? 'is-compact' : '',
        });
        startLoad(this);
      },
    },

    methods: {
      handleBack(): void {
        wx.navigateBack({ delta: 1 });
      },
      handleRetry(this: InsightsDashboardInstance): void {
        void loadDashboard(this);
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
  const groupId = page.data.groupId;
  if (groupId.length === 0) {
    page.setData({ errorMessage: '当前群组信息缺失，请返回工作台后重试。', state: 'error' });
    return;
  }
  const requestSerial = page._requestSerial + 1;
  page._requestSerial = requestSerial;
  page.setData({ errorMessage: '', state: 'loading' });
  try {
    await requireClientCapability('insights');
    const [eventPage, monthSnapshot] = await Promise.all([
      page._insightsReadClient.listEvents(groupId, { pageSize: 50 }),
      page._insightsReadClient.getMonthStatistics(groupId, currentBusinessMonth()),
    ]);
    if (requestSerial !== page._requestSerial) return;
    const events = eventPage.events.map(toEventCard);
    const statistics = toStatisticsCards(monthSnapshot.summary);
    page.setData({
      eventCountLabel: `${events.length} 条`,
      events,
      roleRows: toRoleCards(monthSnapshot.summary),
      statistics,
      state: events.length === 0 && monthSnapshot.summary.plannedCount === 0 ? 'empty' : 'ready',
    });
  } catch (error) {
    if (requestSerial !== page._requestSerial) return;
    page.setData({
      errorMessage:
        error instanceof ClientCapabilityDisabledError
          ? error.message
          : toUserMessage(error, '事件与统计暂时无法加载，请稍后重试。'),
      state: error instanceof ClientCapabilityDisabledError ? 'disabled' : 'error',
    });
  }
}

function startLoad(page: InsightsDashboardInstance): void {
  const groupId = page.properties.groupId;
  if (groupId.length === 0 || groupId === page._loadedGroupId) return;
  page._loadedGroupId = groupId;
  page.setData({ groupId });
  void loadDashboard(page);
}

function toEventCard(event: ScheduleEvent): EventCard {
  const affectedCount = event.affectedMembershipIds.length + event.affectedShiftIds.length;
  return {
    actorLabel: '操作者已脱敏',
    detailLabel: `${event.objectType} · 影响 ${affectedCount} 项`,
    eventTypeLabel: eventTypeLabel(event.eventType),
    id: event.id,
    occurredAtLabel: formatDateTime(event.occurredAt),
  };
}

function toStatisticsCards(summary: StatisticsSummary): readonly StatisticsCard[] {
  const completion = summary.plannedCount === 0 ? 0 : Math.round((summary.actualCount / summary.plannedCount) * 100);
  return [
    { label: '实际班次', note: `计划 ${summary.plannedCount} · 完成率 ${completion}%`, value: String(summary.actualCount) },
    { label: '计值班次', note: `周末 ${summary.weekendCount} · 节假日 ${summary.holidayCount}`, value: String(summary.countedActualCount) },
    { label: '需要关注', note: `请假替班 ${summary.leaveCoverCount} · 换班 ${summary.swapCount}`, value: String(Math.max(0, summary.plannedCount - summary.actualCount)) },
  ];
}

function toRoleCards(summary: StatisticsSummary): readonly RoleCard[] {
  return summary.byRole.map((role) => ({
    actualLabel: String(role.actualCount),
    name: role.scheduleRoleName,
    plannedLabel: String(role.plannedCount),
    ratio: role.plannedCount === 0 ? 0 : Math.min(100, Math.round((role.actualCount / role.plannedCount) * 100)),
  }));
}

function eventTypeLabel(value: string): string {
  const labels: Record<string, string> = {
    leave_approved: '请假申请已批准',
    schedule_published: '排班已发布',
    swap_completed: '换班已完成',
  };
  return labels[value] ?? '排班变更记录';
}

function currentBusinessMonth(): string {
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return '时间未知';
  const pad = (part: number): string => String(part).padStart(2, '0');
  const china = new Date(date.valueOf() + 8 * 60 * 60 * 1000);
  return `${china.getUTCMonth() + 1}月${china.getUTCDate()}日 ${pad(china.getUTCHours())}:${pad(china.getUTCMinutes())}`;
}

function toUserMessage(error: unknown, fallback: string): string {
  if (error instanceof ClientCoreError && error.message.length > 0) return error.message;
  return error instanceof Error && error.message.length > 0 ? error.message : fallback;
}
