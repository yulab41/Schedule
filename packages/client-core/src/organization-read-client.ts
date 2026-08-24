import type {
  DissolvedGroup,
  GroupCatalogEntry,
  GroupMember,
  GroupMemberContact,
  GroupSummary,
  MembershipClaimLookupResponse,
  MembershipClaimRequest,
  PlatformAdminUserAccount,
  PlatformAdminUserAccountList,
  ResolveInviteResponse,
  SchedulingConfig,
} from '@schedule/contracts';

import {
  dissolvedGroupListJsonSchema,
  groupCatalogListJsonSchema,
  groupMemberContactListJsonSchema,
  groupMemberListJsonSchema,
  groupSummaryListJsonSchema,
  membershipClaimLookupResponseJsonSchema,
  membershipClaimRequestListJsonSchema,
  platformAdminUserAccountListJsonSchema,
  resolveInviteResponseJsonSchema,
  schedulingConfigJsonSchema,
} from './generated/calendar-schemas.js';
import { defineClientEndpoint, type ClientTransport } from './endpoint.js';
import { createCompactDecoder } from './json-decoder.js';

type EmptyInput = Readonly<Record<string, never>>;

interface GroupInput {
  readonly groupId: string;
}

interface ClaimLookupInput extends GroupInput {
  readonly realName: string;
}

interface InviteInput {
  readonly token: string;
}

export const groupSummaryListDecoder = createCompactDecoder<GroupSummary[]>(
  groupSummaryListJsonSchema,
);
export const groupCatalogListDecoder = createCompactDecoder<GroupCatalogEntry[]>(
  groupCatalogListJsonSchema,
);
export const dissolvedGroupListDecoder = createCompactDecoder<DissolvedGroup[]>(
  dissolvedGroupListJsonSchema,
);
export const groupMemberListDecoder =
  createCompactDecoder<GroupMember[]>(groupMemberListJsonSchema);
export const groupMemberContactListDecoder = createCompactDecoder<GroupMemberContact[]>(
  groupMemberContactListJsonSchema,
);
export const membershipClaimRequestListDecoder = createCompactDecoder<MembershipClaimRequest[]>(
  membershipClaimRequestListJsonSchema,
);
export const membershipClaimLookupResponseDecoder =
  createCompactDecoder<MembershipClaimLookupResponse>(membershipClaimLookupResponseJsonSchema);
export const platformAdminUserAccountListDecoder =
  createCompactDecoder<PlatformAdminUserAccountList>(platformAdminUserAccountListJsonSchema);
export const resolveInviteResponseDecoder = createCompactDecoder<ResolveInviteResponse>(
  resolveInviteResponseJsonSchema,
);
export const schedulingConfigReadDecoder = createCompactDecoder<SchedulingConfig>(
  schedulingConfigJsonSchema,
);

