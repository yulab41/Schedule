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
import { getStoredToken } from '../../api/client.js';
import { getSelectedGroupId, resolveSelectedGroup, setSelectedGroupId } from '../../store/group.js';
import { randomUuid } from '../../utils/uuid.js';
import { getLeaveStatusLabel, getLeaveTypeLabel } from '../../utils/leave-logic.js';
import { getSwapStatusLabel } from '../../utils/swap-logic.js';
import { getDutyAdjustmentStatusLabel } from '../../utils/duty-adjustment-logic.js';

type ApprovalKind = 'duty' | 'leave' | 'swap';

interface ApprovalRow {
  readonly id: string;
  readonly kind: ApprovalKind;
  readonly statusLabel: string;
  readonly summary: string;
  readonly title: string;
  readonly version: number;
}

interface ApprovalsPageData {
  readonly errorMessage: string;
  readonly groups: readonly GroupSummary[];
  readonly kind: ApprovalKind;
  readonly loading: boolean;
  readonly rows: readonly ApprovalRow[];
  readonly selectedGroupId: string;
  readonly visibleRows: readonly ApprovalRow[];
}

Page({
  data: {
    errorMessage: '',
    groups: [],
    kind: 'leave',
    loading: false,
    rows: [],
    selectedGroupId: '',
    visibleRows: [],
  } as ApprovalsPageData,

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
        this.setData({ groups, errorMessage: '请先加入一个群组。' });
        return;
      }
      setSelectedGroupId(selected.id);
      const [leaves, swaps, duties] = await Promise.all([
        listLeaveRequestApprovals(selected.id),
        listSwapApprovals(selected.id),
        listDutyAdjustmentApprovals(selected.id),
      ]);
      this.setData({
        groups,
        rows: [
          ...leaves.map(buildLeaveRow),
          ...swaps.map(buildSwapRow),
          ...duties.map(buildDutyRow),
        ],
        selectedGroupId: selected.id,
        visibleRows: [
          ...leaves.map(buildLeaveRow),
          ...swaps.map(buildSwapRow),
          ...duties.map(buildDutyRow),
        ].filter((row) => row.kind === this.data.kind),
      });
    } catch (error) {
      this.setData({ errorMessage: toMessage(error, '审批列表加载失败。') });
    } finally {
      this.setData({ loading: false });
    }
  },

  onKindChange(event: WechatMiniprogram.CustomEvent) {
    const index = Number(event.detail.value ?? 0);
    const kind: ApprovalKind = index === 1 ? 'swap' : index === 2 ? 'duty' : 'leave';
    this.setData({
      kind,
      visibleRows: this.data.rows.filter((row) => row.kind === kind),
    });
  },

  handleGroupChange(event: WechatMiniprogram.CustomEvent) {
    const groupId = event.detail.groupId;
    if (typeof groupId === 'string' && groupId.length > 0) {
      setSelectedGroupId(groupId);
      this.setData({ selectedGroupId: groupId });
      void this.loadAll();
    }
  },

  async handleDecide(event: WechatMiniprogram.TouchEvent): Promise<void> {
    const id = event.currentTarget.dataset.id;
    const decision = event.currentTarget.dataset.decision;
    const row = this.data.rows.find((item) => item.id === id);
    if (
      row === undefined ||
      (decision !== 'approve' && decision !== 'reject') ||
      this.data.selectedGroupId.length === 0
    ) {
      return;
    }
    const confirmed = await confirmAction(
      decision === 'approve' ? '批准申请' : '驳回申请',
      decision === 'approve' ? '批准后变更将生效，请确认影响。' : '驳回后申请将关闭。',
    );
    if (!confirmed) {
      return;
    }
    this.setData({ errorMessage: '', loading: true });
    try {
      if (row.kind === 'leave') {
        await this.decideLeave(row, decision as 'approve' | 'reject');
      } else if (row.kind === 'swap') {
        const operationId = randomUuid();
        if (decision === 'approve') {
          await approveSwapRequest(this.data.selectedGroupId, row.id, {
            expectedVersion: row.version,
            operationId,
          });
        } else {
          await rejectSwapRequest(this.data.selectedGroupId, row.id, {
            expectedVersion: row.version,
            operationId,
          });
        }
      } else {
        const operationId = randomUuid();
        if (decision === 'approve') {
          await approveDutyAdjustment(this.data.selectedGroupId, row.id, {
            expectedVersion: row.version,
            operationId,
          });
        } else {
          await rejectDutyAdjustment(this.data.selectedGroupId, row.id, {
            expectedVersion: row.version,
            operationId,
          });
        }
      }
      wx.showToast({ icon: 'success', title: decision === 'approve' ? '已批准' : '已驳回' });
      await this.loadAll();
    } catch (error) {
      this.setData({ errorMessage: toMessage(error, '审批操作失败。') });
    } finally {
      this.setData({ loading: false });
    }
  },

  async decideLeave(row: ApprovalRow, decision: 'approve' | 'reject'): Promise<void> {
    const groupId = this.data.selectedGroupId;
    const operationId = randomUuid();
    if (decision === 'reject') {
      await rejectLeaveRequest(groupId, row.id, {
        expectedVersion: row.version,
        operationId,
      });
      return;
    }
    const preview = await previewLeaveRequestApproval(groupId, row.id, 'keep-original-order');
    await approveLeaveRequest(groupId, row.id, {
      acknowledgeBlockers: true,
      expectedPeriodVersions: preview.periodVersions,
      expectedRulesVersion: preview.rulesVersion,
      expectedVersion: row.version,
      operationId,
      strategy: preview.strategy,
    });
  },
});

function buildLeaveRow(request: LeaveRequest): ApprovalRow {
  return {
    id: request.id,
    kind: 'leave',
    statusLabel: getLeaveStatusLabel(request.status),
    summary: `${getLeaveTypeLabel(request.leaveType)} · ${request.startsAt.slice(0, 10)} 至 ${request.endsAt.slice(0, 10)}`,
    title: `${request.memberName ?? ''} 的请假申请`,
    version: request.version,
  };
}

function buildSwapRow(request: SwapRequest): ApprovalRow {
  return {
    id: request.id,
    kind: 'swap',
    statusLabel: getSwapStatusLabel(request.status),
    summary: `${request.initiatorMemberName ?? ''} ↔ ${request.targetMemberName ?? ''}`,
    title: '换班申请',
    version: request.version,
  };
}

function buildDutyRow(request: DutyAdjustmentRequest): ApprovalRow {
  return {
    id: request.id,
    kind: 'duty',
    statusLabel: getDutyAdjustmentStatusLabel(request.status),
    summary: `${request.deductedMemberName ?? ''} 由 ${request.overtimeMemberName ?? ''} 代值`,
    title: '加扣班申请',
    version: request.version,
  };
}

function confirmAction(title: string, content: string): Promise<boolean> {
  return new Promise((resolve) => {
    wx.showModal({
      cancelText: '取消',
      confirmText: '确认',
      content,
      success: (result) => resolve(result.confirm),
      fail: () => resolve(false),
      title,
    });
  });
}

function toMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.length > 0 ? error.message : fallback;
}
