import type {
  ApproveLeaveRequestInput,
  ApprovedLeaveRequestResult,
  CreateDirectDutyAdjustmentInput,
  CreateDirectSwapInput,
  CreateDutyAdjustmentRequestInput,
  CreateLeaveRequestInput,
  CreateSwapRequestInput,
  DutyAdjustmentMutationInput,
  DutyAdjustmentPairInput,
  DutyAdjustmentPreview,
  DutyAdjustmentRequest,
  GroupDutyAdjustmentSettings,
  GroupLeaveReflowStrategy,
  GroupSwapSettings,
  LeaveAffectedShift,
  LeaveAffectedShiftsInput,
  LeaveReflowPreview,
  LeaveRequest,
  LeaveRequestMutationInput,
  LeaveRequestMutationResult,
  MemberSwapSettings,
  PreviewLeaveRequestInput,
  RejectedLeaveRequestResult,
  RejectLeaveRequestInput,
  RevokeDutyAdjustmentInput,
  RevokeSwapRequestInput,
  SwapPairInput,
  SwapPreview,
  SwapRequest,
  SwapRequestMutationInput,
  UpdateGroupDutyAdjustmentSettingsInput,
  UpdateGroupLeaveReflowStrategyInput,
  UpdateGroupSwapSettingsInput,
  UpdateMemberSwapSettingsInput,
} from '@schedule/contracts';

import {
  approvedLeaveRequestResultJsonSchema,
  dutyAdjustmentPreviewJsonSchema,
  dutyAdjustmentRequestJsonSchema,
  dutyAdjustmentRequestListJsonSchema,
  groupDutyAdjustmentSettingsJsonSchema,
  groupLeaveReflowStrategyJsonSchema,
  groupSwapSettingsJsonSchema,
  leaveAffectedShiftListJsonSchema,
  leaveReflowPreviewJsonSchema,
  leaveRequestJsonSchema,
  leaveRequestListJsonSchema,
  leaveRequestMutationResultJsonSchema,
  memberSwapSettingsJsonSchema,
  rejectedLeaveRequestResultJsonSchema,
  swapPreviewJsonSchema,
  swapRequestJsonSchema,
  swapRequestListJsonSchema,
} from './generated/calendar-schemas.js';
import { defineClientEndpoint, type ClientTransport } from './endpoint.js';
import { createCompactDecoder } from './json-decoder.js';

interface GroupInput {
  readonly groupId: string;
}

interface GroupRequestInput<Request> extends GroupInput {
  readonly request: Request;
}

interface ObjectRequestInput<Request> extends GroupRequestInput<Request> {
  readonly objectId: string;
}

export const leaveRequestDecoder = createCompactDecoder<LeaveRequest>(leaveRequestJsonSchema);
export const leaveRequestListDecoder = createCompactDecoder<LeaveRequest[]>(
  leaveRequestListJsonSchema,
);
export const leaveAffectedShiftListDecoder = createCompactDecoder<readonly LeaveAffectedShift[]>(
  leaveAffectedShiftListJsonSchema,
);
export const leaveReflowPreviewDecoder = createCompactDecoder<LeaveReflowPreview>(
  leaveReflowPreviewJsonSchema,
);
export const approvedLeaveRequestResultDecoder = createCompactDecoder<ApprovedLeaveRequestResult>(
  approvedLeaveRequestResultJsonSchema,
);
export const rejectedLeaveRequestResultDecoder = createCompactDecoder<RejectedLeaveRequestResult>(
  rejectedLeaveRequestResultJsonSchema,
);
export const leaveRequestMutationResultDecoder = createCompactDecoder<LeaveRequestMutationResult>(
  leaveRequestMutationResultJsonSchema,
);
export const groupLeaveReflowStrategyDecoder = createCompactDecoder<GroupLeaveReflowStrategy>(
  groupLeaveReflowStrategyJsonSchema,
);
export const swapPreviewDecoder = createCompactDecoder<SwapPreview>(swapPreviewJsonSchema);
export const swapRequestDecoder = createCompactDecoder<SwapRequest>(swapRequestJsonSchema);
export const swapRequestListDecoder =
  createCompactDecoder<SwapRequest[]>(swapRequestListJsonSchema);
