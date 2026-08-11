import type {
  ApproveLeaveRequestInput,
  ApprovedLeaveRequestResult,
  GroupLeaveReflowStrategy,
  LeaveAffectedShift,
  LeaveReflowPreview,
  LeaveReflowStrategy,
  LeaveRequest,
  LeaveRequestMutationResult,
  LeaveRequestType,
  RejectedLeaveRequestResult,
} from '@schedule/contracts';

import type { CalendarCacheIdentity } from '../../store/calendar-cache.js';
import { resolveWorkflowActions, type WorkflowActions } from './workflow-actions.js';
import {
  buildWorkflowPreviewFingerprint,
  createWorkflowOperationRuntime,
  type WorkflowConflictState,
  type WorkflowContext,
} from './workflow-operation.js';
import { buildAllDayLeaveInterval, getChinaBusinessDate } from './workflow-time.js';

export interface LeaveWorkflowForm {
  readonly endDate: string;
  readonly leaveType: LeaveRequestType;
  readonly reason: string;
  readonly startDate: string;
}

export type LeaveImpactState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'none' }
  | { readonly kind: 'ready'; readonly shifts: readonly LeaveAffectedShift[] }
  | { readonly kind: 'unavailable' };

export interface LeaveApprovalState {
  readonly acknowledgeBlockers: boolean;
  readonly isPreviewing: boolean;
  readonly preview: LeaveReflowPreview | undefined;
  readonly request: LeaveRequest;
  readonly strategy: LeaveReflowStrategy;
}

export interface LeaveGroupStrategyState {
  readonly draft: LeaveReflowStrategy;
  readonly saved: LeaveReflowStrategy;
}

interface LeaveApprovalAvailability {
  readonly approvalBlockReason: string | undefined;
  readonly canApproveApproval: boolean;
}

export interface LeaveWorkflowState {
  readonly approval: LeaveApprovalState | undefined;
  readonly approvalBlockReason: string | undefined;
  readonly canSubmit: boolean;
  readonly canApproveApproval: boolean;
  readonly conflict: WorkflowConflictState | undefined;
  readonly dayCount: number;
  readonly errorMessage: string | undefined;
  readonly form: LeaveWorkflowForm;
  readonly groupStrategy: LeaveGroupStrategyState | undefined;
  readonly impact: LeaveImpactState;
  readonly infoMessage: string | undefined;
  readonly isLoading: boolean;
  readonly isSubmitting: boolean;
  readonly myRequests: readonly LeaveRequest[];
  readonly approvals: readonly LeaveRequest[];
}

export interface LeaveWorkflowDependencies {
  approveLeaveRequest(
    groupId: string,
    leaveRequestId: string,
    input: ApproveLeaveRequestInput,
  ): Promise<ApprovedLeaveRequestResult>;
  cancelLeaveRequest(
    groupId: string,
    leaveRequestId: string,
    input: { readonly expectedVersion: number; readonly operationId: string },
  ): Promise<LeaveRequestMutationResult>;
  createLeaveRequest(
    groupId: string,
    input: {
      readonly endsAt: string;
      readonly isAllDay: true;
      readonly leaveType: LeaveRequestType;
      readonly reason?: string;
      readonly startsAt: string;
    },
  ): Promise<LeaveRequest>;
  createOperationId(): string;
  getGroupStrategy(groupId: string): Promise<GroupLeaveReflowStrategy>;
  getLeaveAffectedShifts(
    groupId: string,
    input: { readonly endsAt: string; readonly isAllDay: true; readonly startsAt: string },
  ): Promise<readonly LeaveAffectedShift[]>;
  invalidateCalendarMonth(identity: CalendarCacheIdentity): void;
  listLeaveRequestApprovals(groupId: string): Promise<readonly LeaveRequest[]>;
  listLeaveRequests(groupId: string): Promise<readonly LeaveRequest[]>;
  previewLeaveRequestApproval(
    groupId: string,
    leaveRequestId: string,
    input: { readonly strategy: LeaveReflowStrategy },
  ): Promise<LeaveReflowPreview>;
  rejectLeaveRequest(
    groupId: string,
    leaveRequestId: string,
    input: { readonly expectedVersion: number; readonly operationId: string },
  ): Promise<RejectedLeaveRequestResult>;
  revokeLeaveRequest(
    groupId: string,
    leaveRequestId: string,
    input: { readonly expectedVersion: number; readonly operationId: string },
  ): Promise<LeaveRequestMutationResult>;
  updateGroupStrategy(
    groupId: string,
    input: { readonly strategy: LeaveReflowStrategy },
  ): Promise<GroupLeaveReflowStrategy>;
  getToday?(): string;
  publish?(state: LeaveWorkflowState): void;
}

