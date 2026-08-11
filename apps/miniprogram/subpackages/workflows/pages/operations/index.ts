import {
  acceptDutyAdjustment,
  acceptSwapRequest,
  approveDutyAdjustment,
  approveSwapRequest,
  cancelDutyAdjustment,
  cancelSwapRequest,
  createDirectDutyAdjustment,
  createDirectSwapRequest,
  createDutyAdjustmentRequest,
  createSwapRequest,
  getCalendar,
  getGroupDutyAdjustmentSettings,
  getGroupSwapSettings,
  getMyDutyAdjustmentSettings,
  getMySwapSettings,
  listDutyAdjustmentApprovals,
  listDutyAdjustmentRequests,
  listGroupMembers,
  listSwapApprovals,
  listSwapRequests,
  previewDutyAdjustment,
  previewSwap,
  rejectDutyAdjustment,
  rejectSwapRequest,
  revokeDutyAdjustment,
  revokeSwapRequest,
  updateGroupDutyAdjustmentSettings,
  updateGroupSwapSettings,
  updateMySwapSettings,
} from '../../../../api/endpoints.js';
import { navigateForCurrentSession } from '../../../../features/auth/auth-runtime.js';
import { createLeaveWorkflowOperationId } from '../../../../features/workflows/leave-workflow.js';
import type { WorkflowActions } from '../../../../features/workflows/workflow-actions.js';
import {
  createSwapDutyWorkflowController,
  type SwapDutyWorkflowController,
  type SwapDutyWorkflowState,
} from '../../../../features/workflows/swap-duty-workflow.js';
import {
  resolveWorkflowRouteContext,
  type WorkflowRouteContext,
} from '../../../../features/navigation/workbench-navigation.js';
import { getCalendarCacheRuntime } from '../../../../store/calendar-cache-runtime.js';
import { sessionStore } from '../../../../store/session.js';

interface RequestViewItem {
  readonly actions: WorkflowActions;
  readonly decidedByMemberName?: string;
  readonly id: string;
  readonly isRevocable?: boolean;
  readonly revocationBlockedReason?: string;
  readonly status: string;
}

interface OperationsPageData {
  readonly dutyItems: readonly RequestViewItem[];
  readonly groupName: string;
  readonly hasWorkflowAccess: boolean;
  readonly isAdministrator: boolean;
  readonly swapItems: readonly RequestViewItem[];
  readonly workflow: SwapDutyWorkflowState | undefined;
}

type PickerEvent = WechatMiniprogram.PickerChange;
type InputEvent = WechatMiniprogram.Input;
type SwitchEvent = WechatMiniprogram.SwitchChange;
type ActionEvent = WechatMiniprogram.BaseEvent<
  Record<string, never>,
  { readonly action?: unknown; readonly domain?: unknown; readonly id?: unknown }
>;

interface OperationsPageMethods {
  context?: WorkflowRouteContext;
  controller?: SwapDutyWorkflowController;
  handleAction(event: ActionEvent): void;
  handleDutyCovered(event: PickerEvent): void;
  handleDutyDirect(): void;
  handleDutyOvertime(event: PickerEvent): void;
  handleDutyReason(event: InputEvent): void;
  handleDutySubmit(): void;
  handleDutySetting(event: SwitchEvent): void;
  handleMemberSetting(event: SwitchEvent): void;
  handleMonth(event: PickerEvent): void;
  handleSwapDirect(): void;
  handleSwapInitiator(event: PickerEvent): void;
  handleSwapSubmit(): void;
  handleSwapSetting(event: SwitchEvent): void;
  handleSwapTarget(event: PickerEvent): void;
  confirm(title: string, content: string, action: () => Promise<unknown>): void;
  refresh(): void;
  selectedGroupId?: string;
  sync(): void;
}

function pickerIndex(value: unknown, count: number): number | undefined {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)$/u.test(value)) return undefined;
  const index = Number(value);
  return index >= 0 && index < count ? index : undefined;
}