export const groupSwapSettingsDecoder = createCompactDecoder<GroupSwapSettings>(
  groupSwapSettingsJsonSchema,
);
export const memberSwapSettingsDecoder = createCompactDecoder<MemberSwapSettings>(
  memberSwapSettingsJsonSchema,
);
export const dutyAdjustmentPreviewDecoder = createCompactDecoder<DutyAdjustmentPreview>(
  dutyAdjustmentPreviewJsonSchema,
);
export const dutyAdjustmentRequestDecoder = createCompactDecoder<DutyAdjustmentRequest>(
  dutyAdjustmentRequestJsonSchema,
);
export const dutyAdjustmentRequestListDecoder = createCompactDecoder<DutyAdjustmentRequest[]>(
  dutyAdjustmentRequestListJsonSchema,
);
export const groupDutyAdjustmentSettingsDecoder = createCompactDecoder<GroupDutyAdjustmentSettings>(
  groupDutyAdjustmentSettingsJsonSchema,
);

const requestBody = <Request>({ request }: GroupRequestInput<Request>): Request => request;
const operationId = <Request extends { readonly operationId: string }>(
  input: GroupRequestInput<Request>,
): string => input.request.operationId;

export const workflowEndpoints = {
  leaveCreate: defineClientEndpoint<GroupRequestInput<CreateLeaveRequestInput>, LeaveRequest>({
    auth: 'bearer',
    body: requestBody,
    decoder: leaveRequestDecoder,
    id: 'workflow.leave-create',
    idempotencyKey: operationId,
    method: 'POST',
    path: ({ groupId }) => leavePath(groupId),
  }),
  leaveMine: defineClientEndpoint<GroupInput, LeaveRequest[]>({
    auth: 'bearer',
    decoder: leaveRequestListDecoder,
    id: 'workflow.leave-mine',
    method: 'GET',
    path: ({ groupId }) => leavePath(groupId),
  }),
  leaveAffectedShifts: defineClientEndpoint<
    GroupRequestInput<LeaveAffectedShiftsInput>,
    readonly LeaveAffectedShift[]
  >({
    auth: 'bearer',
    body: requestBody,
    decoder: leaveAffectedShiftListDecoder,
    id: 'workflow.leave-affected-shifts',
    method: 'POST',
    path: ({ groupId }) => `${leavePath(groupId)}/affected-shifts`,
  }),
  leaveApprovals: defineClientEndpoint<GroupInput, LeaveRequest[]>({
    auth: 'bearer',
    decoder: leaveRequestListDecoder,
    id: 'workflow.leave-approvals',
    method: 'GET',
    path: ({ groupId }) => `${leavePath(groupId)}/approvals`,
  }),
  leavePreview: defineClientEndpoint<
    ObjectRequestInput<PreviewLeaveRequestInput>,
    LeaveReflowPreview
  >({
    auth: 'bearer',
    body: requestBody,
    decoder: leaveReflowPreviewDecoder,
    id: 'workflow.leave-preview',
    method: 'POST',
    path: ({ groupId, objectId }) => `${leaveObjectPath(groupId, objectId)}/preview`,
  }),
  leaveApprove: defineClientEndpoint<
    ObjectRequestInput<ApproveLeaveRequestInput>,
    ApprovedLeaveRequestResult
  >({
    auth: 'bearer',
    body: requestBody,
    decoder: approvedLeaveRequestResultDecoder,
    id: 'workflow.leave-approve',
    idempotencyKey: operationId,
    method: 'POST',
    path: ({ groupId, objectId }) => `${leaveObjectPath(groupId, objectId)}/approve`,
  }),
  leaveReject: defineClientEndpoint<
    ObjectRequestInput<RejectLeaveRequestInput>,
    RejectedLeaveRequestResult
  >({
    auth: 'bearer',
    body: requestBody,
    decoder: rejectedLeaveRequestResultDecoder,
    id: 'workflow.leave-reject',
    idempotencyKey: operationId,
    method: 'POST',
    path: ({ groupId, objectId }) => `${leaveObjectPath(groupId, objectId)}/reject`,
  }),
  leaveCancel: defineClientEndpoint<
    ObjectRequestInput<LeaveRequestMutationInput>,
    LeaveRequestMutationResult
  >({
    auth: 'bearer',
    body: requestBody,
    decoder: leaveRequestMutationResultDecoder,
    id: 'workflow.leave-cancel',
    idempotencyKey: operationId,
    method: 'POST',
    path: ({ groupId, objectId }) => `${leaveObjectPath(groupId, objectId)}/cancel`,
  }),
  leaveRevoke: defineClientEndpoint<
    ObjectRequestInput<LeaveRequestMutationInput>,
    LeaveRequestMutationResult
  >({
    auth: 'bearer',
    body: requestBody,
    decoder: leaveRequestMutationResultDecoder,
    id: 'workflow.leave-revoke',
    idempotencyKey: operationId,
    method: 'POST',
    path: ({ groupId, objectId }) => `${leaveObjectPath(groupId, objectId)}/revoke`,
  }),
  leaveStrategy: defineClientEndpoint<GroupInput, GroupLeaveReflowStrategy>({
    auth: 'bearer',
    decoder: groupLeaveReflowStrategyDecoder,
    id: 'workflow.leave-strategy',
    method: 'GET',
    path: ({ groupId }) => leaveStrategyPath(groupId),
  }),
  leaveStrategyUpdate: defineClientEndpoint<
    GroupRequestInput<UpdateGroupLeaveReflowStrategyInput>,
    GroupLeaveReflowStrategy
  >({
    auth: 'bearer',
    body: requestBody,
    decoder: groupLeaveReflowStrategyDecoder,
    id: 'workflow.leave-strategy-update',
    method: 'PUT',
    path: ({ groupId }) => leaveStrategyPath(groupId),
  }),
  swapPreview: defineClientEndpoint<GroupRequestInput<SwapPairInput>, SwapPreview>({
    auth: 'bearer',
    body: requestBody,
    decoder: swapPreviewDecoder,
    id: 'workflow.swap-preview',
    method: 'POST',
    path: ({ groupId }) => `${swapPath(groupId)}/preview`,
  }),
  swapCreate: defineClientEndpoint<GroupRequestInput<CreateSwapRequestInput>, SwapRequest>({
    auth: 'bearer',
    body: requestBody,
    decoder: swapRequestDecoder,
    id: 'workflow.swap-create',
    idempotencyKey: operationId,
    method: 'POST',
    path: ({ groupId }) => swapPath(groupId),
  }),
  swapDirectCreate: defineClientEndpoint<GroupRequestInput<CreateDirectSwapInput>, SwapRequest>({
    auth: 'bearer',
    body: requestBody,
    decoder: swapRequestDecoder,
    id: 'workflow.swap-direct-create',
    idempotencyKey: operationId,
    method: 'POST',
    path: ({ groupId }) => `${swapPath(groupId)}/direct`,
  }),
  swapMine: defineClientEndpoint<GroupInput, SwapRequest[]>({
    auth: 'bearer',
    decoder: swapRequestListDecoder,
    id: 'workflow.swap-mine',
    method: 'GET',
    path: ({ groupId }) => swapPath(groupId),
  }),
  swapApprovals: defineClientEndpoint<GroupInput, SwapRequest[]>({
    auth: 'bearer',
    decoder: swapRequestListDecoder,
    id: 'workflow.swap-approvals',
    method: 'GET',
    path: ({ groupId }) => `${swapPath(groupId)}/approvals`,
  }),
  swapAccept: workflowMutationEndpoint('swap-accept', swapRequestDecoder, 'swaps', 'accept'),
  swapApprove: workflowMutationEndpoint('swap-approve', swapRequestDecoder, 'swaps', 'approve'),
  swapReject: workflowMutationEndpoint('swap-reject', swapRequestDecoder, 'swaps', 'reject'),
  swapCancel: workflowMutationEndpoint('swap-cancel', swapRequestDecoder, 'swaps', 'cancel'),
  swapRevoke: defineClientEndpoint<ObjectRequestInput<RevokeSwapRequestInput>, SwapRequest>({
    auth: 'bearer',
    body: requestBody,
    decoder: swapRequestDecoder,
    id: 'workflow.swap-revoke',
    idempotencyKey: operationId,
    method: 'POST',
    path: ({ groupId, objectId }) => `${swapObjectPath(groupId, objectId)}/revoke`,
  }),
  swapSettings: defineClientEndpoint<GroupInput, GroupSwapSettings>({
    auth: 'bearer',
    decoder: groupSwapSettingsDecoder,
    id: 'workflow.swap-settings',
    method: 'GET',
    path: ({ groupId }) => `${swapPath(groupId)}/settings`,
  }),
  swapSettingsUpdate: defineClientEndpoint<
    GroupRequestInput<UpdateGroupSwapSettingsInput>,
    GroupSwapSettings
  >({
    auth: 'bearer',
    body: requestBody,
    decoder: groupSwapSettingsDecoder,
    id: 'workflow.swap-settings-update',
    method: 'PUT',
    path: ({ groupId }) => `${swapPath(groupId)}/settings`,
  }),
  swapMySettings: defineClientEndpoint<GroupInput, MemberSwapSettings>({
    auth: 'bearer',
    decoder: memberSwapSettingsDecoder,
    id: 'workflow.swap-my-settings',
    method: 'GET',
    path: ({ groupId }) => `${swapPath(groupId)}/my-settings`,
  }),
  swapMySettingsUpdate: defineClientEndpoint<
    GroupRequestInput<UpdateMemberSwapSettingsInput>,
    MemberSwapSettings
  >({
    auth: 'bearer',
    body: requestBody,
    decoder: memberSwapSettingsDecoder,
    id: 'workflow.swap-my-settings-update',
    method: 'PUT',
    path: ({ groupId }) => `${swapPath(groupId)}/my-settings`,
  }),
  dutyPreview: defineClientEndpoint<
    GroupRequestInput<DutyAdjustmentPairInput>,
    DutyAdjustmentPreview
  >({
    auth: 'bearer',
    body: requestBody,
    decoder: dutyAdjustmentPreviewDecoder,
    id: 'workflow.duty-preview',
    method: 'POST',
    path: ({ groupId }) => `${dutyPath(groupId)}/preview`,
  }),
  dutyCreate: defineClientEndpoint<
    GroupRequestInput<CreateDutyAdjustmentRequestInput>,
    DutyAdjustmentRequest
  >({
    auth: 'bearer',
    body: requestBody,
    decoder: dutyAdjustmentRequestDecoder,
    id: 'workflow.duty-create',
    idempotencyKey: operationId,
    method: 'POST',
    path: ({ groupId }) => dutyPath(groupId),
  }),
  dutyDirectCreate: defineClientEndpoint<
    GroupRequestInput<CreateDirectDutyAdjustmentInput>,
    DutyAdjustmentRequest
  >({
    auth: 'bearer',
    body: requestBody,
    decoder: dutyAdjustmentRequestDecoder,
    id: 'workflow.duty-direct-create',
    idempotencyKey: operationId,
    method: 'POST',
    path: ({ groupId }) => `${dutyPath(groupId)}/direct`,
  }),
  dutyMine: defineClientEndpoint<GroupInput, DutyAdjustmentRequest[]>({
    auth: 'bearer',
    decoder: dutyAdjustmentRequestListDecoder,
    id: 'workflow.duty-mine',
    method: 'GET',
    path: ({ groupId }) => dutyPath(groupId),
  }),
  dutyApprovals: defineClientEndpoint<GroupInput, DutyAdjustmentRequest[]>({
    auth: 'bearer',
    decoder: dutyAdjustmentRequestListDecoder,
    id: 'workflow.duty-approvals',
    method: 'GET',
    path: ({ groupId }) => `${dutyPath(groupId)}/approvals`,
  }),
  dutyAccept: workflowMutationEndpoint(
    'duty-accept',
    dutyAdjustmentRequestDecoder,
    'duty-adjustments',
    'accept',
  ),
  dutyApprove: workflowMutationEndpoint(
    'duty-approve',
    dutyAdjustmentRequestDecoder,
    'duty-adjustments',
    'approve',
  ),
  dutyReject: workflowMutationEndpoint(
    'duty-reject',
    dutyAdjustmentRequestDecoder,
    'duty-adjustments',
    'reject',
  ),
  dutyCancel: workflowMutationEndpoint(
    'duty-cancel',
    dutyAdjustmentRequestDecoder,
    'duty-adjustments',
    'cancel',
  ),
  dutyRevoke: defineClientEndpoint<
    ObjectRequestInput<RevokeDutyAdjustmentInput>,
    DutyAdjustmentRequest
  >({
    auth: 'bearer',
    body: requestBody,
    decoder: dutyAdjustmentRequestDecoder,
    id: 'workflow.duty-revoke',
    idempotencyKey: operationId,
    method: 'POST',
    path: ({ groupId, objectId }) => `${dutyObjectPath(groupId, objectId)}/revoke`,
  }),
  dutySettings: defineClientEndpoint<GroupInput, GroupDutyAdjustmentSettings>({
    auth: 'bearer',
    decoder: groupDutyAdjustmentSettingsDecoder,
    id: 'workflow.duty-settings',
    method: 'GET',
    path: ({ groupId }) => `${dutyPath(groupId)}/settings`,
  }),
  dutySettingsUpdate: defineClientEndpoint<
    GroupRequestInput<UpdateGroupDutyAdjustmentSettingsInput>,
    GroupDutyAdjustmentSettings
  >({
    auth: 'bearer',
    body: requestBody,
    decoder: groupDutyAdjustmentSettingsDecoder,
    id: 'workflow.duty-settings-update',
    method: 'PUT',
    path: ({ groupId }) => `${dutyPath(groupId)}/settings`,
  }),
  dutyMySettings: defineClientEndpoint<GroupInput, MemberSwapSettings>({
    auth: 'bearer',
    decoder: memberSwapSettingsDecoder,
    id: 'workflow.duty-my-settings',
    method: 'GET',
    path: ({ groupId }) => `${dutyPath(groupId)}/my-settings`,
  }),
} as const;

