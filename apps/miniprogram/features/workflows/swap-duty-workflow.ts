import type {
  CalendarReadModel,
  CreateDirectDutyAdjustmentInput,
  CreateDirectSwapInput,
  CreateDutyAdjustmentRequestInput,
  CreateSwapRequestInput,
  DutyAdjustmentMutationInput,
  DutyAdjustmentPairInput,
  DutyAdjustmentPreview,
  DutyAdjustmentRequest,
  GroupDutyAdjustmentSettings,
  GroupMember,
  GroupSwapSettings,
  MemberSwapSettings,
  RevokeDutyAdjustmentInput,
  RevokeSwapRequestInput,
  SwapPairInput,
  SwapPreview,
  SwapRequest,
  SwapRequestMutationInput,
} from '@schedule/contracts';

import type { CalendarCacheIdentity } from '../../store/calendar-cache.js';
import {
  resolveCurrentMembershipId,
  resolveWorkflowActions,
  type WorkflowActions,
} from './workflow-actions.js';
import {
  buildWorkflowPreviewFingerprint,
  createWorkflowOperationRuntime,
  type WorkflowConflictState,
  type WorkflowContext,
} from './workflow-operation.js';
import {
  buildWorkflowCandidates,
  getChinaBusinessDate,
  type WorkflowCandidate,
} from './workflow-time.js';

type RequestAction = 'accept' | 'approve' | 'cancel' | 'reject' | 'revoke';

interface SwapForm {
  readonly initiatorAssignmentId: string | undefined;
  readonly targetAssignmentId: string | undefined;
}

interface DutyForm {
  readonly coveredAssignmentId: string | undefined;
  readonly overtimeMembershipId: string | undefined;
  readonly reason: string;
}

export interface SwapWorkflowState {
  readonly approvals: readonly SwapRequest[];
  readonly candidates: readonly WorkflowCandidate[];
  readonly form: SwapForm;
  readonly groupRequiresApproval: boolean | undefined;
  readonly isDirectPreview: boolean;
  readonly isPreviewing: boolean;
  readonly mineCandidates: readonly WorkflowCandidate[];
  readonly preview: SwapPreview | undefined;
  readonly requests: readonly SwapRequest[];
  readonly swapAutoAccepts: boolean | undefined;
}

export interface DutyWorkflowState {
  readonly approvals: readonly DutyAdjustmentRequest[];
  readonly candidates: readonly WorkflowCandidate[];
  readonly dutyAutoAccepts: boolean | undefined;
  readonly form: DutyForm;
  readonly groupRequiresApproval: boolean | undefined;
  readonly isPreviewing: boolean;
  readonly members: readonly GroupMember[];
  readonly mineCandidates: readonly WorkflowCandidate[];
  readonly preview: DutyAdjustmentPreview | undefined;
  readonly requests: readonly DutyAdjustmentRequest[];
}

export interface SwapDutyWorkflowState {
  readonly businessMonth: string;
  readonly conflict: WorkflowConflictState | undefined;
  readonly duty: DutyWorkflowState;
  readonly errorMessage: string | undefined;
  readonly infoMessage: string | undefined;
  readonly isLoading: boolean;
  readonly isWriting: boolean;
  readonly swap: SwapWorkflowState;
}

