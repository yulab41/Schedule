import type {
  CreateScheduleRoleRequest,
  CreateShiftTypeRequest,
  ReorderRotationMembersRequest,
  ReplaceScheduleRoleMembersRequest,
  ScheduleRole,
  ScheduleRoleVersionMutationRequest,
  ShiftType,
  ShiftTypeVersionMutationRequest,
  UpdateRotationRuleRequest,
  UpdateShiftTypeRequest,
} from '@schedule/contracts';

import { scheduleRoleJsonSchema, shiftTypeJsonSchema } from './generated/calendar-schemas.js';
import { defineClientEndpoint, type ClientEndpoint, type ClientTransport } from './endpoint.js';
import { createCompactDecoder, type CompactDecoder } from './json-decoder.js';

interface GroupRequestInput<Request> {
  readonly groupId: string;
  readonly request: Request;
}

interface RoleRequestInput<Request> extends GroupRequestInput<Request> {
  readonly roleId: string;
}

interface ShiftTypeRequestInput<Request> extends GroupRequestInput<Request> {
  readonly shiftTypeId: string;
}

export const scheduleRoleMutationDecoder =
  createCompactDecoder<ScheduleRole>(scheduleRoleJsonSchema);
export const shiftTypeMutationDecoder = createCompactDecoder<ShiftType>(shiftTypeJsonSchema);
const emptyResponseDecoder: CompactDecoder<void> = {
  safeDecode(value) {
    return value === undefined || value === null || value === ''
      ? { data: undefined, success: true }
      : { success: false };
  },
};

const body = <Request>({ request }: GroupRequestInput<Request>): Request => request;
const operationId = <Request extends { readonly operationId: string }>(
  input: GroupRequestInput<Request>,
): string => input.request.operationId;

export const schedulingConfigWriteEndpoints = {
  createScheduleRole: defineClientEndpoint<
    GroupRequestInput<CreateScheduleRoleRequest>,
    ScheduleRole
  >({
    auth: 'bearer',
    body,
    decoder: scheduleRoleMutationDecoder,
    id: 'scheduling-config-write.schedule-role-create',
    idempotencyKey: operationId,
    method: 'POST',
    path: ({ groupId }) => `${groupPath(groupId)}/schedule-roles`,
  }),
  createShiftType: defineClientEndpoint<GroupRequestInput<CreateShiftTypeRequest>, ShiftType>({
    auth: 'bearer',
    body,
    decoder: shiftTypeMutationDecoder,
    id: 'scheduling-config-write.shift-type-create',
    idempotencyKey: operationId,
    method: 'POST',
    path: ({ groupId }) => `${groupPath(groupId)}/shift-types`,
  }),
  deleteScheduleRole: roleEndpoint<ScheduleRoleVersionMutationRequest, void>(
    'schedule-role-delete',
    'DELETE',
    '',
    emptyResponseDecoder,
  ),
  deleteShiftType: shiftTypeEndpoint<ShiftTypeVersionMutationRequest, void>(
    'shift-type-delete',
    'DELETE',
    emptyResponseDecoder,
  ),
  reorderRotationMembers: roleEndpoint<ReorderRotationMembersRequest, ScheduleRole>(
    'rotation-members-reorder',
    'PUT',
    'rotation-members',
    scheduleRoleMutationDecoder,
  ),
  replaceScheduleRoleMembers: roleEndpoint<ReplaceScheduleRoleMembersRequest, ScheduleRole>(
    'schedule-role-members-replace',
    'PUT',
    'members',
    scheduleRoleMutationDecoder,
  ),
  updateRotationRule: roleEndpoint<UpdateRotationRuleRequest, ScheduleRole>(
    'rotation-rule-update',
    'PUT',
    'rotation-rule',
    scheduleRoleMutationDecoder,
  ),
  updateShiftType: shiftTypeEndpoint<UpdateShiftTypeRequest, ShiftType>(
    'shift-type-update',
    'PUT',
    shiftTypeMutationDecoder,
  ),
} as const;

