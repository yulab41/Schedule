import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import type { VisitorAccessLogService } from '../calendar/visitor-access-log.js';
import type { ContactService } from './contact-service.js';
import type { GroupService } from './group-service.js';
import { registerGroupRoutes } from './group-routes.js';
import { registerInviteRoutes } from './invite-routes.js';
import type { InviteService } from './invite-service.js';
import type { MembershipService } from './membership-service.js';
import type { VisitorKeyService } from './visitor-key-service.js';

const groupId = '11111111-1111-4111-8111-111111111111';
const memberId = '22222222-2222-4222-8222-222222222222';
const inviteToken = 'invite-token';
const firstOperationId = '33333333-3333-4333-8333-333333333333';
const secondOperationId = '44444444-4444-4444-8444-444444444444';
const identity = { cloudbaseUid: 'test-user' } satisfies AuthenticatedIdentity;

describe('P8 invite and visitor-key route operation boundary', () => {
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
    calls = {
      accept: vi.fn(async () => ({ group: group() })),
      createLink: vi.fn(async () => ({
        expiresAt: '2026-09-01T00:00:00.000Z',
        groupName: '急诊科',
        permissionRole: 'member',
        realName: '林医生',
        sharePath: `pages/invite/invite?t=${inviteToken}`,
        token: inviteToken,
        version: 1,
      })),
      regenerateKey: vi.fn(async () => ({ visitorKeyChanged: true })),
      revoke: vi.fn(async () => ({ completed: true })),
    };
    registerInviteRoutes(app, calls as unknown as InviteService);
    registerGroupRoutes(
      app,
      {} as GroupService,
      {} as MembershipService,
      {} as ContactService,
      { regenerateKey: calls.regenerateKey } as unknown as VisitorKeyService,
      {} as VisitorAccessLogService,
    );
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('accepts header-only operation ids and forwards every expected version', async () => {
    const responses = await Promise.all(
      mutationRequests(firstOperationId).map((request) => app.inject(request)),
    );

    expect(responses.map((response) => response.statusCode)).toEqual([201, 200, 204, 200]);
    for (const call of Object.values(calls)) {
      expect(call).toHaveBeenCalledOnce();
      expect(call.mock.calls[0]?.at(-1)).toEqual(
        expect.objectContaining({ operationId: firstOperationId }),
      );
    }
    expect(calls.createLink!.mock.calls[0]?.at(-1)).toEqual(
      expect.objectContaining({ expectedTargetVersion: 2 }),
    );
    expect(calls.accept!.mock.calls[0]?.at(-1)).toEqual(
      expect.objectContaining({ expectedVersion: 1 }),
    );
    expect(calls.regenerateKey!.mock.calls[0]?.at(-1)).toEqual(
      expect.objectContaining({ expectedVersion: 3 }),
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
    method: 'POST' | 'PUT',
    url: string,
    payload: Readonly<Record<string, unknown>>,
  ) => ({ headers, method, payload: { ...payload, ...operation }, url });
  return [
    request('POST', `/groups/${groupId}/invite-links`, {
      expectedTargetVersion: 2,
      targetMembershipId: memberId,
    }),
    request('POST', '/invites/accept', {
      confirmRealName: '林医生',
      expectedVersion: 1,
      token: inviteToken,
    }),
    request('POST', `/groups/${groupId}/invite-links/${inviteToken}/revoke`, {
      expectedVersion: 1,
    }),
    request('PUT', `/groups/${groupId}/visitor-key`, { expectedVersion: 3 }),
  ];
}

function group() {
  return { groupCode: '2608', id: groupId, name: '急诊科', role: 'member', version: 3 };
}
