import { ClientCoreError } from '@schedule/client-core';
import type {
  GroupSummary,
  LeaveAffectedShift,
  LeaveReflowPreview,
  LeaveReflowStrategy,
  LeaveRequest,
  LeaveRequestStatus,
  LeaveRequestType,
} from '@schedule/contracts';
import {
  resolveWorkflowOperationAttempt,
  type WorkflowOperationAttempt,
} from '@schedule/presentation-core';

import {
  ClientCapabilityDisabledError,
  requireClientCapability,
} from '../../../../app/client-capability-store.js';
import { createRuntimeWorkflowClient } from '../../../../platform/client-core-calendar.js';
import {
  getStoredWechatProfile,
  getStoredWechatToken,
  getWechatRequestAuthentication,
} from '../../../../platform/wechat-identity.js';
import {
  createWorkbenchReadClient,
  readStoredWorkbenchGroupId,
} from '../../../../platform/workbench-read.js';

type PageState = 'error' | 'loading' | 'ready';
type WorkflowTab = 'mine' | 'review';

interface LeaveRequestView {
  readonly actionLabel: string;
  readonly canCancel: boolean;
  readonly canReview: boolean;
  readonly canRevoke: boolean;
  readonly endsAt: string;
  readonly id: string;
  readonly isAllDay: boolean;
  readonly leaveType: LeaveRequestType;
  readonly memberName: string;
  readonly rangeLabel: string;
  readonly reasonLabel: string;
  readonly reflowStrategy: LeaveReflowStrategy;
  readonly startsAt: string;
  readonly status: LeaveRequestStatus;
  readonly statusLabel: string;
  readonly statusTone: string;
  readonly typeLabel: string;
  readonly version: number;
}

interface LeaveShiftView {
  readonly detail: string;
  readonly id: string;
  readonly tone: string;
}

interface LeaveAlertView {
  readonly id: string;
  readonly message: string;
  readonly tone: 'danger' | 'warning';
}

interface LeaveOption<T extends string> {
  readonly label: string;
  readonly value: T;
}

interface LeavePageData {
  readonly activeTab: WorkflowTab;
  readonly affectedShiftMessage: string;
  readonly affectedShifts: readonly LeaveShiftView[];
  readonly affectedShiftsLoading: boolean;
  readonly approvalAcknowledged: boolean;
  readonly approvalAlerts: readonly LeaveAlertView[];
  readonly approvalBusy: boolean;
  readonly approvalErrorMessage: string;
  readonly approvalHasAffectedAssignments: boolean;
  readonly approvalPreviewReady: boolean;
  readonly approvalRequiresAcknowledge: boolean;
  readonly approvalShiftCount: number;
  readonly approvalShifts: readonly LeaveShiftView[];
  readonly approvalStatistics: string;
  readonly approvalStrategyIndex: number;
  readonly approvalSummary: string;
  readonly approvalVisible: boolean;
  readonly canApprove: boolean;
  readonly currentGroupName: string;
  readonly currentGroupRole: string;
  readonly decidedApprovals: readonly LeaveRequestView[];
  readonly endDate: string;
  readonly errorMessage: string;
  readonly formBusy: boolean;
  readonly formErrorMessage: string;
  readonly formVisible: boolean;
  readonly infoMessage: string;
  readonly leaveDayCount: number;
  readonly leaveTypeIndex: number;
  readonly leaveTypeOptions: readonly LeaveOption<LeaveRequestType>[];
  readonly myCount: number;
  readonly myRequests: readonly LeaveRequestView[];
  readonly pageScrollStyle: string;
  readonly pendingApprovalCount: number;
  readonly pendingApprovals: readonly LeaveRequestView[];
  readonly reason: string;
  readonly shellHeaderStyle: string;
  readonly startDate: string;
  readonly state: PageState;
  readonly strategyBusy: boolean;
  readonly strategyIndex: number;
  readonly strategyOptions: readonly LeaveOption<LeaveReflowStrategy>[];
  readonly viewportClass: string;
}

interface LeavePageInstance {
  _approvalPreview: LeaveReflowPreview | undefined;
  _approvalTarget: LeaveRequest | undefined;
  _currentGroupId: string;
  _hasShown: boolean;
  _loadSerial: number;
  _operationAttempts: Map<string, WorkflowOperationAttempt<Readonly<Record<string, unknown>>>>;
  _requestedGroupId: string;
  readonly data: LeavePageData;
  setData(patch: Partial<LeavePageData>, callback?: () => void): void;
}

interface DatasetEvent {
  readonly currentTarget: {
    readonly dataset: Readonly<Record<string, string | undefined>>;
  };
}