export interface SchedulingConfigWriteClient {
  createScheduleRole(groupId: string, request: CreateScheduleRoleRequest): Promise<ScheduleRole>;
  createShiftType(groupId: string, request: CreateShiftTypeRequest): Promise<ShiftType>;
  deleteScheduleRole(
    groupId: string,
    roleId: string,
    request: ScheduleRoleVersionMutationRequest,
  ): Promise<void>;
  deleteShiftType(
    groupId: string,
    shiftTypeId: string,
    request: ShiftTypeVersionMutationRequest,
  ): Promise<void>;
  reorderRotationMembers(
    groupId: string,
    roleId: string,
    request: ReorderRotationMembersRequest,
  ): Promise<ScheduleRole>;
  replaceScheduleRoleMembers(
    groupId: string,
    roleId: string,
    request: ReplaceScheduleRoleMembersRequest,
  ): Promise<ScheduleRole>;
  updateRotationRule(
    groupId: string,
    roleId: string,
    request: UpdateRotationRuleRequest,
  ): Promise<ScheduleRole>;
  updateShiftType(
    groupId: string,
    shiftTypeId: string,
    request: UpdateShiftTypeRequest,
  ): Promise<ShiftType>;
}

export function createSchedulingConfigWriteClient(
  transport: ClientTransport,
): SchedulingConfigWriteClient {
  return {
    createScheduleRole: (groupId, request) =>
      group(schedulingConfigWriteEndpoints.createScheduleRole, groupId, request),
    createShiftType: (groupId, request) =>
      group(schedulingConfigWriteEndpoints.createShiftType, groupId, request),
    deleteScheduleRole: (groupId, roleId, request) =>
      role(schedulingConfigWriteEndpoints.deleteScheduleRole, groupId, roleId, request),
    deleteShiftType: (groupId, shiftTypeId, request) =>
      shiftType(schedulingConfigWriteEndpoints.deleteShiftType, groupId, shiftTypeId, request),
    reorderRotationMembers: (groupId, roleId, request) =>
      role(schedulingConfigWriteEndpoints.reorderRotationMembers, groupId, roleId, request),
    replaceScheduleRoleMembers: (groupId, roleId, request) =>
      role(schedulingConfigWriteEndpoints.replaceScheduleRoleMembers, groupId, roleId, request),
    updateRotationRule: (groupId, roleId, request) =>
      role(schedulingConfigWriteEndpoints.updateRotationRule, groupId, roleId, request),
    updateShiftType: (groupId, shiftTypeId, request) =>
      shiftType(schedulingConfigWriteEndpoints.updateShiftType, groupId, shiftTypeId, request),
  };

  function group<Request, Output>(
    endpoint: ClientEndpoint<GroupRequestInput<Request>, Output>,
    groupId: string,
    request: Request,
  ): Promise<Output> {
    return transport.request(endpoint, { groupId, request });
  }

  function role<Request, Output>(
    endpoint: ClientEndpoint<RoleRequestInput<Request>, Output>,
    groupId: string,
    roleId: string,
    request: Request,
  ): Promise<Output> {
    return transport.request(endpoint, { groupId, request, roleId });
  }

  function shiftType<Request, Output>(
    endpoint: ClientEndpoint<ShiftTypeRequestInput<Request>, Output>,
    groupId: string,
    shiftTypeId: string,
    request: Request,
  ): Promise<Output> {
    return transport.request(endpoint, { groupId, request, shiftTypeId });
  }
}

function roleEndpoint<Request extends { readonly operationId: string }, Output>(
  id: string,
  method: 'DELETE' | 'PUT',
  suffix: string,
  decoder: CompactDecoder<Output>,
) {
  return defineClientEndpoint<RoleRequestInput<Request>, Output>({
    auth: 'bearer',
    body,
    decoder,
    id: `scheduling-config-write.${id}`,
    idempotencyKey: operationId,
    method,
    path: ({ groupId, roleId }) =>
      `${groupPath(groupId)}/schedule-roles/${encodeURIComponent(roleId)}${suffix === '' ? '' : `/${suffix}`}`,
  });
}

function shiftTypeEndpoint<Request extends { readonly operationId: string }, Output>(
  id: string,
  method: 'DELETE' | 'PUT',
  decoder: CompactDecoder<Output>,
) {
  return defineClientEndpoint<ShiftTypeRequestInput<Request>, Output>({
    auth: 'bearer',
    body,
    decoder,
    id: `scheduling-config-write.${id}`,
    idempotencyKey: operationId,
    method,
    path: ({ groupId, shiftTypeId }) =>
      `${groupPath(groupId)}/shift-types/${encodeURIComponent(shiftTypeId)}`,
  });
}

function groupPath(groupId: string): string {
  return `/groups/${encodeURIComponent(groupId)}`;
}
