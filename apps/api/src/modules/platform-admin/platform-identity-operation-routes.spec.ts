import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { registerWechatAdminBindingRoutes } from '../wechat/wechat-admin-binding-routes.js';
import type { WechatAdminBindingService } from '../wechat/wechat-admin-binding-service.js';
import { registerPlatformAdminRoutes } from './platform-admin-routes.js';
import type { PlatformAdminService } from './platform-admin-service.js';

const userId = '11111111-1111-4111-8111-111111111111';
const operationId = '22222222-2222-4222-8222-222222222222';
const otherOperationId = '33333333-3333-4333-8333-333333333333';
const identity = { cloudbaseUid: 'platform-admin' } satisfies AuthenticatedIdentity;

describe('P8 platform identity route operation boundary', () => {
  let app: FastifyInstance;
  let assignPasswordIdentity: ReturnType<typeof vi.fn>;
  let createLink: ReturnType<typeof vi.fn>;

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
    assignPasswordIdentity = vi.fn(async () => ({
      authVersion: 4,
      passwordConfigured: false,
      username: 'doctor.admin',
    }));
    createLink = vi.fn(async () => ({
      authVersion: 3,
      expiresAt: '2026-08-25T12:00:00.000Z',
      urlLink: 'https://wxaurl.cn/example',
    }));
    registerPlatformAdminRoutes(app, { assignPasswordIdentity } as unknown as PlatformAdminService);
    registerWechatAdminBindingRoutes(app, { createLink } as unknown as WechatAdminBindingService);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('accepts header-only operation ids and forwards expected auth versions', async () => {
    const responses = await Promise.all(
      mutationRequests(operationId).map((request) => app.inject(request)),
    );

    expect(responses.map((response) => response.statusCode)).toEqual([200, 200]);
    expect(assignPasswordIdentity).toHaveBeenCalledWith(
      identity,
      userId,
      expect.objectContaining({ expectedAuthVersion: 3, operationId }),
    );
    expect(createLink).toHaveBeenCalledWith(
      identity,
      userId,
      expect.objectContaining({ expectedAuthVersion: 3, operationId }),
      expect.any(String),
    );
  });

  it('rejects missing and mismatched operation ids before service calls', async () => {
    const missing = await Promise.all(
      mutationRequests(undefined).map((request) => app.inject(request)),
    );
    const mismatched = await Promise.all(
      mutationRequests(operationId, otherOperationId).map((request) => app.inject(request)),
    );

    expect(missing.every((response) => response.statusCode === 400)).toBe(true);
    expect(mismatched.every((response) => response.statusCode === 400)).toBe(true);
    expect(assignPasswordIdentity).not.toHaveBeenCalled();
    expect(createLink).not.toHaveBeenCalled();
  });
});

function mutationRequests(headerOperationId: string | undefined, bodyOperationId?: string) {
  const headers =
    headerOperationId === undefined
      ? { authorization: 'Bearer token' }
      : { authorization: 'Bearer token', 'idempotency-key': headerOperationId };
  const operation = bodyOperationId === undefined ? {} : { operationId: bodyOperationId };
  return [
    {
      headers,
      method: 'PUT' as const,
      payload: { expectedAuthVersion: 3, username: 'doctor.admin', ...operation },
      url: `/platform-admin/users/${userId}/password-identity`,
    },
    {
      headers,
      method: 'POST' as const,
      payload: { expectedAuthVersion: 3, ...operation },
      url: `/platform-admin/users/${userId}/wechat-miniprogram-binding-links`,
    },
  ];
}