interface ValueEvent {
  readonly detail: { readonly value: string | readonly string[] };
}

interface CheckedEvent {
  readonly detail: { readonly checked?: boolean; readonly value?: readonly string[] };
}

const leaveTypeOptions: readonly LeaveOption<LeaveRequestType>[] = [
  { label: '进修', value: 'training' },
  { label: '轮科', value: 'rotation' },
  { label: '病假', value: 'sick' },
  { label: '产假', value: 'maternity' },
  { label: '其他', value: 'other' },
];
const strategyOptions: readonly LeaveOption<LeaveReflowStrategy>[] = [
  { label: '原轮值不变', value: 'keep-original-order' },
  { label: '整体顺延', value: 'shift-forward' },
];
const workflowClient = createRuntimeWorkflowClient(
  getStoredWechatToken,
  getWechatRequestAuthentication(),
);
const workbenchClient = createWorkbenchReadClient();
const initialDate = getTodayBusinessDate();

Page({
  data: {
    activeTab: 'mine',
    affectedShiftMessage: '',
    affectedShifts: [],
    affectedShiftsLoading: false,
    approvalAcknowledged: false,
    approvalAlerts: [],
    approvalBusy: false,
    approvalErrorMessage: '',
    approvalHasAffectedAssignments: false,
    approvalPreviewReady: false,
    approvalRequiresAcknowledge: false,
    approvalShiftCount: 0,
    approvalShifts: [],
    approvalStatistics: '',
    approvalStrategyIndex: 0,
    approvalSummary: '',
    approvalVisible: false,
    canApprove: false,
    currentGroupName: '正在读取群组',
    currentGroupRole: '',
    decidedApprovals: [],
    endDate: initialDate,
    errorMessage: '',
    formBusy: false,
    formErrorMessage: '',
    formVisible: false,
    infoMessage: '',
    leaveDayCount: 1,
    leaveTypeIndex: 2,
    leaveTypeOptions,
    myCount: 0,
    myRequests: [],
    pageScrollStyle: 'height:calc(100% - 64px);',
    pendingApprovalCount: 0,
    pendingApprovals: [],
    reason: '',
    shellHeaderStyle: 'height:64px;min-height:64px;padding-top:8px;',
    startDate: initialDate,
    state: 'loading',
    strategyBusy: false,
    strategyIndex: 0,
    strategyOptions,
    viewportClass: '',
  } satisfies LeavePageData,

  _approvalPreview: undefined,
  _approvalTarget: undefined,
  _currentGroupId: '',
  _hasShown: false,
  _loadSerial: 0,
  _operationAttempts: new Map(),
  _requestedGroupId: '',

  onLoad(this: LeavePageInstance, query: Readonly<Record<string, string | undefined>>): void {
    this._requestedGroupId = decodeQueryValue(query['groupId']);
    this.setData(createShellLayoutPatch());
    void loadLeavePageWithCapability(this);
  },

  onShow(this: LeavePageInstance): void {
    if (!this._hasShown) {
      this._hasShown = true;
      return;
    }
    void loadLeavePageWithCapability(this, { preserveTab: true });
  },

  handleBack(): void {
    wx.navigateBack({ delta: 1 });
  },

  handleRetry(this: LeavePageInstance): void {
    void loadLeavePageWithCapability(this, { preserveTab: true });
  },

  handleTabChange(this: LeavePageInstance, event: DatasetEvent): void {
    const tab = event.currentTarget.dataset['tab'];
    if (tab === 'mine' || (tab === 'review' && this.data.canApprove)) {
      this.setData({ activeTab: tab });
    }
  },

  handleOpenForm(this: LeavePageInstance): void {
    if (this.data.state !== 'ready') return;
    this.setData({ formErrorMessage: '', formVisible: true, infoMessage: '' });
    void loadAffectedShifts(this);
  },

  handleCloseForm(this: LeavePageInstance): void {
    if (!this.data.formBusy) this.setData({ formVisible: false, formErrorMessage: '' });
  },

  handleLeaveTypeChange(this: LeavePageInstance, event: ValueEvent): void {
    const index = Number(event.detail.value);
    if (Number.isInteger(index) && leaveTypeOptions[index] !== undefined) {
      this.setData({ leaveTypeIndex: index, formErrorMessage: '' });
    }
  },

  handleStartDateChange(this: LeavePageInstance, event: ValueEvent): void {
    if (typeof event.detail.value !== 'string') return;
    this.setData(createDatePatch(event.detail.value, this.data.endDate));
    void loadAffectedShifts(this);
  },

  handleEndDateChange(this: LeavePageInstance, event: ValueEvent): void {
    if (typeof event.detail.value !== 'string') return;
    this.setData(createDatePatch(this.data.startDate, event.detail.value));
    void loadAffectedShifts(this);
  },

  handleReasonInput(this: LeavePageInstance, event: ValueEvent): void {
    if (typeof event.detail.value === 'string') {
      this.setData({ reason: event.detail.value, formErrorMessage: '' });
    }
  },

  handleSubmitLeave(this: LeavePageInstance): void {
    void submitLeave(this);
  },

  handleStrategyChange(this: LeavePageInstance, event: ValueEvent): void {
    const index = Number(event.detail.value);
    if (Number.isInteger(index) && strategyOptions[index] !== undefined) {
      void updateDefaultStrategy(this, index);
    }
  },

  handleOpenApproval(this: LeavePageInstance, event: DatasetEvent): void {
    const id = event.currentTarget.dataset['id'];
    const target = findApprovalTarget(this, id);
    if (target === undefined || !this.data.canApprove) return;
    this._approvalPreview = undefined;
    this._approvalTarget = target;
    this.setData({
      approvalAcknowledged: false,
      approvalAlerts: [],
      approvalErrorMessage: '',
      approvalHasAffectedAssignments: false,
      approvalPreviewReady: false,
      approvalRequiresAcknowledge: false,
      approvalShiftCount: 0,
      approvalShifts: [],
      approvalStatistics: '',
      approvalStrategyIndex: strategyIndex(target.reflowStrategy),
      approvalSummary: `${target.memberName ?? '成员'} · ${getLeaveTypeLabel(target.leaveType)} · ${formatLeaveRange(target.startsAt, target.endsAt, target.isAllDay)}`,
      approvalVisible: true,
    });
    void loadApprovalPreview(this);
  },

  handleCloseApproval(this: LeavePageInstance): void {
    if (this.data.approvalBusy) return;
    this._approvalPreview = undefined;
    this._approvalTarget = undefined;
    this.setData({ approvalVisible: false, approvalErrorMessage: '' });
  },

  handleApprovalStrategyChange(this: LeavePageInstance, event: ValueEvent): void {
    const index = Number(event.detail.value);
    if (Number.isInteger(index) && strategyOptions[index] !== undefined) {
      this.setData({ approvalStrategyIndex: index });
      void loadApprovalPreview(this);
    }
  },

  handleRefreshApproval(this: LeavePageInstance): void {
    void loadApprovalPreview(this);
  },

  handleApprovalAcknowledge(this: LeavePageInstance, event: CheckedEvent): void {
    const checked = event.detail.checked ?? event.detail.value?.includes('acknowledged') === true;
    this.setData({ approvalAcknowledged: checked, approvalErrorMessage: '' });
  },

  handleApprove(this: LeavePageInstance): void {
    void approveLeave(this);
  },

  handleReject(this: LeavePageInstance): void {
    void confirmRejectLeave(this);
  },

  handleCancel(this: LeavePageInstance, event: DatasetEvent): void {
    const request = findMyRequest(this, event.currentTarget.dataset['id']);
    if (request !== undefined) void confirmRequestMutation(this, request, 'cancel');
  },

  handleRevoke(this: LeavePageInstance, event: DatasetEvent): void {
    const request = findMyRequest(this, event.currentTarget.dataset['id']);
    if (request !== undefined) void confirmRequestMutation(this, request, 'revoke');
  },

  handleUnavailable(this: LeavePageInstance, event: DatasetEvent): void {
    const label = event.currentTarget.dataset['label'] ?? '此功能';
    this.setData({ infoMessage: `${label}将在后续 P7 阶段开放。` });
  },

  handleSwapNav(this: LeavePageInstance): void {
    if (this._currentGroupId === '') return;
    wx.redirectTo({
      url: `/subpackages/workflows/pages/swap/index?groupId=${encodeURIComponent(this._currentGroupId)}`,
    });
  },
});

