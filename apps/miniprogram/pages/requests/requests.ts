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
  listGroupMembers,
  listGroups,
  listLeaveRequests,
  listSwapRequests,
  revokeDutyAdjustment,
  revokeLeaveRequest,
  revokeSwapRequest,
} from '../../api/endpoints.js';
import { resolveSelectedGroup, setSelectedGroupId } from '../../store/group.js';
import { formatChinaDateShort, formatChinaTime, formatLeaveRange } from '../../utils/time.js';
import { randomUuid } from '../../utils/uuid.js';
import {
  getWorkflowStatusLabel,
  leaveStatusLabels,
  leaveTypeLabels,
} from '../../utils/workflow.js';

type RequestKind = 'duty' | 'leave' | 'swap';

interface RequestRow {
  readonly canAccept: boolean;
  readonly canCancel: boolean;
  readonly canRevoke: boolean;
  readonly detail: string;
  readonly id: string;
  readonly kind: RequestKind;
  readonly statusLabel: string;
  readonly title: string;
  readonly version: number;
}

interface RequestsPageData {
  readonly dutyRequests: readonly RequestRow[];
  readonly errorMessage: string;
  readonly groups: readonly GroupSummary[];
  readonly leaveRequests: readonly RequestRow[];
  readonly loading: boolean;
  readonly selectedGroupId: string;
  readonly swapRequests: readonly RequestRow[];
}