export const organizationReadEndpoints = {
  catalog: defineClientEndpoint<EmptyInput, GroupCatalogEntry[]>({
    auth: 'bearer',
    decoder: groupCatalogListDecoder,
    id: 'organization.catalog',
    method: 'GET',
    path: () => '/groups/catalog',
  }),
  claimLookup: defineClientEndpoint<ClaimLookupInput, MembershipClaimLookupResponse>({
    auth: 'bearer',
    body: ({ realName }) => ({ realName }),
    decoder: membershipClaimLookupResponseDecoder,
    id: 'organization.claim-lookup',
    method: 'POST',
    path: ({ groupId }) => `${groupPath(groupId)}/claim-lookups`,
  }),
  claimRequests: defineClientEndpoint<GroupInput, MembershipClaimRequest[]>({
    auth: 'bearer',
    decoder: membershipClaimRequestListDecoder,
    id: 'organization.claim-requests',
    method: 'GET',
    path: ({ groupId }) => `${groupPath(groupId)}/claim-requests`,
  }),
  contacts: defineClientEndpoint<GroupInput, GroupMemberContact[]>({
    auth: 'bearer',
    decoder: groupMemberContactListDecoder,
    id: 'organization.contacts',
    method: 'GET',
    path: ({ groupId }) => `${groupPath(groupId)}/contacts`,
  }),
  dissolvedGroups: defineClientEndpoint<EmptyInput, DissolvedGroup[]>({
    auth: 'bearer',
    decoder: dissolvedGroupListDecoder,
    id: 'organization.dissolved-groups',
    method: 'GET',
    path: () => '/groups/dissolved',
  }),
  groups: defineClientEndpoint<EmptyInput, GroupSummary[]>({
    auth: 'bearer',
    decoder: groupSummaryListDecoder,
    id: 'organization.groups',
    method: 'GET',
    path: () => '/groups',
  }),
  members: defineClientEndpoint<GroupInput, GroupMember[]>({
    auth: 'bearer',
    decoder: groupMemberListDecoder,
    id: 'organization.members',
    method: 'GET',
    path: ({ groupId }) => `${groupPath(groupId)}/members`,
  }),
  platformAccounts: defineClientEndpoint<EmptyInput, PlatformAdminUserAccountList>({
    auth: 'bearer',
    decoder: platformAdminUserAccountListDecoder,
    id: 'organization.platform-accounts',
    method: 'GET',
    path: () => '/platform-admin/users',
  }),
  resolveInvite: defineClientEndpoint<InviteInput, ResolveInviteResponse>({
    auth: 'bearer',
    body: ({ token }) => ({ token }),
    decoder: resolveInviteResponseDecoder,
    id: 'organization.resolve-invite',
    method: 'POST',
    path: () => '/invites/resolve',
  }),
  schedulingConfig: defineClientEndpoint<GroupInput, SchedulingConfig>({
    auth: 'bearer',
    decoder: schedulingConfigReadDecoder,
    id: 'organization.scheduling-config',
    method: 'GET',
    path: ({ groupId }) => `${groupPath(groupId)}/scheduling-config`,
  }),
} as const;

export interface OrganizationReadClient {
  getSchedulingConfig(groupId: string): Promise<SchedulingConfig>;
  listDissolvedGroups(): Promise<DissolvedGroup[]>;
  listGroupCatalog(): Promise<GroupCatalogEntry[]>;
  listGroupContacts(groupId: string): Promise<GroupMemberContact[]>;
  listGroupMembers(groupId: string): Promise<GroupMember[]>;
  listGroups(): Promise<GroupSummary[]>;
  listMembershipClaimRequests(groupId: string): Promise<MembershipClaimRequest[]>;
  listPlatformUserAccounts(): Promise<PlatformAdminUserAccount[]>;
  lookupClaimMatches(groupId: string, realName: string): Promise<MembershipClaimLookupResponse>;
  resolveInvite(token: string): Promise<ResolveInviteResponse>;
}

export function createOrganizationReadClient(transport: ClientTransport): OrganizationReadClient {
  return {
    getSchedulingConfig(groupId) {
      return transport.request(organizationReadEndpoints.schedulingConfig, { groupId });
    },
    listDissolvedGroups() {
      return transport.request(organizationReadEndpoints.dissolvedGroups, {});
    },
    listGroupCatalog() {
      return transport.request(organizationReadEndpoints.catalog, {});
    },
    listGroupContacts(groupId) {
      return transport.request(organizationReadEndpoints.contacts, { groupId });
    },
    listGroupMembers(groupId) {
      return transport.request(organizationReadEndpoints.members, { groupId });
    },
    listGroups() {
      return transport.request(organizationReadEndpoints.groups, {});
    },
    listMembershipClaimRequests(groupId) {
      return transport.request(organizationReadEndpoints.claimRequests, { groupId });
    },
    listPlatformUserAccounts() {
      return transport
        .request(organizationReadEndpoints.platformAccounts, {})
        .then((result) => result.users);
    },
    lookupClaimMatches(groupId, realName) {
      return transport.request(organizationReadEndpoints.claimLookup, { groupId, realName });
    },
    resolveInvite(token) {
      return transport.request(organizationReadEndpoints.resolveInvite, { token });
    },
  };
}

function groupPath(groupId: string): string {
  return `/groups/${encodeURIComponent(groupId)}`;
}
