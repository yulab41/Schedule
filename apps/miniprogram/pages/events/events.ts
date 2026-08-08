import type { GroupSummary, ScheduleEvent } from '@schedule/contracts';

import { listEvents, listGroups, listVisitorAccessLogs } from '../../api/endpoints.js';
import { getStoredToken } from '../../api/client.js';
import { getSelectedGroupId, resolveSelectedGroup, setSelectedGroupId } from '../../store/group.js';
import { buildEventTimelineItems, formatEventTime } from '../../utils/event-timeline.js';

interface EventRow {
  readonly id: string;
  readonly narrative: string;
  readonly time: string;
  readonly typeLabel: string;
}

interface AccessRow {
  readonly businessMonth: string;
  readonly createdAt: string;
  readonly id: string;
}

interface EventsPageData {
  readonly accessRows: readonly AccessRow[];
  readonly errorMessage: string;
  readonly events: readonly EventRow[];
  readonly groups: readonly GroupSummary[];
  readonly loading: boolean;
  readonly selectedGroupId: string;
  readonly selectedRole: string;
  readonly showAccess: boolean;
}

Page({
  data: {
    accessRows: [],
    errorMessage: '',
    events: [],
    groups: [],
    loading: false,
    selectedGroupId: '',
    selectedRole: '',
    showAccess: false,
  } as EventsPageData,

  onShow() {
    if (getStoredToken() === undefined) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    void this.loadAll();
  },

  async loadAll(): Promise<void> {
    this.setData({ errorMessage: '', loading: true });
    try {
      const groups = await listGroups();
      const selected = resolveSelectedGroup(groups, getSelectedGroupId());
      if (selected === undefined) {
        this.setData({ errorMessage: '请先加入一个群组。', groups });
        return;
      }
      setSelectedGroupId(selected.id);
      const eventPage = await listEvents(selected.id);
      const items = buildEventTimelineItems(eventPage.events);
      this.setData({
        events: items.map((item) => ({
          id: item.event.id,
          narrative: item.event.id, // 由下方 loadNarratives 填充
          time: formatEventTime(item.event.occurredAt),
          typeLabel: item.marker ?? '',
        })),
        groups,
        selectedGroupId: selected.id,
        selectedRole: selected.role,
        showAccess: selected.role === 'owner' || selected.role === 'administrator',
      });
      if (this.data.showAccess) {
        const accessPage = await listVisitorAccessLogs(selected.id);
        this.setData({
          accessRows: accessPage.logs.map((log) => ({
            businessMonth: log.businessMonth,
            createdAt: formatEventTime(log.createdAt),
            id: log.id,
          })),
        });
      }
      await this.loadNarratives(selected.id, eventPage.events);
    } catch (error) {
      this.setData({ errorMessage: toMessage(error, '事件加载失败。') });
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadNarratives(groupId: string, events: readonly ScheduleEvent[]): Promise<void> {
    // 事件叙述基于事件数据与关联排班；此处直接使用本地 buildEventNarrative 需要原始事件。
    const { buildEventNarrative } = await import('../../utils/event-timeline.js');
    this.setData({
      events: events.map((event) => ({
        id: event.id,
        narrative: buildEventNarrative(event) ?? getTypeLabel(event.eventType),
        time: formatEventTime(event.occurredAt),
        typeLabel: getTypeLabel(event.eventType),
      })),
    });
  },

  onTabChange(event: WechatMiniprogram.CustomEvent) {
    this.setData({ showAccess: Number(event.detail.value ?? 0) === 1 });
  },

  handleGroupChange(event: WechatMiniprogram.CustomEvent) {
    const groupId = event.detail.groupId;
    if (typeof groupId === 'string' && groupId.length > 0) {
      setSelectedGroupId(groupId);
      this.setData({ selectedGroupId: groupId });
      void this.loadAll();
    }
  },
});

function getTypeLabel(eventType: string): string {
  const labels: Readonly<Record<string, string>> = {
    swap_completed: '换班已生效',
    leave_cover_completed: '请假替班完成',
    duty_adjustment_completed: '加扣班生效',
    schedule_period_published: '排班已发布',
  };
  return labels[eventType] ?? '排班变更';
}

function toMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.length > 0 ? error.message : fallback;
}