export interface SwapDutyWorkflowDependencies {
  acceptDutyAdjustment(
    groupId: string,
    requestId: string,
    input: DutyAdjustmentMutationInput,
  ): Promise<DutyAdjustmentRequest>;
  acceptSwapRequest(
    groupId: string,
    requestId: string,
    input: SwapRequestMutationInput,
  ): Promise<SwapRequest>;
  approveDutyAdjustment(
    groupId: string,
    requestId: string,
    input: DutyAdjustmentMutationInput,
  ): Promise<DutyAdjustmentRequest>;
  approveSwapRequest(
    groupId: string,
    requestId: string,
    input: SwapRequestMutationInput,
  ): Promise<SwapRequest>;
  cancelDutyAdjustment(
    groupId: string,
    requestId: string,
    input: DutyAdjustmentMutationInput,
  ): Promise<DutyAdjustmentRequest>;
  cancelSwapRequest(
    groupId: string,
    requestId: string,
    input: SwapRequestMutationInput,
  ): Promise<SwapRequest>;
  createDirectDutyAdjustment(
    groupId: string,
    input: CreateDirectDutyAdjustmentInput,
  ): Promise<DutyAdjustmentRequest>;
  createDirectSwapRequest(groupId: string, input: CreateDirectSwapInput): Promise<SwapRequest>;
  createDutyAdjustmentRequest(
    groupId: string,
    input: CreateDutyAdjustmentRequestInput,
  ): Promise<DutyAdjustmentRequest>;
  createOperationId(): string;
  createSwapRequest(groupId: string, input: CreateSwapRequestInput): Promise<SwapRequest>;
  getCalendar(groupId: string, businessMonth: string): Promise<CalendarReadModel>;
  getGroupDutyAdjustmentSettings(groupId: string): Promise<GroupDutyAdjustmentSettings>;
  getGroupSwapSettings(groupId: string): Promise<GroupSwapSettings>;
  getMyDutyAdjustmentSettings(groupId: string): Promise<MemberSwapSettings>;
  getMySwapSettings(groupId: string): Promise<MemberSwapSettings>;
  invalidateCalendarMonth(identity: CalendarCacheIdentity): void;
  listDutyAdjustmentApprovals(groupId: string): Promise<readonly DutyAdjustmentRequest[]>;
  listDutyAdjustmentRequests(groupId: string): Promise<readonly DutyAdjustmentRequest[]>;
  listGroupMembers(groupId: string): Promise<readonly GroupMember[]>;
  listSwapApprovals(groupId: string): Promise<readonly SwapRequest[]>;
  listSwapRequests(groupId: string): Promise<readonly SwapRequest[]>;
  previewDutyAdjustment(
    groupId: string,
    input: DutyAdjustmentPairInput,
  ): Promise<DutyAdjustmentPreview>;
  previewSwap(groupId: string, input: SwapPairInput): Promise<SwapPreview>;
  rejectDutyAdjustment(
    groupId: string,
    requestId: string,
    input: DutyAdjustmentMutationInput,
  ): Promise<DutyAdjustmentRequest>;
  rejectSwapRequest(
    groupId: string,
    requestId: string,
    input: SwapRequestMutationInput,
  ): Promise<SwapRequest>;
  revokeDutyAdjustment(
    groupId: string,
    requestId: string,
    input: RevokeDutyAdjustmentInput,
  ): Promise<DutyAdjustmentRequest>;
  revokeSwapRequest(
    groupId: string,
    requestId: string,
    input: RevokeSwapRequestInput,
  ): Promise<SwapRequest>;
  updateGroupDutyAdjustmentSettings(
    groupId: string,
    input: { readonly requiresApproval: boolean },
  ): Promise<GroupDutyAdjustmentSettings>;
  updateGroupSwapSettings(
    groupId: string,
    input: { readonly requiresApproval: boolean },
  ): Promise<GroupSwapSettings>;
  updateMySwapSettings(
    groupId: string,
    input: { readonly autoAcceptSwaps: boolean },
  ): Promise<MemberSwapSettings>;
  publish?(state: SwapDutyWorkflowState): void;
}

