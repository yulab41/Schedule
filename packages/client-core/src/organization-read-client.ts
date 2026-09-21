import type {
  DissolvedGroup,
  CurrentEnvironmentQrResponse,
  GroupCatalogEntry,
  GroupMember,
  GroupMemberContact,
  MiniProgramQrEnvironment,
  GroupSummary,
  PlatformAdminUserAccount,
  PlatformAdminUserAccountList,
  SchedulingConfig,
} from '@schedule/contracts';

import {
  dissolvedGroupListJsonSchema,
  currentEnvironmentQrResponseJsonSchema,
  groupCatalogListJsonSchema,
  groupMemberContactListJsonSchema,
  groupMemberListJsonSchema,
  groupSummaryListJsonSchema,
  platformAdminUserAccountListJsonSchema,
  schedulingConfigJsonSchema,
} from './generated/calendar-schemas.js';
import { defineClientEndpoint, type ClientTransport } from './endpoint.js';
import { createCompactDecoder } from './json-decoder.js';

type EmptyInput = Readonly<Record<string, never>>;

interface GroupInput {
  readonly groupId: string;
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
export const schedulingConfigReadDecoder = /* @__PURE__ */ createCompactDecoder<SchedulingConfig>(
  schedulingConfigJsonSchema,
);
export const currentEnvironmentQrResponseDecoder =
  /* @__PURE__ */ createCompactDecoder<CurrentEnvironmentQrResponse>(
    currentEnvironmentQrResponseJsonSchema,
  );

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
  visitorQr: /* @__PURE__ */ defineClientEndpoint<
    GroupInput & { readonly environment: MiniProgramQrEnvironment },
    CurrentEnvironmentQrResponse
  >({
    auth: 'bearer',
    decoder: currentEnvironmentQrResponseDecoder,
    id: 'organization.visitor-qr',
    method: 'GET',
    path: ({ environment, groupId }) =>
      `${groupPath(groupId)}/visitor-qr?environment=${environment}`,
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
  getVisitorQr(
    groupId: string,
    environment: MiniProgramQrEnvironment,
  ): Promise<CurrentEnvironmentQrResponse>;
  listDissolvedGroups(): Promise<DissolvedGroup[]>;
  listGroupCatalog(): Promise<GroupCatalogEntry[]>;
  listGroupContacts(groupId: string): Promise<GroupMemberContact[]>;
  listGroupMembers(groupId: string): Promise<GroupMember[]>;
  listGroups(): Promise<GroupSummary[]>;
  listPlatformUserAccounts(): Promise<PlatformAdminUserAccount[]>;
}

export function createOrganizationReadClient(transport: ClientTransport): OrganizationReadClient {
  return {
    getSchedulingConfig(groupId) {
      return transport.request(organizationReadEndpoints.schedulingConfig, { groupId });
    },
    getVisitorQr(groupId, environment) {
      return transport.request(organizationReadEndpoints.visitorQr, { environment, groupId });
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
  };
}

function groupPath(groupId: string): string {
  return `/groups/${encodeURIComponent(groupId)}`;
}
