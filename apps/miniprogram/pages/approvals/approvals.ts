import type {
  DutyAdjustmentRequest,
  GroupSummary,
  LeaveRequest,
  SwapRequest,
} from '@schedule/contracts';

import {
  approveDutyAdjustment,
  approveLeaveRequest,
  approveSwapRequest,
  listDutyAdjustmentApprovals,
  listGroups,
  listLeaveRequestApprovals,
  listSwapApprovals,
  previewLeaveRequestApproval,
  rejectDutyAdjustment,
  rejectLeaveRequest,
  rejectSwapRequest,
} from '../../api/endpoints.js';
import { resolveSelectedGroup, setSelectedGroupId } from '../../store/group.js';
import { formatChinaDateShort, formatChinaTime, formatLeaveRange } from '../../utils/time.js';
import { randomUuid } from '../../utils/uuid.js';
import { requestStatusChangeSubscription } from '../../utils/subscription.js';
import {
  getWorkflowStatusLabel,
  leaveStatusLabels,
  leaveTypeLabels,
} from '../../utils/workflow.js';

type ApprovalKind = 'duty' | 'leave' | 'swap';

interface ApprovalRow {
  readonly detail: string;
  readonly id: string;
  readonly isPending: boolean;
  readonly kind: ApprovalKind;
  readonly statusLabel: string;
  readonly title: string;
  readonly version: number;
}

interface LeaveApprovalPreview {
  readonly affectedShiftCount: number;
  readonly conflictsCount: number;
  readonly expectedPeriodVersions: Readonly<Record<string, number>>;
  readonly expectedRulesVersion: number;
  readonly expectedVersion: number;
  readonly overlapsUnpublishedPeriod: boolean;
  readonly requestId: string;
  readonly strategy: 'keep-original-order' | 'shift-forward';
  readonly vacanciesCount: number;
  readonly workflowBlockerCount: number;
}

interface ApprovalsPageData {
  readonly dutyApprovals: readonly ApprovalRow[];
  readonly errorMessage: string;
  readonly groups: readonly GroupSummary[];
  readonly leaveApprovals: readonly ApprovalRow[];
  readonly leavePreview: LeaveApprovalPreview | undefined;
  readonly leavePreviewLoading: boolean;
  readonly loading: boolean;
  readonly selectedGroupId: string;
  readonly submitting: boolean;
  readonly swapApprovals: readonly ApprovalRow[];
}