export interface SwapDutyWorkflowController {
  readonly state: SwapDutyWorkflowState;
  activate(context: WorkflowContext): void;
  getDutyActions(request: DutyAdjustmentRequest): WorkflowActions;
  getSwapActions(request: SwapRequest): WorkflowActions;
  performDutyAction(
    action: RequestAction,
    request: DutyAdjustmentRequest,
    reason?: string,
  ): Promise<DutyAdjustmentRequest>;
  performSwapAction(
    action: RequestAction,
    request: SwapRequest,
    reason?: string,
  ): Promise<SwapRequest>;
  refresh(): Promise<void>;
  setBusinessMonth(value: string): Promise<void>;
  setDutyAdjustment(
    coveredAssignmentId: string | undefined,
    overtimeMembershipId: string | undefined,
    reason?: string,
  ): void;
  setSwapAssignments(
    initiatorAssignmentId: string | undefined,
    targetAssignmentId: string | undefined,
  ): void;
  submitDuty(direct: boolean): Promise<DutyAdjustmentRequest>;
  submitSwap(direct: boolean): Promise<SwapRequest>;
  updateDutyRequiresApproval(value: boolean): Promise<GroupDutyAdjustmentSettings>;
  updateMemberAutoAccepts(value: boolean): Promise<MemberSwapSettings>;
  updateSwapRequiresApproval(value: boolean): Promise<GroupSwapSettings>;
}

function isAdministrator(context: WorkflowContext): boolean {
  return context.groupRole === 'administrator' || context.groupRole === 'owner';
}

function isConflict(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    ((error as { readonly status?: unknown }).status === 409 ||
      (error as { readonly code?: unknown }).code === 'CONFLICT')
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message.length > 0
    ? error.message
    : '请求失败，请稍后重试。';
}

function sameContext(left: WorkflowContext | undefined, right: WorkflowContext): boolean {
  return (
    left?.groupId === right.groupId &&
    left.groupRole === right.groupRole &&
    left.groupVersion === right.groupVersion &&
    left.userId === right.userId
  );
}

function isBusinessMonth(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/u.test(value);
}

function initialSwapState(): SwapWorkflowState {
  return {
    approvals: [],
    candidates: [],
    form: { initiatorAssignmentId: undefined, targetAssignmentId: undefined },
    groupRequiresApproval: undefined,
    isDirectPreview: false,
    isPreviewing: false,
    mineCandidates: [],
    preview: undefined,
    requests: [],
    swapAutoAccepts: undefined,
  };
}

function initialDutyState(): DutyWorkflowState {
  return {
    approvals: [],
    candidates: [],
    dutyAutoAccepts: undefined,
    form: { coveredAssignmentId: undefined, overtimeMembershipId: undefined, reason: '' },
    groupRequiresApproval: undefined,
    isPreviewing: false,
    members: [],
    mineCandidates: [],
    preview: undefined,
    requests: [],
  };
}

