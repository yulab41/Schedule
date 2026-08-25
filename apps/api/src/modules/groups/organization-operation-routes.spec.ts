import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import type { VisitorAccessLogService } from '../calendar/visitor-access-log.js';
import type { VisitorKeyService } from './visitor-key-service.js';
import { registerGroupRoutes } from './group-routes.js';
import type { ContactService } from './contact-service.js';
import type { GroupService } from './group-service.js';
import type { MembershipService } from './membership-service.js';

const groupId = '11111111-1111-4111-8111-111111111111';
const memberId = '22222222-2222-4222-8222-222222222222';
const claimId = '33333333-3333-4333-8333-333333333333';
const firstOperationId = '44444444-4444-4444-8444-444444444444';
const secondOperationId = '55555555-5555-4555-8555-555555555555';
const identity = { cloudbaseUid: 'test-user' } satisfies AuthenticatedIdentity;

describe('P8 organization route operation and version boundary', () => {
  let app: FastifyInstance;
  let calls: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    app.decorate('authenticate', async (request: { authenticatedIdentity?: unknown }) => {
      request.authenticatedIdentity = identity;
    });
    app.setErrorHandler((error, _request, reply) => {
      const statusCode =
        typeof error === 'object' && error !== null && 'statusCode' in error
          ? Number(error.statusCode)
          : 500;
      void reply.code(Number.isInteger(statusCode) ? statusCode : 500).send({
        error: error instanceof Error ? error.message : 'unknown error',
      });
    });
    const serviceCall = (result: unknown = { completed: true }) => vi.fn(async () => result);
    calls = {
      addGroupMembers: serviceCall({ added: 1 }),
      addRosterEntries: serviceCall({ added: 1 }),
      approveClaim: serviceCall(claim()),
      claimGroup: serviceCall({ group: group(), status: 'claimed' }),
      convertRosterEntries: serviceCall({ converted: 1, skipped: 0 }),
      createClaim: serviceCall({ direct: true }),
      createGroup: serviceCall(group()),
      deleteGroup: serviceCall(),
      deleteMember: serviceCall(),
      joinGuest: serviceCall(group('guest')),
      leaveGroup: serviceCall(),
      rejectClaim: serviceCall(claim('rejected')),
      restoreGroup: serviceCall(),
      revokeClaim: serviceCall(),
      transferOwnership: serviceCall(group('administrator')),
      updateCode: serviceCall(group()),
      updateContact: serviceCall(contact()),
      updateMemberName: serviceCall(member()),
      updateMemberRole: serviceCall(member()),
      updateName: serviceCall(group()),
    };
    registerGroupRoutes(
      app,
      {
        addGroupMembers: calls.addGroupMembers,
        addRosterEntries: calls.addRosterEntries,
        claim: calls.claimGroup,
        convertRosterEntries: calls.convertRosterEntries,
        create: calls.createGroup,
        restoreGroup: calls.restoreGroup,
        updateCode: calls.updateCode,
        updateName: calls.updateName,
      } as unknown as GroupService,
      {
        approveClaimRequest: calls.approveClaim,
        createClaimRequest: calls.createClaim,
        deleteGroup: calls.deleteGroup,
        deleteMember: calls.deleteMember,
        joinAsGuest: calls.joinGuest,
        leaveGroup: calls.leaveGroup,
        rejectClaimRequest: calls.rejectClaim,
        revokeClaim: calls.revokeClaim,
        transferOwnership: calls.transferOwnership,
        updateMemberName: calls.updateMemberName,
        updateMemberRole: calls.updateMemberRole,
      } as unknown as MembershipService,
      { updateContact: calls.updateContact } as unknown as ContactService,
      {} as VisitorKeyService,
      {} as VisitorAccessLogService,
    );
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('accepts header-only operation ids and forwards every expected version', async () => {
    const requests = mutationRequests(firstOperationId);
    const responses = await Promise.all(requests.map((request) => app.inject(request)));

    expect(responses.map((response) => response.statusCode)).toEqual([
      201, 201, 201, 204, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 201, 200, 200, 200, 204,
      204,
    ]);
    for (const call of Object.values(calls)) {
      expect(call).toHaveBeenCalledOnce();
      expect(call.mock.calls[0]?.at(-1)).toEqual(
        expect.objectContaining({ operationId: firstOperationId }),
      );
    }
    expect(calls.updateName!.mock.calls[0]?.at(-1)).toEqual(
      expect.objectContaining({ expectedVersion: 3 }),
    );
    expect(calls.updateMemberRole!.mock.calls[0]?.at(-1)).toEqual(
      expect.objectContaining({ expectedVersion: 4 }),
    );
    expect(calls.transferOwnership!.mock.calls[0]?.at(-1)).toEqual(
      expect.objectContaining({ expectedGroupVersion: 3, expectedMemberVersion: 4 }),
    );
    expect(calls.approveClaim!.mock.calls[0]?.at(-1)).toEqual(
      expect.objectContaining({ expectedVersion: 5 }),
    );
  });

  it('rejects missing and mismatched operation ids before any service call', async () => {
    const missing = await Promise.all(
      mutationRequests(undefined).map((request) => app.inject(request)),
    );
    const mismatched = await Promise.all(
      mutationRequests(firstOperationId, secondOperationId).map((request) => app.inject(request)),
    );

    expect(missing.every((response) => response.statusCode === 400)).toBe(true);
    expect(mismatched.every((response) => response.statusCode === 400)).toBe(true);
    for (const call of Object.values(calls)) expect(call).not.toHaveBeenCalled();
  });
});