export interface WorkflowClient {
  acceptDutyAdjustment(
    groupId: string,
    objectId: string,
    request: DutyAdjustmentMutationInput,
  ): Promise<DutyAdjustmentRequest>;
  acceptSwapRequest(
    groupId: string,
    objectId: string,
    request: SwapRequestMutationInput,
  ): Promise<SwapRequest>;
  approveDutyAdjustment(
    groupId: string,
    objectId: string,
    request: DutyAdjustmentMutationInput,
  ): Promise<DutyAdjustmentRequest>;
  approveLeaveRequest(
    groupId: string,
    objectId: string,
    request: ApproveLeaveRequestInput,
  ): Promise<ApprovedLeaveRequestResult>;
  approveSwapRequest(
    groupId: string,
    objectId: string,
    request: SwapRequestMutationInput,
  ): Promise<SwapRequest>;
  cancelDutyAdjustment(
    groupId: string,
    objectId: string,
    request: DutyAdjustmentMutationInput,
  ): Promise<DutyAdjustmentRequest>;
  cancelLeaveRequest(
    groupId: string,
    objectId: string,
    request: LeaveRequestMutationInput,
  ): Promise<LeaveRequestMutationResult>;
  cancelSwapRequest(
    groupId: string,
    objectId: string,
    request: SwapRequestMutationInput,
  ): Promise<SwapRequest>;
  createDirectDutyAdjustment(
    groupId: string,
    request: CreateDirectDutyAdjustmentInput,
  ): Promise<DutyAdjustmentRequest>;
  createDirectSwapRequest(groupId: string, request: CreateDirectSwapInput): Promise<SwapRequest>;
  createDutyAdjustmentRequest(
    groupId: string,
    request: CreateDutyAdjustmentRequestInput,
  ): Promise<DutyAdjustmentRequest>;
  createLeaveRequest(groupId: string, request: CreateLeaveRequestInput): Promise<LeaveRequest>;
  createSwapRequest(groupId: string, request: CreateSwapRequestInput): Promise<SwapRequest>;
  getGroupDutyAdjustmentSettings(groupId: string): Promise<GroupDutyAdjustmentSettings>;
  getGroupSwapSettings(groupId: string): Promise<GroupSwapSettings>;
  getLeaveAffectedShifts(
    groupId: string,
    request: LeaveAffectedShiftsInput,
  ): Promise<readonly LeaveAffectedShift[]>;
  getLeaveReflowStrategy(groupId: string): Promise<GroupLeaveReflowStrategy>;
  getMyDutyAdjustmentSettings(groupId: string): Promise<MemberSwapSettings>;
  getMySwapSettings(groupId: string): Promise<MemberSwapSettings>;
  listDutyAdjustmentApprovals(groupId: string): Promise<DutyAdjustmentRequest[]>;
  listLeaveRequestApprovals(groupId: string): Promise<LeaveRequest[]>;
  listMyDutyAdjustments(groupId: string): Promise<DutyAdjustmentRequest[]>;
  listMyLeaveRequests(groupId: string): Promise<LeaveRequest[]>;
  listMySwapRequests(groupId: string): Promise<SwapRequest[]>;
  listSwapApprovals(groupId: string): Promise<SwapRequest[]>;
  previewDutyAdjustment(
    groupId: string,
    request: DutyAdjustmentPairInput,
  ): Promise<DutyAdjustmentPreview>;
  previewLeaveRequestApproval(
    groupId: string,
    objectId: string,
    request: PreviewLeaveRequestInput,
  ): Promise<LeaveReflowPreview>;
  previewSwap(groupId: string, request: SwapPairInput): Promise<SwapPreview>;
  rejectDutyAdjustment(
    groupId: string,
    objectId: string,
    request: DutyAdjustmentMutationInput,
  ): Promise<DutyAdjustmentRequest>;
  rejectLeaveRequest(
    groupId: string,
    objectId: string,
    request: RejectLeaveRequestInput,
  ): Promise<RejectedLeaveRequestResult>;
  rejectSwapRequest(
    groupId: string,
    objectId: string,
    request: SwapRequestMutationInput,
  ): Promise<SwapRequest>;
  revokeDutyAdjustment(
    groupId: string,
    objectId: string,
    request: RevokeDutyAdjustmentInput,
  ): Promise<DutyAdjustmentRequest>;
  revokeLeaveRequest(
    groupId: string,
    objectId: string,
    request: LeaveRequestMutationInput,
  ): Promise<LeaveRequestMutationResult>;
  revokeSwapRequest(
    groupId: string,
    objectId: string,
    request: RevokeSwapRequestInput,
  ): Promise<SwapRequest>;
  updateGroupDutyAdjustmentSettings(
    groupId: string,
    request: UpdateGroupDutyAdjustmentSettingsInput,
  ): Promise<GroupDutyAdjustmentSettings>;
  updateGroupSwapSettings(
    groupId: string,
    request: UpdateGroupSwapSettingsInput,
  ): Promise<GroupSwapSettings>;
  updateLeaveReflowStrategy(
    groupId: string,
    request: UpdateGroupLeaveReflowStrategyInput,
  ): Promise<GroupLeaveReflowStrategy>;
  updateMySwapSettings(
    groupId: string,
    request: UpdateMemberSwapSettingsInput,
  ): Promise<MemberSwapSettings>;
}

