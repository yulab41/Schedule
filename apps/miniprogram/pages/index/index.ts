import type { GroupSummary } from '@schedule/contracts';

import { listGroups } from '../../api/endpoints.js';
import { resolveSelectedGroup, setSelectedGroupId } from '../../store/group.js';

interface IndexPageData {
  readonly errorMessage: string;
  readonly groups: readonly GroupSummary[];
  readonly selectedGroupId: string;
}

Page({
  data: {
    errorMessage: '',
    groups: [],
    selectedGroupId: '',
  } as IndexPageData,

  onShow() {
    void this.loadGroups();
  },

  async loadGroups(): Promise<void> {
    this.setData({ errorMessage: '' });
    try {
      const groups = await listGroups();
      const selected = resolveSelectedGroup(groups);
      this.setData({
        groups,
        selectedGroupId: selected?.id ?? '',
      });
      if (selected !== undefined) {
        setSelectedGroupId(selected.id);
      }
    } catch (error) {
      this.setData({
        errorMessage:
          error instanceof Error && error.message.length > 0
            ? error.message
            : '群组数据加载失败，请稍后重试。',
      });
    }
  },

  handleGroupChange(event: WechatMiniprogram.CustomEvent) {
    const groupId = event.detail.groupId;
    if (typeof groupId === 'string' && groupId.length > 0) {
      this.setData({ selectedGroupId: groupId });
      setSelectedGroupId(groupId);
    }
  },

  openCalendar(): void {
    wx.switchTab({ url: '/pages/calendar/calendar' });
  },

  openMembers(): void {
    if (this.data.selectedGroupId.length === 0) {
      return;
    }
    wx.navigateTo({ url: '/pages/members/members' });
  },
});
