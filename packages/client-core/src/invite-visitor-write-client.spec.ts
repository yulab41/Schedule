import { describe, expect, it, vi } from 'vitest';

import type { ClientTransport } from './endpoint.js';
import {
  createInviteVisitorWriteClient,
  inviteVisitorWriteEndpoints,
} from './invite-visitor-write-client.js';

const groupId = 'group /一';
const inviteToken = 'token /一';
const operationId = '11111111-1111-4111-8111-111111111111';

describe('P8 invite and visitor-key shared write boundary', () => {
  it('sets bearer auth, exact paths, bodies, and idempotency keys for all four writes', () => {
    expect(
      inviteVisitorWriteEndpoints.revokeInvite.path({
        groupId,
        inviteToken,
        request: { expectedVersion: 1, operationId },
      }),
    ).toBe('/groups/group%20%2F%E4%B8%80/invite-links/token%20%2F%E4%B8%80/revoke');
    for (const endpoint of Object.values(inviteVisitorWriteEndpoints)) {
      const input = sampleInput(endpoint.id);
      expect(endpoint.auth, endpoint.id).toBe('bearer');
      expect(endpoint.idempotencyKey?.(input as never), endpoint.id).toBe(operationId);
      expect(endpoint.body?.(input as never), endpoint.id).toEqual(
        expect.objectContaining({ operationId }),
      );
    }
  });

  it('uses the transport receiver exactly once for every method', async () => {
    const request = vi.fn(async (endpoint: { readonly id: string }) => responseFor(endpoint.id));
    const transport = { request } as unknown as ClientTransport;
    const client = createInviteVisitorWriteClient(transport);

    await client.createInviteLink(groupId, {
      expectedTargetVersion: 2,
      operationId,
      targetMembershipId: 'member-1',
    });
    await client.acceptInvite({
      confirmRealName: '林医生',
      expectedVersion: 1,
      operationId,
      token: inviteToken,
    });
    await client.revokeInvite(groupId, inviteToken, { expectedVersion: 1, operationId });
    await client.regenerateVisitorKey(groupId, { expectedVersion: 3, operationId });

    expect(request).toHaveBeenCalledTimes(4);
    expect(request.mock.contexts).toEqual(Array.from({ length: 4 }, () => transport));
  });
});

function sampleInput(id: string): unknown {
  if (id.endsWith('invite-create')) {
    return {
      groupId,
      request: { expectedTargetVersion: 2, operationId, targetMembershipId: 'member-1' },
    };
  }
  if (id.endsWith('invite-accept')) {
    return {
      request: { confirmRealName: '林医生', expectedVersion: 1, operationId, token: inviteToken },
    };
  }
  if (id.endsWith('invite-revoke')) {
    return { groupId, inviteToken, request: { expectedVersion: 1, operationId } };
  }
  return { groupId, request: { expectedVersion: 3, operationId } };
}

function responseFor(id: string): unknown {
  if (id.endsWith('invite-revoke')) return undefined;
  if (id.endsWith('visitor-key-regenerate')) return { visitorKeyChanged: true };
  if (id.endsWith('invite-accept')) {
    return {
      group: { groupCode: '2608', id: 'group-1', name: '急诊科', role: 'member', version: 3 },
    };
  }
  return {
    expiresAt: '2026-09-01T00:00:00.000Z',
    groupName: '急诊科',
    permissionRole: 'member',
    realName: '林医生',
    sharePath: 'pages/invite/invite?t=token',
    token: 'token',
    version: 1,
  };
}