async function loadLeavePageWithCapability(
  page: LeavePageInstance,
  options: { readonly preserveTab?: boolean } = {},
): Promise<void> {
  const serial = ++page._loadSerial;
  page.setData({
    activeTab: options.preserveTab === true ? page.data.activeTab : 'mine',
    errorMessage: '',
    state: 'loading',
  });
  try {
    await requireClientCapability('workflows');
    const groups = await workbenchClient.listGroups();
    if (serial !== page._loadSerial) return;
    const group = resolveTargetGroup(groups, page._requestedGroupId);
    if (group === undefined) throw new Error('当前没有可使用请假功能的工作群组。');
    if (group.role === 'guest') throw new Error('访客不能提交或审批请假。');
    page._currentGroupId = group.id;
    const canApprove = group.role === 'owner' || group.role === 'administrator';
    const [mine, approvals, strategy] = await Promise.all([
      workflowClient.listMyLeaveRequests(group.id),
      canApprove ? workflowClient.listLeaveRequestApprovals(group.id) : Promise.resolve([]),
      workflowClient.getLeaveReflowStrategy(group.id),
    ]);
    if (serial !== page._loadSerial || page._currentGroupId !== group.id) return;
    const pending = approvals.filter((request) => request.status === 'pending');
    const decided = approvals.filter((request) => request.status !== 'pending');
    page.setData({
      activeTab: canApprove ? page.data.activeTab : 'mine',
      canApprove,
      currentGroupName: group.name,
      currentGroupRole: formatRole(group.role),
      decidedApprovals: decided.map((request) => createLeaveRequestView(request, false)),
      errorMessage: '',
      myCount: mine.length,
      myRequests: mine.map((request) => createLeaveRequestView(request, false)),
      pendingApprovalCount: pending.length,
      pendingApprovals: pending.map((request) => createLeaveRequestView(request, true)),
      state: 'ready',
      strategyIndex: strategyIndex(strategy.strategy),
    });
  } catch (error) {
    if (serial !== page._loadSerial) return;
    page._currentGroupId = '';
    page.setData({
      canApprove: false,
      errorMessage: toUserMessage(error, '请假数据暂时无法加载，请稍后重试。'),
      state: 'error',
    });
  }
}

