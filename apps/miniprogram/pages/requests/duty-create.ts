import type { DutyAdjustmentPreview } from '@schedule/contracts';

import {
  createDutyAdjustmentRequest,
  getCalendar,
  listGroupMembers,
  listGroups,
  previewDutyAdjustment,
} from '../../api/endpoints.js';
import { getStoredToken } from '../../api/client.js';
import { getSelectedGroupId, resolveSelectedGroup, setSelectedGroupId } from '../../store/group.js';
import {
  buildDutyAdjustmentCandidates,
  getDutyAdjustmentNextStatusDescription,
} from '../../utils/duty-adjustment-logic.js';
import { formatAssignmentOption } from '../../utils/assignment-option.js';
import { randomUuid } from '../../utils/uuid.js';
import { getCurrentBusinessMonth } from '../../utils/china-time.js';

interface DutyCreatePageData {
  readonly adminShiftIndex: number;
  readonly adminShiftLabels: readonly string[];
  readonly adminShiftOptions: readonly string[];
  readonly errorMessage: string;
  readonly groupId: string;
  readonly nextStatusDescription: string;
  readonly overtimeIndex: number;
  readonly overtimeLabels: readonly string[];
  readonly overtimeOptions: readonly string[];
  readonly preview: DutyAdjustmentPreview | undefined;
  readonly reason: string;
  readonly submitting: boolean;
}

Page({
  data: {
    adminShiftIndex: 0,
    adminShiftLabels: [],
    adminShiftOptions: [],
    errorMessage: '',
    groupId: '',
    nextStatusDescription: '',
    overtimeIndex: 0,
    overtimeLabels: [],
    overtimeOptions: [],
    preview: undefined,
    reason: '',
    submitting: false,
  } as DutyCreatePageData,

  onShow() {
    if (getStoredToken() === undefined) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    void this.loadContext();
  },

  async loadContext(): Promise<void> {
    this.setData({ errorMessage: '' });
    try {
      const groups = await listGroups();
      const selected = resolveSelectedGroup(groups, getSelectedGroupId());
      if (selected === undefined) {
        this.setData({ errorMessage: '请先加入一个群组。' });
        return;
      }
      setSelectedGroupId(selected.id);
      const members = await listGroupMembers(selected.id);
      const mine = members.find((member) => member.isCurrentUser);
      if (mine === undefined) {
        this.setData({ errorMessage: '未找到当前成员身份。' });
        return;
      }
      const calendar = await getCalendar(selected.id, getCurrentBusinessMonth(new Date()));
      const candidates = buildDutyAdjustmentCandidates(calendar, mine.id);
      this.setData({
        adminShiftLabels: candidates.adminShiftOptions.map(formatAssignmentOption),
        adminShiftOptions: candidates.adminShiftOptions.map((assignment) => assignment.id),
        groupId: selected.id,
        overtimeLabels: candidates.overtimeOptions.map((member) => member.realName),
        overtimeOptions: candidates.overtimeOptions.map((member) => member.membershipId),
      });
    } catch (error) {
      this.setData({ errorMessage: toMessage(error, '加扣班数据加载失败。') });
    }
  },

  onAdminShiftChange(event: WechatMiniprogram.PickerChange) {
    this.setData({ adminShiftIndex: Number(event.detail.value ?? 0) });
  },

  onOvertimeChange(event: WechatMiniprogram.PickerChange) {
    this.setData({ overtimeIndex: Number(event.detail.value ?? 0) });
  },

  onReasonInput(event: WechatMiniprogram.TextareaInput) {
    this.setData({ reason: event.detail.value });
  },

  async handlePreview(): Promise<void> {
    const coveredAssignmentId = this.data.adminShiftOptions[this.data.adminShiftIndex];
    const overtimeMembershipId = this.data.overtimeOptions[this.data.overtimeIndex];
    if (coveredAssignmentId === undefined || overtimeMembershipId === undefined) {
      this.setData({ errorMessage: '请先选择被代值班次和加班成员。' });
      return;
    }
    try {
      const preview = await previewDutyAdjustment(this.data.groupId, {
        coveredAssignmentId,
        overtimeMembershipId,
      });
      this.setData({
        nextStatusDescription: getDutyAdjustmentNextStatusDescription(preview.nextStatus),
        preview,
      });
    } catch (error) {
      this.setData({ errorMessage: toMessage(error, '加扣班预览失败。') });
    }
  },

  async handleSubmit(): Promise<void> {
    if (this.data.preview === undefined) {
      await this.handlePreview();
      return;
    }
    const coveredAssignmentId = this.data.adminShiftOptions[this.data.adminShiftIndex];
    const overtimeMembershipId = this.data.overtimeOptions[this.data.overtimeIndex];
    if (coveredAssignmentId === undefined || overtimeMembershipId === undefined) {
      return;
    }
    this.setData({ errorMessage: '', submitting: true });
    try {
      await createDutyAdjustmentRequest(this.data.groupId, {
        coveredAssignmentId,
        operationId: randomUuid(),
        overtimeMembershipId,
        reason: this.data.reason.trim(),
      });
      wx.showToast({ icon: 'success', title: '加扣班已提交' });
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
