import type { GroupSummary } from '@schedule/contracts';

import {
  getGroupNotificationSettings,
  getMyNotificationPreferences,
  listGroups,
  updateGroupNotificationSettings,
  updateMyNotificationPreferences,
} from '../../api/endpoints.js';
import { getStoredToken } from '../../api/client.js';
import { getSelectedGroupId, resolveSelectedGroup, setSelectedGroupId } from '../../store/group.js';
import { requestDutyReminderSubscription } from '../../utils/subscription.js';
import { formatReminderHours, parseReminderHoursInput } from '../../utils/notification-logic.js';

interface SettingsPageData {
  readonly errorMessage: string;
  readonly groupDefaultHours: string;
  readonly groups: readonly GroupSummary[];
  readonly hoursInput: string;
  readonly infoMessage: string;
  readonly selectedGroupId: string;
  readonly submitting: boolean;
  readonly wechatNotificationsEnabled: boolean;
}

Page({
  data: {
    errorMessage: '',
    groupDefaultHours: '',
    groups: [],
    hoursInput: '',
    infoMessage: '',
    selectedGroupId: '',
    submitting: false,
    wechatNotificationsEnabled: false,
  } as SettingsPageData,

  onShow() {
    if (getStoredToken() === undefined) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    void this.loadAll();
  },

  async loadAll(): Promise<void> {
    this.setData({ errorMessage: '' });
    try {
      const groups = await listGroups();
      const selected = resolveSelectedGroup(groups, getSelectedGroupId());
      if (selected === undefined) {
        this.setData({ errorMessage: '请先加入一个群组。', groups });
        return;
      }
      setSelectedGroupId(selected.id);
      const [mine, group] = await Promise.all([
        getMyNotificationPreferences(selected.id),
        getGroupNotificationSettings(selected.id),
      ]);
      this.setData({
        groupDefaultHours: formatReminderHours(group.dutyReminderHours),
        groups,
        hoursInput: formatReminderHours(mine.dutyReminderHours),
        selectedGroupId: selected.id,
        wechatNotificationsEnabled: mine.wechatNotificationsEnabled,
      });
    } catch (error) {
      this.setData({ errorMessage: toMessage(error, '设置加载失败。') });
    }
  },

  handleGroupChange(event: WechatMiniprogram.CustomEvent) {
    const groupId = event.detail.groupId;
    if (typeof groupId === 'string' && groupId.length > 0) {
      setSelectedGroupId(groupId);
      this.setData({ selectedGroupId: groupId });
      void this.loadAll();
    }
  },

  onWechatToggle(event: WechatMiniprogram.CustomEvent) {
    const enabled = event.detail.value === true;
    this.setData({ wechatNotificationsEnabled: enabled });
    if (enabled) {
      void requestDutyReminderSubscription();
    }
  },

  onHoursInput(event: WechatMiniprogram.Input) {
    this.setData({ hoursInput: event.detail.value });
  },

  onGroupHoursInput(event: WechatMiniprogram.Input) {
    this.setData({ groupDefaultHours: event.detail.value });
  },

  async handleSaveMine(): Promise<void> {
    this.setData({ errorMessage: '', infoMessage: '', submitting: true });
    try {
      const hours = parseReminderHoursInput(this.data.hoursInput);
      await updateMyNotificationPreferences(this.data.selectedGroupId, {
        dutyReminderHours: hours,
        wechatNotificationsEnabled: this.data.wechatNotificationsEnabled,
      });
      wx.showToast({ icon: 'success', title: '提醒已保存' });
    } catch (error) {
      this.setData({ errorMessage: toMessage(error, '保存失败。') });
    } finally {
      this.setData({ submitting: false });
    }
  },

  async handleSaveGroup(): Promise<void> {
    this.setData({ errorMessage: '', infoMessage: '', submitting: true });
    try {
      const hours = parseReminderHoursInput(this.data.groupDefaultHours);
      await updateGroupNotificationSettings(this.data.selectedGroupId, {
        dutyReminderHours: hours,
      });
      wx.showToast({ icon: 'success', title: '群组默认已保存' });
    } catch (error) {
      this.setData({ errorMessage: toMessage(error, '保存失败。') });
    } finally {
      this.setData({ submitting: false });
    }
  },
});

function toMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.length > 0 ? error.message : fallback;
}
