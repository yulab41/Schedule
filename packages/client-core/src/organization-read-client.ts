import type {
  DissolvedGroup,
  GroupCatalogEntry,
  GroupMember,
  GroupMemberContact,
  GroupQrResponse,
  GroupSummary,
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
  groupQrResponseJsonSchema,
  groupSummaryListJsonSchema,
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

interface InviteInput {
  readonly token: string;
}

export const groupSummaryListDecoder = /* @__PURE__ */ createCompactDecoder<GroupSummary[]>(
  groupSummaryListJsonSchema,
);
export const groupCatalogListDecoder = /* @__PURE__ */ createCompactDecoder<GroupCatalogEntry[]>(
  groupCatalogListJsonSchema,
);
export const dissolvedGroupListDecoder = /* @__PURE__ */ createCompactDecoder<DissolvedGroup[]>(
  dissolvedGroupListJsonSchema,
);
export const groupMemberListDecoder =
  /* @__PURE__ */ createCompactDecoder<GroupMember[]>(groupMemberListJsonSchema);
export const groupMemberContactListDecoder = /* @__PURE__ */ createCompactDecoder<
  GroupMemberContact[]
>(groupMemberContactListJsonSchema);
export const platformAdminUserAccountListDecoder =
  /* @__PURE__ */ createCompactDecoder<PlatformAdminUserAccountList>(
    platformAdminUserAccountListJsonSchema,
  );
export const resolveInviteResponseDecoder =
  /* @__PURE__ */ createCompactDecoder<ResolveInviteResponse>(resolveInviteResponseJsonSchema);
export const schedulingConfigReadDecoder = /* @__PURE__ */ createCompactDecoder<SchedulingConfig>(
  schedulingConfigJsonSchema,
);
export const groupQrResponseDecoder =
  /* @__PURE__ */ createCompactDecoder<GroupQrResponse>(groupQrResponseJsonSchema);

export const organizationReadEndpoints = {
  catalog: /* @__PURE__ */ defineClientEndpoint<EmptyInput, GroupCatalogEntry[]>({
    auth: 'bearer',
    decoder: groupCatalogListDecoder,
    id: 'organization.catalog',
    method: 'GET',
    path: () => '/groups/catalog',
  }),
  contacts: /* @__PURE__ */ defineClientEndpoint<GroupInput, GroupMemberContact[]>({
    auth: 'bearer',
    decoder: groupMemberContactListDecoder,
    id: 'organization.contacts',
    method: 'GET',
    path: ({ groupId }) => `${groupPath(groupId)}/contacts?includeEmployeeCodes=1`,
  }),
  dissolvedGroups: /* @__PURE__ */ defineClientEndpoint<EmptyInput, DissolvedGroup[]>({
    auth: 'bearer',
    decoder: dissolvedGroupListDecoder,
    id: 'organization.dissolved-groups',
    method: 'GET',
    path: () => '/groups/dissolved',
  }),
  groups: /* @__PURE__ */ defineClientEndpoint<EmptyInput, GroupSummary[]>({
    auth: 'bearer',
    decoder: groupSummaryListDecoder,
    id: 'organization.groups',
    method: 'GET',
    path: () => '/groups',
  }),
  groupQr: /* @__PURE__ */ defineClientEndpoint<GroupInput, GroupQrResponse>({
    auth: 'bearer',
    decoder: groupQrResponseDecoder,
    id: 'organization.group-qr',
    method: 'GET',
    path: ({ groupId }) => `${groupPath(groupId)}/group-qr`,
  }),
  members: /* @__PURE__ */ defineClientEndpoint<GroupInput, GroupMember[]>({
    auth: 'bearer',
    decoder: groupMemberListDecoder,
    id: 'organization.members',
    method: 'GET',
    path: ({ groupId }) => `${groupPath(groupId)}/members`,
  }),
  platformAccounts: /* @__PURE__ */ defineClientEndpoint<EmptyInput, PlatformAdminUserAccountList>({
    auth: 'bearer',
    decoder: platformAdminUserAccountListDecoder,
    id: 'organization.platform-accounts',
    method: 'GET',
    path: () => '/platform-admin/users',
  }),
  resolveInvite: /* @__PURE__ */ defineClientEndpoint<InviteInput, ResolveInviteResponse>({
    auth: 'bearer',
    body: ({ token }) => ({ token }),
    decoder: resolveInviteResponseDecoder,
    id: 'organization.resolve-invite',
    method: 'POST',
    path: () => '/invites/resolve',
  }),
  schedulingConfig: /* @__PURE__ */ defineClientEndpoint<GroupInput, SchedulingConfig>({
    auth: 'bearer',
    decoder: schedulingConfigReadDecoder,
    id: 'organization.scheduling-config',
    method: 'GET',
    path: ({ groupId }) => `${groupPath(groupId)}/scheduling-config`,
  }),
} as const;

export interface OrganizationReadClient {
  getSchedulingConfig(groupId: string): Promise<SchedulingConfig>;
  getGroupQr(groupId: string): Promise<GroupQrResponse>;
  listDissolvedGroups(): Promise<DissolvedGroup[]>;
  listGroupCatalog(): Promise<GroupCatalogEntry[]>;
  listGroupContacts(groupId: string): Promise<GroupMemberContact[]>;
  listGroupMembers(groupId: string): Promise<GroupMember[]>;
  listGroups(): Promise<GroupSummary[]>;
  listPlatformUserAccounts(): Promise<PlatformAdminUserAccount[]>;
  resolveInvite(token: string): Promise<ResolveInviteResponse>;
}

export function createOrganizationReadClient(transport: ClientTransport): OrganizationReadClient {
  return {
    getSchedulingConfig(groupId) {
      return transport.request(organizationReadEndpoints.schedulingConfig, { groupId });
    },
    getGroupQr(groupId) {
      return transport.request(organizationReadEndpoints.groupQr, { groupId });
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
    listPlatformUserAccounts() {
      return transport
        .request(organizationReadEndpoints.platformAccounts, {})
        .then((result) => result.users);
    },
    resolveInvite(token) {
      return transport.request(organizationReadEndpoints.resolveInvite, { token });
    },
  };
}

function groupPath(groupId: string): string {
  return `/groups/${encodeURIComponent(groupId)}`;
}
