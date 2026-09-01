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
  buildLeaveFormInterval,
  formatAffectedAssignment,
  formatLeaveRange,
  formatWorkflowDateWithWeekday as formatDateWithWeekday,
  getLeaveDayCount,
  getLeaveRejectionConfirmation,
  getLeaveStatusLabel,
  getLeaveStatusTone,
  getLeaveTypeLabel,
  getTodayCalendarDate,
  resolveWorkflowOperationAttempt,
  summarizeStatisticsDelta,
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
import { captureWorkflowControllerTask } from '../controller-host.js';

export { getTodayCalendarDate };

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
  readonly statusLabel: string;
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
  readonly affectedWarningMessage: string;
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
  readonly endDateDisplay: string;
  readonly endDateMin: string;
  readonly embedded: boolean;
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
  readonly startDateDisplay: string;
  readonly todayDate: string;
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
  triggerEvent?(name: string, detail: Readonly<Record<string, unknown>>): void;
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
const initialDate = getTodayCalendarDate();

export function createLeavePanelControllerDefinition(embedded = false) {
  return {
    data: {
      activeTab: 'mine',
      affectedShiftMessage: '',
      affectedShifts: [],
      affectedShiftsLoading: false,
      affectedWarningMessage: '',
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
      endDateDisplay: formatDateWithWeekday(initialDate),
      endDateMin: initialDate,
      embedded,
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
      startDateDisplay: formatDateWithWeekday(initialDate),
      state: 'loading',
      strategyBusy: false,
      strategyIndex: 0,
      strategyOptions,
      todayDate: initialDate,
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
      this.setData(
        this.data.embedded
          ? { pageScrollStyle: 'height:100%;', viewportClass: '' }
          : createShellLayoutPatch(),
      );
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
      const todayDate = getTodayCalendarDate();
      const startDate = this.data.startDate < todayDate ? todayDate : this.data.startDate;
      const endDate = this.data.endDate < startDate ? startDate : this.data.endDate;
      this.setData(
        {
          ...createDatePatch(startDate, endDate),
          affectedShiftMessage: '',
          affectedShifts: [],
          affectedShiftsLoading: true,
          affectedWarningMessage: '',
          formErrorMessage: '',
          formVisible: true,
          infoMessage: '',
          todayDate,
        },
        () => void loadAffectedShifts(this),
      );
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
      if (event.detail.value < this.data.todayDate) {
        this.setData({ formErrorMessage: '开始日期最早只能是当天。' });
        return;
      }
      this.setData(createDatePatch(event.detail.value, this.data.endDate));
      void loadAffectedShifts(this);
    },

    handleEndDateChange(this: LeavePageInstance, event: ValueEvent): void {
      if (typeof event.detail.value !== 'string') return;
      if (event.detail.value < this.data.todayDate) {
        this.setData({ formErrorMessage: '结束日期不能早于今天。' });
        return;
      }
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

    handleDutyNav(this: LeavePageInstance): void {
      if (this._currentGroupId === '') return;
      wx.redirectTo({
        url: `/subpackages/workflows/pages/duty/index?groupId=${encodeURIComponent(this._currentGroupId)}`,
      });
    },
  };
}

async function loadLeavePageWithCapability(
  page: LeavePageInstance,
  options: { readonly preserveTab?: boolean } = {},
): Promise<void> {
  const task = captureWorkflowControllerTask(page);
  if (!task.isCurrent()) return;
  const serial = ++page._loadSerial;
  page.setData({
    activeTab: options.preserveTab === true ? page.data.activeTab : 'mine',
    errorMessage: '',
    state: 'loading',
  });
  try {
    await requireClientCapability('workflows');
    if (!task.isCurrent()) return;
    const groups = await workbenchClient.listGroups();
    if (!task.isCurrent() || serial !== page._loadSerial) return;
    const group = resolveTargetGroup(groups, page._requestedGroupId);
    if (group === undefined) throw new Error('当前没有可使用请假功能的工作群组。');
    if (group.role === 'guest') throw new Error('访客不能提交或审批请假。');
    page._currentGroupId = group.id;
    const canApprove =
      group.isDeveloperAdmin === true || group.role === 'owner' || group.role === 'administrator';
    const [mine, approvals, strategy] = await Promise.all([
      workflowClient.listMyLeaveRequests(group.id),
      canApprove ? workflowClient.listLeaveRequestApprovals(group.id) : Promise.resolve([]),
      workflowClient.getLeaveReflowStrategy(group.id),
    ]);
    if (!task.isCurrent() || serial !== page._loadSerial || page._currentGroupId !== group.id) {
      return;
    }
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
    if (!task.isCurrent() || serial !== page._loadSerial) return;
    page._currentGroupId = '';
    page.setData({
      canApprove: false,
      errorMessage: toUserMessage(error, '请假数据暂时无法加载，请稍后重试。'),
      state: 'error',
    });
  }
}

async function submitLeave(page: LeavePageInstance): Promise<void> {
  const task = captureWorkflowControllerTask(page);
  if (!task.isCurrent()) return;
  if (page.data.formBusy || page._currentGroupId === '') return;
  let interval: { readonly endsAt: string; readonly startsAt: string };
  try {
    interval = buildLeaveFormInterval({
      endDate: page.data.endDate,
      startDate: page.data.startDate,
    });
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
    if (!task.isCurrent()) return;
    page._operationAttempts.delete(operationKey);
    page.setData({
      formVisible: false,
      infoMessage: '请假申请已提交，等待管理员审批。',
      reason: '',
    });
    notifyCalendarChanged(page);
    await loadLeavePageWithCapability(page, { preserveTab: true });
    if (!task.isCurrent()) return;
  } catch (error) {
    if (!task.isCurrent()) return;
    page.setData({ formErrorMessage: getMutationErrorMessage(error) });
    if (isConflict(error)) {
      page._operationAttempts.delete(operationKey);
      await loadLeavePageWithCapability(page, { preserveTab: true });
      if (!task.isCurrent()) return;
    }
  } finally {
    if (task.isCurrent()) page.setData({ formBusy: false });
  }
}

async function loadAffectedShifts(page: LeavePageInstance): Promise<void> {
  const task = captureWorkflowControllerTask(page);
  if (!task.isCurrent()) return;
  if (page._currentGroupId === '') return;
  let interval;
  try {
    interval = buildLeaveFormInterval({
      endDate: page.data.endDate,
      startDate: page.data.startDate,
    });
  } catch {
    page.setData({ affectedShiftMessage: '', affectedShifts: [], affectedWarningMessage: '' });
    return;
  }
  page.setData({
    affectedShiftMessage: '',
    affectedShiftsLoading: true,
    affectedWarningMessage: '',
  });
  try {
    const shifts = await workflowClient.getLeaveAffectedShifts(page._currentGroupId, {
      endsAt: interval.endsAt,
      isAllDay: true,
      startsAt: interval.startsAt,
    });
    if (!task.isCurrent()) return;
    page.setData({
      affectedShiftMessage: shifts.length === 0 ? '请假期间没有已发布的未来班次。' : '',
      affectedShifts: shifts.map(createAffectedShiftView),
      affectedWarningMessage: shifts.some((shift) => !shift.isCovered)
        ? '可先到“换班”或“加扣班”安排替班；未安排也可以提交申请。'
        : '',
    });
  } catch {
    if (!task.isCurrent()) return;
    page.setData({
      affectedShiftMessage: '暂时无法读取受影响班次。',
      affectedShifts: [],
      affectedWarningMessage: '',
    });
  } finally {
    if (task.isCurrent()) page.setData({ affectedShiftsLoading: false });
  }
}

async function updateDefaultStrategy(page: LeavePageInstance, index: number): Promise<void> {
  const task = captureWorkflowControllerTask(page);
  if (!task.isCurrent()) return;
  if (!page.data.canApprove || page.data.strategyBusy || page._currentGroupId === '') return;
  const strategy = strategyOptions[index]?.value;
  if (strategy === undefined) return;
  page.setData({ errorMessage: '', infoMessage: '', strategyBusy: true });
  try {
    const result = await workflowClient.updateLeaveReflowStrategy(page._currentGroupId, {
      strategy,
    });
    if (!task.isCurrent()) return;
    page.setData({
      infoMessage: '群组默认重排策略已更新，新提交的请假将使用该策略。',
      strategyIndex: strategyIndex(result.strategy),
    });
  } catch (error) {
    if (!task.isCurrent()) return;
    page.setData({ errorMessage: toUserMessage(error, '默认重排策略暂时无法更新。') });
  } finally {
    if (task.isCurrent()) page.setData({ strategyBusy: false });
  }
}

async function loadApprovalPreview(page: LeavePageInstance): Promise<void> {
  const task = captureWorkflowControllerTask(page);
  if (!task.isCurrent()) return;
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
    if (!task.isCurrent() || page._approvalTarget?.id !== target.id) return;
    page._approvalPreview = preview;
    page.setData(createApprovalPreviewPatch(preview));
  } catch (error) {
    if (!task.isCurrent()) return;
    page.setData({
      approvalErrorMessage: isConflict(error)
        ? '排班数据已被其他操作更新，请重新生成预览。'
        : toUserMessage(error, '请假审批预览暂时无法生成。'),
    });
  } finally {
    if (task.isCurrent()) page.setData({ approvalBusy: false });
  }
}