async function submitLeave(page: LeavePageInstance): Promise<void> {
  if (page.data.formBusy || page._currentGroupId === '') return;
  let interval: { readonly endsAt: string; readonly startsAt: string };
  try {
    interval = buildAllDayInterval(page.data.startDate, page.data.endDate);
  } catch (error) {
    page.setData({ formErrorMessage: toUserMessage(error, '请假日期不正确。') });
    return;
  }
  const selectedType = leaveTypeOptions[page.data.leaveTypeIndex]?.value ?? 'sick';
  const operationKey = `${page._currentGroupId}:leave:create`;
  const reason = page.data.reason.trim();
  const request = resolveOperation(page, operationKey, {
    endsAt: interval.endsAt,
    isAllDay: true,
    leaveType: selectedType,
    ...(reason === '' ? {} : { reason }),
    startsAt: interval.startsAt,
  });
  page.setData({ formBusy: true, formErrorMessage: '', infoMessage: '' });
  try {
    await workflowClient.createLeaveRequest(page._currentGroupId, request);
    page._operationAttempts.delete(operationKey);
    page.setData({
      formVisible: false,
      infoMessage: '请假申请已提交，等待管理员审批。',
      reason: '',
    });
    await loadLeavePageWithCapability(page, { preserveTab: true });
  } catch (error) {
    page.setData({ formErrorMessage: getMutationErrorMessage(error) });
    if (isConflict(error)) {
      page._operationAttempts.delete(operationKey);
      await loadLeavePageWithCapability(page, { preserveTab: true });
    }
  } finally {
    page.setData({ formBusy: false });
  }
}

async function loadAffectedShifts(page: LeavePageInstance): Promise<void> {
  if (page._currentGroupId === '') return;
  let interval;
  try {
    interval = buildAllDayInterval(page.data.startDate, page.data.endDate);
  } catch {
    page.setData({ affectedShiftMessage: '', affectedShifts: [] });
    return;
  }
  page.setData({ affectedShiftMessage: '', affectedShiftsLoading: true });
  try {
    const shifts = await workflowClient.getLeaveAffectedShifts(page._currentGroupId, {
      endsAt: interval.endsAt,
      isAllDay: true,
      startsAt: interval.startsAt,
    });
    page.setData({
      affectedShiftMessage:
        shifts.length === 0
          ? '所选日期暂未涉及已发布班次。'
          : `涉及 ${shifts.length} 个已发布班次。`,
      affectedShifts: shifts.map(createAffectedShiftView),
    });
  } catch {
    page.setData({ affectedShiftMessage: '暂时无法读取受影响班次。', affectedShifts: [] });
  } finally {
    page.setData({ affectedShiftsLoading: false });
  }
}

