import type {
  DutyAdjustmentRequest,
  GroupSummary,
  LeaveRequest,
  SwapRequest,
} from '@schedule/contracts';

import {
  acceptDutyAdjustment,
  acceptSwapRequest,
  cancelDutyAdjustment,
  cancelLeaveRequest,
  cancelSwapRequest,
  listDutyAdjustmentRequests,
  listGroups,
  listLeaveRequests,
  listSwapRequests,
  revokeDutyAdjustment,
  revokeLeaveRequest,
  revokeSwapRequest,
} from '../../api/endpoints.js';
import { getStoredToken } from '../../api/client.js';
import { getSelectedGroupId, resolveSelectedGroup, setSelectedGroupId } from '../../store/group.js';
import { randomUuid } from '../../utils/uuid.js';
import { getWorkflowStatusLabel } from '../../utils/workflow-logic.js';
import { getLeaveStatusLabel, getLeaveTypeLabel } from '../../utils/leave-logic.js';

type RequestKind = 'duty' | 'leave' | 'swap';

interface RequestRow {
  readonly actionLabel: string;
  readonly actionName: 'accept' | 'cancel' | 'revoke';
  readonly id: string;
  readonly statusLabel: string;
  readonly summary: string;
  readonly title: string;
}

interface RequestsPageData {
  readonly dutyRows: readonly RequestRow[];
  readonly errorMessage: string;
  readonly groups: readonly GroupSummary[];
  readonly kind: RequestKind;
  readonly leaveRows: readonly RequestRow[];
  readonly loading: boolean;
  readonly selectedGroupId: string;
  readonly swapRows: readonly RequestRow[];
}

Page({
  data: {
    dutyRows: [],
    errorMessage: '',
    groups: [],
    kind: 'leave',
    leaveRows: [],
    loading: false,
    selectedGroupId: '',
    swapRows: [],
  } as RequestsPageData,

  onLoad(options: Record<string, string | undefined>) {
    const kind = options.type === 'swap' || options.type === 'duty' ? options.type : 'leave';
    this.setData({ kind });
  },

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
        listLeaveRequests(selected.id),
        listSwapRequests(selected.id),
        listDutyAdjustmentRequests(selected.id),
      ]);
      this.setData({
        dutyRows: duties.map(buildDutyRow),
        groups,
        leaveRows: leaves.map(buildLeaveRow),
        selectedGroupId: selected.id,
        swapRows: swaps.map(buildSwapRow),
      });
    } catch (error) {
      this.setData({ errorMessage: toMessage(error, '申请列表加载失败。') });
    } finally {
      this.setData({ loading: false });
    }
  },

  onKindChange(event: WechatMiniprogram.CustomEvent) {
    const index = Number(event.detail.value ?? 0);
    const kind: RequestKind = index === 1 ? 'swap' : index === 2 ? 'duty' : 'leave';
    this.setData({ kind });
  },

  handleGroupChange(event: WechatMiniprogram.CustomEvent) {
    const groupId = event.detail.groupId;
    if (typeof groupId === 'string' && groupId.length > 0) {
      setSelectedGroupId(groupId);
      this.setData({ selectedGroupId: groupId });
      void this.loadAll();
    }
  },

  handleAction(event: WechatMiniprogram.TouchEvent) {
    const id = event.currentTarget.dataset.id;
    const action = event.currentTarget.dataset.action;
    const kind = this.data.kind;
    if (typeof id !== 'string' || typeof action !== 'string' || id.length === 0) {
      return;
    }
    void this.runAction(kind, id, action as RequestRow['actionName']);
  },

  async runAction(kind: RequestKind, id: string, action: RequestRow['actionName']): Promise<void> {
    const groupId = this.data.selectedGroupId;
    const confirmed = await confirmAction('确认操作', '该操作将按服务端规则校验并执行。');
    if (!confirmed) {
      return;
    }
    const operationId = randomUuid();
    this.setData({ errorMessage: '', loading: true });
    try {
      if (kind === 'leave') {
        const version = await this.leaveVersion(id);
        if (action === 'cancel') {
          await cancelLeaveRequest(groupId, id, { expectedVersion: version, operationId });
        } else {
          await revokeLeaveRequest(groupId, id, { expectedVersion: version, operationId });
        }
      } else if (kind === 'swap') {
        const version = await this.swapVersion(id);
        if (action === 'accept') {
          await acceptSwapRequest(groupId, id, { expectedVersion: version, operationId });
        } else if (action === 'cancel') {
          await cancelSwapRequest(groupId, id, { expectedVersion: version, operationId });
        } else {
          await revokeSwapRequest(groupId, id, { expectedVersion: version, operationId });
        }
      } else {
        const version = await this.dutyVersion(id);
        if (action === 'accept') {
          await acceptDutyAdjustment(groupId, id, {
            expectedVersion: version,
            operationId,
          });
        } else if (action === 'cancel') {
          await cancelDutyAdjustment(groupId, id, {
            expectedVersion: version,
            operationId,
          });
        } else {
          await revokeDutyAdjustment(groupId, id, {
            expectedVersion: version,
            operationId,
          });
        }
      }
      wx.showToast({ icon: 'success', title: '操作成功' });
      await this.loadAll();
    } catch (error) {
      this.setData({ errorMessage: toMessage(error, '操作失败。') });
    } finally {
      this.setData({ loading: false });
    }
  },

  async leaveVersion(id: string): Promise<number> {
    const groupId = this.data.selectedGroupId;
    const rows = await listLeaveRequests(groupId);
    return rows.find((row) => row.id === id)?.version ?? 1;
  },

  async swapVersion(id: string): Promise<number> {
    const groupId = this.data.selectedGroupId;
    const rows = await listSwapRequests(groupId);
    return rows.find((row) => row.id === id)?.version ?? 1;
  },

  async dutyVersion(id: string): Promise<number> {
    const groupId = this.data.selectedGroupId;
    const rows = await listDutyAdjustmentRequests(groupId);
    return rows.find((row) => row.id === id)?.version ?? 1;
  },

  openCreate() {
    const urls: Readonly<Record<RequestKind, string>> = {
      leave: '/pages/leave-create/leave-create',
      swap: '/pages/requests/swap-create',
      duty: '/pages/requests/duty-create',
    };
    wx.navigateTo({ url: urls[this.data.kind] });
  },
});

