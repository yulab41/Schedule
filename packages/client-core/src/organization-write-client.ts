import type {
  AddGroupMembersRequest,
  AddGroupMembersResponse,
  AddRosterEntriesRequest,
  AddRosterEntriesResponse,
  ClaimGroupRequest,
  ClaimGroupResponse,
  ConvertPendingRosterRequest,
  ConvertPendingRosterResponse,
  CreateGroupRequest,
  CreateMembershipClaimRequest,
  CreateMembershipClaimResponse,
  GroupMember,
  GroupMemberContact,
  GroupMemberVersionMutationRequest,
  GroupSummary,
  GroupVersionMutationRequest,
  MembershipClaimDecisionRequest,
  MembershipClaimRequest,
  OrganizationOperationRequest,
  TransferGroupOwnershipRequest,
  UpdateGroupCodeRequest,
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
  membershipClaimRequestJsonSchema,
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

interface ClaimRequestInput<Request> extends GroupRequestInput<Request> {
  readonly claimId: string;
}

export const groupSummaryMutationDecoder =
  createCompactDecoder<GroupSummary>(groupSummaryJsonSchema);
export const groupMemberMutationDecoder = createCompactDecoder<GroupMember>(groupMemberJsonSchema);
export const groupMemberContactMutationDecoder = createCompactDecoder<GroupMemberContact>(
  groupMemberContactJsonSchema,
);
export const addRosterEntriesResponseDecoder = createCompactDecoder<AddRosterEntriesResponse>(
  addRosterEntriesResponseJsonSchema,
);
export const addGroupMembersResponseDecoder = createCompactDecoder<AddGroupMembersResponse>(
  addGroupMembersResponseJsonSchema,
);
export const convertPendingRosterResponseDecoder =
  createCompactDecoder<ConvertPendingRosterResponse>(convertPendingRosterResponseJsonSchema);
export const membershipClaimRequestMutationDecoder = createCompactDecoder<MembershipClaimRequest>(
  membershipClaimRequestJsonSchema,
);
export const claimGroupResponseDecoder: CompactDecoder<ClaimGroupResponse> = {
  safeDecode(value) {
    if (!isRecord(value)) return { success: false };
    const keys = Object.keys(value).sort();
    if (value['status'] === 'request_created') {
      return keys.length === 1 && keys[0] === 'status'
        ? { data: value as ClaimGroupResponse, success: true }
        : { success: false };
    }
    if (value['status'] !== 'claimed' || keys.join(',') !== 'group,status') {
      return { success: false };
    }
    const group = groupSummaryMutationDecoder.safeDecode(value['group']);
    return group.success
      ? { data: value as ClaimGroupResponse, success: true }
      : { success: false };
  },
};
export const createMembershipClaimResponseDecoder: CompactDecoder<CreateMembershipClaimResponse> = {
  safeDecode(value) {
    if (!isRecord(value)) return { success: false };
    const keys = Object.keys(value).sort().join(',');
    if (value['direct'] === true) {
      return keys === 'direct'
        ? { data: value as CreateMembershipClaimResponse, success: true }
        : { success: false };
    }
    if (value['direct'] !== false || keys !== 'direct,request') return { success: false };
    const request = membershipClaimRequestMutationDecoder.safeDecode(value['request']);
    return request.success
      ? { data: value as CreateMembershipClaimResponse, success: true }
      : { success: false };
  },
};
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
  approveMembershipClaim: claimEndpoint(
    'claim-approve',
    'approve',
    membershipClaimRequestMutationDecoder,
  ),
  claimGroup: defineClientEndpoint<RequestInput<ClaimGroupRequest>, ClaimGroupResponse>({
    auth: 'bearer',
    body,
    decoder: claimGroupResponseDecoder,
    id: 'organization-write.claim-group',
    idempotencyKey: operationId,
    method: 'POST',
    path: () => '/groups/claim',
  }),
  convertRosterEntries: groupEndpoint<ConvertPendingRosterRequest, ConvertPendingRosterResponse>(
    'roster-convert',
    'POST',
    'roster-entries/convert',
    convertPendingRosterResponseDecoder,
  ),
  createGroup: defineClientEndpoint<RequestInput<CreateGroupRequest>, GroupSummary>({
    auth: 'bearer',
    body,
    decoder: groupSummaryMutationDecoder,
    id: 'organization-write.create-group',
    idempotencyKey: operationId,
    method: 'POST',
    path: () => '/groups',
  }),
  createMembershipClaim: groupEndpoint<CreateMembershipClaimRequest, CreateMembershipClaimResponse>(
    'claim-create',
    'POST',
    'claim-requests',
    createMembershipClaimResponseDecoder,
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
  rejectMembershipClaim: claimEndpoint(
    'claim-reject',
    'reject',
    membershipClaimRequestMutationDecoder,
  ),
  restoreGroup: groupEndpoint<GroupVersionMutationRequest, void>(
    'group-restore',
    'POST',
    'restore',
    emptyResponseDecoder,
  ),
  revokeMembershipClaim: memberEndpoint<GroupMemberVersionMutationRequest, void>(
    'claim-revoke',
    'POST',
    'revoke-claim',
    emptyResponseDecoder,
  ),
  transferGroupOwnership: groupEndpoint<TransferGroupOwnershipRequest, GroupSummary>(
    'owner-transfer',
    'POST',
    'owner-transfer',
    groupSummaryMutationDecoder,
  ),
  updateGroupCode: groupEndpoint<UpdateGroupCodeRequest, GroupSummary>(
    'group-code-update',
    'PUT',
    'group-code',
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
  approveMembershipClaimRequest(
    groupId: string,
    claimId: string,
    request: MembershipClaimDecisionRequest,
  ): Promise<MembershipClaimRequest>;
  claimGroup(request: ClaimGroupRequest): Promise<ClaimGroupResponse>;
  convertRosterEntries(
    groupId: string,
    request: ConvertPendingRosterRequest,
  ): Promise<ConvertPendingRosterResponse>;
  createGroup(request: CreateGroupRequest): Promise<GroupSummary>;
  createMembershipClaimRequest(
    groupId: string,
    request: CreateMembershipClaimRequest,
  ): Promise<CreateMembershipClaimResponse>;
  deleteGroup(groupId: string, request: GroupVersionMutationRequest): Promise<void>;
  deleteGroupMember(
    groupId: string,
    memberId: string,
    request: GroupMemberVersionMutationRequest,
  ): Promise<void>;
  joinGroupAsGuest(groupId: string, request: OrganizationOperationRequest): Promise<GroupSummary>;
  leaveGroup(groupId: string, request: OrganizationOperationRequest): Promise<void>;
  rejectMembershipClaimRequest(
    groupId: string,
    claimId: string,
    request: MembershipClaimDecisionRequest,
  ): Promise<MembershipClaimRequest>;
  restoreGroup(groupId: string, request: GroupVersionMutationRequest): Promise<void>;
  revokeMembershipClaim(
    groupId: string,
    memberId: string,
    request: GroupMemberVersionMutationRequest,
  ): Promise<void>;
  transferGroupOwnership(
    groupId: string,
    request: TransferGroupOwnershipRequest,
  ): Promise<GroupSummary>;
  updateGroupCode(groupId: string, request: UpdateGroupCodeRequest): Promise<GroupSummary>;
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
    approveMembershipClaimRequest: (groupId, claimId, request) =>
      claim(organizationWriteEndpoints.approveMembershipClaim, groupId, claimId, request),
    claimGroup: (request) => transport.request(organizationWriteEndpoints.claimGroup, { request }),
    convertRosterEntries: (groupId, request) =>
      group(organizationWriteEndpoints.convertRosterEntries, groupId, request),
    createGroup: (request) =>
      transport.request(organizationWriteEndpoints.createGroup, { request }),
    createMembershipClaimRequest: (groupId, request) =>
      group(organizationWriteEndpoints.createMembershipClaim, groupId, request),
    deleteGroup: (groupId, request) =>
      group(organizationWriteEndpoints.deleteGroup, groupId, request),
    deleteGroupMember: (groupId, memberId, request) =>
      member(organizationWriteEndpoints.deleteMember, groupId, memberId, request),
    joinGroupAsGuest: (groupId, request) =>
      group(organizationWriteEndpoints.joinGroupAsGuest, groupId, request),
    leaveGroup: (groupId, request) =>
      group(organizationWriteEndpoints.leaveGroup, groupId, request),
    rejectMembershipClaimRequest: (groupId, claimId, request) =>
      claim(organizationWriteEndpoints.rejectMembershipClaim, groupId, claimId, request),
    restoreGroup: (groupId, request) =>
      group(organizationWriteEndpoints.restoreGroup, groupId, request),
    revokeMembershipClaim: (groupId, memberId, request) =>
      member(organizationWriteEndpoints.revokeMembershipClaim, groupId, memberId, request),
    transferGroupOwnership: (groupId, request) =>
      group(organizationWriteEndpoints.transferGroupOwnership, groupId, request),
    updateGroupCode: (groupId, request) =>
      group(organizationWriteEndpoints.updateGroupCode, groupId, request),
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
  function claim<Request, Output>(
    endpoint: ClientEndpoint<ClaimRequestInput<Request>, Output>,
    groupId: string,
    claimId: string,
    request: Request,
  ): Promise<Output> {
    return transport.request(endpoint, { claimId, groupId, request });
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

function claimEndpoint(
  id: string,
  action: 'approve' | 'reject',
  decoder: CompactDecoder<MembershipClaimRequest>,
) {
  return defineClientEndpoint<
    ClaimRequestInput<MembershipClaimDecisionRequest>,
    MembershipClaimRequest
  >({
    auth: 'bearer',
    body,
    decoder,
    id: `organization-write.${id}`,
    idempotencyKey: operationId,
    method: 'POST',
    path: ({ claimId, groupId }) =>
      `${groupPath(groupId)}/claim-requests/${encodeURIComponent(claimId)}/${action}`,
  });
}

function groupPath(groupId: string): string {
  return `/groups/${encodeURIComponent(groupId)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