function actionData(
  event: ActionEvent,
): { action: string; domain: string; id: string } | undefined {
  const { action, domain, id } = event.currentTarget?.dataset ?? {};
  return typeof action === 'string' && typeof domain === 'string' && typeof id === 'string'
    ? { action, domain, id }
    : undefined;
}

Page<OperationsPageData, OperationsPageMethods>({
  data: {
    dutyItems: [],
    groupName: '',
    hasWorkflowAccess: false,
    isAdministrator: false,
    swapItems: [],
    workflow: undefined,
  },
  onLoad(options): void {
    this.selectedGroupId = typeof options.groupId === 'string' ? options.groupId : undefined;
    this.controller = createSwapDutyWorkflowController({
      acceptDutyAdjustment,
      acceptSwapRequest,
      approveDutyAdjustment,
      approveSwapRequest,
      cancelDutyAdjustment,
      cancelSwapRequest,
      createDirectDutyAdjustment,
      createDirectSwapRequest,
      createDutyAdjustmentRequest,
      createOperationId: createLeaveWorkflowOperationId,
      createSwapRequest,
      getCalendar,
      getGroupDutyAdjustmentSettings,
      getGroupSwapSettings,
      getMyDutyAdjustmentSettings,
      getMySwapSettings,
      invalidateCalendarMonth: (identity) => getCalendarCacheRuntime().invalidate(identity),
      listDutyAdjustmentApprovals,
      listDutyAdjustmentRequests,
      listGroupMembers,
      listSwapApprovals,
      listSwapRequests,
      previewDutyAdjustment,
      previewSwap,
      rejectDutyAdjustment,
      rejectSwapRequest,
      revokeDutyAdjustment,
      revokeSwapRequest,
      updateGroupDutyAdjustmentSettings,
      updateGroupSwapSettings,
      updateMySwapSettings,
      publish: () => this.sync(),
    });
  },
  onShow(): void {
    this.refresh();
  },
  sync(): void {
    const workflow = this.controller?.state;
    if (workflow === undefined) return;
    const swapItems = [...workflow.swap.requests, ...workflow.swap.approvals].map((request) => ({
      actions: this.controller!.getSwapActions(request),
      decidedByMemberName: request.decidedByMemberName,
      id: request.id,
      isRevocable: request.isRevocable,
      revocationBlockedReason: request.revocationBlockedReason,
      status: request.status,
    }));
    const dutyItems = [...workflow.duty.requests, ...workflow.duty.approvals].map((request) => ({
      actions: this.controller!.getDutyActions(request),
      decidedByMemberName: request.decidedByMemberName,
      id: request.id,
      isRevocable: request.isRevocable,
      revocationBlockedReason: request.revocationBlockedReason,
      status: request.status,
    }));
    this.setData({ dutyItems, swapItems, workflow });
  },
  refresh(): void {
    const session = sessionStore.state;
    if (session.status !== 'authenticated' || session.profile === undefined) {
      navigateForCurrentSession();
      return;
    }
    const context =
      this.selectedGroupId === undefined
        ? undefined
        : resolveWorkflowRouteContext(session.groups, this.selectedGroupId);
    const group =
      context === undefined ? undefined : session.groups.find(({ id }) => id === context.groupId);
    this.context = context;
    if (context === undefined || group === undefined || this.controller === undefined) {
      this.setData({
        dutyItems: [],
        groupName: '',
        hasWorkflowAccess: false,
        swapItems: [],
        workflow: undefined,
      });
      return;
    }
    this.controller.activate({ ...context, userId: session.profile.id });
    this.setData({
      groupName: group.name,
      hasWorkflowAccess: true,
      isAdministrator: context.groupRole === 'administrator' || context.groupRole === 'owner',
    });
    this.sync();
    void this.controller.refresh().catch(() => undefined);
  },
  handleMonth(event): void {
    const value = event.detail.value;
    if (typeof value === 'string')
      void this.controller?.setBusinessMonth(value.slice(0, 7)).catch(() => undefined);
  },
  handleSwapInitiator(event): void {
    const values = this.controller?.state.swap.candidates ?? [];
    const index = pickerIndex(event.detail.value, values.length);
    const value = index === undefined ? undefined : values[index]?.assignment.id;
    this.controller?.setSwapAssignments(value, this.controller.state.swap.form.targetAssignmentId);
  },
  handleSwapTarget(event): void {
    const values = this.controller?.state.swap.candidates ?? [];
    const index = pickerIndex(event.detail.value, values.length);
    const value = index === undefined ? undefined : values[index]?.assignment.id;
    this.controller?.setSwapAssignments(
      this.controller.state.swap.form.initiatorAssignmentId,
      value,
    );
  },
  handleSwapSubmit(): void {
    this.confirm('普通换班', '将先生成或使用当前预览，并按服务端状态提交。', () =>
      this.controller!.submitSwap(false),
    );
  },
  handleSwapDirect(): void {
    this.confirm('直办换班', '将先生成预览；确认后立即完成，不需要成员同意或群组审批。', () =>
      this.controller!.submitSwap(true),
    );
  },
  handleDutyCovered(event): void {
    const values = this.controller?.state.duty.candidates ?? [];
    const index = pickerIndex(event.detail.value, values.length);
    const value = index === undefined ? undefined : values[index]?.assignment.id;
    this.controller?.setDutyAdjustment(value, this.controller.state.duty.form.overtimeMembershipId);
  },
  handleDutyOvertime(event): void {
    const values = this.controller?.state.duty.members ?? [];
    const index = pickerIndex(event.detail.value, values.length);
    const value = index === undefined ? undefined : values[index]?.id;
    this.controller?.setDutyAdjustment(this.controller.state.duty.form.coveredAssignmentId, value);
  },
  handleDutyReason(event): void {
    this.controller?.setDutyAdjustment(
      this.controller.state.duty.form.coveredAssignmentId,
      this.controller.state.duty.form.overtimeMembershipId,
      event.detail.value,
    );
  },
  handleDutySubmit(): void {
    this.confirm('普通加扣班', '将先生成或使用当前预览，并按服务端状态提交。', () =>
      this.controller!.submitDuty(false),
    );
  },
  handleDutyDirect(): void {
    this.confirm('直办加扣班', '不生成专用预览；确认后立即完成，不需要成员同意或群组审批。', () =>
      this.controller!.submitDuty(true),
    );
  },
  handleSwapSetting(event): void {
    void this.controller?.updateSwapRequiresApproval(event.detail.value).catch(() => undefined);
  },
  handleDutySetting(event): void {
    void this.controller?.updateDutyRequiresApproval(event.detail.value).catch(() => undefined);
  },
  handleMemberSetting(event): void {
    void this.controller?.updateMemberAutoAccepts(event.detail.value).catch(() => undefined);
  },
  handleAction(event): void {
    const data = actionData(event);
    if (data === undefined || this.controller === undefined) return;
    const action = data.action as 'accept' | 'approve' | 'cancel' | 'reject' | 'revoke';
    if (data.domain === 'swap') {
      const request = [
        ...this.controller.state.swap.requests,
        ...this.controller.state.swap.approvals,
      ].find(({ id }) => id === data.id);
      if (request !== undefined)
        this.confirm('换班操作确认', `确认执行 ${action} 操作吗？`, () =>
          this.controller!.performSwapAction(action, request),
        );
      return;
    }
    const request = [
      ...this.controller.state.duty.requests,
      ...this.controller.state.duty.approvals,
    ].find(({ id }) => id === data.id);
    if (request !== undefined)
      this.confirm('加扣班操作确认', `确认执行 ${action} 操作吗？`, () =>
        this.controller!.performDutyAction(action, request),
      );
  },
  confirm(title, content, action): void {
    wx.showModal({
      cancelText: '返回',
      confirmText: '确认',
      content,
      success: ({ confirm }) => {
        if (confirm) void action().catch(() => undefined);
      },
      title,
    });
  },
});
