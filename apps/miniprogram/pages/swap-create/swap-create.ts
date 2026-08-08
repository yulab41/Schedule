import type {
  CalendarDutyAssignment,
  CalendarDutyMember,
  GroupSummary,
  SwapPreview,
} from '@schedule/contracts';

import {
  createSwapRequest,
  getCalendar,
  listGroupMembers,
  listGroups,
  previewSwap,
} from '../../api/endpoints.js';
import { resolveSelectedGroup, setSelectedGroupId } from '../../store/group.js';
import { formatLocalDate, formatMonthLabel, shiftBusinessMonth } from '../../utils/calendar.js';
import { requestApprovalSubscription } from '../../utils/subscription.js';
import { randomUuid } from '../../utils/uuid.js';
import {
  buildMyOperableAssignments,
  formatAssignmentOption,
  getTargetOptions,
  getWorkflowNextStatusDescription,
  groupAssignmentsByDutyMember,
} from '../../utils/workflow.js';

interface SwapCreatePageData {
  readonly businessMonth: string;
  readonly errorMessage: string;
  readonly groups: readonly GroupSummary[];
  readonly loading: boolean;
  readonly monthLabel: string;
  readonly myAssignmentLabels: readonly string[];
  readonly myAssignments: readonly CalendarDutyAssignment[];
  readonly myMembershipId: string;
  readonly preview: SwapPreview | undefined;
  readonly previewLoading: boolean;
  readonly previewStatusDescription: string;
  readonly selectedGroupId: string;
  readonly selectedMyIndex: number;
  readonly selectedTargetAssignmentIndex: number;
  readonly selectedTargetIndex: number;
  readonly submitting: boolean;
  readonly targetAssignmentLabels: readonly string[];
  readonly targetAssignmentsByMember: Record<string, readonly CalendarDutyAssignment[]>;
  readonly targetNames: readonly string[];
  readonly targetOptions: readonly CalendarDutyMember[];
  readonly today: string;
}

