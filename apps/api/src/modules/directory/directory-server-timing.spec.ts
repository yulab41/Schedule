import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { registerDirectoryRoutes } from './directory-routes.js';
import type { DirectoryQuery } from './directory-query.js';

const groupId = '11111111-1111-4111-8111-111111111111';
const identity = {
  clientPlatform: 'miniprogram',
  clientVersion: '0.1.0-test',
  cloudbaseUid: 'directory-diagnostic-user',
} satisfies AuthenticatedIdentity;

describe('directory controlled Server-Timing', () => {
  let app: FastifyInstance;
  let list: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    app = Fastify({ logger: false });
    app.decorate('authenticate', async (request: { authenticatedIdentity?: unknown }) => {
      request.authenticatedIdentity = identity;
    });
    list = vi.fn(async (_identity, _groupId, _query, _kind, timing) => {
      Object.assign(timing ?? {}, {
        aliasMs: 1,
        batchMs: 2,
        contactsMs: 3,
        countMs: 12,
        databaseWaitMs: 7,
        permissionMs: 8,
        queryMs: 46,
        rowsMs: 30,
        transformMs: 1,
      });
      return { entries: [], totalCount: 0 };
    });
    registerDirectoryRoutes(app, {
      facets: vi.fn(async () => ({ totalCount: 0 })),
      list,
      lookup: vi.fn(async () => ({ entries: [] })),
    } as unknown as DirectoryQuery);
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns fixed non-sensitive segments only for opted-in Mini Program list reads', async () => {
    const response = await app.inject({
      headers: {
        'x-schedule-client-platform': 'miniprogram',
        'x-schedule-directory-diagnostics': 'v1',
      },
      method: 'GET',
      url: `/groups/${groupId}/employee-directory?q=private-value`,
    });

    expect(response.statusCode).toBe(200);
    const timing = response.headers['server-timing'];
    expect(timing).toContain('queue;desc="unsupported"');
    expect(timing).toContain('cache;desc="none"');
    expect(timing).toMatch(/cold;desc="(?:cold|warm)"/u);
    expect(timing).toContain('db_wait;dur=7');
    expect(timing).toContain('rows;dur=30');
    expect(timing).toContain('total;dur=');
    expect(timing).not.toContain('private-value');
    expect(list).toHaveBeenCalledTimes(1);
    expect(list.mock.calls[0]?.[4]).toBeDefined();
  });

  it('does not expose timing without both the diagnostic opt-in and Mini Program platform', async () => {
    for (const headers of [
      {},
      { 'x-schedule-client-platform': 'miniprogram' },
      { 'x-schedule-directory-diagnostics': 'v1' },
      {
        'x-schedule-client-platform': 'web',
        'x-schedule-directory-diagnostics': 'v1',
      },
    ]) {
      const response = await app.inject({
        headers,
        method: 'GET',
        url: `/groups/${groupId}/directory?q=safe`,
      });
      expect(response.headers).not.toHaveProperty('server-timing');
    }
  });

  it('keeps facets and lookup outside the timing response contract', async () => {
    const headers = {
      'x-schedule-client-platform': 'miniprogram',
      'x-schedule-directory-diagnostics': 'v1',
    };
    const facets = await app.inject({
      headers,
      method: 'GET',
      url: `/groups/${groupId}/directory/facets`,
    });
    const lookup = await app.inject({
      headers,
      method: 'POST',
      payload: { entryIds: [] },
      url: `/groups/${groupId}/directory/lookup`,
    });

    expect(facets.headers).not.toHaveProperty('server-timing');
    expect(lookup.headers).not.toHaveProperty('server-timing');
  });
});
