import type { GroupSummary } from '@schedule/contracts';

import {
  getGroupNotificationSettings,
  getMyNotificationPreferences,
  listGroups,
  updateGroupNotificationSettings,
  updateMyNotificationPreferences,
} from '../../api/endpoints.js';
import { resolveSelectedGroup, setSelectedGroupId } from '../../store/group.js';
import { requestDutyReminderSubscription } from '../../utils/subscription.js';

interface NotificationSettingsPageData {
  readonly canManageSettings: boolean;
  readonly errorMessage: string;
  readonly groupHoursInput: string;
  readonly groups: readonly GroupSummary[];
  readonly loading: boolean;
  readonly myHoursInput: string;
  readonly myHoursMode: 'custom' | 'default' | 'off';
  readonly saving: boolean;
  readonly selectedGroupId: string;
  readonly successMessage: string;
  readonly wechatNotificationsEnabled: boolean;
}

Page({
  data: {
    canManageSettings: false,
    errorMessage: '',
    groupHoursInput: '',
    groups: [],
    loading: false,
    myHoursInput: '',
    myHoursMode: 'default',
    saving: false,
    selectedGroupId: '',
    successMessage: '',
    wechatNotificationsEnabled: false,
  } as NotificationSettingsPageData,

  onShow() {
    void this.loadData();
  },

  async loadData(): Promise<void> {
    this.setData({ errorMessage: '', loading: true });
    try {
      const groups = await listGroups();
      const selected = resolveSelectedGroup(groups);
      if (selected === undefined) {
        this.setData({ groups, selectedGroupId: '' });
        return;
      }
      setSelectedGroupId(selected.id);
      const canManageSettings = selected.role !== 'member';
      const [preferences, groupSettings] = await Promise.all([
        getMyNotificationPreferences(selected.id),
        canManageSettings ? getGroupNotificationSettings(selected.id) : Promise.resolve(undefined),
      ]);
      this.setData({
        canManageSettings,
        groupHoursInput: groupSettings?.dutyReminderHours.join(', ') ?? '',
        groups,
        myHoursInput: preferences.dutyReminderHours?.join(', ') ?? '',
        myHoursMode:
          preferences.dutyReminderHours === null
            ? 'default'
            : preferences.dutyReminderHours.length === 0
              ? 'off'
              : 'custom',
        selectedGroupId: selected.id,
        wechatNotificationsEnabled: preferences.wechatNotificationsEnabled,
      });
      if (preferences.wechatNotificationsEnabled) {
        await requestDutyReminderSubscription();
      }
    } catch (error) {
      this.setData({ errorMessage: toErrorMessage(error) });
    } finally {
      this.setData({ loading: false });
    }
  },

  handleGroupChange(event: WechatMiniprogram.CustomEvent) {
    const groupId = event.detail.groupId;
    if (typeof groupId !== 'string' || groupId.length === 0) {
      return;
    }
    this.setData({ selectedGroupId: groupId });
    setSelectedGroupId(groupId);
    void this.loadData();
  },

  handleWechatToggle(event: WechatMiniprogram.SwitchChange) {
    const enabled = event.detail.value === true;
    this.setData({ wechatNotificationsEnabled: enabled });
    if (enabled) {
      void requestDutyReminderSubscription();
    }
  },

  handleHoursModeChange(event: WechatMiniprogram.TouchEvent) {
    const mode = event.currentTarget.dataset.mode;
    if (mode === 'custom' || mode === 'default' || mode === 'off') {
      this.setData({ myHoursMode: mode });
    }
  },

  handleMyHoursInput(event: WechatMiniprogram.Input) {
    this.setData({ myHoursInput: event.detail.value });
  },

  handleGroupHoursInput(event: WechatMiniprogram.Input) {
    this.setData({ groupHoursInput: event.detail.value });
  },

  async handleSave(): Promise<void> {
    if (this.data.saving) {
      return;
    }
    this.setData({ errorMessage: '', saving: true });
    try {
      const dutyReminderHours =
        this.data.myHoursMode === 'default'
          ? null
          : this.data.myHoursMode === 'off'
            ? []
            : parseReminderHours(this.data.myHoursInput);
      await updateMyNotificationPreferences(this.data.selectedGroupId, {
        dutyReminderHours,
        wechatNotificationsEnabled: this.data.wechatNotificationsEnabled,
      });
      if (this.data.canManageSettings && this.data.groupHoursInput.trim().length > 0) {
        await updateGroupNotificationSettings(this.data.selectedGroupId, {
          dutyReminderHours: parseReminderHours(this.data.groupHoursInput),
        });
      }
      this.setData({ successMessage: '提醒设置已保存。' });
      setTimeout(() => {
        this.setData({ successMessage: '' });
      }, 2500);
    } catch (error) {
      this.setData({ errorMessage: toErrorMessage(error) });
    } finally {
      this.setData({ saving: false });
    }
  },
});

function parseReminderHours(value: string): number[] {
  const tokens = value
    .split(/[,，、\s]+/u)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  const hours = tokens.map((entry) => Number(entry));
  const uniqueHours = [...new Set(hours)].sort((first, second) => second - first);
  if (
    tokens.length === 0 ||
    hours.some((hour) => !Number.isInteger(hour) || hour < 1 || hour > 720) ||
    uniqueHours.length > 5
  ) {
    throw new Error('请输入 1 到 5 个互不相同、1 到 720 之间的整数小时数。');
  }
  return uniqueHours;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error && error.message.length > 0
    ? error.message
    : '操作失败，请稍后重试。';
}
