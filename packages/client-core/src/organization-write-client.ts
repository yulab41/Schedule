import type {
  AddGroupMembersRequest,
  AddGroupMembersResponse,
  AddRosterEntriesRequest,
  AddRosterEntriesResponse,
  ConvertPendingRosterRequest,
  ConvertPendingRosterResponse,
  CreateGroupRequest,
  GroupMember,
  GroupMemberContact,
  GroupMemberVersionMutationRequest,
  GroupSummary,
  GroupVersionMutationRequest,
  OrganizationOperationRequest,
  TransferGroupOwnershipRequest,
  UpdateGroupMemberContactRequest,
  UpdateGroupMemberNameRequest,
  UpdateGroupMemberRoleRequest,
  UpdateGroupNameRequest,
} from '@schedule/contracts';

import {
  addGroupMembersResponseJsonSchema,
  addRosterEntriesResponseJsonSchema,
  convertPendingRosterResponseJsonSchema,
  groupMemberContactJsonSchema,
  groupMemberJsonSchema,
  groupSummaryJsonSchema,
} from './generated/calendar-schemas.js';
import { defineClientEndpoint, type ClientEndpoint, type ClientTransport } from './endpoint.js';
import { createCompactDecoder, type CompactDecoder } from './json-decoder.js';

interface RequestInput<Request> {
  readonly request: Request;
}

interface GroupRequestInput<Request> extends RequestInput<Request> {
  readonly groupId: string;
}

interface MemberRequestInput<Request> extends GroupRequestInput<Request> {
  readonly memberId: string;
}

export const groupSummaryMutationDecoder =
  /* @__PURE__ */ createCompactDecoder<GroupSummary>(groupSummaryJsonSchema);
export const groupMemberMutationDecoder =
  /* @__PURE__ */ createCompactDecoder<GroupMember>(groupMemberJsonSchema);
export const groupMemberContactMutationDecoder =
  /* @__PURE__ */ createCompactDecoder<GroupMemberContact>(groupMemberContactJsonSchema);
export const addRosterEntriesResponseDecoder =
  /* @__PURE__ */ createCompactDecoder<AddRosterEntriesResponse>(
    addRosterEntriesResponseJsonSchema,
  );
export const addGroupMembersResponseDecoder =
  /* @__PURE__ */ createCompactDecoder<AddGroupMembersResponse>(addGroupMembersResponseJsonSchema);
export const convertPendingRosterResponseDecoder =
  /* @__PURE__ */ createCompactDecoder<ConvertPendingRosterResponse>(
    convertPendingRosterResponseJsonSchema,
  );
const emptyResponseDecoder: CompactDecoder<void> = {
  safeDecode(value) {
    return value === undefined || value === null || value === ''
      ? { data: undefined, success: true }
      : { success: false };
  },
};

const body = <Request>({ request }: RequestInput<Request>): Request => request;
const operationId = <Request extends { readonly operationId: string }>(
  input: RequestInput<Request>,
): string => input.request.operationId;

