import type { LeaveAffectedShift } from '@schedule/contracts';

import { createLeaveRequest, getLeaveAffectedShifts, listGroups } from '../../api/endpoints.js';
import { getStoredToken } from '../../api/client.js';
import { getSelectedGroupId, resolveSelectedGroup, setSelectedGroupId } from '../../store/group.js';
import { buildLeaveFormInterval, leaveTypeLabels } from '../../utils/leave-logic.js';

interface LeaveCreatePageData {
  readonly affectedShifts: readonly LeaveAffectedShift[];
  readonly allDay: boolean;
  readonly endDate: string;
  readonly endTime: string;
  readonly errorMessage: string;
  readonly groupId: string;
  readonly leaveType: keyof typeof leaveTypeLabels;
  readonly reason: string;
  readonly resolutionMode: string;
  readonly startDate: string;
  readonly startTime: string;
  readonly submitting: boolean;
}

Page({
  data: {
    affectedShifts: [],
    allDay: true,
    endDate: '',
    endTime: '18:00',
    errorMessage: '',
    groupId: '',
    leaveType: 'sick',
    reason: '',
    resolutionMode: 'manual',
    startDate: '',
    startTime: '08:00',
    submitting: false,
  } as LeaveCreatePageData,

  onShow() {
    if (getStoredToken() === undefined) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    void this.loadGroup();
  },

  async loadGroup(): Promise<void> {
    try {
      const groups = await listGroups();
      const selected = resolveSelectedGroup(groups, getSelectedGroupId());
      if (selected !== undefined) {
        setSelectedGroupId(selected.id);
        this.setData({ groupId: selected.id });
      }
    } catch (error) {
      this.setData({ errorMessage: toMessage(error, '群组加载失败。') });
    }
  },

  onStartDate(event: WechatMiniprogram.PickerChange) {
    this.setData({ startDate: String(event.detail.value ?? '') });
  },

  onEndDate(event: WechatMiniprogram.PickerChange) {
    this.setData({ endDate: String(event.detail.value ?? '') });
  },

  onStartTime(event: WechatMiniprogram.PickerChange) {
    this.setData({ startTime: String(event.detail.value ?? '') });
  },

  onEndTime(event: WechatMiniprogram.PickerChange) {
    this.setData({ endTime: String(event.detail.value ?? '') });
  },

  onTypeChange(event: WechatMiniprogram.PickerChange) {
    const value = Number(event.detail.value ?? 0);
    this.setData({
      leaveType: Object.keys(leaveTypeLabels)[value] as keyof typeof leaveTypeLabels,
    });
  },

  onAllDayChange(event: WechatMiniprogram.CustomEvent) {
    this.setData({ allDay: event.detail.value === true });
  },

  onReasonInput(event: WechatMiniprogram.TextareaInput) {
    this.setData({ reason: event.detail.value });
  },

  onResolutionChange(event: WechatMiniprogram.PickerChange) {
    const value = Number(event.detail.value ?? 0);
    this.setData({ resolutionMode: value === 1 ? 'shift-forward' : 'manual' });
  },

  async previewAffected(): Promise<void> {
    if (this.data.startDate.length === 0 || this.data.endDate.length === 0) {
      this.setData({ errorMessage: '请选择请假日期。' });
      return;
    }
    try {
      const interval = buildLeaveFormInterval({
        allDay: this.data.allDay,
        endDate: this.data.endDate,
        endTime: this.data.endTime,
        startDate: this.data.startDate,
        startTime: this.data.startTime,
      });
      const shifts = await getLeaveAffectedShifts(this.data.groupId, {
        endsAt: interval.endsAt,
        isAllDay: this.data.allDay,
        startsAt: interval.startsAt,
      });
      this.setData({ affectedShifts: shifts });
    } catch (error) {
      this.setData({ errorMessage: toMessage(error, '影响班次查询失败。') });
    }
  },

  async handleSubmit(): Promise<void> {
    if (this.data.startDate.length === 0 || this.data.endDate.length === 0) {
      this.setData({ errorMessage: '请选择请假日期。' });
      return;
    }
    this.setData({ errorMessage: '', submitting: true });
    try {
      const interval = buildLeaveFormInterval({
        allDay: this.data.allDay,
        endDate: this.data.endDate,
        endTime: this.data.endTime,
        startDate: this.data.startDate,
        startTime: this.data.startTime,
      });
      await createLeaveRequest(this.data.groupId, {
        endsAt: interval.endsAt,
        isAllDay: this.data.allDay,
        leaveType: this.data.leaveType,
        reason: this.data.reason.trim(),
        resolutionMode: this.data.resolutionMode as 'manual' | 'shift-forward',
        startsAt: interval.startsAt,
      });
      wx.showToast({ icon: 'success', title: '请假已提交' });
      wx.navigateBack();
    } catch (error) {
      this.setData({ errorMessage: toMessage(error, '提交失败。') });
    } finally {
      this.setData({ submitting: false });
    }
  },
});

function toMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.length > 0 ? error.message : fallback;
}