export interface LeaveWorkflowController {
  readonly state: LeaveWorkflowState;
  activate(context: WorkflowContext): void;
  approve(): Promise<ApprovedLeaveRequestResult>;
  cancel(request: LeaveRequest): Promise<LeaveRequestMutationResult>;
  getActions(request: LeaveRequest, source?: 'approval' | 'mine'): WorkflowActions;
  openApproval(request: LeaveRequest): Promise<void>;
  refresh(): Promise<void>;
  refreshApprovalPreview(): Promise<void>;
  revoke(request: LeaveRequest): Promise<LeaveRequestMutationResult>;
  saveGroupStrategy(): Promise<GroupLeaveReflowStrategy>;
  setAcknowledgeBlockers(value: boolean): void;
  setApprovalStrategy(strategy: LeaveReflowStrategy): Promise<void>;
  setGroupStrategyDraft(strategy: LeaveReflowStrategy): void;
  submitCreate(): Promise<LeaveRequest>;
  updateForm(input: Partial<LeaveWorkflowForm>): Promise<void>;
  reject(): Promise<RejectedLeaveRequestResult>;
}

function sameContext(left: WorkflowContext | undefined, right: WorkflowContext): boolean {
  return (
    left?.groupId === right.groupId &&
    left.groupRole === right.groupRole &&
    left.groupVersion === right.groupVersion &&
    left.userId === right.userId
  );
}

function isAdministrator(context: WorkflowContext): boolean {
  return context.groupRole === 'administrator' || context.groupRole === 'owner';
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error && error.message.length > 0
    ? error.message
    : '请求失败，请稍后重试。';
}

function isConflict(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    ('status' in error || 'code' in error) &&
    ((error as { readonly status?: unknown }).status === 409 ||
      (error as { readonly code?: unknown }).code === 'CONFLICT')
  );
}

function getInitialForm(getToday: (() => string) | undefined): LeaveWorkflowForm {
  const today = getToday?.() ?? getChinaBusinessDate();
  return { endDate: today, leaveType: 'sick', reason: '', startDate: today };
}

function canSubmit(form: LeaveWorkflowForm, context: WorkflowContext | undefined): boolean {
  if (context === undefined || context.groupRole === 'guest') return false;
  try {
    buildAllDayLeaveInterval(form.startDate, form.endDate);
    return true;
  } catch {
    return false;
  }
}

function getDayCount(form: LeaveWorkflowForm): number {
  try {
    return buildAllDayLeaveInterval(form.startDate, form.endDate).dayCount;
  } catch {
    return 0;
  }
}

function getApprovalAvailability(
  approval: LeaveApprovalState | undefined,
): LeaveApprovalAvailability {
  if (approval === undefined) return { approvalBlockReason: undefined, canApproveApproval: false };
  if (approval.preview === undefined)
    return { approvalBlockReason: '正在生成当前请假的审批预览。', canApproveApproval: false };
  if (approval.preview.workflowBlockers.length > 0)
    return { approvalBlockReason: '存在活动工作流阻塞，不能批准。', canApproveApproval: false };
  if (
    (approval.preview.conflicts.length > 0 || approval.preview.vacancies.length > 0) &&
    !approval.acknowledgeBlockers
  )
    return { approvalBlockReason: '请先确认冲突和空缺后再批准。', canApproveApproval: false };
  return { approvalBlockReason: undefined, canApproveApproval: true };
}

export function createLeaveWorkflowOperationId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/gu, (token) => {
    const nibble = Math.floor(Math.random() * 16);
    return (token === 'x' ? nibble : (nibble & 0x3) | 0x8).toString(16);
  });
}

