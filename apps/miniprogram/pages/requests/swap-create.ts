import type { SwapPreview } from '@schedule/contracts';

import {
  createSwapRequest,
  getCalendar,
  listGroupMembers,
  listGroups,
  previewSwap,
} from '../../api/endpoints.js';
import { getStoredToken } from '../../api/client.js';
import { getSelectedGroupId, resolveSelectedGroup, setSelectedGroupId } from '../../store/group.js';
import { buildSwapCandidates, getSwapNextStatusDescription } from '../../utils/swap-logic.js';
import { formatAssignmentOption } from '../../utils/assignment-option.js';
import { randomUuid } from '../../utils/uuid.js';
import { getCurrentBusinessMonth } from '../../utils/china-time.js';

interface AssignmentOption {
  readonly id: string;
  readonly label: string;
}

interface TargetOption {
  readonly id: string;
  readonly name: string;
}

interface SwapCreatePageData {
  readonly errorMessage: string;
  readonly groupId: string;
  readonly myAssignmentIndex: number;
  readonly myAssignments: readonly AssignmentOption[];
  readonly nextStatusDescription: string;
  readonly preview: SwapPreview | undefined;
  readonly submitting: boolean;
  readonly targetAssignmentIndex: number;
  readonly targetAssignments: readonly AssignmentOption[];
  readonly targetIndex: number;
  readonly targetOptions: readonly TargetOption[];
}

Page({
  data: {
    errorMessage: '',
    groupId: '',
    myAssignmentIndex: 0,
    myAssignments: [],
    nextStatusDescription: '',
    preview: undefined,
    submitting: false,
    targetAssignmentIndex: 0,
    targetAssignments: [],
    targetIndex: 0,
    targetOptions: [],
  } as SwapCreatePageData,

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
      const candidates = buildSwapCandidates(calendar, mine.id);
      const myAssignments = candidates.myAssignments.map((assignment) => ({
        id: assignment.id,
        label: formatAssignmentOption(assignment),
      }));
      const targetOptions = candidates.targetOptions.map((member) => ({
        id: member.membershipId,
        name: member.realName,
      }));
      const firstTarget = targetOptions[0];
      const targetAssignments =
        firstTarget === undefined
          ? []
          : (candidates.assignmentsByTarget.get(firstTarget.id) ?? []).map((assignment) => ({
              id: assignment.id,
              label: formatAssignmentOption(assignment),
            }));
      this.setData({
        groupId: selected.id,
        myAssignmentIndex: 0,
        myAssignments,
        targetAssignmentIndex: 0,
        targetAssignments,
        targetIndex: 0,
        targetOptions,
      });
    } catch (error) {
      this.setData({ errorMessage: toMessage(error, '换班数据加载失败。') });
    }
  },

  onMyAssignmentChange(event: WechatMiniprogram.PickerChange) {
    this.setData({ myAssignmentIndex: Number(event.detail.value ?? 0) });
  },

  async onTargetChange(event: WechatMiniprogram.PickerChange): Promise<void> {
    const index = Number(event.detail.value ?? 0);
    const target = this.data.targetOptions[index];
    if (target === undefined) {
      return;
    }
    this.setData({ targetIndex: index, targetAssignmentIndex: 0, targetAssignments: [] });
    const calendar = await this.loadCalendar();
    const members = await listGroupMembers(this.data.groupId);
    const mine = members.find((member) => member.isCurrentUser);
    if (calendar === undefined || mine === undefined) {
      return;
    }
    const candidates = buildSwapCandidates(calendar, mine.id);
    const assignments = candidates.assignmentsByTarget.get(target.id) ?? [];
    this.setData({
      targetAssignments: assignments.map((assignment) => ({
        id: assignment.id,
        label: formatAssignmentOption(assignment),
      })),
    });
  },

  async loadCalendar() {
    try {
      return await getCalendar(this.data.groupId, getCurrentBusinessMonth(new Date()));
    } catch {
      this.setData({ errorMessage: '日历加载失败。' });
      return undefined;
    }
  },

  onTargetAssignmentChange(event: WechatMiniprogram.PickerChange) {
    this.setData({ targetAssignmentIndex: Number(event.detail.value ?? 0) });
  },

  async handlePreview(): Promise<void> {
    const initiatorAssignmentId = this.data.myAssignments[this.data.myAssignmentIndex]?.id;
    const targetAssignmentId = this.data.targetAssignments[this.data.targetAssignmentIndex]?.id;
    const targetMembershipId = this.data.targetOptions[this.data.targetIndex]?.id;
    if (
      initiatorAssignmentId === undefined ||
      targetAssignmentId === undefined ||
      targetMembershipId === undefined
    ) {
      this.setData({ errorMessage: '请先选择我的班次、目标成员和对方班次。' });
      return;
    }
    try {
      const preview = await previewSwap(this.data.groupId, {
        initiatorAssignmentId,
        targetAssignmentId,
        targetMembershipId,
      });
      this.setData({
        nextStatusDescription: getSwapNextStatusDescription(preview.nextStatus),
        preview,
      });
    } catch (error) {
      this.setData({ errorMessage: toMessage(error, '换班预览失败。') });
    }
  },

  async handleSubmit(): Promise<void> {
    if (this.data.preview === undefined) {
      await this.handlePreview();
      return;
    }
    const initiatorAssignmentId = this.data.myAssignments[this.data.myAssignmentIndex]?.id;
    const targetAssignmentId = this.data.targetAssignments[this.data.targetAssignmentIndex]?.id;
    const targetMembershipId = this.data.targetOptions[this.data.targetIndex]?.id;
    if (
      initiatorAssignmentId === undefined ||
      targetAssignmentId === undefined ||
      targetMembershipId === undefined
    ) {
      return;
    }
    this.setData({ errorMessage: '', submitting: true });
    try {
      await createSwapRequest(this.data.groupId, {
        initiatorAssignmentId,
        operationId: randomUuid(),
        targetAssignmentId,
        targetMembershipId,
      });
      wx.showToast({ icon: 'success', title: '换班已提交' });
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
