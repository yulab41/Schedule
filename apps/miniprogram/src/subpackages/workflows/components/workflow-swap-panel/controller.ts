import { ClientCoreError } from '@schedule/client-core';
import type {
  CalendarDutyAssignment,
  CalendarReadModel,
  GroupSummary,
  SwapPreview,
  SwapRequest,
  SwapRequestStatus,
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

interface SelectionOption {
  readonly isWeekend?: boolean;
  readonly label: string;
  readonly value: string;
}

interface ConflictView {
  readonly id: string;
  readonly message: string;
}

interface SwapRequestView {
  readonly canAccept: boolean;
  readonly canApprove: boolean;
  readonly canCancel: boolean;
  readonly canReject: boolean;
  readonly canRevoke: boolean;
  readonly counterpartName: string;
  readonly decidedByLabel: string;
  readonly id: string;
  readonly initiatorName: string;
  readonly pairLabel: string;
  readonly reasonLabel: string;
  readonly statusLabel: string;
  readonly statusTone: string;
  readonly targetName: string;
  readonly version: number;
}

interface SwapPageData {
  readonly adminBusy: boolean;
  readonly adminErrorMessage: string;
  readonly adminFormVisible: boolean;
  readonly adminInitiatorAssignmentIndex: number;
  readonly adminInitiatorAssignmentOptions: readonly SelectionOption[];
  readonly adminInitiatorMemberIndex: number;
  readonly adminInitiatorMemberOptions: readonly SelectionOption[];
  readonly adminInitiatorMonth: string;
  readonly adminPreviewConflicts: readonly ConflictView[];
  readonly adminPreviewReady: boolean;
  readonly adminPreviewSummary: string;
  readonly adminTargetAssignmentIndex: number;
  readonly adminTargetAssignmentOptions: readonly SelectionOption[];
  readonly adminTargetMemberIndex: number;
  readonly adminTargetMemberOptions: readonly SelectionOption[];
  readonly adminTargetMonth: string;
  readonly archivedSwapCount: number;
  readonly autoAcceptSwaps: boolean;
  readonly canApprove: boolean;
  readonly completedSwapCount: number;
  readonly completedSwaps: readonly SwapRequestView[];
  readonly currentGroupName: string;
  readonly currentGroupRole: string;
  readonly embedded: boolean;
  readonly errorMessage: string;
  readonly handledApprovalCount: number;
  readonly handledApprovals: readonly SwapRequestView[];
  readonly incomingCount: number;
  readonly incomingRequests: readonly SwapRequestView[];
  readonly infoMessage: string;
  readonly myAssignmentIndex: number;
  readonly myAssignmentMonth: string;
  readonly myAssignmentOptions: readonly SelectionOption[];
  readonly myRequestCount: number;
  readonly myRequests: readonly SwapRequestView[];
  readonly mutationBusyIds: readonly string[];
  readonly pageScrollStyle: string;
  readonly pendingApprovalCount: number;
  readonly pendingApprovals: readonly SwapRequestView[];
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
  readonly targetAssignmentIndex: number;
  readonly targetAssignmentMonth: string;
  readonly targetAssignmentOptions: readonly SelectionOption[];
  readonly targetMemberIndex: number;
  readonly targetMemberOptions: readonly SelectionOption[];
  readonly viewportClass: string;
}

interface SwapPageInstance {
  _adminPreview: SwapPreview | undefined;
  _calendarRequestSerials: Map<string, number>;
  _calendarSerial: number;
  _calendars: Map<string, CalendarReadModel>;
  _currentGroupId: string;
  _hasShown: boolean;
  _loadSerial: number;
  _myMembershipId: string;
  _operationAttempts: Map<string, WorkflowOperationAttempt<Readonly<Record<string, unknown>>>>;
  _rawApprovals: readonly SwapRequest[];
  _rawMyRequests: readonly SwapRequest[];
  _requestPreview: SwapPreview | undefined;
  _requestedGroupId: string;
  _revokeTarget: SwapRequest | undefined;
  readonly data: SwapPageData;
  setData(patch: Partial<SwapPageData>, callback?: () => void): void;
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

export function createSwapPanelControllerDefinition(embedded = false) {
  return {
    data: {
      adminBusy: false,
      adminErrorMessage: '',
      adminFormVisible: false,
      adminInitiatorAssignmentIndex: -1,
      adminInitiatorAssignmentOptions: [],
      adminInitiatorMemberIndex: -1,
      adminInitiatorMemberOptions: [],
      adminInitiatorMonth: initialMonth,
      adminPreviewConflicts: [],
      adminPreviewReady: false,
      adminPreviewSummary: '',
      adminTargetAssignmentIndex: -1,
      adminTargetAssignmentOptions: [],
      adminTargetMemberIndex: -1,
      adminTargetMemberOptions: [],
      adminTargetMonth: initialMonth,
      archivedSwapCount: 0,
      autoAcceptSwaps: false,
      canApprove: false,
      completedSwapCount: 0,
      completedSwaps: [],
      currentGroupName: '正在读取群组',
      currentGroupRole: '',
      embedded,
      errorMessage: '',
      handledApprovalCount: 0,
      handledApprovals: [],
      incomingCount: 0,
      incomingRequests: [],
      infoMessage: '',
      myAssignmentIndex: -1,
      myAssignmentMonth: initialMonth,
      myAssignmentOptions: [],
      myRequestCount: 0,
      myRequests: [],
      mutationBusyIds: [],
      pageScrollStyle: 'height:calc(100% - 64px);',
      pendingApprovalCount: 0,
      pendingApprovals: [],
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
      targetAssignmentIndex: -1,
      targetAssignmentMonth: initialMonth,
      targetAssignmentOptions: [],
      targetMemberIndex: -1,
      targetMemberOptions: [],
      viewportClass: '',
    } satisfies SwapPageData,

    _adminPreview: undefined,
    _calendarRequestSerials: new Map(),
    _calendarSerial: 0,
    _calendars: new Map(),
    _currentGroupId: '',
    _hasShown: false,
    _loadSerial: 0,
    _myMembershipId: '',
    _operationAttempts: new Map(),
    _rawApprovals: [],
    _rawMyRequests: [],
    _requestPreview: undefined,
    _requestedGroupId: '',
    _revokeTarget: undefined,

    onLoad(this: SwapPageInstance, query: Readonly<Record<string, string | undefined>>): void {
      this._requestedGroupId = decodeQueryValue(query['groupId']);
      this._calendarRequestSerials = new Map();
      this._calendars = new Map();
      this.setData(
        this.data.embedded
          ? { pageScrollStyle: 'height:100%;', viewportClass: '' }
          : createShellLayoutPatch(),
      );
      void loadSwapPageWithCapability(this);
    },

    onShow(this: SwapPageInstance): void {
      if (!this._hasShown) {
        this._hasShown = true;
        return;
      }
      void loadSwapPageWithCapability(this, { preserveForms: true });
    },

    handleBack(): void {
      wx.navigateBack({ delta: 1 });
    },

    handleRetry(this: SwapPageInstance): void {
      void loadSwapPageWithCapability(this, { preserveForms: true });
    },

    handleLeaveNav(this: SwapPageInstance): void {
      if (this._currentGroupId === '') return;
      wx.redirectTo({
        url: `/subpackages/workflows/pages/leave/index?groupId=${encodeURIComponent(this._currentGroupId)}`,
      });
    },

    handleDutyNav(this: SwapPageInstance): void {
      if (this._currentGroupId === '') return;
      wx.redirectTo({
        url: `/subpackages/workflows/pages/duty/index?groupId=${encodeURIComponent(this._currentGroupId)}`,
      });
    },

    handleUnavailable(this: SwapPageInstance, event: DatasetEvent): void {
      const label = event.currentTarget.dataset['label'] ?? '此功能';
      this.setData({ infoMessage: `${label}将在后续 P7 阶段开放。` });
    },

    handleOpenRequestForm(this: SwapPageInstance): void {
      resetRequestForm(this);
      this.setData({ requestFormVisible: true });
    },

    handleCloseRequestForm(this: SwapPageInstance): void {
      if (!this.data.requestBusy) this.setData({ requestFormVisible: false });
    },

    handleOpenAdminForm(this: SwapPageInstance): void {
      if (!this.data.canApprove) return;
      resetAdminForm(this);
      this.setData({ adminFormVisible: true });
    },

    handleCloseAdminForm(this: SwapPageInstance): void {
      if (!this.data.adminBusy) this.setData({ adminFormVisible: false });
    },

    handleMyMonthChange(this: SwapPageInstance, event: ValueEvent): void {
      if (typeof event.detail.value !== 'string' || !isBusinessMonth(event.detail.value)) return;
      this._requestPreview = undefined;
      this.setData({
        myAssignmentIndex: -1,
        myAssignmentMonth: event.detail.value,
        myAssignmentOptions: [],
        requestErrorMessage: '',
        requestPreviewConflicts: [],
        requestPreviewReady: false,
      });
      void ensureCalendarMonth(this, event.detail.value).then(() => syncRequestCandidates(this));
    },

    handleTargetMonthChange(this: SwapPageInstance, event: ValueEvent): void {
      if (typeof event.detail.value !== 'string' || !isBusinessMonth(event.detail.value)) return;
      this._requestPreview = undefined;
      this.setData({
        requestErrorMessage: '',
        requestPreviewConflicts: [],
        requestPreviewReady: false,
        targetAssignmentIndex: -1,
        targetAssignmentMonth: event.detail.value,
        targetAssignmentOptions: [],
        targetMemberIndex: -1,
        targetMemberOptions: [],
      });
      void ensureCalendarMonth(this, event.detail.value).then(() => syncRequestCandidates(this));
    },

    handleMyAssignmentChange(this: SwapPageInstance, event: ValueEvent): void {
      setSelectionIndex(this, 'myAssignmentIndex', event, this.data.myAssignmentOptions.length);
      clearRequestPreview(this);
    },

    handleTargetMemberChange(this: SwapPageInstance, event: ValueEvent): void {
      const index = readSelectionIndex(event, this.data.targetMemberOptions.length);
      if (index < 0) return;
      this.setData({ targetMemberIndex: index, targetAssignmentIndex: -1 });
      clearRequestPreview(this);
      syncTargetAssignmentOptions(this);
    },

    handleTargetAssignmentChange(this: SwapPageInstance, event: ValueEvent): void {
      setSelectionIndex(
        this,
        'targetAssignmentIndex',
        event,
        this.data.targetAssignmentOptions.length,
      );
      clearRequestPreview(this);
    },

    handlePreview(this: SwapPageInstance): void {
      void computeRequestPreview(this);
    },

    handleSubmit(this: SwapPageInstance): void {
      void submitSwap(this);
    },

    handleAdminInitiatorMonthChange(this: SwapPageInstance, event: ValueEvent): void {
      handleAdminMonthChange(this, event, 'initiator');
    },

    handleAdminTargetMonthChange(this: SwapPageInstance, event: ValueEvent): void {
      handleAdminMonthChange(this, event, 'target');
    },

    handleAdminInitiatorMemberChange(this: SwapPageInstance, event: ValueEvent): void {
      const index = readSelectionIndex(event, this.data.adminInitiatorMemberOptions.length);
      if (index < 0) return;
      this.setData({ adminInitiatorMemberIndex: index, adminInitiatorAssignmentIndex: -1 });
      clearAdminPreview(this);
      syncAdminAssignmentOptions(this, 'initiator');
    },

    handleAdminTargetMemberChange(this: SwapPageInstance, event: ValueEvent): void {
      const index = readSelectionIndex(event, this.data.adminTargetMemberOptions.length);
      if (index < 0) return;
      this.setData({ adminTargetMemberIndex: index, adminTargetAssignmentIndex: -1 });
      clearAdminPreview(this);
      syncAdminAssignmentOptions(this, 'target');
    },

    handleAdminInitiatorAssignmentChange(this: SwapPageInstance, event: ValueEvent): void {
      setSelectionIndex(
        this,
        'adminInitiatorAssignmentIndex',
        event,
        this.data.adminInitiatorAssignmentOptions.length,
      );
      clearAdminPreview(this);
    },

    handleAdminTargetAssignmentChange(this: SwapPageInstance, event: ValueEvent): void {
      setSelectionIndex(
        this,
        'adminTargetAssignmentIndex',
        event,
        this.data.adminTargetAssignmentOptions.length,
      );
      clearAdminPreview(this);
    },

    handleAdminPreview(this: SwapPageInstance): void {
      void computeAdminPreview(this);
    },

    handleAdminSubmit(this: SwapPageInstance): void {
      void submitAdminSwap(this);
    },

    handleAccept(this: SwapPageInstance, event: DatasetEvent): void {
      void mutateSwap(this, event.currentTarget.dataset['id'], 'accept');
    },

    handleApprove(this: SwapPageInstance, event: DatasetEvent): void {
      void mutateSwap(this, event.currentTarget.dataset['id'], 'approve');
    },

    handleReject(this: SwapPageInstance, event: DatasetEvent): void {
      void confirmSwapMutation(this, event.currentTarget.dataset['id'], 'reject');
    },

    handleCancel(this: SwapPageInstance, event: DatasetEvent): void {
      void confirmSwapMutation(this, event.currentTarget.dataset['id'], 'cancel');
    },

    handleRevoke(this: SwapPageInstance, event: DatasetEvent): void {
      const request = findSwapRequest(this, event.currentTarget.dataset['id']);
      if (request === undefined || request.status !== 'completed') return;
      this._revokeTarget = request;
      this.setData({
        revokeErrorMessage: '',
        revokeReason: '',
        revokeVisible: true,
      });
    },

    handleRevokeReasonInput(this: SwapPageInstance, event: ValueEvent): void {
      if (typeof event.detail.value === 'string') {
        this.setData({ revokeReason: event.detail.value, revokeErrorMessage: '' });
      }
    },

    handleCloseRevoke(this: SwapPageInstance): void {
      if (this.data.revokeBusy) return;
      this._revokeTarget = undefined;
      this.setData({ revokeVisible: false });
    },

    handleConfirmRevoke(this: SwapPageInstance): void {
      void revokeSwap(this);
    },

    handleGroupApprovalToggle(this: SwapPageInstance, event: ValueEvent): void {
      const checked = readChecked(event);
      if (checked !== undefined) void updateGroupApproval(this, checked);
    },

    handleAutoAcceptToggle(this: SwapPageInstance, event: ValueEvent): void {
      const checked = readChecked(event);
      if (checked !== undefined) void updateAutoAccept(this, checked);
    },
  };
}

async function loadSwapPageWithCapability(
  page: SwapPageInstance,
  options: { readonly preserveForms?: boolean } = {},
): Promise<void> {
  const serial = ++page._loadSerial;
  if (options.preserveForms !== true) {
    page._requestPreview = undefined;
    page._adminPreview = undefined;
  }
  page.setData({ errorMessage: '', state: 'loading' });
  try {
    await requireClientCapability('workflows');
    const groups = await workbenchClient.listGroups();
    if (serial !== page._loadSerial) return;
    const group = resolveTargetGroup(groups, page._requestedGroupId);
    if (group === undefined) throw new Error('当前没有可使用换班功能的工作群组。');
    if (group.role === 'guest') throw new Error('访客不能发起或处理换班。');
    page._currentGroupId = group.id;
    const canApprove =
      group.isDeveloperAdmin === true ||
      group.role === 'owner' ||
      group.role === 'administrator';
    const months = unique([
      page.data.myAssignmentMonth,
      page.data.targetAssignmentMonth,
      page.data.adminInitiatorMonth,
      page.data.adminTargetMonth,
    ]);
    const [members, calendars, groupSettings, mySettings, mine, approvals] = await Promise.all([
      workbenchClient.getMembers(group.id),
      Promise.all(months.map((month) => workbenchClient.getCalendar(group.id, month))),
      workflowClient.getGroupSwapSettings(group.id),
      workflowClient.getMySwapSettings(group.id),
      workflowClient.listMySwapRequests(group.id),
      canApprove ? workflowClient.listSwapApprovals(group.id) : Promise.resolve([]),
    ]);
    if (serial !== page._loadSerial || page._currentGroupId !== group.id) return;
    page._calendars = new Map(calendars.map((calendar) => [calendar.businessMonth, calendar]));
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
    syncRequestCandidates(page);
    syncAdminCandidates(page);
    syncSwapLists(page);
  } catch (error) {
    if (serial !== page._loadSerial) return;
    page._currentGroupId = '';
    page.setData({
      canApprove: false,
      errorMessage: toUserMessage(error, '换班数据暂时无法加载，请稍后重试。'),
      state: 'error',
    });
  }
}

async function ensureCalendarMonth(page: SwapPageInstance, month: string): Promise<void> {
  if (page._calendars.has(month) || page._currentGroupId === '') return;
  const serial = ++page._calendarSerial;
  const groupId = page._currentGroupId;
  page._calendarRequestSerials.set(month, serial);
  try {
    const calendar = await workbenchClient.getCalendar(groupId, month);
    if (page._currentGroupId !== groupId || page._calendarRequestSerials.get(month) !== serial) {
      return;
    }
    page._calendars = new Map(page._calendars).set(month, calendar);
  } catch (error) {
    page.setData({
      requestErrorMessage: toUserMessage(error, '换班月份暂时无法加载，请稍后重试。'),
    });
  } finally {
    if (page._calendarRequestSerials.get(month) === serial) {
      page._calendarRequestSerials.delete(month);
    }
  }
}

function syncSwapLists(page: SwapPageInstance): void {
  const incoming = page._rawMyRequests.filter(
    (request) =>
      request.targetMembershipId === page._myMembershipId && request.status === 'pending_target',
  );
  const pending = page._rawApprovals.filter((request) => request.status === 'pending_approval');
  const handled = page._rawApprovals.filter((request) => request.status !== 'pending_approval');
  const completed = page._rawApprovals.filter(
    (request) => request.status === 'completed' && request.isRevocable !== false,
  );
  const archived = page._rawApprovals.filter(
    (request) => request.status === 'completed' && request.isRevocable === false,
  );
  page.setData({
    archivedSwapCount: archived.length,
    completedSwapCount: completed.length,
    completedSwaps: completed.map((request) => createSwapRequestView(page, request, 'completed')),
    handledApprovalCount: handled.length,
    handledApprovals: handled.map((request) => createSwapRequestView(page, request, 'handled')),
    incomingCount: incoming.length,
    incomingRequests: incoming.map((request) => createSwapRequestView(page, request, 'incoming')),
    myRequestCount: page._rawMyRequests.length,
    myRequests: page._rawMyRequests.map((request) => createSwapRequestView(page, request, 'mine')),
    pendingApprovalCount: pending.length,
    pendingApprovals: pending.map((request) => createSwapRequestView(page, request, 'approval')),
  });
}

function syncRequestCandidates(page: SwapPageInstance): void {
  const myCalendar = page._calendars.get(page.data.myAssignmentMonth);
  const targetCalendar = page._calendars.get(page.data.targetAssignmentMonth);
  const myAssignments = operableAssignments(myCalendar).filter(
    (assignment) => getDutyMembershipId(assignment) === page._myMembershipId,
  );
  const targetAssignments = operableAssignments(targetCalendar).filter(
    (assignment) => getDutyMembershipId(assignment) !== undefined,
  );
  const targetIds = new Set(targetAssignments.map(getDutyMembershipId));
  const targetMembers = (targetCalendar?.members ?? []).filter(
    (member) => member.membershipId !== page._myMembershipId && targetIds.has(member.membershipId),
  );
  page.setData({
    myAssignmentOptions: myAssignments.map(createAssignmentOption),
    targetMemberOptions: targetMembers.map((member) => ({
      label: member.realName,
      value: member.membershipId,
    })),
  });
  syncTargetAssignmentOptions(page);
}

function syncTargetAssignmentOptions(page: SwapPageInstance): void {
  const membershipId = page.data.targetMemberOptions[page.data.targetMemberIndex]?.value;
  const options =
    membershipId === undefined
      ? []
      : operableAssignments(page._calendars.get(page.data.targetAssignmentMonth))
          .filter((assignment) => getDutyMembershipId(assignment) === membershipId)
          .map(createAssignmentOption);
  page.setData({ targetAssignmentOptions: options });
}

function syncAdminCandidates(page: SwapPageInstance): void {
  page.setData({
    adminInitiatorMemberOptions: memberOptionsForCalendar(
      page._calendars.get(page.data.adminInitiatorMonth),
    ),
    adminTargetMemberOptions: memberOptionsForCalendar(
      page._calendars.get(page.data.adminTargetMonth),
    ),
  });
  syncAdminAssignmentOptions(page, 'initiator');
  syncAdminAssignmentOptions(page, 'target');
}

function syncAdminAssignmentOptions(page: SwapPageInstance, side: 'initiator' | 'target'): void {
  const memberOptions =
    side === 'initiator'
      ? page.data.adminInitiatorMemberOptions
      : page.data.adminTargetMemberOptions;
  const memberIndex =
    side === 'initiator' ? page.data.adminInitiatorMemberIndex : page.data.adminTargetMemberIndex;
  const membershipId = memberOptions[memberIndex]?.value;
  const month = side === 'initiator' ? page.data.adminInitiatorMonth : page.data.adminTargetMonth;
  const options =
    membershipId === undefined
      ? []
      : operableAssignments(page._calendars.get(month))
          .filter((assignment) => getDutyMembershipId(assignment) === membershipId)
          .map(createAssignmentOption);
  page.setData(
    side === 'initiator'
      ? { adminInitiatorAssignmentOptions: options }
      : { adminTargetAssignmentOptions: options },
  );
}

async function computeRequestPreview(page: SwapPageInstance): Promise<void> {
  const input = getRequestPair(page);
  if (input === undefined) {
    page.setData({ requestErrorMessage: '请先选择自己的班次、目标成员和目标班次。' });
    return;
  }
  page._requestPreview = undefined;
  page.setData({
    requestBusy: true,
    requestErrorMessage: '',
    requestPreviewConflicts: [],
    requestPreviewReady: false,
  });
  try {
    const preview = await workflowClient.previewSwap(page._currentGroupId, input);
    page._requestPreview = preview;
    page.setData(createPreviewPatch(preview, 'request'));
  } catch (error) {
    await handlePreviewError(page, error, 'request');
  } finally {
    page.setData({ requestBusy: false });
  }
}

async function submitSwap(page: SwapPageInstance): Promise<void> {
  if (page.data.requestBusy || page._currentGroupId === '') return;
  const input = getRequestPair(page);
  if (input === undefined) {
    page.setData({ requestErrorMessage: '请先选择自己的班次、目标成员和目标班次。' });
    return;
  }
  if (!previewMatches(page._requestPreview, input)) {
    await computeRequestPreview(page);
    if (!previewMatches(page._requestPreview, input)) return;
  }
  const operationKey = `${page._currentGroupId}:swap:create`;
  const request = resolveOperation(page, operationKey, input);
  page.setData({ requestBusy: true, requestErrorMessage: '', infoMessage: '' });
  try {
    const created = await workflowClient.createSwapRequest(page._currentGroupId, request);
    page._operationAttempts.delete(operationKey);
    page.setData({
      infoMessage:
        created.status === 'completed'
          ? '换班已生效，双方实际班次已交换。'
          : created.status === 'pending_approval'
            ? '换班申请已提交，等待管理员审批。'
            : '换班申请已提交，等待目标成员接受。',
      requestFormVisible: false,
    });
    resetRequestForm(page);
    notifyCalendarChanged(page);
    await loadSwapPageWithCapability(page, { preserveForms: true });
  } catch (error) {
    page.setData({ requestErrorMessage: getMutationErrorMessage(error) });
    if (isConflict(error)) {
      page._operationAttempts.delete(operationKey);
      page._requestPreview = undefined;
      await loadSwapPageWithCapability(page, { preserveForms: true });
    }
  } finally {
    page.setData({ requestBusy: false });
  }
}

async function computeAdminPreview(page: SwapPageInstance): Promise<void> {
  const input = getAdminPair(page);
  if (input === undefined) {
    page.setData({ adminErrorMessage: '请先选择两位不同成员及其班次。' });
    return;
  }
  page._adminPreview = undefined;
  page.setData({
    adminBusy: true,
    adminErrorMessage: '',
    adminPreviewConflicts: [],
    adminPreviewReady: false,
  });
  try {
    const preview = await workflowClient.previewSwap(page._currentGroupId, input);
    page._adminPreview = preview;
    page.setData(createPreviewPatch(preview, 'admin'));
  } catch (error) {
    await handlePreviewError(page, error, 'admin');
  } finally {
    page.setData({ adminBusy: false });
  }
}

async function submitAdminSwap(page: SwapPageInstance): Promise<void> {
  if (!page.data.canApprove || page.data.adminBusy || page._currentGroupId === '') return;
  const pair = getAdminPair(page);
  if (pair === undefined) {
    page.setData({ adminErrorMessage: '请先选择两位不同成员及其班次。' });
    return;
  }
  if (!previewMatches(page._adminPreview, pair)) {
    await computeAdminPreview(page);
    if (!previewMatches(page._adminPreview, pair)) return;
  }
  const input = {
    initiatorAssignmentId: pair.initiatorAssignmentId,
    targetAssignmentId: pair.targetAssignmentId,
  };
  const operationKey = `${page._currentGroupId}:swap:create-direct`;
  const request = resolveOperation(page, operationKey, input);
  page.setData({ adminBusy: true, adminErrorMessage: '', infoMessage: '' });
  try {
    const created = await workflowClient.createDirectSwapRequest(page._currentGroupId, request);
    page._operationAttempts.delete(operationKey);
    page.setData({
      adminFormVisible: false,
      infoMessage: `已为 ${created.initiatorMemberName ?? ''} 与 ${created.targetMemberName ?? ''} 完成换班，实际班次已交换。`,
    });
    resetAdminForm(page);
    notifyCalendarChanged(page);
    await loadSwapPageWithCapability(page, { preserveForms: true });
  } catch (error) {
    page.setData({ adminErrorMessage: getMutationErrorMessage(error) });
    if (isConflict(error)) {
      page._operationAttempts.delete(operationKey);
      page._adminPreview = undefined;
      await loadSwapPageWithCapability(page, { preserveForms: true });
    }
  } finally {
    page.setData({ adminBusy: false });
  }
}

async function mutateSwap(
  page: SwapPageInstance,
  id: string | undefined,
  action: 'accept' | 'approve' | 'cancel' | 'reject',
): Promise<void> {
  const swap = findSwapRequest(page, id);
  if (swap === undefined || page.data.mutationBusyIds.includes(swap.id)) return;
  const operationKey = `${page._currentGroupId}:swap:${action}:${swap.id}:${swap.version}`;
  const input = resolveOperation(page, operationKey, { expectedVersion: swap.version });
  page.setData({
    errorMessage: '',
    infoMessage: '',
    mutationBusyIds: [...page.data.mutationBusyIds, swap.id],
  });
  try {
    if (action === 'accept') {
      await workflowClient.acceptSwapRequest(page._currentGroupId, swap.id, input);
    } else if (action === 'approve') {
      await workflowClient.approveSwapRequest(page._currentGroupId, swap.id, input);
    } else if (action === 'cancel') {
      await workflowClient.cancelSwapRequest(page._currentGroupId, swap.id, input);
    } else {
      await workflowClient.rejectSwapRequest(page._currentGroupId, swap.id, input);
    }
    page._operationAttempts.delete(operationKey);
    page.setData({ infoMessage: getMutationSuccessMessage(action) });
    notifyCalendarChanged(page);
    await loadSwapPageWithCapability(page, { preserveForms: true });
  } catch (error) {
    page.setData({ errorMessage: getMutationErrorMessage(error) });
    if (isConflict(error)) {
      page._operationAttempts.delete(operationKey);
      await loadSwapPageWithCapability(page, { preserveForms: true });
    }
  } finally {
    page.setData({ mutationBusyIds: page.data.mutationBusyIds.filter((item) => item !== swap.id) });
  }
}

async function confirmSwapMutation(
  page: SwapPageInstance,
  id: string | undefined,
  action: 'cancel' | 'reject',
): Promise<void> {
  const swap = findSwapRequest(page, id);
  if (swap === undefined) return;
  const content =
    action === 'cancel'
      ? '确定撤销该换班申请吗？'
      : `确定驳回与 ${swap.initiatorMemberName ?? '对方'} 的换班申请吗？`;
  if (await showConfirm(content)) await mutateSwap(page, swap.id, action);
}

async function revokeSwap(page: SwapPageInstance): Promise<void> {
  const swap = page._revokeTarget;
  if (swap === undefined || page.data.revokeBusy) return;
  const reason = page.data.revokeReason.trim();
  const operationKey = `${page._currentGroupId}:swap:revoke:${swap.id}:${swap.version}`;
  const input = resolveOperation(page, operationKey, {
    expectedVersion: swap.version,
    ...(reason === '' ? {} : { reason }),
  });
  page.setData({ revokeBusy: true, revokeErrorMessage: '' });
  try {
    await workflowClient.revokeSwapRequest(page._currentGroupId, swap.id, input);
    page._operationAttempts.delete(operationKey);
    page._revokeTarget = undefined;
    page.setData({ infoMessage: '换班已撤销。', revokeVisible: false });
    notifyCalendarChanged(page);
    await loadSwapPageWithCapability(page, { preserveForms: true });
  } catch (error) {
    page.setData({ revokeErrorMessage: getMutationErrorMessage(error) });
    if (isConflict(error)) {
      page._operationAttempts.delete(operationKey);
      page._revokeTarget = undefined;
      page.setData({ revokeVisible: false });
      await loadSwapPageWithCapability(page, { preserveForms: true });
    }
  } finally {
    page.setData({ revokeBusy: false });
  }
}

async function updateGroupApproval(page: SwapPageInstance, checked: boolean): Promise<void> {
  if (!page.data.canApprove || page.data.settingsBusy) return;
  page.setData({ settingsBusy: true, errorMessage: '', infoMessage: '' });
  try {
    const settings = await workflowClient.updateGroupSwapSettings(page._currentGroupId, {
      requiresApproval: checked,
    });
    page.setData({
      infoMessage: settings.requiresApproval
        ? '换班已改为需要管理员审批。'
        : '换班已改为无需管理员审批。',
      requiresApproval: settings.requiresApproval,
    });
  } catch (error) {
    page.setData({ errorMessage: toUserMessage(error, '换班设置暂时无法更新。') });
  } finally {
    page.setData({ settingsBusy: false });
  }
}

async function updateAutoAccept(page: SwapPageInstance, checked: boolean): Promise<void> {
  if (page.data.settingsBusy) return;
  page.setData({ settingsBusy: true, errorMessage: '', infoMessage: '' });
  try {
    const settings = await workflowClient.updateMySwapSettings(page._currentGroupId, {
      autoAcceptSwaps: checked,
    });
    page.setData({
      autoAcceptSwaps: settings.autoAcceptSwaps,
      infoMessage: settings.autoAcceptSwaps ? '已开启自动接受换班。' : '已关闭自动接受换班。',
    });
  } catch (error) {
    page.setData({ errorMessage: toUserMessage(error, '换班设置暂时无法更新。') });
  } finally {
    page.setData({ settingsBusy: false });
  }
}

async function handlePreviewError(
  page: SwapPageInstance,
  error: unknown,
  form: 'admin' | 'request',
): Promise<void> {
  const message = isConflict(error)
    ? '排班数据已被其他操作更新，请重新选择班次并生成预览。'
    : toUserMessage(error, '换班预览暂时无法生成。');
  page.setData(
    form === 'admin' ? { adminErrorMessage: message } : { requestErrorMessage: message },
  );
  if (isConflict(error)) await loadSwapPageWithCapability(page, { preserveForms: true });
}

function createSwapRequestView(
  page: SwapPageInstance,
  request: SwapRequest,
  context: 'approval' | 'completed' | 'handled' | 'incoming' | 'mine',
): SwapRequestView {
  const initiatorIsCurrent = request.initiatorMembershipId === page._myMembershipId;
  const counterpartName = initiatorIsCurrent
    ? (request.targetMemberName ?? '对方')
    : (request.initiatorMemberName ?? '对方');
  const pendingMine =
    initiatorIsCurrent &&
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
      request.isRevocable !== false &&
      isSwapRequestStillFuture(request),
    counterpartName,
    decidedByLabel: request.decidedByMemberName ?? '—',
    id: request.id,
    initiatorName: request.initiatorMemberName ?? '成员',
    pairLabel: `${formatShift(request.initiatorAssignment)} ↔ ${formatShift(request.targetAssignment)}`,
    reasonLabel: request.revocationReason ?? request.revocationBlockedReason ?? '',
    statusLabel: getSwapStatusLabel(request.status),
    statusTone: `is-${getStatusTone(request.status)}`,
    targetName: request.targetMemberName ?? '成员',
    version: request.version,
  };
}

function createPreviewPatch(
  preview: SwapPreview,
  form: 'admin' | 'request',
): Partial<SwapPageData> {
  const summary = `${formatAssignmentSummary(preview.initiatorAssignment)} ↔ ${formatAssignmentSummary(preview.targetAssignment)}；${form === 'admin' ? '执行后立即生效，无需审批和成员同意。' : getNextStatusDescription(preview.nextStatus)}`;
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

function getRequestPair(page: SwapPageInstance):
  | {
      readonly initiatorAssignmentId: string;
      readonly targetAssignmentId: string;
      readonly targetMembershipId: string;
    }
  | undefined {
  const initiatorAssignmentId = page.data.myAssignmentOptions[page.data.myAssignmentIndex]?.value;
  const targetMembershipId = page.data.targetMemberOptions[page.data.targetMemberIndex]?.value;
  const targetAssignmentId =
    page.data.targetAssignmentOptions[page.data.targetAssignmentIndex]?.value;
  if (
    initiatorAssignmentId === undefined ||
    targetMembershipId === undefined ||
    targetAssignmentId === undefined
  ) {
    return undefined;
  }
  return { initiatorAssignmentId, targetAssignmentId, targetMembershipId };
}

function getAdminPair(page: SwapPageInstance):
  | {
      readonly initiatorAssignmentId: string;
      readonly initiatorMembershipId: string;
      readonly targetAssignmentId: string;
      readonly targetMembershipId: string;
    }
  | undefined {
  const initiatorMembershipId =
    page.data.adminInitiatorMemberOptions[page.data.adminInitiatorMemberIndex]?.value;
  const initiatorAssignmentId =
    page.data.adminInitiatorAssignmentOptions[page.data.adminInitiatorAssignmentIndex]?.value;
  const targetMembershipId =
    page.data.adminTargetMemberOptions[page.data.adminTargetMemberIndex]?.value;
  const targetAssignmentId =
    page.data.adminTargetAssignmentOptions[page.data.adminTargetAssignmentIndex]?.value;
  if (
    initiatorMembershipId === undefined ||
    initiatorAssignmentId === undefined ||
    targetMembershipId === undefined ||
    targetAssignmentId === undefined ||
    initiatorMembershipId === targetMembershipId
  ) {
    return undefined;
  }
  return {
    initiatorAssignmentId,
    initiatorMembershipId,
    targetAssignmentId,
    targetMembershipId,
  };
}

function previewMatches(
  preview: SwapPreview | undefined,
  input: {
    readonly initiatorAssignmentId: string;
    readonly targetAssignmentId: string;
    readonly targetMembershipId: string;
  },
): boolean {
  return (
    preview?.initiatorAssignment.assignmentId === input.initiatorAssignmentId &&
    preview.targetAssignment.assignmentId === input.targetAssignmentId &&
    (preview.targetAssignment.actualMemberId ?? preview.targetAssignment.plannedMemberId) ===
      input.targetMembershipId
  );
}

function handleAdminMonthChange(
  page: SwapPageInstance,
  event: ValueEvent,
  side: 'initiator' | 'target',
): void {
  if (typeof event.detail.value !== 'string' || !isBusinessMonth(event.detail.value)) return;
  clearAdminPreview(page);
  page.setData(
    side === 'initiator'
      ? {
          adminInitiatorAssignmentIndex: -1,
          adminInitiatorAssignmentOptions: [],
          adminInitiatorMemberIndex: -1,
          adminInitiatorMemberOptions: [],
          adminInitiatorMonth: event.detail.value,
        }
      : {
          adminTargetAssignmentIndex: -1,
          adminTargetAssignmentOptions: [],
          adminTargetMemberIndex: -1,
          adminTargetMemberOptions: [],
          adminTargetMonth: event.detail.value,
        },
  );
  void ensureCalendarMonth(page, event.detail.value).then(() => syncAdminCandidates(page));
}

function resetRequestForm(page: SwapPageInstance): void {
  page._requestPreview = undefined;
  page.setData({
    myAssignmentIndex: -1,
    requestBusy: false,
    requestErrorMessage: '',
    requestPreviewConflicts: [],
    requestPreviewReady: false,
    requestPreviewSummary: '',
    targetAssignmentIndex: -1,
    targetAssignmentOptions: [],
    targetMemberIndex: -1,
  });
  syncRequestCandidates(page);
}

function resetAdminForm(page: SwapPageInstance): void {
  page._adminPreview = undefined;
  page.setData({
    adminBusy: false,
    adminErrorMessage: '',
    adminInitiatorAssignmentIndex: -1,
    adminInitiatorAssignmentOptions: [],
    adminInitiatorMemberIndex: -1,
    adminPreviewConflicts: [],
    adminPreviewReady: false,
    adminPreviewSummary: '',
    adminTargetAssignmentIndex: -1,
    adminTargetAssignmentOptions: [],
    adminTargetMemberIndex: -1,
  });
  syncAdminCandidates(page);
}

function clearRequestPreview(page: SwapPageInstance): void {
  page._requestPreview = undefined;
  page.setData({
    requestErrorMessage: '',
    requestPreviewConflicts: [],
    requestPreviewReady: false,
    requestPreviewSummary: '',
  });
}

function clearAdminPreview(page: SwapPageInstance): void {
  page._adminPreview = undefined;
  page.setData({
    adminErrorMessage: '',
    adminPreviewConflicts: [],
    adminPreviewReady: false,
    adminPreviewSummary: '',
  });
}

function setSelectionIndex(
  page: SwapPageInstance,
  key:
    | 'adminInitiatorAssignmentIndex'
    | 'adminTargetAssignmentIndex'
    | 'myAssignmentIndex'
    | 'targetAssignmentIndex',
  event: ValueEvent,
  length: number,
): void {
  const index = readSelectionIndex(event, length);
  if (index >= 0) page.setData({ [key]: index } as Partial<SwapPageData>);
}

function readSelectionIndex(event: ValueEvent, length: number): number {
  const index = Number(event.detail.value);
  return Number.isInteger(index) && index >= 0 && index < length ? index : -1;
}

function readChecked(event: ValueEvent): boolean | undefined {
  if (typeof event.detail.checked === 'boolean') return event.detail.checked;
  return typeof event.detail.value === 'boolean' ? event.detail.value : undefined;
}

function memberOptionsForCalendar(calendar: CalendarReadModel | undefined): SelectionOption[] {
  const membershipIds = new Set(operableAssignments(calendar).map(getDutyMembershipId));
  return (calendar?.members ?? [])
    .filter((member) => membershipIds.has(member.membershipId))
    .map((member) => ({ label: member.realName, value: member.membershipId }));
}

function operableAssignments(calendar: CalendarReadModel | undefined): CalendarDutyAssignment[] {
  const today = getTodayBusinessDate();
  return (calendar?.assignments ?? []).filter((assignment) => assignment.businessDate >= today);
}

function createAssignmentOption(assignment: CalendarDutyAssignment): SelectionOption {
  return {
    isWeekend: isWeekendDate(assignment.businessDate),
    label: formatAssignment(assignment),
    value: assignment.id,
  };
}

function isWeekendDate(value: string): boolean {
  const day = new Date(`${value}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

function formatAssignment(assignment: CalendarDutyAssignment): string {
  return `${assignment.businessDate} ${assignment.shiftTypeName}（${weekdayLabel(assignment.businessDate)}）· ${assignment.actualMemberName ?? assignment.plannedMemberName ?? '待定'}`;
}

function formatAssignmentSummary(assignment: SwapPreview['initiatorAssignment']): string {
  return `${assignment.businessDate} ${assignment.shiftTypeName}（${weekdayLabel(assignment.businessDate)}）· ${assignment.actualMemberName ?? assignment.plannedMemberName ?? '待定'}`;
}

function formatShift(assignment: SwapRequest['initiatorAssignment']): string {
  return `${assignment.businessDate.slice(5)} ${assignment.shiftTypeName}`;
}

function weekdayLabel(value: string): string {
  const labels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return labels[new Date(`${value}T00:00:00Z`).getUTCDay()] ?? '';
}

function getDutyMembershipId(assignment: CalendarDutyAssignment): string | undefined {
  return assignment.actualMembershipId ?? assignment.plannedMembershipId;
}

function isSwapRequestStillFuture(request: SwapRequest): boolean {
  const today = getTodayBusinessDate();
  return (
    request.initiatorAssignment.businessDate >= today &&
    request.targetAssignment.businessDate >= today
  );
}

function getSwapStatusLabel(status: SwapRequestStatus): string {
  return status === 'pending_target'
    ? '待对方接受'
    : status === 'pending_approval'
      ? '待管理员审批'
      : status === 'completed'
        ? '已生效'
        : status === 'rejected'
          ? '已驳回'
          : status === 'cancelled'
            ? '已取消'
            : '已撤销';
}

function getStatusTone(status: SwapRequestStatus): 'danger' | 'neutral' | 'success' | 'warning' {
  return status === 'pending_target' || status === 'pending_approval'
    ? 'warning'
    : status === 'completed'
      ? 'success'
      : status === 'rejected'
        ? 'danger'
        : 'neutral';
}

function notifyCalendarChanged(page: SwapPageInstance): void {
  page.triggerEvent?.('calendarchanged', { groupId: page._currentGroupId });
}

function getNextStatusDescription(status: SwapRequestStatus): string {
  return status === 'pending_target'
    ? '提交后将等待目标成员接受。'
    : status === 'pending_approval'
      ? '目标成员将自动接受，提交后进入管理员审批。'
      : status === 'completed'
        ? '目标成员已开启自动接受且群组无需审批，提交后将立即生效。'
        : '';
}

function getMutationSuccessMessage(action: 'accept' | 'approve' | 'cancel' | 'reject'): string {
  return action === 'accept'
    ? '换班申请已接受。'
    : action === 'approve'
      ? '换班申请已批准。'
      : action === 'cancel'
        ? '换班申请已撤销。'
        : '换班申请已驳回。';
}

function findSwapRequest(page: SwapPageInstance, id: string | undefined): SwapRequest | undefined {
  if (id === undefined) return undefined;
  return [...page._rawMyRequests, ...page._rawApprovals].find((request) => request.id === id);
}

function resolveOperation<Payload extends Readonly<Record<string, unknown>>>(
  page: SwapPageInstance,
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

function getCurrentBusinessMonth(): string {
  return getTodayBusinessDate().slice(0, 7);
}

function getTodayBusinessDate(): string {
  const china = new Date(Date.now() + 8 * 60 * 60 * 1000);
  if (china.getUTCHours() < 8) china.setUTCDate(china.getUTCDate() - 1);
  return china.toISOString().slice(0, 10);
}

function isBusinessMonth(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/u.test(value);
}

function formatRole(role: GroupSummary['role']): string {
  return role === 'owner' ? '群主' : role === 'administrator' ? '管理员' : '成员';
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function createShellLayoutPatch(): Pick<
  SwapPageData,
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
  return toUserMessage(error, '换班操作暂时无法完成，请稍后重试。');
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
