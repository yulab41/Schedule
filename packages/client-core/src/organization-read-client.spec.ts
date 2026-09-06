import {
  dissolvedGroupListSchema,
  groupCatalogListSchema,
  groupMemberContactListSchema,
  groupMemberListSchema,
  groupQrResponseSchema,
  groupSummaryListSchema,
  platformAdminUserAccountListSchema,
  resolveInviteResponseSchema,
  schedulingConfigSchema,
} from '@schedule/contracts';
import { describe, expect, it, vi } from 'vitest';

import { organizationReadApiGoldenResponse as golden } from './testing/organization-read-api-golden.js';
import {
  createOrganizationReadClient,
  dissolvedGroupListDecoder,
  groupCatalogListDecoder,
  groupMemberContactListDecoder,
  groupMemberListDecoder,
  groupQrResponseDecoder,
  groupSummaryListDecoder,
  organizationReadEndpoints,
  platformAdminUserAccountListDecoder,
  resolveInviteResponseDecoder,
  schedulingConfigReadDecoder,
} from './organization-read-client.js';
import type { ClientTransport } from './endpoint.js';

describe('P8 organization shared read boundary', () => {
  it('preserves optional verified contact employee codes and rejects malformed values', () => {
    for (const codes of [undefined, [], ['SYNTHETIC-001']]) {
      const contact = {
        ...golden.contacts[0],
        ...(codes === undefined ? {} : { employeeCodes: codes }),
      };
      expect(groupMemberContactListSchema.safeParse([contact]).success).toBe(true);
      expect(groupMemberContactListDecoder.safeDecode([contact]).success).toBe(true);
    }
    const malformed = [{ ...golden.contacts[0], employeeCodes: [123] }];
    expect(groupMemberContactListSchema.safeParse(malformed).success).toBe(false);
    expect(groupMemberContactListDecoder.safeDecode(malformed).success).toBe(false);
  });
  it('keeps authentication, methods, encoded paths, and lookup bodies exact', () => {
    const groupId = 'group /一';
    expect(organizationReadEndpoints.groups.path({})).toBe('/groups');
    expect(organizationReadEndpoints.catalog.path({})).toBe('/groups/catalog');
    expect(organizationReadEndpoints.dissolvedGroups.path({})).toBe('/groups/dissolved');
    expect(organizationReadEndpoints.members.path({ groupId })).toBe(
      '/groups/group%20%2F%E4%B8%80/members',
    );
    expect(organizationReadEndpoints.contacts.path({ groupId })).toBe(
      '/groups/group%20%2F%E4%B8%80/contacts?includeEmployeeCodes=1',
    );
    expect(organizationReadEndpoints.schedulingConfig.path({ groupId })).toBe(
      '/groups/group%20%2F%E4%B8%80/scheduling-config',
    );
    expect(organizationReadEndpoints.groupQr.path({ groupId })).toBe(
      '/groups/group%20%2F%E4%B8%80/group-qr',
    );
    expect(organizationReadEndpoints.platformAccounts.path({})).toBe('/platform-admin/users');
    expect(organizationReadEndpoints.resolveInvite.body?.({ token: 'ticket /一' })).toEqual({
      token: 'ticket /一',
    });
    expect(
      Object.values(organizationReadEndpoints).every((endpoint) => endpoint.auth === 'bearer'),
    ).toBe(true);
    expect(organizationReadEndpoints.resolveInvite.method).toBe('POST');
    expect(
      Object.entries(organizationReadEndpoints)
        .filter(([key]) => key !== 'resolveInvite')
        .every(([, endpoint]) => endpoint.method === 'GET'),
    ).toBe(true);
  });

  it('matches Web Zod for valid payloads without cloning them', () => {
    const fixtures = [
      [groupSummaryListSchema, groupSummaryListDecoder, golden.groups],
      [groupCatalogListSchema, groupCatalogListDecoder, golden.groupCatalog],
      [dissolvedGroupListSchema, dissolvedGroupListDecoder, golden.dissolvedGroups],
      [groupMemberListSchema, groupMemberListDecoder, golden.members],
      [groupMemberContactListSchema, groupMemberContactListDecoder, golden.contacts],
      [schedulingConfigSchema, schedulingConfigReadDecoder, golden.schedulingConfig],
      [groupQrResponseSchema, groupQrResponseDecoder, golden.groupQr],
      [
        platformAdminUserAccountListSchema,
        platformAdminUserAccountListDecoder,
        golden.platformAccounts,
      ],
      [resolveInviteResponseSchema, resolveInviteResponseDecoder, golden.invite],
    ] as const;

    for (const [schema, decoder, value] of fixtures) {
      const zodResult = schema.safeParse(value);
      const compactResult = decoder.safeDecode(value);
      expect(zodResult.success).toBe(true);
      expect(compactResult.success).toBe(true);
      if (zodResult.success && compactResult.success) {
        expect(compactResult.data).toEqual(zodResult.data);
        expect(compactResult.data).toBe(value);
      }
    }
  });

  it('rejects strict malformed payloads alongside Web Zod', () => {
    const invalidFixtures = [
      [groupSummaryListSchema, groupSummaryListDecoder, [{ ...golden.groups[0], extra: true }]],
      [groupMemberListSchema, groupMemberListDecoder, [{ ...golden.members[0], role: 'doctor' }]],
      [
        groupMemberContactListSchema,
        groupMemberContactListDecoder,
        [{ ...golden.contacts[0], version: -1 }],
      ],
      [
        platformAdminUserAccountListSchema,
        platformAdminUserAccountListDecoder,
        { ...golden.platformAccounts, extra: true },
      ],
      [
        resolveInviteResponseSchema,
        resolveInviteResponseDecoder,
        { ...golden.invite, token: 'secret' },
      ],
    ] as const;

    for (const [schema, decoder, value] of invalidFixtures) {
      expect(schema.safeParse(value).success).toBe(false);
      expect(decoder.safeDecode(value).success).toBe(false);
    }
  });

  it('preserves the legacy Web read compatibility for a missing rules version', () => {
    const legacyConfig = { ...golden.schedulingConfig } as { rulesVersion?: number };
    delete legacyConfig.rulesVersion;
    expect(schedulingConfigSchema.safeParse(legacyConfig).success).toBe(true);
    const decoded = schedulingConfigReadDecoder.safeDecode(legacyConfig);
    expect(decoded.success).toBe(true);
    if (decoded.success) expect(decoded.data).toBe(legacyConfig);
  });

  it('uses the transport receiver exactly once per service call and unwraps only the platform envelope', async () => {
    const responses = new Map<string, unknown>([
      ['organization.groups', golden.groups],
      ['organization.catalog', golden.groupCatalog],
      ['organization.dissolved-groups', golden.dissolvedGroups],
      ['organization.members', golden.members],
      ['organization.contacts', golden.contacts],
      ['organization.scheduling-config', golden.schedulingConfig],
      ['organization.group-qr', golden.groupQr],
      ['organization.platform-accounts', golden.platformAccounts],
      ['organization.resolve-invite', golden.invite],
    ]);
    const request = vi.fn(async (endpoint: { readonly id: string }) => responses.get(endpoint.id));
    const transport = { request } as unknown as ClientTransport;
    const client = createOrganizationReadClient(transport);

    await expect(client.listGroups()).resolves.toBe(golden.groups);
    await expect(client.listGroupCatalog()).resolves.toBe(golden.groupCatalog);
    await expect(client.listDissolvedGroups()).resolves.toBe(golden.dissolvedGroups);
    await expect(client.listGroupMembers('group-1')).resolves.toBe(golden.members);
    await expect(client.listGroupContacts('group-1')).resolves.toBe(golden.contacts);
    await expect(client.getSchedulingConfig('group-1')).resolves.toBe(golden.schedulingConfig);
    await expect(client.getGroupQr('group-1')).resolves.toBe(golden.groupQr);
    await expect(client.listPlatformUserAccounts()).resolves.toBe(golden.platformAccounts.users);
    await expect(client.resolveInvite('invite-token')).resolves.toBe(golden.invite);
    expect(request).toHaveBeenCalledTimes(9);
    expect(request.mock.contexts).toEqual(Array.from({ length: 9 }, () => transport));
  });
});