async function updateDefaultStrategy(page: LeavePageInstance, index: number): Promise<void> {
  if (!page.data.canApprove || page.data.strategyBusy || page._currentGroupId === '') return;
  const strategy = strategyOptions[index]?.value;
  if (strategy === undefined) return;
  page.setData({ errorMessage: '', infoMessage: '', strategyBusy: true });
  try {
    const result = await workflowClient.updateLeaveReflowStrategy(page._currentGroupId, {
      strategy,
    });
    page.setData({
      infoMessage: '群组默认重排策略已更新，新提交的请假将使用该策略。',
      strategyIndex: strategyIndex(result.strategy),
    });
  } catch (error) {
    page.setData({ errorMessage: toUserMessage(error, '默认重排策略暂时无法更新。') });
  } finally {
    page.setData({ strategyBusy: false });
  }
}

async function loadApprovalPreview(page: LeavePageInstance): Promise<void> {
  const target = page._approvalTarget;
  if (target === undefined || page._currentGroupId === '') return;
  const strategy = strategyOptions[page.data.approvalStrategyIndex]?.value ?? target.reflowStrategy;
  page._approvalPreview = undefined;
  page.setData({
    approvalAcknowledged: false,
    approvalBusy: true,
    approvalErrorMessage: '',
    approvalPreviewReady: false,
  });
  try {
    const preview = await workflowClient.previewLeaveRequestApproval(
      page._currentGroupId,
      target.id,
      { strategy },
    );
    if (page._approvalTarget?.id !== target.id) return;
    page._approvalPreview = preview;
    page.setData(createApprovalPreviewPatch(preview));
  } catch (error) {
    page.setData({
      approvalErrorMessage: isConflict(error)
        ? '排班数据已被其他操作更新，请重新生成预览。'
        : toUserMessage(error, '请假审批预览暂时无法生成。'),
    });
  } finally {
    page.setData({ approvalBusy: false });
  }
}

async function approveLeave(page: LeavePageInstance): Promise<void> {
  const target = page._approvalTarget;
  if (target === undefined || page._currentGroupId === '' || page.data.approvalBusy) return;
  if (!page.data.approvalPreviewReady) {
    await loadApprovalPreview(page);
    return;
  }
  if (page.data.approvalRequiresAcknowledge && !page.data.approvalAcknowledged) {
    page.setData({ approvalErrorMessage: '请先确认我已知晓冲突和空缺，再批准并重排。' });
    return;
  }
  const strategy = strategyOptions[page.data.approvalStrategyIndex]?.value ?? target.reflowStrategy;
  const preview = page._approvalPreview;
  if (preview === undefined || preview.strategy !== strategy) {
    await loadApprovalPreview(page);
    return;
  }
  const operationKey = `${page._currentGroupId}:leave:approve:${target.id}:${target.version}`;
  const request = resolveOperation(page, operationKey, {
    ...(page.data.approvalRequiresAcknowledge ? { acknowledgeBlockers: true } : {}),
    expectedPeriodVersions: preview.periodVersions,
    expectedRulesVersion: preview.rulesVersion,
    expectedVersion: target.version,
    strategy,
  });
  page.setData({ approvalBusy: true, approvalErrorMessage: '' });
  try {
    await workflowClient.approveLeaveRequest(page._currentGroupId, target.id, request);
    page._operationAttempts.delete(operationKey);
    page._approvalPreview = undefined;
    page._approvalTarget = undefined;
    page.setData({ approvalVisible: false, infoMessage: '请假申请已处理。' });
    await loadLeavePageWithCapability(page, { preserveTab: true });
  } catch (error) {
    page.setData({ approvalErrorMessage: getMutationErrorMessage(error) });
    if (isConflict(error)) {
      page._operationAttempts.delete(operationKey);
      page._approvalPreview = undefined;
      page._approvalTarget = undefined;
      page.setData({ approvalVisible: false });
      await loadLeavePageWithCapability(page, { preserveTab: true });
    }
  } finally {
    page.setData({ approvalBusy: false });
  }
}

async function confirmRejectLeave(page: LeavePageInstance): Promise<void> {
  const target = page._approvalTarget;
  if (target === undefined || page.data.approvalBusy) return;
  const confirmed = await showConfirm(`确定驳回${target.memberName ?? '该成员'}的请假申请吗？`);
  if (!confirmed) return;
  const operationKey = `${page._currentGroupId}:leave:reject:${target.id}:${target.version}`;
  const request = resolveOperation(page, operationKey, { expectedVersion: target.version });
  page.setData({ approvalBusy: true, approvalErrorMessage: '' });
  try {
    await workflowClient.rejectLeaveRequest(page._currentGroupId, target.id, request);
    page._operationAttempts.delete(operationKey);
    page._approvalPreview = undefined;
    page._approvalTarget = undefined;
    page.setData({ approvalVisible: false, infoMessage: '请假申请已处理。' });
    await loadLeavePageWithCapability(page, { preserveTab: true });
  } catch (error) {
    page.setData({ approvalErrorMessage: getMutationErrorMessage(error) });
    if (isConflict(error)) {
      page._operationAttempts.delete(operationKey);
      page._approvalPreview = undefined;
      page._approvalTarget = undefined;
      page.setData({ approvalVisible: false });
      await loadLeavePageWithCapability(page, { preserveTab: true });
    }
  } finally {
    page.setData({ approvalBusy: false });
  }
}