export function createLeaveWorkflowController(
  dependencies: LeaveWorkflowDependencies,
): LeaveWorkflowController {
  let activeContext: WorkflowContext | undefined;
  let contextGeneration = 0;
  let impactGeneration = 0;
  let approvalGeneration = 0;
  let groupStrategyDirty = false;
  let createFlight: Promise<LeaveRequest> | undefined;
  const mutationFlights = new Map<string, Promise<unknown>>();
  const initialForm = getInitialForm(dependencies.getToday);
  let state: LeaveWorkflowState = {
    approval: undefined,
    approvalBlockReason: undefined,
    canSubmit: false,
    canApproveApproval: false,
    conflict: undefined,
    dayCount: getDayCount(initialForm),
    errorMessage: undefined,
    form: initialForm,
    groupStrategy: undefined,
    impact: { kind: 'idle' },
    infoMessage: undefined,
    isLoading: false,
    isSubmitting: false,
    myRequests: [],
    approvals: [],
  };

  const publish = (): void => {
    dependencies.publish?.(state);
  };

  const setState = (
    next: Omit<
      LeaveWorkflowState,
      'approvalBlockReason' | 'canApproveApproval' | 'canSubmit' | 'dayCount'
    >,
  ): void => {
    const approvalAvailability = getApprovalAvailability(next.approval);
    state = {
      ...next,
      ...approvalAvailability,
      canSubmit: canSubmit(next.form, activeContext),
      dayCount: getDayCount(next.form),
    };
    publish();
  };

  const patchState = (
    patch: Partial<
      Omit<
        LeaveWorkflowState,
        'approvalBlockReason' | 'canApproveApproval' | 'canSubmit' | 'dayCount'
      >
    >,
  ): void => {
    setState({ ...state, ...patch });
  };

  const requireContext = (): WorkflowContext => {
    if (activeContext === undefined) throw new Error('工作流上下文不可用。');
    if (activeContext.groupRole === 'guest') throw new Error('访客不能访问工作流。');
    return activeContext;
  };

  const isCurrent = (context: WorkflowContext, generation: number): boolean =>
    generation === contextGeneration && sameContext(activeContext, context);

  const resetApproval = (): void => {
    approvalGeneration += 1;
    patchState({ approval: undefined });
  };

  const runtime = createWorkflowOperationRuntime<LeaveReflowPreview>({
    publish: (event) => {
      if (event.kind === 'preview-invalidated') {
        approvalGeneration += 1;
        patchState({
          approval:
            state.approval === undefined
              ? undefined
              : {
                  ...state.approval,
                  acknowledgeBlockers: false,
                  isPreviewing: false,
                  preview: undefined,
                },
          impact: { kind: 'idle' },
        });
        return;
      }
      impactGeneration += 1;
      patchState({
        conflict: { message: event.message, summary: event.summary },
        impact: { kind: 'idle' },
      });
    },
    refresh: async (context) => {
      if (isCurrent(context, contextGeneration)) await controller.refresh();
    },
  });

  const runMutation = <Result>(
    key: string,
    mutate: () => Promise<Result>,
    onSuccess: (result: Result) => Promise<void>,
  ): Promise<Result> => {
    const existing = mutationFlights.get(key) as Promise<Result> | undefined;
    if (existing !== undefined) return existing;
    const operation = runtime
      .run(key, mutate)
      .then(async (result) => {
        await onSuccess(result);
        return result;
      })
      .catch((error: unknown) => {
        if (!isConflict(error)) patchState({ errorMessage: getErrorMessage(error) });
        throw error;
      });
    mutationFlights.set(key, operation);
    void operation.then(
      () => {
        if (mutationFlights.get(key) === operation) mutationFlights.delete(key);
      },
      () => {
        if (mutationFlights.get(key) === operation) mutationFlights.delete(key);
      },
    );
    return operation;
  };

  const loadImpact = (): Promise<void> => {
    const context = requireContext();
    const generation = contextGeneration;
    const requestGeneration = ++impactGeneration;
    let interval: ReturnType<typeof buildAllDayLeaveInterval>;
    try {
      interval = buildAllDayLeaveInterval(state.form.startDate, state.form.endDate);
    } catch {
      patchState({ impact: { kind: 'idle' } });
      return Promise.resolve();
    }
    patchState({ impact: { kind: 'loading' } });
    return dependencies
      .getLeaveAffectedShifts(context.groupId, {
        endsAt: interval.endsAt,
        isAllDay: true,
        startsAt: interval.startsAt,
      })
      .then((shifts) => {
        if (!isCurrent(context, generation) || requestGeneration !== impactGeneration) return;
        patchState({
          impact: shifts.length === 0 ? { kind: 'none' } : { kind: 'ready', shifts: [...shifts] },
        });
      })
      .catch(() => {
        if (!isCurrent(context, generation) || requestGeneration !== impactGeneration) return;
        patchState({ impact: { kind: 'unavailable' } });
      });
  };

  const loadApprovalPreview = (requestGeneration: number): Promise<void> => {
    const context = requireContext();
    const generation = contextGeneration;
    const approval = state.approval;
    if (approval === undefined) return Promise.resolve();
    const { request, strategy } = approval;
    return dependencies
      .previewLeaveRequestApproval(context.groupId, request.id, { strategy })
      .then((nextPreview) => {
        if (
          !isCurrent(context, generation) ||
          requestGeneration !== approvalGeneration ||
          state.approval?.request.id !== request.id ||
          state.approval.strategy !== strategy
        )
          return;
        const fingerprint = buildWorkflowPreviewFingerprint({
          leaveRequestId: request.id,
          leaveRequestVersion: request.version,
          previewGeneration: requestGeneration,
          strategy,
        });
        runtime.setPreview(fingerprint, nextPreview);
        patchState({
          approval: {
            ...state.approval,
            acknowledgeBlockers: false,
            isPreviewing: false,
            preview: nextPreview,
          },
          conflict: undefined,
          errorMessage: undefined,
        });
      })
      .catch((error: unknown) => {
        if (!isCurrent(context, generation) || requestGeneration !== approvalGeneration) return;
        patchState({
          approval:
            state.approval === undefined ? undefined : { ...state.approval, isPreviewing: false },
          errorMessage: getErrorMessage(error),
        });
      });
  };

  const invalidateApprovedMonths = (
    context: WorkflowContext,
    result: ApprovedLeaveRequestResult,
  ): void => {
    const months = new Set(
      result.preview.affectedAssignments
        .map(({ businessDate }) => businessDate.slice(0, 7))
        .filter((businessMonth) => /^\d{4}-\d{2}$/u.test(businessMonth)),
    );
    for (const businessMonth of months) {
      dependencies.invalidateCalendarMonth({ ...context, businessMonth });
    }
  };

  const controller: LeaveWorkflowController = {
    get state() {
      return state;
    },
    activate(context) {
      if (sameContext(activeContext, context)) return;
      activeContext = { ...context };
      contextGeneration += 1;
      impactGeneration += 1;
      approvalGeneration += 1;
      groupStrategyDirty = false;
      createFlight = undefined;
      mutationFlights.clear();
      runtime.activate(context);
      setState({
        approval: undefined,
        conflict: undefined,
        errorMessage: undefined,
        form: getInitialForm(dependencies.getToday),
        groupStrategy: undefined,
        impact: { kind: 'idle' },
        infoMessage: undefined,
        isLoading: false,
        isSubmitting: false,
        myRequests: [],
        approvals: [],
      });
    },
    async refresh() {
      const context = requireContext();
      const generation = contextGeneration;
      patchState({ isLoading: true, errorMessage: undefined });
      try {
        const [myRequests, approvals, groupStrategy] = await Promise.all([
          dependencies.listLeaveRequests(context.groupId),
          isAdministrator(context)
            ? dependencies.listLeaveRequestApprovals(context.groupId)
            : Promise.resolve([] as readonly LeaveRequest[]),
          isAdministrator(context)
            ? dependencies.getGroupStrategy(context.groupId)
            : Promise.resolve(undefined),
        ]);
        if (!isCurrent(context, generation)) return;
        const strategy =
          groupStrategy === undefined
            ? undefined
            : {
                draft: groupStrategyDirty
                  ? (state.groupStrategy?.draft ?? groupStrategy.strategy)
                  : groupStrategy.strategy,
                saved: groupStrategy.strategy,
              };
        patchState({
          approvals: [...approvals],
          groupStrategy: strategy,
          myRequests: [...myRequests],
        });
      } catch (error) {
        if (isCurrent(context, generation)) patchState({ errorMessage: getErrorMessage(error) });
        throw error;
      } finally {
        if (isCurrent(context, generation)) patchState({ isLoading: false });
      }
    },
    updateForm(input) {
      requireContext();
      impactGeneration += 1;
      patchState({
        conflict: undefined,
        errorMessage: undefined,
        form: { ...state.form, ...input },
        impact: { kind: 'idle' },
      });
      return loadImpact();
    },
    submitCreate() {
      if (createFlight !== undefined) return createFlight;
      let context: WorkflowContext;
      try {
        context = requireContext();
      } catch (error) {
        return Promise.reject(error);
      }
      let interval: ReturnType<typeof buildAllDayLeaveInterval>;
      try {
        interval = buildAllDayLeaveInterval(state.form.startDate, state.form.endDate);
      } catch (error) {
        patchState({ errorMessage: getErrorMessage(error) });
        return Promise.reject(error);
      }
      const form = state.form;
      patchState({ conflict: undefined, errorMessage: undefined, isSubmitting: true });
      const operation = runMutation(
        'leave:create',
        () =>
          dependencies.createLeaveRequest(context.groupId, {
            endsAt: interval.endsAt,
            isAllDay: true,
            leaveType: form.leaveType,
            ...(form.reason.trim().length === 0 ? {} : { reason: form.reason.trim() }),
            startsAt: interval.startsAt,
          }),
        async () => {
          if (!sameContext(activeContext, context)) return;
          impactGeneration += 1;
          patchState({
            form: { ...state.form, reason: '' },
            impact: { kind: 'idle' },
            infoMessage: '请假申请已提交，等待管理员审批。',
          });
          await controller.refresh();
        },
      );
      createFlight = operation;
      void operation.then(
        () => {
          if (createFlight === operation) createFlight = undefined;
          if (sameContext(activeContext, context)) patchState({ isSubmitting: false });
        },
        () => {
          if (createFlight === operation) createFlight = undefined;
          if (sameContext(activeContext, context)) patchState({ isSubmitting: false });
        },
      );
      return operation;
    },
    openApproval(request) {
      requireContext();
      approvalGeneration += 1;
      const generation = approvalGeneration;
      patchState({
        conflict: undefined,
        errorMessage: undefined,
        approval: {
          acknowledgeBlockers: false,
          isPreviewing: true,
          preview: undefined,
          request,
          strategy: request.reflowStrategy,
        },
      });
      return loadApprovalPreview(generation);
    },
    refreshApprovalPreview() {
      if (state.approval === undefined) return Promise.resolve();
      approvalGeneration += 1;
      const generation = approvalGeneration;
      patchState({
        approval: {
          ...state.approval,
          acknowledgeBlockers: false,
          isPreviewing: true,
          preview: undefined,
        },
      });
      return loadApprovalPreview(generation);
    },
    setApprovalStrategy(strategy) {
      if (strategy !== 'keep-original-order' && strategy !== 'shift-forward')
        return Promise.reject(new Error('重排策略无效。'));
      if (state.approval === undefined) return Promise.reject(new Error('请先选择待审批申请。'));
      approvalGeneration += 1;
      const generation = approvalGeneration;
      patchState({
        approval: {
          ...state.approval,
          acknowledgeBlockers: false,
          isPreviewing: true,
          preview: undefined,
          strategy,
        },
      });
      return loadApprovalPreview(generation);
    },
    setAcknowledgeBlockers(value) {
      if (state.approval === undefined) return;
      patchState({ approval: { ...state.approval, acknowledgeBlockers: value } });
    },
    approve() {
      const context = requireContext();
      const approval = state.approval;
      const approvalAvailability = getApprovalAvailability(approval);
      if (!approvalAvailability.canApproveApproval) {
        const message =
          approvalAvailability.approvalBlockReason ?? 'Approval preview is unavailable.';
        patchState({ errorMessage: message });
        return Promise.reject(new Error(message));
      }
      if (approval === undefined || approval.preview === undefined)
        return Promise.reject(new Error('请先生成当前请假的审批预览。'));
      const fingerprint = buildWorkflowPreviewFingerprint({
        leaveRequestId: approval.request.id,
        leaveRequestVersion: approval.request.version,
        previewGeneration: approvalGeneration,
        strategy: approval.strategy,
      });
      const currentPreview = runtime.getPreview(fingerprint);
      if (currentPreview === undefined || currentPreview !== approval.preview)
        return Promise.reject(new Error('审批预览已过期，请重新生成。'));
      if (currentPreview.workflowBlockers.length > 0)
        return Promise.reject(new Error('存在活动工作流阻塞，不能确认绕过。'));
      if (
        (currentPreview.conflicts.length > 0 || currentPreview.vacancies.length > 0) &&
        !approval.acknowledgeBlockers
      )
        return Promise.reject(new Error('请先确认冲突和空缺后再批准。'));
      return runMutation(
        `leave:approve:${approval.request.id}:${currentPreview.leaveRequestVersion}`,
        () =>
          dependencies.approveLeaveRequest(context.groupId, approval.request.id, {
            ...(approval.acknowledgeBlockers ? { acknowledgeBlockers: true } : {}),
            expectedPeriodVersions: currentPreview.periodVersions,
            expectedRulesVersion: currentPreview.rulesVersion,
            expectedVersion: currentPreview.leaveRequestVersion,
            operationId: dependencies.createOperationId(),
            strategy: currentPreview.strategy,
          }),
        async (result) => {
          if (!sameContext(activeContext, context)) return;
          invalidateApprovedMonths(context, result);
          resetApproval();
          patchState({ infoMessage: '请假申请已批准。' });
          await controller.refresh();
        },
      );
    },
    reject() {
      const context = requireContext();
      const approval = state.approval;
      if (approval === undefined) return Promise.reject(new Error('请先选择待审批申请。'));
      if (!controller.getActions(approval.request, 'approval').reject)
        return Promise.reject(new Error('当前身份不能驳回该请假申请。'));
      return runMutation(
        `leave:reject:${approval.request.id}:${approval.request.version}`,
        () =>
          dependencies.rejectLeaveRequest(context.groupId, approval.request.id, {
            expectedVersion: approval.request.version,
            operationId: dependencies.createOperationId(),
          }),
        async () => {
          if (!sameContext(activeContext, context)) return;
          resetApproval();
          patchState({ infoMessage: '请假申请已驳回。' });
          await controller.refresh();
        },
      );
    },
    getActions(request, source = 'mine') {
      const context = requireContext();
      return resolveWorkflowActions({
        actorRelation: source === 'mine' ? 'applicant' : 'unrelated',
        domain: 'leave',
        groupRole: context.groupRole,
        isRevocable: request.isRevocable,
        status: request.status,
      });
    },
    cancel(request) {
      const context = requireContext();
      if (!controller.getActions(request, 'mine').cancel)
        return Promise.reject(new Error('当前申请不能取消。'));
      return runMutation(
        `leave:cancel:${request.id}:${request.version}`,
        () =>
          dependencies.cancelLeaveRequest(context.groupId, request.id, {
            expectedVersion: request.version,
            operationId: dependencies.createOperationId(),
          }),
        async () => {
          if (!sameContext(activeContext, context)) return;
          patchState({ infoMessage: '请假申请已取消。' });
          await controller.refresh();
        },
      );
    },
    revoke(request) {
      const context = requireContext();
      if (!controller.getActions(request, 'mine').revoke)
        return Promise.reject(new Error('当前申请不能撤销。'));
      return runMutation(
        `leave:revoke:${request.id}:${request.version}`,
        () =>
          dependencies.revokeLeaveRequest(context.groupId, request.id, {
            expectedVersion: request.version,
            operationId: dependencies.createOperationId(),
          }),
        async () => {
          if (!sameContext(activeContext, context)) return;
          patchState({
            infoMessage: '请假已撤销；如需恢复原排班，请重新生成或发布排班。',
          });
          await controller.refresh();
        },
      );
    },
    setGroupStrategyDraft(strategy) {
      const context = requireContext();
      if (!isAdministrator(context)) throw new Error('只有管理员可以修改群组默认重排策略。');
      const current = state.groupStrategy;
      if (current === undefined) throw new Error('群组默认重排策略尚未加载。');
      groupStrategyDirty = strategy !== current.saved;
      patchState({ groupStrategy: { ...current, draft: strategy } });
    },
    saveGroupStrategy() {
      const context = requireContext();
      if (!isAdministrator(context))
        return Promise.reject(new Error('只有管理员可以修改群组默认重排策略。'));
      const strategy = state.groupStrategy;
      if (strategy === undefined) return Promise.reject(new Error('群组默认重排策略尚未加载。'));
      return runMutation(
        'leave:group-reflow-strategy',
        () => dependencies.updateGroupStrategy(context.groupId, { strategy: strategy.draft }),
        async (result) => {
          if (!sameContext(activeContext, context)) return;
          groupStrategyDirty = false;
          patchState({
            groupStrategy: { draft: result.strategy, saved: result.strategy },
            infoMessage: '群组默认重排策略已更新，仅影响后续新申请。',
          });
          await controller.refresh();
        },
      ).catch(async (error: unknown) => {
        if (sameContext(activeContext, context) && !isConflict(error)) {
          try {
            await controller.refresh();
          } catch {
            // Keep the user draft and the original save error.
          }
        }
        throw error;
      });
    },
  };

  return controller;
}