Page({
  data: {
    businessMonth: '',
    errorMessage: '',
    groups: [],
    loading: false,
    monthLabel: '',
    myAssignmentLabels: [],
    myAssignments: [],
    myMembershipId: '',
    preview: undefined,
    previewLoading: false,
    previewStatusDescription: '',
    selectedGroupId: '',
    selectedMyIndex: 0,
    selectedTargetAssignmentIndex: 0,
    selectedTargetIndex: 0,
    submitting: false,
    targetAssignmentLabels: [],
    targetAssignmentsByMember: {},
    targetNames: [],
    targetOptions: [],
    today: '',
  } as SwapCreatePageData,

  onLoad() {
    const today = formatLocalDate(new Date());
    this.setData({
      businessMonth: today.slice(0, 7),
      monthLabel: formatMonthLabel(today.slice(0, 7)),
      today,
    });
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
      const [calendar, members] = await Promise.all([
        getCalendar(selected.id, this.data.businessMonth),
        listGroupMembers(selected.id),
      ]);
      const myMembershipId = members.find((member) => member.isCurrentUser)?.id ?? '';
      const myAssignments = buildMyOperableAssignments(
        calendar.assignments,
        myMembershipId,
        this.data.today,
      );
      const operable = calendar.assignments.filter(
        (assignment) => assignment.businessDate >= this.data.today,
      );
      const assignmentsByTarget = groupAssignmentsByDutyMember(operable);
      const targetOptions = getTargetOptions(calendar.members, myMembershipId, assignmentsByTarget);
      const targetAssignmentsByMember: Record<string, readonly CalendarDutyAssignment[]> = {};
      for (const member of targetOptions) {
        targetAssignmentsByMember[member.membershipId] =
          assignmentsByTarget.get(member.membershipId) ?? [];
      }
      this.setData({
        groups,
        myAssignmentLabels: myAssignments.map(formatAssignmentOption),
        myAssignments,
        myMembershipId,
        selectedGroupId: selected.id,
        targetAssignmentsByMember,
        targetNames: targetOptions.map((member) => member.realName),
        targetOptions,
      });
      this.updateTargetAssignmentLabels();
      await this.refreshPreview();
    } catch (error) {
      this.setData({
        errorMessage:
          error instanceof Error && error.message.length > 0
            ? error.message
            : '排班数据加载失败，请稍后重试。',
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  updateTargetAssignmentLabels(): void {
    const target = this.data.targetOptions[this.data.selectedTargetIndex];
    const targetAssignments =
      target === undefined ? [] : (this.data.targetAssignmentsByMember[target.membershipId] ?? []);
    this.setData({
      targetAssignmentLabels: targetAssignments.map(formatAssignmentOption),
    });
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

  changeMonth(event: WechatMiniprogram.TouchEvent): void {
    if (this.data.loading) {
      return;
    }
    const delta = Number(event.currentTarget.dataset.delta ?? 0);
    if (!Number.isInteger(delta)) {
      return;
    }
    const businessMonth = shiftBusinessMonth(this.data.businessMonth, delta);
    this.setData({
      businessMonth,
      monthLabel: formatMonthLabel(businessMonth),
    });
    void this.loadData();
  },

  handleMyAssignmentChange(event: WechatMiniprogram.PickerChange) {
    this.setData({ selectedMyIndex: Number(event.detail.value ?? 0) });
    void this.refreshPreview();
  },

  handleTargetChange(event: WechatMiniprogram.PickerChange) {
    this.setData({
      selectedTargetAssignmentIndex: 0,
      selectedTargetIndex: Number(event.detail.value ?? 0),
    });
    this.updateTargetAssignmentLabels();
    void this.refreshPreview();
  },

  handleTargetAssignmentChange(event: WechatMiniprogram.PickerChange) {
    this.setData({ selectedTargetAssignmentIndex: Number(event.detail.value ?? 0) });
    void this.refreshPreview();
  },

  async refreshPreview(): Promise<void> {
    const myAssignment = this.data.myAssignments[this.data.selectedMyIndex];
    const target = this.data.targetOptions[this.data.selectedTargetIndex];
    if (myAssignment === undefined || target === undefined) {
      this.setData({ preview: undefined });
      return;
    }
    const targetAssignments = this.data.targetAssignmentsByMember[target.membershipId] ?? [];
    const targetAssignment = targetAssignments[this.data.selectedTargetAssignmentIndex];
    if (targetAssignment === undefined) {
      this.setData({ preview: undefined });
      return;
    }
    this.setData({ errorMessage: '', previewLoading: true });
    try {
      const preview = await previewSwap(this.data.selectedGroupId, {
        initiatorAssignmentId: myAssignment.id,
        targetAssignmentId: targetAssignment.id,
        targetMembershipId: target.membershipId,
      });
      this.setData({
        preview,
        previewStatusDescription: getWorkflowNextStatusDescription(preview.nextStatus, '对方'),
      });
    } catch (error) {
      this.setData({
        preview: undefined,
        previewStatusDescription: '',
        errorMessage: toErrorMessage(error),
      });
    } finally {
      this.setData({ previewLoading: false });
    }
  },

  async handleSubmit(): Promise<void> {
    const preview = this.data.preview;
    const myAssignment = this.data.myAssignments[this.data.selectedMyIndex];
    const target = this.data.targetOptions[this.data.selectedTargetIndex];
    if (
      preview === undefined ||
      myAssignment === undefined ||
      target === undefined ||
      preview.conflicts.length > 0 ||
      this.data.submitting
    ) {
      return;
    }
    const targetAssignments = this.data.targetAssignmentsByMember[target.membershipId] ?? [];
    const targetAssignment = targetAssignments[this.data.selectedTargetAssignmentIndex];
    if (targetAssignment === undefined) {
      return;
    }
    this.setData({ errorMessage: '', submitting: true });
    try {
      await requestApprovalSubscription();
      await createSwapRequest(this.data.selectedGroupId, {
        initiatorAssignmentId: myAssignment.id,
        operationId: randomUuid(),
        targetAssignmentId: targetAssignment.id,
        targetMembershipId: target.membershipId,
      });
      wx.showToast({ icon: 'success', title: '已提交申请' });
      setTimeout(() => {
        wx.navigateBack();
      }, 600);
    } catch (error) {
      this.setData({ errorMessage: toErrorMessage(error) });
    } finally {
      this.setData({ submitting: false });
    }
  },
});

function toErrorMessage(error: unknown): string {
  return error instanceof Error && error.message.length > 0
    ? error.message
    : '操作失败，请稍后重试。';
}
