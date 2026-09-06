import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';

import { registerGroupRoutes } from './group-routes.js';

describe('retired membership claim routes', () => {
  it('opts into employee code fields only for the exact query value without changing authentication', async () => {
    const app = Fastify({ logger: false });
    const identity = { cloudbaseUid: 'synthetic-contact-reader' };
    const authenticate = vi.fn(async (request: { authenticatedIdentity?: unknown }) => {
      request.authenticatedIdentity = identity;
    });
    app.decorate('authenticate', authenticate);
    const listContacts = vi.fn(async () => []);
    const unused = {} as never;
    registerGroupRoutes(app, unused, unused, { listContacts } as never, unused, unused);
    await app.ready();
    try {
      const groupId = '11111111-1111-4111-8111-111111111111';
      for (const [query, expected] of [
        ['', false],
        ['?includeEmployeeCodes=1', true],
        ['?includeEmployeeCodes=true', false],
        ['?includeEmployeeCodes=0', false],
        ['?includeEmployeeCodes=1&includeEmployeeCodes=1', false],
      ] as const) {
        const response = await app.inject({
          method: 'GET',
          url: `/groups/${groupId}/contacts${query}`,
        });
        expect(response.statusCode).toBe(200);
        expect(listContacts).toHaveBeenLastCalledWith(identity, groupId, {
          includeEmployeeCodes: expected,
        });
      }
      expect(authenticate).toHaveBeenCalledTimes(5);
    } finally {
      await app.close();
    }
  });
  it('does not expose lookup, submission, history decisions or revocation to authenticated clients', async () => {
    const app = Fastify({ logger: false });
    app.decorate('authenticate', async () => undefined);
    const unused = {} as never;
    registerGroupRoutes(app, unused, unused, unused, unused, unused);
    await app.ready();
    try {
      for (const [method, suffix] of [
        ['POST', 'claim-lookups'],
        ['GET', 'claim-requests'],
        ['POST', 'claim-requests'],
        ['POST', 'claim-requests/request/approve'],
        ['POST', 'claim-requests/request/reject'],
        ['POST', 'members/member/revoke-claim'],
      ] as const) {
        const response = await app.inject({ method, url: `/groups/synthetic/${suffix}` });
        expect(response.statusCode, `${method} ${suffix}`).toBe(404);
      }
    } finally {
      await app.close();
    }
  });
});