export const organizationWriteEndpoints = {
  addGroupMembers: groupEndpoint<AddGroupMembersRequest, AddGroupMembersResponse>(
    'members-add',
    'POST',
    'members',
    addGroupMembersResponseDecoder,
  ),
  addRosterEntries: groupEndpoint<AddRosterEntriesRequest, AddRosterEntriesResponse>(
    'roster-add',
    'POST',
    'roster-entries',
    addRosterEntriesResponseDecoder,
  ),
  convertRosterEntries: groupEndpoint<ConvertPendingRosterRequest, ConvertPendingRosterResponse>(
    'roster-convert',
    'POST',
    'roster-entries/convert',
    convertPendingRosterResponseDecoder,
  ),
  createGroup: /* @__PURE__ */ defineClientEndpoint<RequestInput<CreateGroupRequest>, GroupSummary>(
    {
      auth: 'bearer',
      body,
      decoder: groupSummaryMutationDecoder,
      id: 'organization-write.create-group',
      idempotencyKey: operationId,
      method: 'POST',
      path: () => '/groups',
    },
  ),
  deleteGroup: groupEndpoint<GroupVersionMutationRequest, void>(
    'group-delete',
    'DELETE',
    '',
    emptyResponseDecoder,
  ),
  deleteMember: memberEndpoint<GroupMemberVersionMutationRequest, void>(
    'member-delete',
    'DELETE',
    '',
    emptyResponseDecoder,
  ),
  joinGroupAsGuest: groupEndpoint<OrganizationOperationRequest, GroupSummary>(
    'guest-join',
    'POST',
    'join-guest',
    groupSummaryMutationDecoder,
  ),
  leaveGroup: groupEndpoint<OrganizationOperationRequest, void>(
    'group-leave',
    'POST',
    'leave',
    emptyResponseDecoder,
  ),
  restoreGroup: groupEndpoint<GroupVersionMutationRequest, void>(
    'group-restore',
    'POST',
    'restore',
    emptyResponseDecoder,
  ),
  transferGroupOwnership: groupEndpoint<TransferGroupOwnershipRequest, GroupSummary>(
    'owner-transfer',
    'POST',
    'owner-transfer',
    groupSummaryMutationDecoder,
  ),
  updateGroupName: groupEndpoint<UpdateGroupNameRequest, GroupSummary>(
    'group-name-update',
    'PUT',
    'name',
    groupSummaryMutationDecoder,
  ),
  updateMemberContact: memberEndpoint<UpdateGroupMemberContactRequest, GroupMemberContact>(
    'member-contact-update',
    'PUT',
    'contact',
    groupMemberContactMutationDecoder,
  ),
  updateMemberName: memberEndpoint<UpdateGroupMemberNameRequest, GroupMember>(
    'member-name-update',
    'PUT',
    'name',
    groupMemberMutationDecoder,
  ),
  updateMemberRole: memberEndpoint<UpdateGroupMemberRoleRequest, GroupMember>(
    'member-role-update',
    'PUT',
    'role',
    groupMemberMutationDecoder,
  ),
} as const;

export interface OrganizationWriteClient {
  addGroupMembers(
    groupId: string,
    request: AddGroupMembersRequest,
  ): Promise<AddGroupMembersResponse>;
  addRosterEntries(
    groupId: string,
    request: AddRosterEntriesRequest,
  ): Promise<AddRosterEntriesResponse>;
  convertRosterEntries(
    groupId: string,
    request: ConvertPendingRosterRequest,
  ): Promise<ConvertPendingRosterResponse>;
  createGroup(request: CreateGroupRequest): Promise<GroupSummary>;
  deleteGroup(groupId: string, request: GroupVersionMutationRequest): Promise<void>;
  deleteGroupMember(
    groupId: string,
    memberId: string,
    request: GroupMemberVersionMutationRequest,
  ): Promise<void>;
  joinGroupAsGuest(groupId: string, request: OrganizationOperationRequest): Promise<GroupSummary>;
  leaveGroup(groupId: string, request: OrganizationOperationRequest): Promise<void>;
  restoreGroup(groupId: string, request: GroupVersionMutationRequest): Promise<void>;
  transferGroupOwnership(
    groupId: string,
    request: TransferGroupOwnershipRequest,
  ): Promise<GroupSummary>;
  updateGroupMemberContact(
    groupId: string,
    memberId: string,
    request: UpdateGroupMemberContactRequest,
  ): Promise<GroupMemberContact>;
  updateGroupMemberName(
    groupId: string,
    memberId: string,
    request: UpdateGroupMemberNameRequest,
  ): Promise<GroupMember>;
  updateGroupMemberRole(
    groupId: string,
    memberId: string,
    request: UpdateGroupMemberRoleRequest,
  ): Promise<GroupMember>;
  updateGroupName(groupId: string, request: UpdateGroupNameRequest): Promise<GroupSummary>;
}

