import type { GroupSummary, ScheduleEvent, VisitorAccessLog } from '@schedule/contracts';

import { listEvents, listGroups, listVisitorAccessLogs } from '../../api/endpoints.js';
import { resolveSelectedGroup, setSelectedGroupId } from '../../store/group.js';
import { buildEventNarrative, formatEventTime, getEventTypeLabel } from '../../utils/events.js';

interface EventRow {
  readonly id: string;
  readonly narrative: string;
  readonly time: string;
  readonly typeLabel: string;
}

interface VisitorLogRow {
  readonly businessMonth: string;
  readonly clientIp: string;
  readonly createdAt: string;
  readonly id: string;
}

interface EventsPageData {
  readonly activeTab: 'events' | 'logs';
  readonly canViewLogs: boolean;
  readonly errorMessage: string;
  readonly events: readonly EventRow[];
  readonly eventsCursor: string | undefined;
  readonly groups: readonly GroupSummary[];
  readonly loading: boolean;
  readonly logs: readonly VisitorLogRow[];
  readonly logsCursor: string | undefined;
  readonly selectedGroupId: string;
}

Page({
  data: {
    activeTab: 'events',
    canViewLogs: false,
    errorMessage: '',
    events: [],
    eventsCursor: undefined,
    groups: [],
    loading: false,
    logs: [],
    logsCursor: undefined,
    selectedGroupId: '',
  } as EventsPageData,

  onShow() {
    void this.loadGroups();
  },

  async loadGroups(): Promise<void> {
    this.setData({ errorMessage: '', loading: true });
    try {
      const groups = await listGroups();
      const selected = resolveSelectedGroup(groups);
      this.setData({
        canViewLogs: selected?.role === 'owner' || selected?.role === 'administrator',
        groups,
        selectedGroupId: selected?.id ?? '',
      });
      if (selected !== undefined) {
        setSelectedGroupId(selected.id);
        this.setData({ events: [], eventsCursor: undefined, logs: [], logsCursor: undefined });
        await this.loadEvents();
      }
    } catch (error) {
      this.setData({ errorMessage: toErrorMessage(error) });
    } finally {
      this.setData({ loading: false });
    }
  },

  switchTab(event: WechatMiniprogram.TouchEvent) {
    const tab = event.currentTarget.dataset.tab;
    if (tab === 'logs' || tab === 'events') {
      this.setData({ activeTab: tab });
      if (tab === 'logs' && this.data.logs.length === 0) {
        void this.loadLogs();
      }
    }
  },

  async loadEvents(): Promise<void> {
    const groupId = this.data.selectedGroupId;
    if (groupId.length === 0) {
      return;
    }
    this.setData({ errorMessage: '', loading: true });
    try {
      const page = await listEvents(groupId, this.data.eventsCursor);
      this.setData({
        events: [...this.data.events, ...page.events.map((event) => buildEventRow(event))],
        eventsCursor: page.nextCursor,
      });
    } catch (error) {
      this.setData({ errorMessage: toErrorMessage(error) });
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadLogs(): Promise<void> {
    const groupId = this.data.selectedGroupId;
    if (groupId.length === 0) {
      return;
    }
    this.setData({ errorMessage: '', loading: true });
    try {
      const page = await listVisitorAccessLogs(groupId, this.data.logsCursor);
      this.setData({
        logs: [...this.data.logs, ...page.logs.map((log) => buildLogRow(log))],
        logsCursor: page.nextCursor,
      });
    } catch (error) {
      this.setData({ errorMessage: toErrorMessage(error) });
    } finally {
      this.setData({ loading: false });
    }
  },

  loadMore(): void {
    if (this.data.activeTab === 'events') {
      void this.loadEvents();
    } else {
      void this.loadLogs();
    }
  },

  handleGroupChange(event: WechatMiniprogram.CustomEvent) {
    const groupId = event.detail.groupId;
    if (typeof groupId !== 'string' || groupId.length === 0) {
      return;
    }
    const selected = this.data.groups.find((group) => group.id === groupId);
    this.setData({
      canViewLogs: selected?.role === 'owner' || selected?.role === 'administrator',
      selectedGroupId: groupId,
    });
    setSelectedGroupId(groupId);
    void this.loadGroups();
  },
});

function buildEventRow(event: ScheduleEvent): EventRow {
  return {
    id: event.id,
    narrative: buildEventNarrative(event),
    time: formatEventTime(event.occurredAt),
    typeLabel: getEventTypeLabel(event.eventType),
  };
}

function buildLogRow(log: VisitorAccessLog): VisitorLogRow {
  return {
    businessMonth: log.businessMonth,
    clientIp: log.clientIp ?? '—',
    createdAt: formatEventTime(log.createdAt),
    id: log.id,
  };
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error && error.message.length > 0
    ? error.message
    : '数据加载失败，请稍后重试。';
}
