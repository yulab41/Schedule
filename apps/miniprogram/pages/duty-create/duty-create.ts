import type {
  CalendarDutyAssignment,
  CalendarDutyMember,
  DutyAdjustmentPreview,
  GroupSummary,
} from '@schedule/contracts';

import {
  createDutyAdjustmentRequest,
  getCalendar,
  listGroupMembers,
  listGroups,
  previewDutyAdjustment,
} from '../../api/endpoints.js';
import { resolveSelectedGroup, setSelectedGroupId } from '../../store/group.js';
import { formatLocalDate, formatMonthLabel, shiftBusinessMonth } from '../../utils/calendar.js';
import { requestApprovalSubscription } from '../../utils/subscription.js';
import { randomUuid } from '../../utils/uuid.js';
import {
  buildMyOperableAssignments,
  formatAssignmentOption,
  getWorkflowNextStatusDescription,
} from '../../utils/workflow.js';

interface DutyCreatePageData {
  readonly businessMonth: string;
  readonly errorMessage: string;
  readonly groups: readonly GroupSummary[];
  readonly loading: boolean;
  readonly monthLabel: string;
  readonly myAssignmentLabels: readonly string[];
  readonly myAssignments: readonly CalendarDutyAssignment[];
  readonly myMembershipId: string;
  readonly overtimeNames: readonly string[];
  readonly overtimeOptions: readonly CalendarDutyMember[];
  readonly preview: DutyAdjustmentPreview | undefined;
  readonly previewLoading: boolean;
  readonly previewStatusDescription: string;
  readonly reason: string;
  readonly selectedGroupId: string;
  readonly selectedMyIndex: number;
  readonly selectedOvertimeIndex: number;
  readonly submitting: boolean;
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
    overtimeNames: [],
    overtimeOptions: [],
    preview: undefined,
    previewLoading: false,
    previewStatusDescription: '',
    reason: '',
    selectedGroupId: '',
    selectedMyIndex: 0,
    selectedOvertimeIndex: 0,
    submitting: false,
    today: '',
  } as DutyCreatePageData,

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
      const overtimeOptions = calendar.members.filter(
        (member) => member.membershipId !== myMembershipId,
      );
      this.setData({
        groups,
        myAssignmentLabels: myAssignments.map(formatAssignmentOption),
        myAssignments,
        myMembershipId,
        overtimeNames: overtimeOptions.map((member) => member.realName),
        overtimeOptions,
        selectedGroupId: selected.id,
      });
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

  handleOvertimeChange(event: WechatMiniprogram.PickerChange) {
    this.setData({ selectedOvertimeIndex: Number(event.detail.value ?? 0) });
    void this.refreshPreview();
  },

  handleReasonInput(event: WechatMiniprogram.Input) {
    this.setData({ reason: event.detail.value });
  },

  async refreshPreview(): Promise<void> {
    const myAssignment = this.data.myAssignments[this.data.selectedMyIndex];
    const overtime = this.data.overtimeOptions[this.data.selectedOvertimeIndex];
    if (myAssignment === undefined || overtime === undefined) {
      this.setData({ preview: undefined });
      return;
    }
    this.setData({ errorMessage: '', previewLoading: true });
    try {
      const preview = await previewDutyAdjustment(this.data.selectedGroupId, {
        coveredAssignmentId: myAssignment.id,
        overtimeMembershipId: overtime.membershipId,
      });
      this.setData({
        preview,
        previewStatusDescription: getWorkflowNextStatusDescription(preview.nextStatus, '加班成员'),
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
    const overtime = this.data.overtimeOptions[this.data.selectedOvertimeIndex];
    if (
      preview === undefined ||
      myAssignment === undefined ||
      overtime === undefined ||
      preview.conflicts.length > 0 ||
      this.data.submitting
    ) {
      return;
    }
    this.setData({ errorMessage: '', submitting: true });
    try {
      await requestApprovalSubscription();
      await createDutyAdjustmentRequest(this.data.selectedGroupId, {
        coveredAssignmentId: myAssignment.id,
        operationId: randomUuid(),
        overtimeMembershipId: overtime.membershipId,
        ...(this.data.reason.trim().length > 0 ? { reason: this.data.reason.trim() } : {}),
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