async function approveLeave(page: LeavePageInstance): Promise<void> {
  const task = captureWorkflowControllerTask(page);
  if (!task.isCurrent()) return;
  const target = page._approvalTarget;
  if (target === undefined || page._currentGroupId === '' || page.data.approvalBusy) return;
  if (!page.data.approvalPreviewReady) {
    await loadApprovalPreview(page);
    if (!task.isCurrent()) return;
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
    if (!task.isCurrent()) return;
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
    if (!task.isCurrent()) return;
    page._operationAttempts.delete(operationKey);
    page._approvalPreview = undefined;
    page._approvalTarget = undefined;
    page.setData({ approvalVisible: false, infoMessage: '请假申请已处理。' });
    notifyCalendarChanged(page);
    await loadLeavePageWithCapability(page, { preserveTab: true });
    if (!task.isCurrent()) return;
  } catch (error) {
    if (!task.isCurrent()) return;
    page.setData({ approvalErrorMessage: getMutationErrorMessage(error) });
    if (isConflict(error)) {
      page._operationAttempts.delete(operationKey);
      page._approvalPreview = undefined;
      page._approvalTarget = undefined;
      page.setData({ approvalVisible: false });
      await loadLeavePageWithCapability(page, { preserveTab: true });
      if (!task.isCurrent()) return;
    }
  } finally {
    if (task.isCurrent()) page.setData({ approvalBusy: false });
  }
}

