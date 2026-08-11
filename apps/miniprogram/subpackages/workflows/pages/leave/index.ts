import {
  approveLeaveRequest,
  cancelLeaveRequest,
  createLeaveRequest,
  getLeaveAffectedShifts,
  getLeaveReflowStrategy,
  listLeaveRequestApprovals,
  listLeaveRequests,
  previewLeaveRequestApproval,
  rejectLeaveRequest,
  revokeLeaveRequest,
  updateLeaveReflowStrategy,
} from '../../../../api/endpoints.js';
import { navigateForCurrentSession } from '../../../../features/auth/auth-runtime.js';
import {
  createLeaveWorkflowController,
  createLeaveWorkflowOperationId,
  type LeaveWorkflowController,
  type LeaveWorkflowState,
} from '../../../../features/workflows/leave-workflow.js';
import {
  resolveWorkflowRouteContext,
  type WorkflowRouteContext,
} from '../../../../features/navigation/workbench-navigation.js';
import { getCalendarCacheRuntime } from '../../../../store/calendar-cache-runtime.js';
import { sessionStore } from '../../../../store/session.js';

const leaveTypeOptions = [
  { label: '病假', value: 'sick' },
  { label: '进修', value: 'training' },
  { label: '轮转', value: 'rotation' },
  { label: '产假', value: 'maternity' },
  { label: '其他', value: 'other' },
] as const;

const strategyOptions = [
  { label: '原轮值不变', value: 'keep-original-order' },
  { label: '整体顺延', value: 'shift-forward' },
] as const;

interface LeavePageData {
  readonly groupName: string;
  readonly groupStrategyIndex: number;
  readonly hasWorkflowAccess: boolean;
  readonly leaveTypeOptions: typeof leaveTypeOptions;
  readonly strategyOptions: typeof strategyOptions;
  readonly workflow: LeaveWorkflowState | undefined;
}

type PickerEvent = WechatMiniprogram.PickerChange;
type InputEvent = WechatMiniprogram.Input;
type RequestIdEvent = WechatMiniprogram.BaseEvent<Record<string, never>, { readonly id?: unknown }>;
type CheckboxEvent = WechatMiniprogram.CustomEvent<{ readonly value?: readonly string[] }>;

interface LeavePageMethods {
  context?: WorkflowRouteContext;
  controller?: LeaveWorkflowController;
  groupStrategyIndex(): number;
  handleAcknowledgement(event: CheckboxEvent): void;
  handleApprovalStrategyChange(event: PickerEvent): void;
  handleApprove(): void;
  handleCancel(event: RequestIdEvent): void;
  handleEndDateChange(event: PickerEvent): void;
  handleGroupStrategyChange(event: PickerEvent): void;
  handleLeaveTypeChange(event: PickerEvent): void;
  handleOpenApproval(event: RequestIdEvent): void;
  handleReasonInput(event: InputEvent): void;
  handleReject(): void;
  handleRevoke(event: RequestIdEvent): void;
  handleStartDateChange(event: PickerEvent): void;
  handleSubmitCreate(): void;
  refresh(): void;
  selectedGroupId?: string;
  showConfirmation(title: string, content: string, action: () => Promise<unknown>): void;
  sync(): void;
}

function getPickerIndex(value: unknown, optionCount: number): number | undefined {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)$/u.test(value)) return undefined;
  const index = Number(value);
  return index >= 0 && index < optionCount ? index : undefined;
}

function getRequestId(event: RequestIdEvent): string | undefined {
  const id = event.currentTarget?.dataset?.id;
  return typeof id === 'string' && id.length > 0 ? id : undefined;
}