function mutationRequests(headerOperationId: string | undefined, bodyOperationId?: string) {
  const headers = headerOperationId === undefined ? {} : { 'idempotency-key': headerOperationId };
  const operation = bodyOperationId === undefined ? {} : { operationId: bodyOperationId };
  const request = (
    method: 'DELETE' | 'POST' | 'PUT',
    url: string,
    payload: Readonly<Record<string, unknown>> = {},
  ) => ({ headers, method, payload: { ...payload, ...operation }, url });
  return [
    request('POST', '/groups', { groupCode: '2608', name: '急诊科' }),
    request('POST', '/groups/claim', { groupCode: '2608' }),
    request('POST', `/groups/${groupId}/join-guest`),
    request('POST', `/groups/${groupId}/leave`),
    request('POST', `/groups/${groupId}/roster-entries`, { realNames: ['林医生'] }),
    request('POST', `/groups/${groupId}/roster-entries/convert`, { realNames: ['林医生'] }),
    request('POST', `/groups/${groupId}/members`, { realNames: ['林医生'] }),
    request('PUT', `/groups/${groupId}/group-code`, { expectedVersion: 3, groupCode: '2609' }),
    request('PUT', `/groups/${groupId}/name`, { expectedVersion: 3, name: '急诊二组' }),
    request('PUT', `/groups/${groupId}/members/${memberId}/role`, {
      expectedVersion: 4,
      role: 'administrator',
    }),
    request('PUT', `/groups/${groupId}/members/${memberId}/name`, {
      expectedVersion: 4,
      realName: '林主任',
    }),
    request('PUT', `/groups/${groupId}/members/${memberId}/contact`, {
      expectedVersion: 2,
      shortPhone: '6601',
    }),
    request('DELETE', `/groups/${groupId}/members/${memberId}`, { expectedVersion: 4 }),
    request('POST', `/groups/${groupId}/owner-transfer`, {
      expectedGroupVersion: 3,
      expectedMemberVersion: 4,
      membershipId: memberId,
    }),
    request('POST', `/groups/${groupId}/claim-requests`, {
      expectedMemberVersion: 4,
      membershipId: memberId,
    }),
    request('POST', `/groups/${groupId}/claim-requests/${claimId}/approve`, {
      expectedVersion: 5,
    }),
    request('POST', `/groups/${groupId}/claim-requests/${claimId}/reject`, {
      expectedVersion: 5,
    }),
    request('POST', `/groups/${groupId}/members/${memberId}/revoke-claim`, {
      expectedVersion: 4,
    }),
    request('DELETE', `/groups/${groupId}`, { expectedVersion: 3 }),
    request('POST', `/groups/${groupId}/restore`, { expectedVersion: 4 }),
  ];
}

function group(role: 'administrator' | 'guest' | 'owner' = 'owner') {
  return { groupCode: '2608', id: groupId, name: '急诊科', role, version: 3 };
}

function member() {
  return { id: memberId, isCurrentUser: false, realName: '林医生', role: 'member', version: 4 };
}

function contact() {
  return { isConfirmed: false, membershipId: memberId, shortPhone: '6601', version: 2 };
}

function claim(status: 'pending' | 'rejected' = 'pending') {
  return {
    createdAt: '2026-08-25T00:00:00.000Z',
    groupId,
    id: claimId,
    requestingUserId: 'user-1',
    requestingUserRealName: '林医生',
    status,
    targetMemberRealName: '林医生',
    targetMembershipId: memberId,
    version: 5,
  };
}
