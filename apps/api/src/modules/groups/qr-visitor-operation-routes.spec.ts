import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import type { VisitorAccessLogService } from '../calendar/visitor-access-log.js';
import type { ContactService } from './contact-service.js';
import type { GroupService } from './group-service.js';
import { registerGroupRoutes } from './group-routes.js';
import type { MembershipService } from './membership-service.js';
import type { VisitorKeyService } from './visitor-key-service.js';

const groupId = '11111111-1111-4111-8111-111111111111';
const operationId = '33333333-3333-4333-8333-333333333333';
const identity = { cloudbaseUid: 'test-user' } satisfies AuthenticatedIdentity;

describe('QR and visitor-key route boundary', () => {
  let app: FastifyInstance;
  const regenerateKey = vi.fn(async () => ({ visitorKeyChanged: true }));

  beforeEach(async () => {
    regenerateKey.mockClear();
    app = Fastify({ logger: false });
    app.decorate('authenticate', async (request: { authenticatedIdentity?: unknown }) => {
      request.authenticatedIdentity = identity;
    });
    registerGroupRoutes(
      app,
      {} as GroupService,
      {} as MembershipService,
      {} as ContactService,
      { regenerateKey } as unknown as VisitorKeyService,
      {} as VisitorAccessLogService,
    );
    await app.ready();
  });

  afterEach(async () => app.close());

  it('keeps visitor-key rotation and removes every invite route', async () => {
    const current = await app.inject({
      headers: { 'idempotency-key': operationId },
      method: 'PUT',
      payload: { expectedVersion: 3 },
      url: `/groups/${groupId}/visitor-key`,
    });
    expect(current.statusCode).toBe(200);
    expect(regenerateKey).toHaveBeenCalledWith(
      identity,
      groupId,
      expect.objectContaining({ expectedVersion: 3, operationId }),
    );

    for (const route of [
      '/invites/resolve',
      '/invites/accept',
      `/groups/${groupId}/invite-links`,
    ]) {
      expect((await app.inject({ method: 'POST', url: route })).statusCode).toBe(404);
    }
  });
});
