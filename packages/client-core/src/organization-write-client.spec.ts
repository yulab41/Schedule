import { describe, expect, it, vi } from 'vitest';

import type { ClientTransport } from './endpoint.js';
import {
  createOrganizationWriteClient,
  organizationWriteEndpoints,
} from './organization-write-client.js';

const groupId = 'group /一';
const memberId = 'member /一';
const operationId = '11111111-1111-4111-8111-111111111111';

describe('P8 organization shared write boundary', () => {
  it('sets bearer auth, exact encoded paths, bodies, and idempotency keys for every mutation', () => {
    expect(organizationWriteEndpoints.createGroup.path({ request: createGroupRequest() })).toBe(
      '/groups',
    );
    expect(
      organizationWriteEndpoints.updateMemberRole.path({
        groupId,
        memberId,
        request: { expectedVersion: 2, operationId, role: 'administrator' },
      }),
    ).toBe('/groups/group%20%2F%E4%B8%80/members/member%20%2F%E4%B8%80/role');
    expect(
      organizationWriteEndpoints.deleteGroup.body?.({
        groupId,
        request: { expectedVersion: 3, operationId },
      }),
    ).toEqual({ expectedVersion: 3, operationId });
    expect(
      Object.values(organizationWriteEndpoints).every(
        (endpoint) => endpoint.auth === 'bearer' && endpoint.idempotencyKey !== undefined,
      ),
    ).toBe(true);
    expect(
      Object.values(organizationWriteEndpoints).every((endpoint) =>
        ['DELETE', 'POST', 'PUT'].includes(endpoint.method),
      ),
    ).toBe(true);
    for (const endpoint of Object.values(organizationWriteEndpoints)) {
      const input = sampleInput(endpoint.id);
      expect(endpoint.idempotencyKey?.(input as never), endpoint.id).toBe(operationId);
    }
  });

  it('uses the transport receiver once for all 20 methods without retrying', async () => {
    const request = vi.fn(async (endpoint: { readonly id: string }) => responseFor(endpoint.id));
    const transport = { request } as unknown as ClientTransport;
    const client = createOrganizationWriteClient(transport);

    await client.createGroup(createGroupRequest());
    await client.claimGroup({ groupCode: '2608', operationId });
    await client.joinGroupAsGuest(groupId, { operationId });
    await client.leaveGroup(groupId, { operationId });
    await client.addRosterEntries(groupId, { operationId, realNames: ['林医生'] });
    await client.convertRosterEntries(groupId, { operationId, realNames: ['林医生'] });
    await client.addGroupMembers(groupId, { operationId, realNames: ['林医生'] });
    await client.updateGroupCode(groupId, {
      expectedVersion: 3,
      groupCode: '2609',
      operationId,
    });
    await client.updateGroupName(groupId, { expectedVersion: 3, name: '急诊科', operationId });
    await client.updateGroupMemberRole(groupId, memberId, {
      expectedVersion: 2,
      operationId,
      role: 'administrator',
    });
    await client.updateGroupMemberName(groupId, memberId, {
      expectedVersion: 2,
      operationId,
      realName: '林医生',
    });
    await client.updateGroupMemberContact(groupId, memberId, {
      expectedVersion: 1,
      operationId,
      shortPhone: '6601',
    });
    await client.deleteGroupMember(groupId, memberId, { expectedVersion: 2, operationId });
    await client.transferGroupOwnership(groupId, {
      expectedGroupVersion: 3,
      expectedMemberVersion: 2,
      membershipId: memberId,
      operationId,
    });
    await client.createMembershipClaimRequest(groupId, {
      expectedMemberVersion: 2,
      membershipId: memberId,
      operationId,
    });
    await client.approveMembershipClaimRequest(groupId, 'claim-1', {
      expectedVersion: 1,
      operationId,
    });
    await client.rejectMembershipClaimRequest(groupId, 'claim-1', {
      expectedVersion: 1,
      operationId,
    });
    await client.revokeMembershipClaim(groupId, memberId, { expectedVersion: 2, operationId });
    await client.deleteGroup(groupId, { expectedVersion: 3, operationId });
    await client.restoreGroup(groupId, { expectedVersion: 4, operationId });

    expect(request).toHaveBeenCalledTimes(20);
    expect(request.mock.contexts).toEqual(Array.from({ length: 20 }, () => transport));
  });
});

function createGroupRequest() {
  return { groupCode: '2608', name: '急诊科', operationId };
}

function sampleInput(id: string): unknown {
  const request = { expectedVersion: 1, operationId };
  if (id === 'organization-write.create-group') return { request: createGroupRequest() };
  if (id === 'organization-write.claim-group')
    return { request: { groupCode: '2608', operationId } };
  if (id.includes('member-contact'))
    return { groupId, memberId, request: { ...request, shortPhone: '1' } };
  if (id.includes('member-role'))
    return { groupId, memberId, request: { ...request, role: 'member' } };
  if (id.includes('member-name'))
    return { groupId, memberId, request: { ...request, realName: '林' } };
  if (id.includes('member')) return { groupId, memberId, request };
  if (id.includes('claim')) return { claimId: 'claim-1', groupId, request };
  return { groupId, request };
}

function responseFor(id: string): unknown {
  if (
    id.includes('delete') ||
    id.includes('leave') ||
    id.includes('restore') ||
    id.includes('revoke')
  ) {
    return undefined;
  }
  if (id.includes('group'))
    return { groupCode: '2608', id: 'group-1', name: '急诊科', role: 'owner', version: 1 };
  return { completed: true };
}