export function createOrganizationWriteClient(transport: ClientTransport): OrganizationWriteClient {
  return {
    addGroupMembers: (groupId, request) =>
      group(organizationWriteEndpoints.addGroupMembers, groupId, request),
    addRosterEntries: (groupId, request) =>
      group(organizationWriteEndpoints.addRosterEntries, groupId, request),
    convertRosterEntries: (groupId, request) =>
      group(organizationWriteEndpoints.convertRosterEntries, groupId, request),
    createGroup: (request) =>
      transport.request(organizationWriteEndpoints.createGroup, { request }),
    deleteGroup: (groupId, request) =>
      group(organizationWriteEndpoints.deleteGroup, groupId, request),
    deleteGroupMember: (groupId, memberId, request) =>
      member(organizationWriteEndpoints.deleteMember, groupId, memberId, request),
    joinGroupAsGuest: (groupId, request) =>
      group(organizationWriteEndpoints.joinGroupAsGuest, groupId, request),
    leaveGroup: (groupId, request) =>
      group(organizationWriteEndpoints.leaveGroup, groupId, request),
    restoreGroup: (groupId, request) =>
      group(organizationWriteEndpoints.restoreGroup, groupId, request),
    transferGroupOwnership: (groupId, request) =>
      group(organizationWriteEndpoints.transferGroupOwnership, groupId, request),
    updateGroupMemberContact: (groupId, memberId, request) =>
      member(organizationWriteEndpoints.updateMemberContact, groupId, memberId, request),
    updateGroupMemberName: (groupId, memberId, request) =>
      member(organizationWriteEndpoints.updateMemberName, groupId, memberId, request),
    updateGroupMemberRole: (groupId, memberId, request) =>
      member(organizationWriteEndpoints.updateMemberRole, groupId, memberId, request),
    updateGroupName: (groupId, request) =>
      group(organizationWriteEndpoints.updateGroupName, groupId, request),
  };

  function group<Request, Output>(
    endpoint: ClientEndpoint<GroupRequestInput<Request>, Output>,
    groupId: string,
    request: Request,
  ): Promise<Output> {
    return transport.request(endpoint, { groupId, request });
  }
  function member<Request, Output>(
    endpoint: ClientEndpoint<MemberRequestInput<Request>, Output>,
    groupId: string,
    memberId: string,
    request: Request,
  ): Promise<Output> {
    return transport.request(endpoint, { groupId, memberId, request });
  }
}

function groupEndpoint<Request extends { readonly operationId: string }, Output>(
  id: string,
  method: 'DELETE' | 'POST' | 'PUT',
  suffix: string,
  decoder: CompactDecoder<Output>,
) {
  return defineClientEndpoint<GroupRequestInput<Request>, Output>({
    auth: 'bearer',
    body,
    decoder,
    id: `organization-write.${id}`,
    idempotencyKey: operationId,
    method,
    path: ({ groupId }) => `${groupPath(groupId)}${suffix === '' ? '' : `/${suffix}`}`,
  });
}

function memberEndpoint<Request extends { readonly operationId: string }, Output>(
  id: string,
  method: 'DELETE' | 'POST' | 'PUT',
  suffix: string,
  decoder: CompactDecoder<Output>,
) {
  return defineClientEndpoint<MemberRequestInput<Request>, Output>({
    auth: 'bearer',
    body,
    decoder,
    id: `organization-write.${id}`,
    idempotencyKey: operationId,
    method,
    path: ({ groupId, memberId }) =>
      `${groupPath(groupId)}/members/${encodeURIComponent(memberId)}${suffix === '' ? '' : `/${suffix}`}`,
  });
}

function groupPath(groupId: string): string {
  return `/groups/${encodeURIComponent(groupId)}`;
}