export function createWorkflowClient(transport: ClientTransport): WorkflowClient {
  const group = <Request, Result>(
    endpoint: { readonly id: string },
    groupId: string,
    request?: Request,
  ): Promise<Result> =>
    transport.request(
      endpoint as never,
      (request === undefined ? { groupId } : { groupId, request }) as never,
    );
  const object = <Request, Result>(
    endpoint: { readonly id: string },
    groupId: string,
    objectId: string,
    request: Request,
  ): Promise<Result> =>
    transport.request(endpoint as never, { groupId, objectId, request } as never);

  return {
    acceptDutyAdjustment: (groupId, objectId, request) =>
      object(workflowEndpoints.dutyAccept, groupId, objectId, request),
    acceptSwapRequest: (groupId, objectId, request) =>
      object(workflowEndpoints.swapAccept, groupId, objectId, request),
    approveDutyAdjustment: (groupId, objectId, request) =>
      object(workflowEndpoints.dutyApprove, groupId, objectId, request),
    approveLeaveRequest: (groupId, objectId, request) =>
      object(workflowEndpoints.leaveApprove, groupId, objectId, request),
    approveSwapRequest: (groupId, objectId, request) =>
      object(workflowEndpoints.swapApprove, groupId, objectId, request),
    cancelDutyAdjustment: (groupId, objectId, request) =>
      object(workflowEndpoints.dutyCancel, groupId, objectId, request),
    cancelLeaveRequest: (groupId, objectId, request) =>
      object(workflowEndpoints.leaveCancel, groupId, objectId, request),
    cancelSwapRequest: (groupId, objectId, request) =>
      object(workflowEndpoints.swapCancel, groupId, objectId, request),
    createDirectDutyAdjustment: (groupId, request) =>
      group(workflowEndpoints.dutyDirectCreate, groupId, request),
    createDirectSwapRequest: (groupId, request) =>
      group(workflowEndpoints.swapDirectCreate, groupId, request),
    createDutyAdjustmentRequest: (groupId, request) =>
      group(workflowEndpoints.dutyCreate, groupId, request),
    createLeaveRequest: (groupId, request) =>
      group(workflowEndpoints.leaveCreate, groupId, request),
    createSwapRequest: (groupId, request) => group(workflowEndpoints.swapCreate, groupId, request),
    getGroupDutyAdjustmentSettings: (groupId) => group(workflowEndpoints.dutySettings, groupId),
    getGroupSwapSettings: (groupId) => group(workflowEndpoints.swapSettings, groupId),
    getLeaveAffectedShifts: (groupId, request) =>
      group(workflowEndpoints.leaveAffectedShifts, groupId, request),
    getLeaveReflowStrategy: (groupId) => group(workflowEndpoints.leaveStrategy, groupId),
    getMyDutyAdjustmentSettings: (groupId) => group(workflowEndpoints.dutyMySettings, groupId),
    getMySwapSettings: (groupId) => group(workflowEndpoints.swapMySettings, groupId),
    listDutyAdjustmentApprovals: (groupId) => group(workflowEndpoints.dutyApprovals, groupId),
    listLeaveRequestApprovals: (groupId) => group(workflowEndpoints.leaveApprovals, groupId),
    listMyDutyAdjustments: (groupId) => group(workflowEndpoints.dutyMine, groupId),
    listMyLeaveRequests: (groupId) => group(workflowEndpoints.leaveMine, groupId),
    listMySwapRequests: (groupId) => group(workflowEndpoints.swapMine, groupId),
    listSwapApprovals: (groupId) => group(workflowEndpoints.swapApprovals, groupId),
    previewDutyAdjustment: (groupId, request) =>
      group(workflowEndpoints.dutyPreview, groupId, request),
    previewLeaveRequestApproval: (groupId, objectId, request) =>
      object(workflowEndpoints.leavePreview, groupId, objectId, request),
    previewSwap: (groupId, request) => group(workflowEndpoints.swapPreview, groupId, request),
    rejectDutyAdjustment: (groupId, objectId, request) =>
      object(workflowEndpoints.dutyReject, groupId, objectId, request),
    rejectLeaveRequest: (groupId, objectId, request) =>
      object(workflowEndpoints.leaveReject, groupId, objectId, request),
    rejectSwapRequest: (groupId, objectId, request) =>
      object(workflowEndpoints.swapReject, groupId, objectId, request),
    revokeDutyAdjustment: (groupId, objectId, request) =>
      object(workflowEndpoints.dutyRevoke, groupId, objectId, request),
    revokeLeaveRequest: (groupId, objectId, request) =>
      object(workflowEndpoints.leaveRevoke, groupId, objectId, request),
    revokeSwapRequest: (groupId, objectId, request) =>
      object(workflowEndpoints.swapRevoke, groupId, objectId, request),
    updateGroupDutyAdjustmentSettings: (groupId, request) =>
      group(workflowEndpoints.dutySettingsUpdate, groupId, request),
    updateGroupSwapSettings: (groupId, request) =>
      group(workflowEndpoints.swapSettingsUpdate, groupId, request),
    updateLeaveReflowStrategy: (groupId, request) =>
      group(workflowEndpoints.leaveStrategyUpdate, groupId, request),
    updateMySwapSettings: (groupId, request) =>
      group(workflowEndpoints.swapMySettingsUpdate, groupId, request),
  };
}