function buildLeaveRow(request: LeaveRequest): RequestRow {
  const range = `${request.startsAt.slice(0, 10)} 至 ${request.endsAt.slice(0, 10)}`;
  const canCancel = request.status === 'pending' || request.status === 'approved';
  const actionName: RequestRow['actionName'] = canCancel ? 'cancel' : 'revoke';
  return {
    actionLabel: canCancel ? '取消' : request.status === 'approved' ? '撤销' : '',
    actionName,
    id: request.id,
    statusLabel: getLeaveStatusLabel(request.status),
    summary: `${range} · ${request.reason ?? ''}`,
    title: `${getLeaveTypeLabel(request.leaveType)}申请`,
  };
}

function buildSwapRow(request: SwapRequest): RequestRow {
  const statusLabel = getWorkflowStatusLabel(request.status, '对方');
  const isTarget = request.status === 'pending_target';
  const canCancel = request.status === 'pending_approval' || request.status === 'pending_target';
  const actionName: RequestRow['actionName'] = isTarget
    ? 'accept'
    : canCancel
      ? 'cancel'
      : 'revoke';
  return {
    actionLabel: isTarget ? '接受' : canCancel ? '取消' : '撤销',
    actionName,
    id: request.id,
    statusLabel,
    summary: `${request.initiatorAssignment.businessDate} ↔ ${request.targetAssignment.businessDate}`,
    title: '换班申请',
  };
}

function buildDutyRow(request: DutyAdjustmentRequest): RequestRow {
  const statusLabel = getWorkflowStatusLabel(request.status, '加班成员');
  const isTarget = request.status === 'pending_target';
  const canCancel = request.status === 'pending_approval' || request.status === 'pending_target';
  const actionName: RequestRow['actionName'] = isTarget
    ? 'accept'
    : canCancel
      ? 'cancel'
      : 'revoke';
  return {
    actionLabel: isTarget ? '接受' : canCancel ? '取消' : '撤销',
    actionName,
    id: request.id,
    statusLabel,
    summary: `${request.coveredAssignment.businessDate} · ${request.reason ?? ''}`,
    title: '加扣班申请',
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
