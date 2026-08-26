import { ClientCoreError } from '@schedule/client-core';
import type {
  CalendarDutyAssignment,
  CalendarReadModel,
  DutyAdjustmentPreview,
  DutyAdjustmentRequest,
  GroupSummary,
} from '@schedule/contracts';
import {
  filterOperableAssignments,
  formatAssignmentSummaryOption as formatAssignmentSummary,
  getCurrentWorkflowBusinessMonth as getCurrentBusinessMonth,
  getDutyAdjustmentNextStatusDescription as getNextStatusDescription,
  getDutyAdjustmentStatusLabel as getDutyStatusLabel,
  getWorkflowDutyMembershipId as getDutyMembershipId,
  getWorkflowStatusTone as getStatusTone,
  isWorkflowBusinessMonth as isBusinessMonth,
  isWorkflowWeekendDate,
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

interface SelectionOption {
  readonly isWeekend?: boolean;
  readonly label: string;
  readonly value: string;
}

interface ConflictView {
  readonly id: string;
  readonly message: string;
}

interface DutyRequestView {
  readonly canAccept: boolean;
  readonly canApprove: boolean;
  readonly canCancel: boolean;
  readonly canReject: boolean;
  readonly canRevoke: boolean;
  readonly counterpartName: string;
  readonly decidedByLabel: string;
  readonly deductedName: string;
  readonly id: string;
  readonly overtimeName: string;
  readonly reasonLabel: string;
  readonly shiftLabel: string;
  readonly statusLabel: string;
  readonly statusTone: string;
  readonly version: number;
}

interface DutyPageData {
  readonly adminAssignmentIndex: number;
  readonly adminAssignmentOptions: readonly SelectionOption[];
  readonly adminBusy: boolean;
  readonly adminErrorMessage: string;
  readonly adminFormVisible: boolean;
  readonly adminOvertimeMemberIndex: number;
  readonly adminOvertimeMemberOptions: readonly SelectionOption[];
  readonly adminPreviewConflicts: readonly ConflictView[];
  readonly adminPreviewReady: boolean;
  readonly adminPreviewSummary: string;
  readonly adminReason: string;
  readonly archivedDutyCount: number;
  readonly autoAcceptSwaps: boolean;
  readonly businessMonth: string;
  readonly canApprove: boolean;
  readonly completedAdjustments: readonly DutyRequestView[];
  readonly completedCount: number;
  readonly currentGroupName: string;
  readonly currentGroupRole: string;
  readonly embedded: boolean;
  readonly errorMessage: string;
  readonly handledApprovalCount: number;
  readonly handledApprovals: readonly DutyRequestView[];
  readonly incomingCount: number;
  readonly incomingRequests: readonly DutyRequestView[];
  readonly infoMessage: string;
  readonly mutationBusyIds: readonly string[];
  readonly myAssignmentIndex: number;
  readonly myAssignmentOptions: readonly SelectionOption[];
  readonly myRequestCount: number;
  readonly myRequests: readonly DutyRequestView[];
  readonly overtimeMemberIndex: number;
  readonly overtimeMemberOptions: readonly SelectionOption[];
  readonly pageScrollStyle: string;
  readonly pendingApprovalCount: number;
  readonly pendingApprovals: readonly DutyRequestView[];
  readonly reason: string;
  readonly requestBusy: boolean;
  readonly requestErrorMessage: string;
  readonly requestFormVisible: boolean;
  readonly requestPreviewConflicts: readonly ConflictView[];
  readonly requestPreviewReady: boolean;
  readonly requestPreviewSummary: string;
  readonly requiresApproval: boolean;
  readonly revokeBusy: boolean;
  readonly revokeErrorMessage: string;
  readonly revokeReason: string;
  readonly revokeVisible: boolean;
  readonly settingsBusy: boolean;
  readonly shellHeaderStyle: string;
  readonly state: PageState;
  readonly viewportClass: string;
}

interface DutyPairSnapshot {
  readonly coveredAssignmentId: string;
  readonly overtimeMembershipId: string;
}

interface DutyPageInstance {
  _adminPreview: DutyAdjustmentPreview | undefined;
  _adminPreviewInput: DutyPairSnapshot | undefined;
  _calendar: CalendarReadModel | undefined;
  _calendarSerial: number;
  _currentGroupId: string;
  _hasShown: boolean;
  _loadSerial: number;
  _myMembershipId: string;
  _operationAttempts: Map<string, WorkflowOperationAttempt<Readonly<Record<string, unknown>>>>;
  _rawApprovals: readonly DutyAdjustmentRequest[];
  _rawMyRequests: readonly DutyAdjustmentRequest[];
  _requestPreview: DutyAdjustmentPreview | undefined;
  _requestPreviewInput: DutyPairSnapshot | undefined;
  _requestedGroupId: string;
  _revokeTarget: DutyAdjustmentRequest | undefined;
  readonly data: DutyPageData;
  setData(patch: Partial<DutyPageData>, callback?: () => void): void;
  triggerEvent?(name: string, detail: Readonly<Record<string, unknown>>): void;
}

interface ValueEvent {
  readonly detail: { readonly checked?: boolean; readonly value: boolean | string };
}

interface DatasetEvent {
  readonly currentTarget: {
    readonly dataset: Readonly<Record<string, string | undefined>>;
  };
}

const workflowClient = createRuntimeWorkflowClient(
  getStoredWechatToken,
  getWechatRequestAuthentication(),
);
const workbenchClient = createWorkbenchReadClient();
const initialMonth = getCurrentBusinessMonth();

export function createDutyPanelControllerDefinition(embedded = false) {
  return {
    data: {
      adminAssignmentIndex: -1,
      adminAssignmentOptions: [],
      adminBusy: false,
      adminErrorMessage: '',
      adminFormVisible: false,
      adminOvertimeMemberIndex: -1,
      adminOvertimeMemberOptions: [],
      adminPreviewConflicts: [],
      adminPreviewReady: false,
      adminPreviewSummary: '',
      adminReason: '',
      archivedDutyCount: 0,
      autoAcceptSwaps: false,
      businessMonth: initialMonth,
      canApprove: false,
      completedAdjustments: [],
      completedCount: 0,
      currentGroupName: '正在读取群组',
      currentGroupRole: '',
      embedded,
      errorMessage: '',
      handledApprovalCount: 0,
      handledApprovals: [],
      incomingCount: 0,
      incomingRequests: [],
      infoMessage: '',
      mutationBusyIds: [],
      myAssignmentIndex: -1,
      myAssignmentOptions: [],
      myRequestCount: 0,
      myRequests: [],
      overtimeMemberIndex: -1,
      overtimeMemberOptions: [],
      pageScrollStyle: 'height:calc(100% - 64px);',
      pendingApprovalCount: 0,
      pendingApprovals: [],
      reason: '',
      requestBusy: false,
      requestErrorMessage: '',
      requestFormVisible: false,
      requestPreviewConflicts: [],
      requestPreviewReady: false,
      requestPreviewSummary: '',
      requiresApproval: false,
      revokeBusy: false,
      revokeErrorMessage: '',
      revokeReason: '',
      revokeVisible: false,
      settingsBusy: false,
      shellHeaderStyle: 'height:64px;min-height:64px;padding-top:8px;',
      state: 'loading',
      viewportClass: '',
    } satisfies DutyPageData,

    _adminPreview: undefined,
    _adminPreviewInput: undefined,
    _calendar: undefined,
    _calendarSerial: 0,
    _currentGroupId: '',
    _hasShown: false,
    _loadSerial: 0,
    _myMembershipId: '',
    _operationAttempts: new Map(),
    _rawApprovals: [],
    _rawMyRequests: [],
    _requestPreview: undefined,
    _requestPreviewInput: undefined,
    _requestedGroupId: '',
    _revokeTarget: undefined,

    onLoad(this: DutyPageInstance, query: Readonly<Record<string, string | undefined>>): void {
      this._requestedGroupId = decodeQueryValue(query['groupId']);
      this.setData(
        this.data.embedded
          ? { pageScrollStyle: 'height:100%;', viewportClass: '' }
          : createShellLayoutPatch(),
      );
      void loadDutyPageWithCapability(this);
    },

    onShow(this: DutyPageInstance): void {
      if (!this._hasShown) {
        this._hasShown = true;
        return;
      }
      void loadDutyPageWithCapability(this, { preserveForms: true });
    },

    handleBack(): void {
      wx.navigateBack({ delta: 1 });
    },

    handleRetry(this: DutyPageInstance): void {
      void loadDutyPageWithCapability(this, { preserveForms: true });
    },

    handleLeaveNav(this: DutyPageInstance): void {
      navigateWorkflowPage(this, 'leave');
    },

    handleSwapNav(this: DutyPageInstance): void {
      navigateWorkflowPage(this, 'swap');
    },

    handleUnavailable(this: DutyPageInstance): void {
      this.setData({ infoMessage: '更多功能将在后续阶段开放。' });
    },

    handleOpenRequestForm(this: DutyPageInstance): void {
      resetRequestForm(this);
      this.setData({ requestFormVisible: true });
    },

    handleCloseRequestForm(this: DutyPageInstance): void {
      if (!this.data.requestBusy) this.setData({ requestFormVisible: false });
    },

    handleOpenAdminForm(this: DutyPageInstance): void {
      if (!this.data.canApprove) return;
      resetAdminForm(this);
      this.setData({ adminFormVisible: true });
    },

    handleCloseAdminForm(this: DutyPageInstance): void {
      if (!this.data.adminBusy) this.setData({ adminFormVisible: false });
    },

    handleMonthChange(this: DutyPageInstance, event: ValueEvent): void {
      if (typeof event.detail.value !== 'string' || !isBusinessMonth(event.detail.value)) return;
      this.setData({ businessMonth: event.detail.value });
      clearRequestPreview(this);
      clearAdminPreview(this);
      this.setData({
        adminAssignmentIndex: -1,
        adminAssignmentOptions: [],
        adminOvertimeMemberOptions: [],
        adminOvertimeMemberIndex: -1,
        myAssignmentIndex: -1,
        myAssignmentOptions: [],
        overtimeMemberIndex: -1,
        overtimeMemberOptions: [],
      });
      void loadCalendarMonth(this, event.detail.value);
    },

    handleMyAssignmentChange(this: DutyPageInstance, event: ValueEvent): void {
      setIndex(this, 'myAssignmentIndex', event, this.data.myAssignmentOptions.length);
      clearRequestPreview(this);
    },

    handleOvertimeMemberChange(this: DutyPageInstance, event: ValueEvent): void {
      setIndex(this, 'overtimeMemberIndex', event, this.data.overtimeMemberOptions.length);
      clearRequestPreview(this);
    },

    handleReasonInput(this: DutyPageInstance, event: ValueEvent): void {
      if (typeof event.detail.value === 'string') {
        this.setData({ reason: event.detail.value, requestErrorMessage: '' });
      }
    },

    handlePreview(this: DutyPageInstance): void {
      void computeRequestPreview(this);
    },

    handleSubmit(this: DutyPageInstance): void {
      void submitDutyRequest(this);
    },

    handleAdminAssignmentChange(this: DutyPageInstance, event: ValueEvent): void {
      const index = readIndex(event, this.data.adminAssignmentOptions.length);
      if (index < 0) return;
      this.setData({ adminAssignmentIndex: index, adminOvertimeMemberIndex: -1 });
      clearAdminPreview(this);
      syncAdminOvertimeOptions(this);
    },

    handleAdminOvertimeMemberChange(this: DutyPageInstance, event: ValueEvent): void {
      setIndex(
        this,
        'adminOvertimeMemberIndex',
        event,
        this.data.adminOvertimeMemberOptions.length,
      );
      clearAdminPreview(this);
    },

    handleAdminReasonInput(this: DutyPageInstance, event: ValueEvent): void {
      if (typeof event.detail.value === 'string') {
        this.setData({ adminReason: event.detail.value, adminErrorMessage: '' });
      }
    },

    handleAdminPreview(this: DutyPageInstance): void {
      void computeAdminPreview(this);
    },

    handleAdminSubmit(this: DutyPageInstance): void {
      void submitDirectDuty(this);
    },

    handleAccept(this: DutyPageInstance, event: DatasetEvent): void {
      void mutateDuty(this, event.currentTarget.dataset['id'], 'accept');
    },

    handleApprove(this: DutyPageInstance, event: DatasetEvent): void {
      void mutateDuty(this, event.currentTarget.dataset['id'], 'approve');
    },

    handleReject(this: DutyPageInstance, event: DatasetEvent): void {
      void confirmDutyMutation(this, event.currentTarget.dataset['id'], 'reject');
    },

    handleCancel(this: DutyPageInstance, event: DatasetEvent): void {
      void confirmDutyMutation(this, event.currentTarget.dataset['id'], 'cancel');
    },

    handleRevoke(this: DutyPageInstance, event: DatasetEvent): void {
      const request = findDutyRequest(this, event.currentTarget.dataset['id']);
      if (request === undefined || request.status !== 'completed') return;
      this._revokeTarget = request;
      this.setData({
        revokeErrorMessage: '',
        revokeReason: '',
        revokeVisible: true,
      });
    },

    handleRevokeReasonInput(this: DutyPageInstance, event: ValueEvent): void {
      if (typeof event.detail.value === 'string') {
        this.setData({ revokeReason: event.detail.value, revokeErrorMessage: '' });
      }
    },

    handleCloseRevoke(this: DutyPageInstance): void {
      if (this.data.revokeBusy) return;
      this._revokeTarget = undefined;
      this.setData({ revokeVisible: false });
    },

    handleConfirmRevoke(this: DutyPageInstance): void {
      void revokeDuty(this);
    },

    handleGroupApprovalToggle(this: DutyPageInstance, event: ValueEvent): void {
      const checked = readChecked(event);
      if (checked !== undefined) void updateGroupApproval(this, checked);
    },

    handleAutoAcceptToggle(this: DutyPageInstance, event: ValueEvent): void {
      const checked = readChecked(event);
      if (checked !== undefined) void updateAutoAccept(this, checked);
    },
  };
}

async function loadDutyPageWithCapability(
  page: DutyPageInstance,
  options: { readonly preserveForms?: boolean } = {},
): Promise<void> {
  const serial = ++page._loadSerial;
  if (options.preserveForms !== true) {
    page._requestPreview = undefined;
    page._requestPreviewInput = undefined;
    page._adminPreview = undefined;
    page._adminPreviewInput = undefined;
  }
  page.setData({ errorMessage: '', state: 'loading' });
  try {
    await requireClientCapability('workflows');
    const groups = await workbenchClient.listGroups();
    if (serial !== page._loadSerial) return;
    const group = resolveTargetGroup(groups, page._requestedGroupId);
    if (group === undefined) throw new Error('当前没有可使用加扣班功能的工作群组。');
    if (group.role === 'guest') throw new Error('访客不能发起或处理加扣班。');
    page._currentGroupId = group.id;
    const canApprove =
      group.isDeveloperAdmin === true || group.role === 'owner' || group.role === 'administrator';
    const [calendar, members, groupSettings, mySettings, mine, approvals] = await Promise.all([
      workbenchClient.getCalendar(group.id, page.data.businessMonth),
      workbenchClient.getMembers(group.id),
      workflowClient.getGroupDutyAdjustmentSettings(group.id),
      workflowClient.getMyDutyAdjustmentSettings(group.id),
      workflowClient.listMyDutyAdjustments(group.id),
      canApprove ? workflowClient.listDutyAdjustmentApprovals(group.id) : Promise.resolve([]),
    ]);
    if (serial !== page._loadSerial || page._currentGroupId !== group.id) return;
    page._calendar = calendar;
    page._rawMyRequests = mine;
    page._rawApprovals = approvals;
    page._myMembershipId = members.find((member) => member.isCurrentUser)?.id ?? '';
    if (page._myMembershipId === '' && group.isDeveloperAdmin !== true) {
      throw new Error('当前账号未关联群组成员。');
    }
    page.setData({
      autoAcceptSwaps: mySettings.autoAcceptSwaps,
      canApprove,
      currentGroupName: group.name,
      currentGroupRole: formatRole(group.role),
      requiresApproval: groupSettings.requiresApproval,
      state: 'ready',
    });
    syncCandidates(page);
    syncDutyLists(page);
  } catch (error) {
    if (serial !== page._loadSerial) return;
    page._currentGroupId = '';
    page.setData({
      canApprove: false,
      errorMessage: toUserMessage(error, '加扣班数据暂时无法加载，请稍后重试。'),
      state: 'error',
    });
  }
}

async function loadCalendarMonth(page: DutyPageInstance, month: string): Promise<void> {
  if (page._currentGroupId === '') return;
  const serial = ++page._calendarSerial;
  const groupId = page._currentGroupId;
  page.setData({ requestBusy: true, requestErrorMessage: '' });
  try {
    const calendar = await workbenchClient.getCalendar(groupId, month);
    if (
      serial !== page._calendarSerial ||
      page._currentGroupId !== groupId ||
      page.data.businessMonth !== month
    ) {
      return;
    }
    page._calendar = calendar;
    syncCandidates(page);
  } catch (error) {
    if (serial === page._calendarSerial) {
      page.setData({
        requestErrorMessage: toUserMessage(error, '加扣班月份暂时无法加载，请稍后重试。'),
      });
    }
  } finally {
    if (serial === page._calendarSerial) page.setData({ requestBusy: false });
  }
}

function syncCandidates(page: DutyPageInstance): void {
  const assignments = operableAssignments(page._calendar);
  page.setData({
    adminAssignmentOptions: assignments
      .filter((assignment) => getDutyMembershipId(assignment) !== undefined)
      .map(createAssignmentOption),
    myAssignmentOptions: assignments
      .filter((assignment) => getDutyMembershipId(assignment) === page._myMembershipId)
      .map(createAssignmentOption),
    overtimeMemberOptions: (page._calendar?.members ?? [])
      .filter((member) => member.membershipId !== page._myMembershipId)
      .map((member) => ({ label: member.realName, value: member.membershipId })),
  });
  syncAdminOvertimeOptions(page);
}

function syncAdminOvertimeOptions(page: DutyPageInstance): void {
  const assignmentId = page.data.adminAssignmentOptions[page.data.adminAssignmentIndex]?.value;
  const assignment = page._calendar?.assignments.find((item) => item.id === assignmentId);
  const deductedMembershipId =
    assignment === undefined ? undefined : getDutyMembershipId(assignment);
  page.setData({
    adminOvertimeMemberOptions: (page._calendar?.members ?? [])
      .filter((member) => member.membershipId !== deductedMembershipId)
      .map((member) => ({ label: member.realName, value: member.membershipId })),
  });
}

function syncDutyLists(page: DutyPageInstance): void {
  const incoming = page._rawMyRequests.filter(
    (request) =>
      request.overtimeMembershipId === page._myMembershipId && request.status === 'pending_target',
  );
  const pending = page._rawApprovals.filter((request) => request.status === 'pending_approval');
  const handled = page._rawApprovals.filter(
    (request) =>
      request.status === 'cancelled' ||
      request.status === 'rejected' ||
      request.status === 'revoked',
  );
  const completed = page._rawApprovals.filter(
    (request) => request.status === 'completed' && request.isRevocable !== false,
  );
  const archived = page._rawApprovals.filter(
    (request) => request.status === 'completed' && request.isRevocable === false,
  );
  page.setData({
    archivedDutyCount: archived.length,
    completedAdjustments: completed.map((request) => createDutyView(page, request, 'completed')),
    completedCount: completed.length,
    handledApprovalCount: handled.length,
    handledApprovals: handled.map((request) => createDutyView(page, request, 'handled')),
    incomingCount: incoming.length,
    incomingRequests: incoming.map((request) => createDutyView(page, request, 'incoming')),
    myRequestCount: page._rawMyRequests.length,
    myRequests: page._rawMyRequests.map((request) => createDutyView(page, request, 'mine')),
    pendingApprovalCount: pending.length,
    pendingApprovals: pending.map((request) => createDutyView(page, request, 'approval')),
  });
}

async function computeRequestPreview(page: DutyPageInstance): Promise<void> {
  const input = getRequestPair(page);
  if (input === undefined) {
    page.setData({ requestErrorMessage: '请先选择自己的班次和加班成员。' });
    return;
  }
  clearRequestPreview(page);
  page.setData({ requestBusy: true });
  try {
    const preview = await workflowClient.previewDutyAdjustment(page._currentGroupId, input);
    page._requestPreview = preview;
    page._requestPreviewInput = Object.freeze({ ...input });
    page.setData(createPreviewPatch(preview, 'request'));
  } catch (error) {
    await handlePreviewError(page, error, 'request');
  } finally {
    page.setData({ requestBusy: false });
  }
}

async function submitDutyRequest(page: DutyPageInstance): Promise<void> {
  if (page.data.requestBusy || page._currentGroupId === '') return;
  const pair = getRequestPair(page);
  if (pair === undefined) {
    page.setData({ requestErrorMessage: '请先选择自己的班次和加班成员。' });
    return;
  }
  if (!pairMatches(page._requestPreviewInput, pair)) {
    await computeRequestPreview(page);
    if (!pairMatches(page._requestPreviewInput, pair)) return;
  }
  const reason = page.data.reason.trim();
  const payload = { ...pair, ...(reason === '' ? {} : { reason }) };
  const operationKey = `${page._currentGroupId}:duty-adjustment:create`;
  const request = resolveOperation(page, operationKey, payload);
  page.setData({ requestBusy: true, requestErrorMessage: '', infoMessage: '' });
  try {
    const created = await workflowClient.createDutyAdjustmentRequest(page._currentGroupId, request);
    page._operationAttempts.delete(operationKey);
    page.setData({
      infoMessage:
        created.status === 'completed'
          ? '加扣班已生效，加班成员将代值该班次。'
          : created.status === 'pending_approval'
            ? '加扣班申请已提交，等待管理员审批。'
            : '加扣班申请已提交，等待加班成员接受。',
      requestFormVisible: false,
    });
    resetRequestForm(page);
    notifyCalendarChanged(page);
    await loadDutyPageWithCapability(page, { preserveForms: true });
  } catch (error) {
    page.setData({ requestErrorMessage: getMutationErrorMessage(error) });
    if (isConflict(error)) {
      page._operationAttempts.delete(operationKey);
      clearRequestPreview(page);
      await loadDutyPageWithCapability(page, { preserveForms: true });
    }
  } finally {
    page.setData({ requestBusy: false });
  }
}

async function computeAdminPreview(page: DutyPageInstance): Promise<void> {
  const input = getAdminPair(page);
  if (input === undefined) {
    page.setData({ adminErrorMessage: '请选择被代班班次和加班成员。' });
    return;
  }
  clearAdminPreview(page);
  page.setData({ adminBusy: true });
  try {
    const preview = await workflowClient.previewDutyAdjustment(page._currentGroupId, input);
    page._adminPreview = preview;
    page._adminPreviewInput = Object.freeze({ ...input });
    page.setData(createPreviewPatch(preview, 'admin'));
  } catch (error) {
    await handlePreviewError(page, error, 'admin');
  } finally {
    page.setData({ adminBusy: false });
  }
}

async function submitDirectDuty(page: DutyPageInstance): Promise<void> {
  if (!page.data.canApprove || page.data.adminBusy || page._currentGroupId === '') return;
  const pair = getAdminPair(page);
  if (pair === undefined) {
    page.setData({ adminErrorMessage: '请选择被代班班次和加班成员。' });
    return;
  }
  if (!pairMatches(page._adminPreviewInput, pair)) {
    await computeAdminPreview(page);
    if (!pairMatches(page._adminPreviewInput, pair)) return;
  }
  const reason = page.data.adminReason.trim();
  const payload = { ...pair, ...(reason === '' ? {} : { reason }) };
  const operationKey = `${page._currentGroupId}:duty-adjustment:create-direct`;
  const request = resolveOperation(page, operationKey, payload);
  page.setData({ adminBusy: true, adminErrorMessage: '', infoMessage: '' });
  try {
    const created = await workflowClient.createDirectDutyAdjustment(page._currentGroupId, request);
    page._operationAttempts.delete(operationKey);
    page.setData({
      adminFormVisible: false,
      infoMessage: `管理员代值已生效：${created.deductedMemberName ?? ''} 扣班，${created.overtimeMemberName ?? ''} 加班。`,
    });
    resetAdminForm(page);
    notifyCalendarChanged(page);
    await loadDutyPageWithCapability(page, { preserveForms: true });
  } catch (error) {
    page.setData({ adminErrorMessage: getMutationErrorMessage(error) });
    if (isConflict(error)) {
      page._operationAttempts.delete(operationKey);
      clearAdminPreview(page);
      await loadDutyPageWithCapability(page, { preserveForms: true });
    }
  } finally {
    page.setData({ adminBusy: false });
  }
}

async function mutateDuty(
  page: DutyPageInstance,
  id: string | undefined,
  action: 'accept' | 'approve' | 'cancel' | 'reject',
): Promise<void> {
  const duty = findDutyRequest(page, id);
  if (duty === undefined || page.data.mutationBusyIds.includes(duty.id)) return;
  const operationKey = `${page._currentGroupId}:duty-adjustment:${action}:${duty.id}:${duty.version}`;
  const input = resolveOperation(page, operationKey, { expectedVersion: duty.version });
  page.setData({
    errorMessage: '',
    infoMessage: '',
    mutationBusyIds: [...page.data.mutationBusyIds, duty.id],
  });
  try {
    if (action === 'accept') {
      await workflowClient.acceptDutyAdjustment(page._currentGroupId, duty.id, input);
    } else if (action === 'approve') {
      await workflowClient.approveDutyAdjustment(page._currentGroupId, duty.id, input);
    } else if (action === 'cancel') {
      await workflowClient.cancelDutyAdjustment(page._currentGroupId, duty.id, input);
    } else {
      await workflowClient.rejectDutyAdjustment(page._currentGroupId, duty.id, input);
    }
    page._operationAttempts.delete(operationKey);
    page.setData({ infoMessage: '加扣班状态已更新。' });
    notifyCalendarChanged(page);
    await loadDutyPageWithCapability(page, { preserveForms: true });
  } catch (error) {
    page.setData({ errorMessage: getMutationErrorMessage(error) });
    if (isConflict(error)) {
      page._operationAttempts.delete(operationKey);
      await loadDutyPageWithCapability(page, { preserveForms: true });
    }
  } finally {
    page.setData({ mutationBusyIds: page.data.mutationBusyIds.filter((item) => item !== duty.id) });
  }
}

async function confirmDutyMutation(
  page: DutyPageInstance,
  id: string | undefined,
  action: 'cancel' | 'reject',
): Promise<void> {
  const duty = findDutyRequest(page, id);
  if (duty === undefined) return;
  const content =
    action === 'cancel'
      ? '确定撤销该加扣班申请吗？'
      : `确定驳回 ${duty.deductedMemberName ?? ''} 的加扣班申请吗？`;
  if (await showConfirm(content)) await mutateDuty(page, duty.id, action);
}

async function revokeDuty(page: DutyPageInstance): Promise<void> {
  const duty = page._revokeTarget;
  if (duty === undefined || page.data.revokeBusy) return;
  const reason = page.data.revokeReason.trim();
  const operationKey = `${page._currentGroupId}:duty-adjustment:revoke:${duty.id}:${duty.version}`;
  const input = resolveOperation(page, operationKey, {
    expectedVersion: duty.version,
    ...(reason === '' ? {} : { reason }),
  });
  page.setData({ revokeBusy: true, revokeErrorMessage: '' });
  try {
    await workflowClient.revokeDutyAdjustment(page._currentGroupId, duty.id, input);
    page._operationAttempts.delete(operationKey);
    page._revokeTarget = undefined;
    page.setData({
      infoMessage: '加扣班已撤销，被扣班成员恢复为实际值班人员。',
      revokeVisible: false,
    });
    notifyCalendarChanged(page);
    await loadDutyPageWithCapability(page, { preserveForms: true });
  } catch (error) {
    page.setData({ revokeErrorMessage: getMutationErrorMessage(error) });
    if (isConflict(error)) {
      page._operationAttempts.delete(operationKey);
      page._revokeTarget = undefined;
      page.setData({ revokeVisible: false });
      await loadDutyPageWithCapability(page, { preserveForms: true });
    }
  } finally {
    page.setData({ revokeBusy: false });
  }
}

async function updateGroupApproval(page: DutyPageInstance, checked: boolean): Promise<void> {
  if (!page.data.canApprove || page.data.settingsBusy) return;
  page.setData({ settingsBusy: true, errorMessage: '', infoMessage: '' });
  try {
    const result = await workflowClient.updateGroupDutyAdjustmentSettings(page._currentGroupId, {
      requiresApproval: checked,
    });
    page.setData({
      infoMessage: result.requiresApproval
        ? '加扣班已改为需要管理员审批。'
        : '加扣班已改为无需管理员审批。',
      requiresApproval: result.requiresApproval,
    });
  } catch (error) {
    page.setData({ errorMessage: toUserMessage(error, '加扣班设置暂时无法更新。') });
  } finally {
    page.setData({ settingsBusy: false });
  }
}

async function updateAutoAccept(page: DutyPageInstance, checked: boolean): Promise<void> {
  if (page.data.settingsBusy) return;
  page.setData({ settingsBusy: true, errorMessage: '', infoMessage: '' });
  try {
    const result = await workflowClient.updateMySwapSettings(page._currentGroupId, {
      autoAcceptSwaps: checked,
    });
    page.setData({
      autoAcceptSwaps: result.autoAcceptSwaps,
      infoMessage: result.autoAcceptSwaps
        ? '已开启自动接受换班/加扣班。'
        : '已关闭自动接受换班/加扣班。',
    });
  } catch (error) {
    page.setData({ errorMessage: toUserMessage(error, '加扣班设置暂时无法更新。') });
  } finally {
    page.setData({ settingsBusy: false });
  }
}

async function handlePreviewError(
  page: DutyPageInstance,
  error: unknown,
  form: 'admin' | 'request',
): Promise<void> {
  const message = isConflict(error)
    ? '排班数据已被其他操作更新，请重新选择班次并生成预览。'
    : toUserMessage(error, '加扣班预览暂时无法生成。');
  page.setData(
    form === 'admin' ? { adminErrorMessage: message } : { requestErrorMessage: message },
  );
  if (isConflict(error)) await loadDutyPageWithCapability(page, { preserveForms: true });
}

function syncAdminOvertimeOptionsAfterReset(page: DutyPageInstance): void {
  page.setData({ adminOvertimeMemberOptions: [] });
}

function resetRequestForm(page: DutyPageInstance): void {
  clearRequestPreview(page);
  page.setData({
    myAssignmentIndex: -1,
    overtimeMemberIndex: -1,
    reason: '',
    requestBusy: false,
    requestErrorMessage: '',
  });
}

function resetAdminForm(page: DutyPageInstance): void {
  clearAdminPreview(page);
  page.setData({
    adminAssignmentIndex: -1,
    adminBusy: false,
    adminErrorMessage: '',
    adminOvertimeMemberIndex: -1,
    adminReason: '',
  });
  syncAdminOvertimeOptionsAfterReset(page);
}

function clearRequestPreview(page: DutyPageInstance): void {
  page._requestPreview = undefined;
  page._requestPreviewInput = undefined;
  page.setData({
    requestErrorMessage: '',
    requestPreviewConflicts: [],
    requestPreviewReady: false,
    requestPreviewSummary: '',
  });
}

function clearAdminPreview(page: DutyPageInstance): void {
  page._adminPreview = undefined;
  page._adminPreviewInput = undefined;
  page.setData({
    adminErrorMessage: '',
    adminPreviewConflicts: [],
    adminPreviewReady: false,
    adminPreviewSummary: '',
  });
}

function createPreviewPatch(
  preview: DutyAdjustmentPreview,
  form: 'admin' | 'request',
): Partial<DutyPageData> {
  const summary = `${formatAssignmentSummary(preview.coveredAssignment)}；${preview.deductedMemberName ?? '原成员'} 扣班，${preview.overtimeMemberName ?? '加班成员'} 代值；${form === 'admin' ? '执行后立即生效，无需审批和成员同意。' : getNextStatusDescription(preview.nextStatus)}`;
  const conflicts = preview.conflicts.map((conflict, index) => ({
    id: `${conflict.code}-${conflict.membershipId}-${conflict.assignmentId ?? index}`,
    message: conflict.message,
  }));
  return form === 'admin'
    ? {
        adminPreviewConflicts: conflicts,
        adminPreviewReady: true,
        adminPreviewSummary: summary,
      }
    : {
        requestPreviewConflicts: conflicts,
        requestPreviewReady: true,
        requestPreviewSummary: summary,
      };
}

function createDutyView(
  page: DutyPageInstance,
  request: DutyAdjustmentRequest,
  context: 'approval' | 'completed' | 'handled' | 'incoming' | 'mine',
): DutyRequestView {
  const deductedIsCurrent = request.deductedMembershipId === page._myMembershipId;
  const counterpartName = deductedIsCurrent
    ? (request.overtimeMemberName ?? '对方')
    : (request.deductedMemberName ?? '对方');
  const pendingMine =
    deductedIsCurrent &&
    (request.status === 'pending_target' || request.status === 'pending_approval');
  return {
    canAccept: context === 'incoming' && request.status === 'pending_target',
    canApprove: context === 'approval' && request.status === 'pending_approval',
    canCancel: context === 'mine' && pendingMine,
    canReject:
      (context === 'incoming' && request.status === 'pending_target') ||
      (context === 'approval' && request.status === 'pending_approval'),
    canRevoke:
      (context === 'completed' || context === 'mine') &&
      request.status === 'completed' &&
      request.isRevocable !== false,
    counterpartName,
    decidedByLabel: request.decidedByMemberName ?? '—',
    deductedName: request.deductedMemberName ?? '原成员',
    id: request.id,
    overtimeName: request.overtimeMemberName ?? '加班成员',
    reasonLabel:
      request.revocationReason ?? request.revocationBlockedReason ?? request.reason ?? '',
    shiftLabel: formatAssignmentSummary(request.coveredAssignment),
    statusLabel: getDutyStatusLabel(request.status),
    statusTone: `is-${getStatusTone(request.status)}`,
    version: request.version,
  };
}

function getRequestPair(page: DutyPageInstance): DutyPairSnapshot | undefined {
  const coveredAssignmentId = page.data.myAssignmentOptions[page.data.myAssignmentIndex]?.value;
  const overtimeMembershipId =
    page.data.overtimeMemberOptions[page.data.overtimeMemberIndex]?.value;
  return coveredAssignmentId === undefined || overtimeMembershipId === undefined
    ? undefined
    : { coveredAssignmentId, overtimeMembershipId };
}

function getAdminPair(page: DutyPageInstance): DutyPairSnapshot | undefined {
  const coveredAssignmentId =
    page.data.adminAssignmentOptions[page.data.adminAssignmentIndex]?.value;
  const overtimeMembershipId =
    page.data.adminOvertimeMemberOptions[page.data.adminOvertimeMemberIndex]?.value;
  return coveredAssignmentId === undefined || overtimeMembershipId === undefined
    ? undefined
    : { coveredAssignmentId, overtimeMembershipId };
}

function pairMatches(previous: DutyPairSnapshot | undefined, current: DutyPairSnapshot): boolean {
  return (
    previous?.coveredAssignmentId === current.coveredAssignmentId &&
    previous.overtimeMembershipId === current.overtimeMembershipId
  );
}

function setIndex(
  page: DutyPageInstance,
  key: 'adminOvertimeMemberIndex' | 'myAssignmentIndex' | 'overtimeMemberIndex',
  event: ValueEvent,
  length: number,
): void {
  const index = readIndex(event, length);
  if (index >= 0) page.setData({ [key]: index } as Partial<DutyPageData>);
}

function readIndex(event: ValueEvent, length: number): number {
  const index = Number(event.detail.value);
  return Number.isInteger(index) && index >= 0 && index < length ? index : -1;
}

function readChecked(event: ValueEvent): boolean | undefined {
  if (typeof event.detail.checked === 'boolean') return event.detail.checked;
  return typeof event.detail.value === 'boolean' ? event.detail.value : undefined;
}

function operableAssignments(
  calendar: CalendarReadModel | undefined,
): readonly CalendarDutyAssignment[] {
  return filterOperableAssignments(calendar?.assignments ?? []);
}

function createAssignmentOption(assignment: CalendarDutyAssignment): SelectionOption {
  return {
    isWeekend: isWorkflowWeekendDate(assignment.businessDate),
    label: formatAssignmentSummary(assignment),
    value: assignment.id,
  };
}

function notifyCalendarChanged(page: DutyPageInstance): void {
  page.triggerEvent?.('calendarchanged', { groupId: page._currentGroupId });
}

function navigateWorkflowPage(page: DutyPageInstance, target: 'leave' | 'swap'): void {
  if (page._currentGroupId === '') return;
  wx.redirectTo({
    url: `/subpackages/workflows/pages/${target}/index?groupId=${encodeURIComponent(page._currentGroupId)}`,
  });
}

function findDutyRequest(
  page: DutyPageInstance,
  id: string | undefined,
): DutyAdjustmentRequest | undefined {
  if (id === undefined) return undefined;
  return [...page._rawMyRequests, ...page._rawApprovals].find((request) => request.id === id);
}

function resolveOperation<Payload extends Readonly<Record<string, unknown>>>(
  page: DutyPageInstance,
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

function formatRole(role: GroupSummary['role']): string {
  return role === 'owner' ? '群主' : role === 'administrator' ? '管理员' : '成员';
}

function createShellLayoutPatch(): Pick<
  DutyPageData,
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
  return toUserMessage(error, '加扣班操作暂时无法完成，请稍后重试。');
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
      success: (result) => resolve(result.confirm),
      fail: () => resolve(false),
      title: '请确认',
    });
  });
}