function workflowMutationEndpoint<Output>(
  id: string,
  decoder: ReturnType<typeof createCompactDecoder<Output>>,
  resource: 'duty-adjustments' | 'swaps',
  action: 'accept' | 'approve' | 'cancel' | 'reject',
) {
  return defineClientEndpoint<
    ObjectRequestInput<{ readonly expectedVersion: number; readonly operationId: string }>,
    Output
  >({
    auth: 'bearer',
    body: requestBody,
    decoder,
    id: `workflow.${id}`,
    idempotencyKey: operationId,
    method: 'POST',
    path: ({ groupId, objectId }) =>
      `/groups/${encodeURIComponent(groupId)}/${resource}/${encodeURIComponent(objectId)}/${action}`,
  });
}

function leavePath(groupId: string): string {
  return `/groups/${encodeURIComponent(groupId)}/leave-requests`;
}
function leaveObjectPath(groupId: string, objectId: string): string {
  return `${leavePath(groupId)}/${encodeURIComponent(objectId)}`;
}
function leaveStrategyPath(groupId: string): string {
  return `/groups/${encodeURIComponent(groupId)}/leave-reflow-strategy`;
}
function swapPath(groupId: string): string {
  return `/groups/${encodeURIComponent(groupId)}/swaps`;
}
function swapObjectPath(groupId: string, objectId: string): string {
  return `${swapPath(groupId)}/${encodeURIComponent(objectId)}`;
}
function dutyPath(groupId: string): string {
  return `/groups/${encodeURIComponent(groupId)}/duty-adjustments`;
}
function dutyObjectPath(groupId: string, objectId: string): string {
  return `${dutyPath(groupId)}/${encodeURIComponent(objectId)}`;
}