async function confirmRequestMutation(
  page: LeavePageInstance,
  request: LeaveRequest,
  action: 'cancel' | 'revoke',
): Promise<void> {
  const message =
    action === 'cancel'
      ? '确定取消该请假申请吗？'
      : '确定撤销该已批准的请假吗？撤销后如需恢复原排班，请重新生成或发布排班。';
  if (!(await showConfirm(message))) return;
  const operationKey = `${page._currentGroupId}:leave:${action}:${request.id}:${request.version}`;
  const input = resolveOperation(page, operationKey, { expectedVersion: request.version });
  page.setData({ errorMessage: '', infoMessage: '' });
  try {
    if (action === 'cancel') {
      await workflowClient.cancelLeaveRequest(page._currentGroupId, request.id, input);
    } else {
      await workflowClient.revokeLeaveRequest(page._currentGroupId, request.id, input);
    }
    page._operationAttempts.delete(operationKey);
    page.setData({
      infoMessage:
        action === 'cancel'
          ? '请假申请已取消。'
          : '请假已撤销；如需恢复原排班，请重新生成或发布排班。',
    });
    await loadLeavePageWithCapability(page, { preserveTab: true });
  } catch (error) {
    page.setData({ errorMessage: getMutationErrorMessage(error) });
    if (isConflict(error)) {
      page._operationAttempts.delete(operationKey);
      await loadLeavePageWithCapability(page, { preserveTab: true });
    }
  }
}

function createApprovalPreviewPatch(
  preview: LeaveReflowPreview,
): Pick<
  LeavePageData,
  | 'approvalAlerts'
  | 'approvalHasAffectedAssignments'
  | 'approvalPreviewReady'
  | 'approvalRequiresAcknowledge'
  | 'approvalShiftCount'
  | 'approvalShifts'
  | 'approvalStatistics'
> {
  const alerts: LeaveAlertView[] = [];
  if (preview.conflicts.length > 0) {
    alerts.push({
      id: 'conflicts',
      message: `发现 ${preview.conflicts.length} 处硬冲突（请假或时间重叠）。`,
      tone: 'danger',
    });
  }
  if (preview.workflowBlockers.length > 0) {
    alerts.push({
      id: 'blockers',
      message: preview.workflowBlockers.map((blocker) => blocker.message).join('；'),
      tone: 'danger',
    });
  }
  if (preview.continuousDutyWarnings.length > 0) {
    alerts.push({
      id: 'warnings',
      message: `发现 ${preview.continuousDutyWarnings.length} 处连续值班风险（至少 24 小时）。`,
      tone: 'warning',
    });
  }
  if (preview.vacancies.length > 0) {
    alerts.push({
      id: 'vacancies',
      message: `发现 ${preview.vacancies.length} 个待处理空缺（无可用替班成员）。`,
      tone: 'warning',
    });
  }
  return {
    approvalAlerts: alerts,
    approvalHasAffectedAssignments: preview.affectedAssignments.length > 0,
    approvalPreviewReady: true,
    approvalRequiresAcknowledge: preview.conflicts.length > 0 || preview.vacancies.length > 0,
    approvalShiftCount: preview.affectedShiftCount,
    approvalShifts: preview.affectedAssignments.map((assignment) => ({
      detail: `${formatBusinessDate(assignment.businessDate)} ${assignment.shiftTypeName}（${assignment.shiftTypeAbbreviation}）：${assignment.previousMemberName ?? '空缺'} → ${assignment.nextMemberName ?? '空缺'}`,
      id: assignment.assignmentId,
      tone: 'primary',
    })),
    approvalStatistics:
      preview.statisticsDelta.byMember.length === 0
        ? '无值班统计变化'
        : preview.statisticsDelta.byMember
            .map(
              (member) =>
                `${member.realName} ${member.assignmentDelta > 0 ? '+' : ''}${member.assignmentDelta} 班`,
            )
            .join('、'),
  };
}