Page<LeavePageData, LeavePageMethods>({
  data: {
    groupName: '',
    groupStrategyIndex: 0,
    hasWorkflowAccess: false,
    leaveTypeOptions,
    strategyOptions,
    workflow: undefined,
  },
  onLoad(options): void {
    this.selectedGroupId = typeof options.groupId === 'string' ? options.groupId : undefined;
    this.controller = createLeaveWorkflowController({
      approveLeaveRequest,
      cancelLeaveRequest,
      createLeaveRequest,
      createOperationId: createLeaveWorkflowOperationId,
      getGroupStrategy: getLeaveReflowStrategy,
      getLeaveAffectedShifts,
      invalidateCalendarMonth: (identity) => {
        getCalendarCacheRuntime().invalidate(identity);
      },
      listLeaveRequestApprovals,
      listLeaveRequests,
      previewLeaveRequestApproval,
      rejectLeaveRequest,
      revokeLeaveRequest,
      updateGroupStrategy: updateLeaveReflowStrategy,
      publish: () => this.sync(),
    });
  },
  onShow(): void {
    this.refresh();
  },
  sync(): void {
    const workflow = this.controller?.state;
    this.setData({ workflow, groupStrategyIndex: this.groupStrategyIndex() });
  },
  groupStrategyIndex(): number {
    const draft = this.controller?.state.groupStrategy?.draft;
    return draft === 'shift-forward' ? 1 : 0;
  },
  refresh(): void {
    const session = sessionStore.state;
    if (session.status !== 'authenticated' || session.profile === undefined) {
      navigateForCurrentSession();
      return;
    }
    const selectedGroupId = this.selectedGroupId;
    const context =
      selectedGroupId === undefined
        ? undefined
        : resolveWorkflowRouteContext(session.groups, selectedGroupId);
    const group =
      context === undefined ? undefined : session.groups.find(({ id }) => id === context.groupId);
    this.context = context;
    if (context === undefined || group === undefined || this.controller === undefined) {
      this.setData({ groupName: '', hasWorkflowAccess: false, workflow: undefined });
      return;
    }
    this.controller.activate({ ...context, userId: session.profile.id });
    this.setData({ groupName: group.name, hasWorkflowAccess: true });
    this.sync();
    void this.controller.refresh().catch(() => undefined);
  },
  handleStartDateChange(event): void {
    const value = event.detail.value;
    if (typeof value === 'string') void this.controller?.updateForm({ startDate: value });
  },
  handleEndDateChange(event): void {
    const value = event.detail.value;
    if (typeof value === 'string') void this.controller?.updateForm({ endDate: value });
  },
  handleLeaveTypeChange(event): void {
    const index = getPickerIndex(event.detail.value, leaveTypeOptions.length);
    const option = index === undefined ? undefined : leaveTypeOptions[index];
    if (option !== undefined) void this.controller?.updateForm({ leaveType: option.value });
  },
  handleReasonInput(event): void {
    void this.controller?.updateForm({ reason: event.detail.value });
  },
  handleSubmitCreate(): void {
    void this.controller?.submitCreate().catch(() => undefined);
  },
  handleOpenApproval(event): void {
    const id = getRequestId(event);
    const request = this.controller?.state.approvals.find((candidate) => candidate.id === id);
    if (request !== undefined) void this.controller?.openApproval(request);
  },
  handleApprovalStrategyChange(event): void {
    const index = getPickerIndex(event.detail.value, strategyOptions.length);
    const option = index === undefined ? undefined : strategyOptions[index];
    if (option !== undefined) void this.controller?.setApprovalStrategy(option.value);
  },
  handleAcknowledgement(event): void {
    this.controller?.setAcknowledgeBlockers(event.detail.value?.includes('acknowledge') === true);
  },
  handleApprove(): void {
    this.showConfirmation('批准请假', '将按当前审批预览执行。', () => this.controller!.approve());
  },
  handleReject(): void {
    this.showConfirmation('驳回请假', '确认驳回这项待审批请假吗？', () =>
      this.controller!.reject(),
    );
  },
  handleCancel(event): void {
    const id = getRequestId(event);
    const request = this.controller?.state.myRequests.find((candidate) => candidate.id === id);
    if (request === undefined) return;
    this.showConfirmation('取消请假', '确认取消这项待审批请假吗？', () =>
      this.controller!.cancel(request),
    );
  },
  handleRevoke(event): void {
    const id = getRequestId(event);
    const request = this.controller?.state.myRequests.find((candidate) => candidate.id === id);
    if (request === undefined) return;
    this.showConfirmation(
      '撤销已批准请假',
      '撤销不会自动恢复已重排的班表；如需恢复，请重新生成或发布排班。',
      () => this.controller!.revoke(request),
    );
  },
  handleGroupStrategyChange(event): void {
    const index = getPickerIndex(event.detail.value, strategyOptions.length);
    const option = index === undefined ? undefined : strategyOptions[index];
    if (option === undefined || this.controller === undefined) return;
    this.showConfirmation('更新默认策略', '只影响后续新申请，不改变当前审批中的单项策略。', () => {
      this.controller!.setGroupStrategyDraft(option.value);
      return this.controller!.saveGroupStrategy();
    });
  },
  showConfirmation(title, content, action): void {
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