async function confirmRejectLeave(page: LeavePageInstance): Promise<void> {
  const task = captureWorkflowControllerTask(page);
  if (!task.isCurrent()) return;
  const target = page._approvalTarget;
  if (target === undefined || page.data.approvalBusy) return;
  const confirmed = await showConfirm(getLeaveRejectionConfirmation(target.memberName));
  if (!task.isCurrent() || !confirmed) return;
  const operationKey = `${page._currentGroupId}:leave:reject:${target.id}:${target.version}`;
  const request = resolveOperation(page, operationKey, { expectedVersion: target.version });
  page.setData({ approvalBusy: true, approvalErrorMessage: '' });
  try {
    await workflowClient.rejectLeaveRequest(page._currentGroupId, target.id, request);
    if (!task.isCurrent()) return;
    page._operationAttempts.delete(operationKey);
    page._approvalPreview = undefined;
    page._approvalTarget = undefined;
    page.setData({ approvalVisible: false, infoMessage: '请假申请已处理。' });
    notifyCalendarChanged(page);
    await loadLeavePageWithCapability(page, { preserveTab: true });
    if (!task.isCurrent()) return;
  } catch (error) {
    if (!task.isCurrent()) return;
    page.setData({ approvalErrorMessage: getMutationErrorMessage(error) });
    if (isConflict(error)) {
      page._operationAttempts.delete(operationKey);
      page._approvalPreview = undefined;
      page._approvalTarget = undefined;
      page.setData({ approvalVisible: false });
      await loadLeavePageWithCapability(page, { preserveTab: true });
      if (!task.isCurrent()) return;
    }
  } finally {
    if (task.isCurrent()) page.setData({ approvalBusy: false });
  }
}

async function confirmRequestMutation(
  page: LeavePageInstance,
  request: LeaveRequest,
  action: 'cancel' | 'revoke',
): Promise<void> {
  const task = captureWorkflowControllerTask(page);
  if (!task.isCurrent()) return;
  const message =
    action === 'cancel'
      ? '确定取消该请假申请吗？'
      : '确定撤销该已批准的请假吗？撤销后如需恢复原排班，请重新生成或发布排班。';
  const confirmed = await showConfirm(message);
  if (!task.isCurrent() || !confirmed) return;
  const operationKey = `${page._currentGroupId}:leave:${action}:${request.id}:${request.version}`;
  const input = resolveOperation(page, operationKey, { expectedVersion: request.version });
  page.setData({ errorMessage: '', infoMessage: '' });
  try {
    if (action === 'cancel') {
      await workflowClient.cancelLeaveRequest(page._currentGroupId, request.id, input);
    } else {
      await workflowClient.revokeLeaveRequest(page._currentGroupId, request.id, input);
    }
    if (!task.isCurrent()) return;
    page._operationAttempts.delete(operationKey);
    page.setData({
      infoMessage:
        action === 'cancel'
          ? '请假申请已取消。'
          : '请假已撤销；如需恢复原排班，请重新生成或发布排班。',
    });
    notifyCalendarChanged(page);
    await loadLeavePageWithCapability(page, { preserveTab: true });
    if (!task.isCurrent()) return;
  } catch (error) {
    if (!task.isCurrent()) return;
    page.setData({ errorMessage: getMutationErrorMessage(error) });
    if (isConflict(error)) {
      page._operationAttempts.delete(operationKey);
      await loadLeavePageWithCapability(page, { preserveTab: true });
      if (!task.isCurrent()) return;
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
      detail: formatAffectedAssignment(assignment),
      id: assignment.assignmentId,
      statusLabel: '',
      tone: 'primary',
    })),
    approvalStatistics: summarizeStatisticsDelta(preview.statisticsDelta),
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
    detail: `${shift.businessDate} ${shift.shiftTypeName}`,
    id: shift.assignmentId,
    statusLabel: shift.isCovered ? '已安排' : '未安排',
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
  const today = getTodayCalendarDate();
  const endDateMin = startDate > today ? startDate : today;
  return {
    endDate,
    endDateDisplay: formatDateWithWeekday(endDate),
    endDateMin,
    formErrorMessage: '',
    leaveDayCount: getLeaveDayCount(startDate, endDate),
    startDate,
    startDateDisplay: formatDateWithWeekday(startDate),
  };
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

function notifyCalendarChanged(page: LeavePageInstance): void {
  page.triggerEvent?.('calendarchanged', { groupId: page._currentGroupId });
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