export function createSwapDutyWorkflowController(
  dependencies: SwapDutyWorkflowDependencies,
  getToday: () => string = getChinaBusinessDate,
): SwapDutyWorkflowController {
  let activeContext: WorkflowContext | undefined;
  let generation = 0;
  let currentMembershipId: string | undefined;
  let swapPreviewFingerprint: string | undefined;
  let dutyPreviewFingerprint: string | undefined;
  const mutationFlights = new Map<string, Promise<unknown>>();
  const initialMonth = getToday().slice(0, 7);
  let state: SwapDutyWorkflowState = {
    businessMonth: initialMonth,
    conflict: undefined,
    duty: initialDutyState(),
    errorMessage: undefined,
    infoMessage: undefined,
    isLoading: false,
    isWriting: false,
    swap: initialSwapState(),
  };

  const publish = (): void => dependencies.publish?.(state);
  const setState = (next: SwapDutyWorkflowState): void => {
    state = next;
    publish();
  };
  const patchState = (patch: Partial<SwapDutyWorkflowState>): void =>
    setState({ ...state, ...patch });
  const isCurrent = (context: WorkflowContext, expectedGeneration: number): boolean =>
    expectedGeneration === generation && sameContext(activeContext, context);
  const requireContext = (): WorkflowContext => {
    if (activeContext === undefined) throw new Error('工作流上下文不可用。');
    if (activeContext.groupRole === 'guest') throw new Error('访客不能访问工作流。');
    return activeContext;
  };

  const clearPreviews = (): void => {
    swapPreviewFingerprint = undefined;
    dutyPreviewFingerprint = undefined;
    patchState({
      duty: { ...state.duty, isPreviewing: false, preview: undefined },
      swap: { ...state.swap, isPreviewing: false, preview: undefined },
    });
  };

  const runtime = createWorkflowOperationRuntime<SwapPreview | DutyAdjustmentPreview>({
    publish: (event) => {
      if (event.kind === 'preview-invalidated') {
        clearPreviews();
        return;
      }
      patchState({ conflict: { message: event.message, summary: event.summary } });
    },
    refresh: async (context) => {
      if (isCurrent(context, generation)) await controller.refresh();
    },
  });

  const runMutation = <Result>(
    key: string,
    mutate: () => Promise<Result>,
    onSuccess: (result: Result, context: WorkflowContext) => Promise<void>,
  ): Promise<Result> => {
    const existing = mutationFlights.get(key) as Promise<Result> | undefined;
    if (existing !== undefined) return existing;
    const context = requireContext();
    const operation = runtime
      .run(key, mutate)
      .then(async (result) => {
        if (sameContext(activeContext, context)) await onSuccess(result, context);
        return result;
      })
      .catch((error: unknown) => {
        if (!isConflict(error)) patchState({ errorMessage: errorMessage(error) });
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

  const swapInput = (): SwapPairInput => {
    const initiator = state.swap.candidates.find(
      ({ assignment }) => assignment.id === state.swap.form.initiatorAssignmentId,
    );
    const target = state.swap.candidates.find(
      ({ assignment }) => assignment.id === state.swap.form.targetAssignmentId,
    );
    if (
      initiator === undefined ||
      target === undefined ||
      initiator.assignment.id === target.assignment.id ||
      initiator.dutyMembershipId === undefined ||
      target.dutyMembershipId === undefined
    )
      throw new Error('请选择两条不同且已分配成员的班次。');
    return {
      initiatorAssignmentId: initiator.assignment.id,
      initiatorMembershipId: initiator.dutyMembershipId,
      targetAssignmentId: target.assignment.id,
      targetMembershipId: target.dutyMembershipId,
    };
  };

  const dutyInput = (): DutyAdjustmentPairInput => {
    const covered = state.duty.candidates.find(
      ({ assignment }) => assignment.id === state.duty.form.coveredAssignmentId,
    );
    const overtimeMembershipId = state.duty.form.overtimeMembershipId;
    if (covered === undefined || overtimeMembershipId === undefined)
      throw new Error('请选择被代班次和加班成员。');
    return { coveredAssignmentId: covered.assignment.id, overtimeMembershipId };
  };

  const invalidateSwap = (context: WorkflowContext, request: SwapRequest): void => {
    for (const businessMonth of new Set([
      request.initiatorAssignment.businessDate.slice(0, 7),
      request.targetAssignment.businessDate.slice(0, 7),
    ])) {
      if (isBusinessMonth(businessMonth))
        dependencies.invalidateCalendarMonth({ ...context, businessMonth });
    }
  };

  const invalidateDuty = (context: WorkflowContext, request: DutyAdjustmentRequest): void => {
    const businessMonth = request.coveredAssignment.businessDate.slice(0, 7);
    if (isBusinessMonth(businessMonth))
      dependencies.invalidateCalendarMonth({ ...context, businessMonth });
  };

  const previewSwap = (direct: boolean): Promise<void> => {
    const context = requireContext();
    const expectedGeneration = generation;
    let input: SwapPairInput;
    try {
      input = swapInput();
    } catch (error) {
      patchState({ errorMessage: errorMessage(error) });
      return Promise.reject(error);
    }
    const fingerprint = buildWorkflowPreviewFingerprint({ direct, domain: 'swap', ...input });
    patchState({
      conflict: undefined,
      errorMessage: undefined,
      swap: { ...state.swap, isDirectPreview: direct, isPreviewing: true, preview: undefined },
    });
    return dependencies
      .previewSwap(context.groupId, input)
      .then((preview) => {
        if (!isCurrent(context, expectedGeneration)) return;
        swapPreviewFingerprint = fingerprint;
        runtime.setPreview(fingerprint, preview);
        patchState({ swap: { ...state.swap, isPreviewing: false, preview } });
      })
      .catch((error: unknown) => {
        if (isCurrent(context, expectedGeneration)) {
          patchState({
            errorMessage: errorMessage(error),
            swap: { ...state.swap, isPreviewing: false, preview: undefined },
          });
        }
        throw error;
      });
  };

  const previewDuty = (): Promise<void> => {
    const context = requireContext();
    const expectedGeneration = generation;
    let input: DutyAdjustmentPairInput;
    try {
      input = dutyInput();
    } catch (error) {
      patchState({ errorMessage: errorMessage(error) });
      return Promise.reject(error);
    }
    const fingerprint = buildWorkflowPreviewFingerprint({ domain: 'duty', ...input });
    patchState({
      conflict: undefined,
      errorMessage: undefined,
      duty: { ...state.duty, isPreviewing: true, preview: undefined },
    });
    return dependencies
      .previewDutyAdjustment(context.groupId, input)
      .then((preview) => {
        if (!isCurrent(context, expectedGeneration)) return;
        dutyPreviewFingerprint = fingerprint;
        runtime.setPreview(fingerprint, preview);
        patchState({ duty: { ...state.duty, isPreviewing: false, preview } });
      })
      .catch((error: unknown) => {
        if (isCurrent(context, expectedGeneration)) {
          patchState({
            duty: { ...state.duty, isPreviewing: false, preview: undefined },
            errorMessage: errorMessage(error),
          });
        }
        throw error;
      });
  };

  const requireSwapPreview = async (direct: boolean): Promise<SwapPairInput> => {
    const input = swapInput();
    const fingerprint = buildWorkflowPreviewFingerprint({ direct, domain: 'swap', ...input });
    if (
      state.swap.preview === undefined ||
      runtime.getPreview(fingerprint) !== state.swap.preview
    ) {
      await previewSwap(direct);
      throw new Error('已生成换班预览，请确认后再次提交。');
    }
    if (swapPreviewFingerprint !== fingerprint) throw new Error('换班预览已过期，请重新生成。');
    return input;
  };

  const requireDutyPreview = async (): Promise<DutyAdjustmentPairInput> => {
    const input = dutyInput();
    const fingerprint = buildWorkflowPreviewFingerprint({ domain: 'duty', ...input });
    if (
      state.duty.preview === undefined ||
      runtime.getPreview(fingerprint) !== state.duty.preview
    ) {
      await previewDuty();
      throw new Error('已生成加扣班预览，请确认后再次提交。');
    }
    if (dutyPreviewFingerprint !== fingerprint) throw new Error('加扣班预览已过期，请重新生成。');
    return input;
  };

  const controller: SwapDutyWorkflowController = {
    get state() {
      return state;
    },
    activate(context) {
      if (sameContext(activeContext, context)) return;
      activeContext = { ...context };
      generation += 1;
      currentMembershipId = undefined;
      swapPreviewFingerprint = undefined;
      dutyPreviewFingerprint = undefined;
      mutationFlights.clear();
      runtime.activate(context);
      setState({
        businessMonth: getToday().slice(0, 7),
        conflict: undefined,
        duty: initialDutyState(),
        errorMessage: undefined,
        infoMessage: undefined,
        isLoading: false,
        isWriting: false,
        swap: initialSwapState(),
      });
    },
    async refresh() {
      const context = requireContext();
      const expectedGeneration = generation;
      patchState({ isLoading: true, errorMessage: undefined });
      try {
        const [
          calendar,
          members,
          swapRequests,
          dutyRequests,
          swapAuto,
          dutyAuto,
          swapApprovals,
          dutyApprovals,
          swapGroup,
          dutyGroup,
        ] = await Promise.all([
          dependencies.getCalendar(context.groupId, state.businessMonth),
          dependencies.listGroupMembers(context.groupId),
          dependencies.listSwapRequests(context.groupId),
          dependencies.listDutyAdjustmentRequests(context.groupId),
          dependencies.getMySwapSettings(context.groupId),
          dependencies.getMyDutyAdjustmentSettings(context.groupId),
          isAdministrator(context)
            ? dependencies.listSwapApprovals(context.groupId)
            : Promise.resolve([] as readonly SwapRequest[]),
          isAdministrator(context)
            ? dependencies.listDutyAdjustmentApprovals(context.groupId)
            : Promise.resolve([] as readonly DutyAdjustmentRequest[]),
          isAdministrator(context)
            ? dependencies.getGroupSwapSettings(context.groupId)
            : Promise.resolve(undefined),
          isAdministrator(context)
            ? dependencies.getGroupDutyAdjustmentSettings(context.groupId)
            : Promise.resolve(undefined),
        ]);
        if (!isCurrent(context, expectedGeneration)) return;
        currentMembershipId = resolveCurrentMembershipId(members);
        const candidates = buildWorkflowCandidates(
          calendar.assignments,
          currentMembershipId,
          new Date(`${getToday()}T00:00:00.000+08:00`),
        );
        patchState({
          duty: {
            ...state.duty,
            approvals: [...dutyApprovals],
            candidates: candidates.operable,
            dutyAutoAccepts: dutyAuto.autoAcceptSwaps,
            groupRequiresApproval: dutyGroup?.requiresApproval,
            members: [...members],
            mineCandidates: candidates.mine,
            requests: [...dutyRequests],
          },
          swap: {
            ...state.swap,
            approvals: [...swapApprovals],
            candidates: candidates.operable,
            groupRequiresApproval: swapGroup?.requiresApproval,
            mineCandidates: candidates.mine,
            requests: [...swapRequests],
            swapAutoAccepts: swapAuto.autoAcceptSwaps,
          },
        });
      } catch (error) {
        if (isCurrent(context, expectedGeneration))
          patchState({ errorMessage: errorMessage(error) });
        throw error;
      } finally {
        if (isCurrent(context, expectedGeneration)) patchState({ isLoading: false });
      }
    },
    setBusinessMonth(value) {
      if (!isBusinessMonth(value)) return Promise.reject(new Error('业务月份无效。'));
      if (value === state.businessMonth) return Promise.resolve();
      swapPreviewFingerprint = undefined;
      dutyPreviewFingerprint = undefined;
      patchState({
        businessMonth: value,
        conflict: undefined,
        duty: { ...state.duty, candidates: [], mineCandidates: [], preview: undefined },
        swap: { ...state.swap, candidates: [], mineCandidates: [], preview: undefined },
      });
      return controller.refresh();
    },
    setSwapAssignments(initiatorAssignmentId, targetAssignmentId) {
      swapPreviewFingerprint = undefined;
      patchState({
        conflict: undefined,
        swap: {
          ...state.swap,
          form: { initiatorAssignmentId, targetAssignmentId },
          isPreviewing: false,
          preview: undefined,
        },
      });
    },
    setDutyAdjustment(coveredAssignmentId, overtimeMembershipId, reason) {
      dutyPreviewFingerprint = undefined;
      patchState({
        conflict: undefined,
        duty: {
          ...state.duty,
          form: {
            coveredAssignmentId,
            overtimeMembershipId,
            reason: reason ?? state.duty.form.reason,
          },
          isPreviewing: false,
          preview: undefined,
        },
      });
    },
    submitSwap(direct) {
      const context = requireContext();
      if (direct && !isAdministrator(context))
        return Promise.reject(new Error('当前身份不能直办换班。'));
      if (
        !direct &&
        !state.swap.mineCandidates.some(
          ({ assignment }) => assignment.id === state.swap.form.initiatorAssignmentId,
        )
      )
        return Promise.reject(new Error('普通换班只能使用本人当前班次。'));
      if (state.swap.isDirectPreview !== direct) {
        swapPreviewFingerprint = undefined;
        patchState({ swap: { ...state.swap, isDirectPreview: direct, preview: undefined } });
      }
      return requireSwapPreview(direct).then((input) => {
        patchState({ isWriting: true, conflict: undefined, errorMessage: undefined });
        const key = `swap:${direct ? 'direct' : 'create'}:${input.initiatorAssignmentId}:${input.targetAssignmentId}`;
        return runMutation(
          key,
          () =>
            direct
              ? dependencies.createDirectSwapRequest(context.groupId, {
                  initiatorAssignmentId: input.initiatorAssignmentId,
                  operationId: dependencies.createOperationId(),
                  targetAssignmentId: input.targetAssignmentId,
                })
              : dependencies.createSwapRequest(context.groupId, {
                  ...input,
                  operationId: dependencies.createOperationId(),
                }),
          async (result, active) => {
            if (result.status === 'completed') invalidateSwap(active, result);
            swapPreviewFingerprint = undefined;
            patchState({
              infoMessage: direct ? '换班已直办完成。' : `换班申请已提交：${result.status}。`,
              swap: { ...state.swap, preview: undefined },
            });
            await controller.refresh();
          },
        ).finally(() => {
          if (sameContext(activeContext, context)) patchState({ isWriting: false });
        });
      });
    },
    submitDuty(direct) {
      const context = requireContext();
      if (direct && !isAdministrator(context))
        return Promise.reject(new Error('当前身份不能直办加扣班。'));
      if (
        !direct &&
        !state.duty.mineCandidates.some(
          ({ assignment }) => assignment.id === state.duty.form.coveredAssignmentId,
        )
      )
        return Promise.reject(new Error('普通加扣班只能使用本人当前班次。'));
      const submit = async (): Promise<DutyAdjustmentRequest> => {
        const input = direct ? dutyInput() : await requireDutyPreview();
        const reason = state.duty.form.reason.trim();
        patchState({ isWriting: true, conflict: undefined, errorMessage: undefined });
        const key = `duty:${direct ? 'direct' : 'create'}:${input.coveredAssignmentId}:${input.overtimeMembershipId}`;
        return runMutation(
          key,
          () => {
            const payload = {
              ...input,
              operationId: dependencies.createOperationId(),
              ...(reason.length === 0 ? {} : { reason }),
            };
            return direct
              ? dependencies.createDirectDutyAdjustment(context.groupId, payload)
              : dependencies.createDutyAdjustmentRequest(context.groupId, payload);
          },
          async (result, active) => {
            if (result.status === 'completed') invalidateDuty(active, result);
            dutyPreviewFingerprint = undefined;
            patchState({
              duty: { ...state.duty, form: { ...state.duty.form, reason: '' }, preview: undefined },
              infoMessage: direct ? '加扣班已直办完成。' : `加扣班申请已提交：${result.status}。`,
            });
            await controller.refresh();
          },
        ).finally(() => {
          if (sameContext(activeContext, context)) patchState({ isWriting: false });
        });
      };
      return submit();
    },
    getSwapActions(request) {
      const context = requireContext();
      const relation =
        request.initiatorMembershipId === currentMembershipId
          ? 'initiator'
          : request.targetMembershipId === currentMembershipId
            ? 'target'
            : 'unrelated';
      return resolveWorkflowActions({
        actorRelation: relation,
        domain: 'swap',
        groupRole: context.groupRole,
        isRevocable: request.isRevocable,
        status: request.status,
      });
    },
    getDutyActions(request) {
      const context = requireContext();
      const relation =
        request.deductedMembershipId === currentMembershipId
          ? 'deducted'
          : request.overtimeMembershipId === currentMembershipId
            ? 'overtime'
            : 'unrelated';
      return resolveWorkflowActions({
        actorRelation: relation,
        domain: 'duty',
        groupRole: context.groupRole,
        isRevocable: request.isRevocable,
        status: request.status,
      });
    },
    performSwapAction(action, request, reason) {
      const context = requireContext();
      if (!controller.getSwapActions(request)[action])
        return Promise.reject(new Error('当前身份不能执行此换班操作。'));
      const key = `swap:${action}:${request.id}:${request.version}`;
      return runMutation(
        key,
        () => {
          const input = {
            expectedVersion: request.version,
            operationId: dependencies.createOperationId(),
          };
          if (action === 'accept')
            return dependencies.acceptSwapRequest(context.groupId, request.id, input);
          if (action === 'approve')
            return dependencies.approveSwapRequest(context.groupId, request.id, input);
          if (action === 'cancel')
            return dependencies.cancelSwapRequest(context.groupId, request.id, input);
          if (action === 'reject')
            return dependencies.rejectSwapRequest(context.groupId, request.id, input);
          const normalizedReason = reason?.trim();
          return dependencies.revokeSwapRequest(context.groupId, request.id, {
            ...input,
            ...(normalizedReason === undefined || normalizedReason.length === 0
              ? {}
              : { reason: normalizedReason }),
          });
        },
        async (result, active) => {
          if (
            action === 'approve' ||
            action === 'revoke' ||
            (action === 'accept' && result.status === 'completed')
          )
            invalidateSwap(active, result);
          patchState({ infoMessage: `换班操作已完成：${result.status}。` });
          await controller.refresh();
        },
      );
    },
    performDutyAction(action, request, reason) {
      const context = requireContext();
      if (!controller.getDutyActions(request)[action])
        return Promise.reject(new Error('当前身份不能执行此加扣班操作。'));
      const key = `duty:${action}:${request.id}:${request.version}`;
      return runMutation(
        key,
        () => {
          const input = {
            expectedVersion: request.version,
            operationId: dependencies.createOperationId(),
          };
          if (action === 'accept')
            return dependencies.acceptDutyAdjustment(context.groupId, request.id, input);
          if (action === 'approve')
            return dependencies.approveDutyAdjustment(context.groupId, request.id, input);
          if (action === 'cancel')
            return dependencies.cancelDutyAdjustment(context.groupId, request.id, input);
          if (action === 'reject')
            return dependencies.rejectDutyAdjustment(context.groupId, request.id, input);
          const normalizedReason = reason?.trim();
          return dependencies.revokeDutyAdjustment(context.groupId, request.id, {
            ...input,
            ...(normalizedReason === undefined || normalizedReason.length === 0
              ? {}
              : { reason: normalizedReason }),
          });
        },
        async (result, active) => {
          if (
            action === 'approve' ||
            action === 'revoke' ||
            (action === 'accept' && result.status === 'completed')
          )
            invalidateDuty(active, result);
          patchState({ infoMessage: `加扣班操作已完成：${result.status}。` });
          await controller.refresh();
        },
      );
    },
    updateSwapRequiresApproval(value) {
      const context = requireContext();
      if (!isAdministrator(context))
        return Promise.reject(new Error('只有管理员可以修改换班审批设置。'));
      return runMutation(
        'swap:settings',
        () => dependencies.updateGroupSwapSettings(context.groupId, { requiresApproval: value }),
        async (result) => {
          patchState({ swap: { ...state.swap, groupRequiresApproval: result.requiresApproval } });
          await controller.refresh();
        },
      );
    },
    updateDutyRequiresApproval(value) {
      const context = requireContext();
      if (!isAdministrator(context))
        return Promise.reject(new Error('只有管理员可以修改加扣班审批设置。'));
      return runMutation(
        'duty:settings',
        () =>
          dependencies.updateGroupDutyAdjustmentSettings(context.groupId, {
            requiresApproval: value,
          }),
        async (result) => {
          patchState({ duty: { ...state.duty, groupRequiresApproval: result.requiresApproval } });
          await controller.refresh();
        },
      );
    },
    updateMemberAutoAccepts(value) {
      const context = requireContext();
      return runMutation(
        'member:swap-auto-accept',
        () => dependencies.updateMySwapSettings(context.groupId, { autoAcceptSwaps: value }),
        async (result) => {
          patchState({
            duty: { ...state.duty, dutyAutoAccepts: result.autoAcceptSwaps },
            swap: { ...state.swap, swapAutoAccepts: result.autoAcceptSwaps },
          });
          await controller.refresh();
        },
      );
    },
  };

  return controller;
}