Page({
  data: {
    dutyRequests: [],
    errorMessage: '',
    groups: [],
    leaveRequests: [],
    loading: false,
    selectedGroupId: '',
    swapRequests: [],
  } as RequestsPageData,

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
        await this.loadRequests();
      } else {
        this.setData({ leaveRequests: [], swapRequests: [], dutyRequests: [] });
      }
    } catch (error) {
      this.setData({
        errorMessage:
          error instanceof Error && error.message.length > 0
            ? error.message
            : '申请数据加载失败，请稍后重试。',
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadRequests(): Promise<void> {
    const groupId = this.data.selectedGroupId;
    if (groupId.length === 0) {
      return;
    }
    this.setData({ errorMessage: '', loading: true });
    try {
      const [members, leaves, swaps, duties] = await Promise.all([
        listGroupMembers(groupId),
        listLeaveRequests(groupId),
        listSwapRequests(groupId),
        listDutyAdjustmentRequests(groupId),
      ]);
      const myMembershipId = members.find((member) => member.isCurrentUser)?.id;
      this.setData({
        dutyRequests: duties.map((request) => buildDutyRow(request, myMembershipId)),
        leaveRequests: leaves.map((request) => buildLeaveRow(request)),
        swapRequests: swaps.map((request) => buildSwapRow(request, myMembershipId)),
      });
    } catch (error) {
      this.setData({
        errorMessage:
          error instanceof Error && error.message.length > 0
            ? error.message
            : '申请数据加载失败，请稍后重试。',
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
    void this.loadRequests();
  },

  openLeaveCreate(): void {
    wx.navigateTo({ url: '/pages/leave-create/leave-create' });
  },

  openSwapCreate(): void {
    wx.navigateTo({ url: '/pages/swap-create/swap-create' });
  },

  openDutyCreate(): void {
    wx.navigateTo({ url: '/pages/duty-create/duty-create' });
  },

  handleAccept(event: WechatMiniprogram.TouchEvent) {
    const id = event.currentTarget.dataset.id;
    const kind = event.currentTarget.dataset.kind;
    const version = Number(event.currentTarget.dataset.version ?? 0);
    if (typeof id !== 'string' || typeof kind !== 'string' || !Number.isInteger(version)) {
      return;
    }
    void this.performAction(kind as RequestKind, id, version, 'accept');
  },

  handleCancel(event: WechatMiniprogram.TouchEvent) {
    const id = event.currentTarget.dataset.id;
    const kind = event.currentTarget.dataset.kind;
    const version = Number(event.currentTarget.dataset.version ?? 0);
    if (typeof id !== 'string' || typeof kind !== 'string' || !Number.isInteger(version)) {
      return;
    }
    void this.performAction(kind as RequestKind, id, version, 'cancel');
  },

  handleRevoke(event: WechatMiniprogram.TouchEvent) {
    const id = event.currentTarget.dataset.id;
    const kind = event.currentTarget.dataset.kind;
    const version = Number(event.currentTarget.dataset.version ?? 0);
    if (typeof id !== 'string' || typeof kind !== 'string' || !Number.isInteger(version)) {
      return;
    }
    void this.performAction(kind as RequestKind, id, version, 'revoke');
  },

  async performAction(
    kind: RequestKind,
    id: string,
    version: number,
    action: 'accept' | 'cancel' | 'revoke',
  ): Promise<void> {
    const confirmed = await confirmAction(action);
    if (!confirmed) {
      return;
    }
    const groupId = this.data.selectedGroupId;
    this.setData({ errorMessage: '', loading: true });
    try {
      const mutation = { expectedVersion: version, operationId: randomUuid() };
      switch (kind) {
        case 'leave':
          if (action === 'cancel') {
            await cancelLeaveRequest(groupId, id, mutation);
          } else if (action === 'revoke') {
            await revokeLeaveRequest(groupId, id, mutation);
          }
          break;
        case 'swap':
          if (action === 'accept') {
            await acceptSwapRequest(groupId, id, mutation);
          } else if (action === 'cancel') {
            await cancelSwapRequest(groupId, id, mutation);
          } else if (action === 'revoke') {
            await revokeSwapRequest(groupId, id, mutation);
          }
          break;
        case 'duty':
          if (action === 'accept') {
            await acceptDutyAdjustment(groupId, id, mutation);
          } else if (action === 'cancel') {
            await cancelDutyAdjustment(groupId, id, mutation);
          } else if (action === 'revoke') {
            await revokeDutyAdjustment(groupId, id, mutation);
          }
          break;
      }
      wx.showToast({ icon: 'success', title: '操作成功' });
      await this.loadRequests();
    } catch (error) {
      this.setData({
        errorMessage:
          error instanceof Error && error.message.length > 0
            ? error.message
            : '操作失败，请稍后重试。',
      });
    } finally {
      this.setData({ loading: false });
    }
  },
});

function buildLeaveRow(request: LeaveRequest): RequestRow {
  return {
    canAccept: false,
    canCancel: request.status === 'pending',
    canRevoke: request.status === 'approved' && request.isRevocable === true,
    detail: formatLeaveRange(request.startsAt, request.endsAt),
    id: request.id,
    kind: 'leave',
    statusLabel: leaveStatusLabels[request.status],
    title: `${leaveTypeLabels[request.leaveType]}请假`,
    version: request.version,
  };
}

function buildSwapRow(request: SwapRequest, myMembershipId: string | undefined): RequestRow {
  const assignment = request.initiatorAssignment;
  const date = formatChinaDateShort(assignment.businessDate);
  const time = `${formatChinaTime(assignment.startsAt)}–${formatChinaTime(assignment.endsAt)}`;
  return {
    canAccept: request.status === 'pending_target' && request.targetMembershipId === myMembershipId,
    canCancel:
      (request.status === 'pending_target' || request.status === 'pending_approval') &&
      request.initiatorMembershipId === myMembershipId,
    canRevoke: request.status === 'completed' && request.isRevocable === true,
    detail: `${date} ${time} ${assignment.shiftTypeName}：${request.initiatorMemberName ?? ''} ↔ ${
      request.targetMemberName ?? ''
    }`,
    id: request.id,
    kind: 'swap',
    statusLabel: getWorkflowStatusLabel(request.status, '对方'),
    title: '换班',
    version: request.version,
  };
}

function buildDutyRow(
  request: DutyAdjustmentRequest,
  myMembershipId: string | undefined,
): RequestRow {
  const assignment = request.coveredAssignment;
  const date = formatChinaDateShort(assignment.businessDate);
  const time = `${formatChinaTime(assignment.startsAt)}–${formatChinaTime(assignment.endsAt)}`;
  return {
    canAccept:
      request.status === 'pending_target' && request.overtimeMembershipId === myMembershipId,
    canCancel:
      (request.status === 'pending_target' || request.status === 'pending_approval') &&
      request.deductedMembershipId === myMembershipId,
    canRevoke: request.status === 'completed' && request.isRevocable === true,
    detail: `${date} ${time} ${assignment.shiftTypeName}：${
      request.deductedMemberName ?? ''
    } 的班次由 ${request.overtimeMemberName ?? ''} 代值`,
    id: request.id,
    kind: 'duty',
    statusLabel: getWorkflowStatusLabel(request.status, '加班成员'),
    title: '加扣班',
    version: request.version,
  };
}

function confirmAction(action: 'accept' | 'cancel' | 'revoke'): Promise<boolean> {
  const title = action === 'accept' ? '确认接受' : action === 'cancel' ? '确认取消' : '确认撤销';
  const content =
    action === 'accept'
      ? '确认接受该申请吗？'
      : action === 'cancel'
        ? '确认取消该申请吗？'
        : '确认撤销已生效的申请吗？撤销后按规则恢复班次。';
  return new Promise((resolve) => {
    wx.showModal({
      cancelText: '再想想',
      confirmText: '确认',
      content,
      success: (result) => resolve(result.confirm),
      fail: () => resolve(false),
      title,
    });
  });
}