function createLeaveRequestView(request: LeaveRequest, canReview: boolean): LeaveRequestView {
  return {
    actionLabel: canReview ? '预览并审批' : '',
    canCancel: !canReview && request.status === 'pending',
    canReview,
    canRevoke: !canReview && request.status === 'approved' && request.isRevocable === true,
    endsAt: request.endsAt,
    id: request.id,
    isAllDay: request.isAllDay,
    leaveType: request.leaveType,
    memberName: request.memberName ?? '我',
    rangeLabel: formatLeaveRange(request.startsAt, request.endsAt, request.isAllDay),
    reasonLabel: request.reason?.trim() || '未填写',
    reflowStrategy: request.reflowStrategy,
    startsAt: request.startsAt,
    status: request.status,
    statusLabel: getLeaveStatusLabel(request.status),
    statusTone: `is-${getLeaveStatusTone(request.status)}`,
    typeLabel: getLeaveTypeLabel(request.leaveType),
    version: request.version,
  };
}

function createAffectedShiftView(shift: LeaveAffectedShift): LeaveShiftView {
  return {
    detail: `${formatBusinessDate(shift.businessDate)} ${shift.shiftTypeName}（${shift.shiftTypeAbbreviation}）${shift.isCovered ? ' · 已覆盖' : ' · 待安排'}`,
    id: shift.assignmentId,
    tone: shift.isCovered ? 'success' : 'warning',
  };
}

function findApprovalTarget(
  page: LeavePageInstance,
  id: string | undefined,
): LeaveRequest | undefined {
  if (id === undefined) return undefined;
  const view = [...page.data.pendingApprovals, ...page.data.decidedApprovals].find(
    (item) => item.id === id,
  );
  if (view === undefined) return undefined;
  return page._approvalTarget?.id === id
    ? page._approvalTarget
    : ({
        endsAt: view.endsAt,
        groupId: page._currentGroupId,
        id: view.id,
        isAllDay: view.isAllDay,
        leaveType: view.leaveType,
        membershipId: '',
        memberName: view.memberName,
        reflowStrategy: view.reflowStrategy,
        startsAt: view.startsAt,
        status: view.status,
        version: view.version,
        createdAt: '',
      } satisfies LeaveRequest);
}

function findMyRequest(page: LeavePageInstance, id: string | undefined): LeaveRequest | undefined {
  const view = page.data.myRequests.find((item) => item.id === id);
  if (view === undefined) return undefined;
  return {
    createdAt: '',
    endsAt: '',
    groupId: page._currentGroupId,
    id: view.id,
    isAllDay: true,
    leaveType: 'other',
    membershipId: '',
    reflowStrategy: 'keep-original-order',
    startsAt: '',
    status: view.canCancel ? 'pending' : 'approved',
    version: view.version,
  };
}

function resolveOperation<Payload extends Readonly<Record<string, unknown>>>(
  page: LeavePageInstance,
  key: string,
  payload: Payload,
): Readonly<Payload & { readonly operationId: string }> {
  const resolved = resolveWorkflowOperationAttempt(
    page._operationAttempts.get(key) as WorkflowOperationAttempt<Payload> | undefined,
    payload,
    createOperationId,
  );
  page._operationAttempts.set(
    key,
    resolved.attempt as WorkflowOperationAttempt<Readonly<Record<string, unknown>>>,
  );
  return resolved.snapshot;
}

function resolveTargetGroup(
  groups: readonly GroupSummary[],
  requestedGroupId: string,
): GroupSummary | undefined {
  const requested = groups.find((group) => group.id === requestedGroupId);
  if (requested !== undefined) return requested;
  const ownerId = getStoredWechatProfile()?.id;
  const storedId = ownerId === undefined ? undefined : readStoredWorkbenchGroupId(ownerId);
  return (
    groups.find((group) => group.id === storedId && group.role !== 'guest') ??
    groups.find((group) => group.role !== 'guest')
  );
}

function createDatePatch(startDate: string, endDate: string): Partial<LeavePageData> {
  return {
    endDate,
    formErrorMessage: '',
    leaveDayCount: getLeaveDayCount(startDate, endDate),
    startDate,
  };
}

function buildAllDayInterval(
  startDate: string,
  endDate: string,
): { readonly endsAt: string; readonly startsAt: string } {
  if (!isDateValue(startDate) || !isDateValue(endDate)) throw new Error('请选择有效的请假日期。');
  if (endDate < startDate) throw new Error('结束日期不能早于开始日期。');
  const startsAt = new Date(`${startDate}T00:00:00+08:00`);
  const endStart = new Date(`${endDate}T00:00:00+08:00`);
  if (Number.isNaN(startsAt.valueOf()) || Number.isNaN(endStart.valueOf())) {
    throw new Error('请假日期格式无效。');
  }
  return {
    endsAt: new Date(endStart.valueOf() + 24 * 60 * 60 * 1000).toISOString(),
    startsAt: startsAt.toISOString(),
  };
}