Page({
  data: {
    dutyApprovals: [],
    errorMessage: '',
    groups: [],
    leaveApprovals: [],
    leavePreview: undefined,
    leavePreviewLoading: false,
    loading: false,
    selectedGroupId: '',
    submitting: false,
    swapApprovals: [],
  } as ApprovalsPageData,

  onShow() {
    void this.loadGroups();
  },

  async loadGroups(): Promise<void> {
    this.setData({ errorMessage: '', loading: true });
    try {
      const groups = await listGroups();
      const selected = resolveSelectedGroup(groups);
      this.setData({
        groups,
        selectedGroupId: selected?.id ?? '',
      });
      if (selected !== undefined) {
        setSelectedGroupId(selected.id);
        await this.loadApprovals();
      } else {
        this.setData({ leaveApprovals: [], swapApprovals: [], dutyApprovals: [] });
      }
    } catch (error) {
      this.setData({ errorMessage: toErrorMessage(error) });
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadApprovals(): Promise<void> {
    const groupId = this.data.selectedGroupId;
    if (groupId.length === 0) {
      return;
    }
    this.setData({ errorMessage: '', loading: true });
    try {
      const [leaves, swaps, duties] = await Promise.all([
        listLeaveRequestApprovals(groupId),
        listSwapApprovals(groupId),
        listDutyAdjustmentApprovals(groupId),
      ]);
      this.setData({
        dutyApprovals: duties.map(buildDutyRow),
        leaveApprovals: leaves.map(buildLeaveRow),
        swapApprovals: swaps.map(buildSwapRow),
      });
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
    void this.loadApprovals();
  },

  async handlePreviewLeave(event: WechatMiniprogram.TouchEvent) {
    const id = event.currentTarget.dataset.id;
    if (typeof id !== 'string' || this.data.leavePreviewLoading) {
      return;
    }
    const request = this.data.leaveApprovals.find((item) => item.id === id);
    if (request === undefined) {
      return;
    }
    this.setData({ errorMessage: '', leavePreviewLoading: true });
    try {
      const preview = await previewLeaveRequestApproval(
        this.data.selectedGroupId,
        id,
        'keep-original-order',
      );
      this.setData({
        leavePreview: {
          affectedShiftCount: preview.affectedShiftCount ?? 0,
          conflictsCount: preview.conflicts.length,
          expectedPeriodVersions: preview.periodVersions,
          expectedRulesVersion: preview.rulesVersion,
          expectedVersion: preview.leaveRequestVersion,
          overlapsUnpublishedPeriod: preview.overlapsUnpublishedPeriod === true,
          requestId: id,
          strategy: preview.strategy,
          vacanciesCount: preview.vacancies.length,
          workflowBlockerCount: preview.workflowBlockers.length,
        },
      });
    } catch (error) {
      this.setData({ errorMessage: toErrorMessage(error) });
    } finally {
      this.setData({ leavePreviewLoading: false });
    }
  },

  closeLeavePreview(): void {
    this.setData({ leavePreview: undefined });
  },

  async handleApproveLeave(): Promise<void> {
    const preview = this.data.leavePreview;
    const request =
      preview === undefined
        ? undefined
        : this.data.leaveApprovals.find((item) => item.id === preview.requestId);
    if (preview === undefined || request === undefined || this.data.submitting) {
      return;
    }
    const confirmed = await confirmAction('确认批准该请假并按预览重排吗？');
    if (!confirmed) {
      return;
    }
    this.setData({ errorMessage: '', submitting: true });
    try {
      await requestStatusChangeSubscription();
      await approveLeaveRequest(this.data.selectedGroupId, request.id, {
        ...(preview.workflowBlockerCount > 0 || preview.conflictsCount > 0
          ? { acknowledgeBlockers: true }
          : {}),
        expectedPeriodVersions: preview.expectedPeriodVersions,
        expectedRulesVersion: preview.expectedRulesVersion,
        expectedVersion: preview.expectedVersion,
        operationId: randomUuid(),
        strategy: preview.strategy,
      });
      wx.showToast({ icon: 'success', title: '已批准' });
      this.setData({ leavePreview: undefined });
      await this.loadApprovals();
    } catch (error) {
      this.setData({ errorMessage: toErrorMessage(error) });
    } finally {
      this.setData({ submitting: false });
    }
  },

  async handleReject(event: WechatMiniprogram.TouchEvent) {
    const kind = event.currentTarget.dataset.kind as ApprovalKind | undefined;
    const id = event.currentTarget.dataset.id;
    const version = Number(event.currentTarget.dataset.version ?? 0);
    if (kind === undefined || typeof id !== 'string' || !Number.isInteger(version)) {
      return;
    }
    const confirmed = await confirmAction('确认驳回该申请吗？');
    if (!confirmed || this.data.submitting) {
      return;
    }
    this.setData({ errorMessage: '', submitting: true });
    try {
      await requestStatusChangeSubscription();
      const mutation = { expectedVersion: version, operationId: randomUuid() };
      switch (kind) {
        case 'leave':
          await rejectLeaveRequest(this.data.selectedGroupId, id, mutation);
          break;
        case 'swap':
          await rejectSwapRequest(this.data.selectedGroupId, id, mutation);
          break;
        case 'duty':
          await rejectDutyAdjustment(this.data.selectedGroupId, id, mutation);
          break;
      }
      wx.showToast({ icon: 'success', title: '已驳回' });
      await this.loadApprovals();
    } catch (error) {
      this.setData({ errorMessage: toErrorMessage(error) });
    } finally {
      this.setData({ submitting: false });
    }
  },

  async handleApprove(event: WechatMiniprogram.TouchEvent) {
    const kind = event.currentTarget.dataset.kind as 'duty' | 'swap' | undefined;
    const id = event.currentTarget.dataset.id;
    const version = Number(event.currentTarget.dataset.version ?? 0);
    if (kind === undefined || typeof id !== 'string' || !Number.isInteger(version)) {
      return;
    }
    const confirmed = await confirmAction('确认批准该申请吗？');
    if (!confirmed || this.data.submitting) {
      return;
    }
    this.setData({ errorMessage: '', submitting: true });
    try {
      await requestStatusChangeSubscription();
      const mutation = { expectedVersion: version, operationId: randomUuid() };
      if (kind === 'swap') {
        await approveSwapRequest(this.data.selectedGroupId, id, mutation);
      } else {
        await approveDutyAdjustment(this.data.selectedGroupId, id, mutation);
      }
      wx.showToast({ icon: 'success', title: '已批准' });
      await this.loadApprovals();
    } catch (error) {
      this.setData({ errorMessage: toErrorMessage(error) });
    } finally {
      this.setData({ submitting: false });
    }
  },

  noop(): void {
    // Intentionally empty: stops tap propagation from the modal body.
  },
});

function buildLeaveRow(request: LeaveRequest): ApprovalRow {
  return {
    detail: `${request.memberName ?? ''} · ${formatLeaveRange(request.startsAt, request.endsAt)}`,
    id: request.id,
    isPending: request.status === 'pending',
    kind: 'leave',
    statusLabel: leaveStatusLabels[request.status],
    title: `${leaveTypeLabels[request.leaveType]}请假`,
    version: request.version,
  };
}

function buildSwapRow(request: SwapRequest): ApprovalRow {
  const assignment = request.initiatorAssignment;
  return {
    detail: `${formatChinaDateShort(assignment.businessDate)} ${formatChinaTime(
      assignment.startsAt,
    )}–${formatChinaTime(assignment.endsAt)} ${assignment.shiftTypeName}：${
      request.initiatorMemberName ?? ''
    } ↔ ${request.targetMemberName ?? ''}`,
    id: request.id,
    isPending: request.status === 'pending_approval',
    kind: 'swap',
    statusLabel: getWorkflowStatusLabel(request.status, '对方'),
    title: '换班',
    version: request.version,
  };
}

function buildDutyRow(request: DutyAdjustmentRequest): ApprovalRow {
  const assignment = request.coveredAssignment;
  return {
    detail: `${formatChinaDateShort(assignment.businessDate)} ${formatChinaTime(
      assignment.startsAt,
    )}–${formatChinaTime(assignment.endsAt)} ${assignment.shiftTypeName}：${
      request.deductedMemberName ?? ''
    } 的班次由 ${request.overtimeMemberName ?? ''} 代值`,
    id: request.id,
    isPending: request.status === 'pending_approval',
    kind: 'duty',
    statusLabel: getWorkflowStatusLabel(request.status, '加班成员'),
    title: '加扣班',
    version: request.version,
  };
}

function confirmAction(content: string): Promise<boolean> {
  return new Promise((resolve) => {
    wx.showModal({
      cancelText: '再想想',
      confirmText: '确认',
      content,
      fail: () => resolve(false),
      success: (result) => resolve(result.confirm),
      title: '确认操作',
    });
  });
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error && error.message.length > 0
    ? error.message
    : '操作失败，请稍后重试。';
}
