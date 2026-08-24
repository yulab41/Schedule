import { readFileSync } from 'node:fs';

import { organizationReadApiGoldenResponse as golden } from '@schedule/client-core/testing';
import { describe, expect, it, vi } from 'vitest';

import type { AuthClient } from '../auth/local-auth.js';
import { createApiClient } from './client.js';

describe('P8 Web organization shared read delegation', () => {
  it('delegates every existing P8 read method without adding calls', () => {
    const source = readFileSync(new URL('./client.ts', import.meta.url), 'utf8');
    expect(source).toContain('createOrganizationReadClient');
    expect(source).toContain(
      'const organizationReadClient = createOrganizationReadClient(sharedClientTransport)',
    );
    for (const method of [
      'listGroups',
      'listGroupCatalog',
      'listDissolvedGroups',
      'listGroupMembers',
      'listGroupContacts',
      'listMembershipClaimRequests',
      'lookupClaimMatches',
      'getSchedulingConfig',
      'listPlatformUserAccounts',
    ]) {
      expect(source).toContain(`return organizationReadClient.${method}(`);
    }
  });

  it('preserves exact Web paths, bodies, bearer headers, response shapes, and fetch count', async () => {
    const responseBodies = [
      golden.groups,
      golden.groupCatalog,
      golden.dissolvedGroups,
      golden.members,
      golden.contacts,
      golden.claimRequests,
      golden.claimLookup,
      golden.schedulingConfig,
      golden.platformAccounts,
    ];
    const fetchImplementation = vi.fn<typeof fetch>();
    for (const body of responseBodies) {
      fetchImplementation.mockResolvedValueOnce(
        new Response(JSON.stringify(body), { status: 200 }),
      );
    }
    const client = createApiClient({ auth: createAuthClient(), fetch: fetchImplementation });

    await expect(client.listGroups()).resolves.toEqual(golden.groups);
    await expect(client.listGroupCatalog()).resolves.toEqual(golden.groupCatalog);
    await expect(client.listDissolvedGroups()).resolves.toEqual(golden.dissolvedGroups);
    await expect(client.listGroupMembers('group /一')).resolves.toEqual(golden.members);
    await expect(client.listGroupContacts('group /一')).resolves.toEqual(golden.contacts);
    await expect(client.listMembershipClaimRequests('group /一')).resolves.toEqual(
      golden.claimRequests,
    );
    await expect(client.lookupClaimMatches('group /一', ' 林医生 ')).resolves.toEqual(
      golden.claimLookup,
    );
    await expect(client.getSchedulingConfig('group /一')).resolves.toEqual(golden.schedulingConfig);
    await expect(client.listPlatformUserAccounts()).resolves.toEqual(golden.platformAccounts.users);

    expect(fetchImplementation).toHaveBeenCalledTimes(9);
    expect(fetchImplementation.mock.calls.map(([url]) => url)).toEqual([
      '/api/groups',
      '/api/groups/catalog',
      '/api/groups/dissolved',
      '/api/groups/group%20%2F%E4%B8%80/members',
      '/api/groups/group%20%2F%E4%B8%80/contacts',
      '/api/groups/group%20%2F%E4%B8%80/claim-requests',
      '/api/groups/group%20%2F%E4%B8%80/claim-lookups',
      '/api/groups/group%20%2F%E4%B8%80/scheduling-config',
      '/api/platform-admin/users',
    ]);
    expect(
      fetchImplementation.mock.calls
        .filter((_, index) => index !== 6)
        .every(
          ([, init]) =>
            JSON.stringify(init?.headers) ===
            JSON.stringify({ Authorization: 'Bearer signed-in-token' }),
        ),
    ).toBe(true);
    expect(fetchImplementation.mock.calls[6]?.[1]?.headers).toEqual({
      Authorization: 'Bearer signed-in-token',
      'Content-Type': 'application/json',
    });
    expect(fetchImplementation.mock.calls[6]?.[1]).toMatchObject({
      body: JSON.stringify({ realName: ' 林医生 ' }),
      method: 'POST',
    });
    expect(
      fetchImplementation.mock.calls
        .filter((_, index) => index !== 6)
        .every(([, init]) => init?.method === 'GET'),
    ).toBe(true);
  });
});

function createAuthClient(): AuthClient {
  return {
    clearDevIdentity() {},
    getSession: () => Promise.resolve({ data: { session: { access_token: 'signed-in-token' } } }),
    setDevIdentity() {},
    setSession() {},
    signInWithPassword: () => Promise.resolve({}),
    signOut: () => Promise.resolve({}),
  };
}