function getTodayBusinessDate(): string {
  const chinaNow = new Date(Date.now() + 8 * 60 * 60 * 1000);
  if (chinaNow.getUTCHours() < 8) chinaNow.setUTCDate(chinaNow.getUTCDate() - 1);
  return chinaNow.toISOString().slice(0, 10);
}

function getLeaveDayCount(startDate: string, endDate: string): number {
  if (!isDateValue(startDate) || !isDateValue(endDate) || endDate < startDate) return 0;
  return (
    Math.round(
      (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) /
        (24 * 60 * 60 * 1000),
    ) + 1
  );
}

function formatLeaveRange(startsAt: string, endsAt: string, isAllDay: boolean): string {
  if (!isAllDay) return `${formatChinaDateTime(startsAt)} 至 ${formatChinaDateTime(endsAt)}`;
  const start = toChinaDate(startsAt);
  const endExclusive = toChinaDate(endsAt);
  const endDate = addDateDays(endExclusive, -1);
  return `${start.slice(5)} 至 ${endDate.slice(5)}（共 ${getLeaveDayCount(start, endDate)} 天）`;
}

function getLeaveTypeLabel(type: LeaveRequestType): string {
  return leaveTypeOptions.find((option) => option.value === type)?.label ?? '其他';
}

function getLeaveStatusLabel(status: LeaveRequestStatus): string {
  return status === 'approved' ? '已批准' : status === 'rejected' ? '已驳回' : '待审批';
}

function getLeaveStatusTone(status: LeaveRequestStatus): 'danger' | 'success' | 'warning' {
  return status === 'approved' ? 'success' : status === 'rejected' ? 'danger' : 'warning';
}

function strategyIndex(strategy: LeaveReflowStrategy): number {
  return Math.max(
    0,
    strategyOptions.findIndex((option) => option.value === strategy),
  );
}

function formatRole(role: GroupSummary['role']): string {
  return role === 'owner' ? '群主' : role === 'administrator' ? '管理员' : '成员';
}

function formatBusinessDate(value: string): string {
  return `${Number(value.slice(5, 7))}月${Number(value.slice(8, 10))}日`;
}

function formatChinaDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  const china = new Date(date.valueOf() + 8 * 60 * 60 * 1000);
  return `${china.toISOString().slice(5, 10)} ${china.toISOString().slice(11, 16)}`;
}

function toChinaDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return '';
  return new Date(date.valueOf() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function addDateDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function isDateValue(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/u.test(value) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  );
}

function createShellLayoutPatch(): Pick<
  LeavePageData,
  'pageScrollStyle' | 'shellHeaderStyle' | 'viewportClass'
> {
  const windowInfo = wx.getWindowInfo();
  const statusBarHeight = Math.max(0, windowInfo.statusBarHeight ?? 0);
  const headerHeight = statusBarHeight + 52;
  return {
    pageScrollStyle: `height:calc(100% - ${headerHeight}px);`,
    shellHeaderStyle: `height:${headerHeight}px;min-height:${headerHeight}px;padding-top:${statusBarHeight}px;`,
    viewportClass: windowInfo.windowWidth <= 340 ? 'is-compact' : '',
  };
}

function decodeQueryValue(value: string | undefined): string {
  if (value === undefined || value === '') return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return '';
  }
}

function createOperationId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/gu, (marker) => {
    const random = Math.floor(Math.random() * 16);
    return (marker === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
}

function isConflict(error: unknown): boolean {
  return error instanceof ClientCoreError && error.code === 'CONFLICT';
}

function getMutationErrorMessage(error: unknown): string {
  if (error instanceof ClientCoreError && error.code === 'NETWORK_ERROR') {
    return '本次结果尚未确认，可直接重试。';
  }
  if (isConflict(error)) return '资料已发生变化，已重新读取最新状态，请再次确认。';
  return toUserMessage(error, '请假操作暂时无法完成，请稍后重试。');
}

function toUserMessage(error: unknown, fallback: string): string {
  if (error instanceof ClientCapabilityDisabledError) return error.message;
  if (error instanceof ClientCoreError && error.message.length > 0) return error.message;
  return error instanceof Error && error.message.length > 0 ? error.message : fallback;
}

function showConfirm(content: string): Promise<boolean> {
  return new Promise((resolve) => {
    wx.showModal({
      cancelText: '暂不',
      confirmText: '确认',
      content,
      title: '请确认',
      success: (result) => resolve(result.confirm),
      fail: () => resolve(false),
    });
  });
}
