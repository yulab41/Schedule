import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerAuthentication } from '../../plugins/authenticate.js';
import { ApiError, registerErrorHandler } from '../../plugins/error-handler.js';
import { registerWechatAuthRoutes } from '../wechat/wechat-auth-routes.js';
import { registerAccountActivityRoutes } from './account-activity-routes.js';
import type { WechatAuthenticatedResponse } from '@schedule/contracts';

const userId = '11111111-1111-4111-8111-111111111111';
const identity = { cloudbaseUid: 'synthetic-member' };
const authenticated: WechatAuthenticatedResponse = {
  status: 'authenticated',
  expiresAt: '2026-10-01T00:00:00Z',
  token: 'synthetic-token',
  profile: { id: userId, realName: 'Synthetic', version: 1 },
};
const apps: ReturnType<typeof Fastify>[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});
function app() {
  const instance = Fastify({ logger: false });
  apps.push(instance);
  registerErrorHandler(instance);
  registerAuthentication(instance, {
    authenticate: async ({ authorization }) =>
      authorization === 'Bearer synthetic' ? identity : undefined,
  });
  return instance;
}
describe('account activity HTTP boundaries', () => {
  it('requires authentication and passes the authenticated identity, rejecting supplied account IDs', async () => {
    const server = app();
    const recordOpen = vi.fn().mockResolvedValue({ recorded: true });
    const summary = vi
      .fn()
      .mockResolvedValue({ todayLoginCount: 0, todayOpenCount: 0, totalOpenCount: 0 });
    registerAccountActivityRoutes(server, { recordOpen, summary });
    const payload = { eventId: userId, openedAt: '2026-09-30T10:00:00Z' };
    expect(
      (await server.inject({ method: 'POST', url: '/me/activity/opens', payload })).statusCode,
    ).toBe(401);
    expect(recordOpen).not.toHaveBeenCalled();
    const headers = { authorization: 'Bearer synthetic' };
    expect(
      (
        await server.inject({
          method: 'POST',
          url: '/me/activity/opens',
          headers,
          payload: { ...payload, userId },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (await server.inject({ method: 'POST', url: '/me/activity/opens', headers, payload }))
        .statusCode,
    ).toBe(200);
    expect(recordOpen).toHaveBeenCalledExactlyOnceWith(identity, payload);
    const response = await server.inject({
      method: 'GET',
      url: `/platform-admin/users/${userId}/activity`,
      headers,
    });
    expect(summary).toHaveBeenCalledExactlyOnceWith(identity, userId);
    expect(response.headers['cache-control']).toBe('no-store');
  });
  it('preserves permission refusal and sanitizes unexpected statistics failures', async () => {
    const server = app();
    registerAccountActivityRoutes(server, {
      summary: vi
        .fn()
        .mockRejectedValue(
          new ApiError({ code: 'FORBIDDEN', statusCode: 403, userMessage: 'Denied' }),
        ),
      recordOpen: vi.fn().mockRejectedValue(new Error('private SQL and identity must not escape')),
    });
    const headers = { authorization: 'Bearer synthetic' };
    expect(
      (
        await server.inject({
          method: 'GET',
          url: `/platform-admin/users/${userId}/activity`,
          headers,
        })
      ).statusCode,
    ).toBe(403);
    const response = await server.inject({
      method: 'POST',
      url: '/me/activity/opens',
      headers,
      payload: { eventId: userId, openedAt: '2026-09-30T10:00:00Z' },
    });
    expect(response.statusCode).toBe(503);
    expect(response.body).not.toContain('private SQL');
    expect(response.json().error.requestId).toBeTypeOf('string');
  });
  it.each([
    ['manual', 'wechat_manual'],
    ['auto', 'wechat_auto'],
    [undefined, 'wechat_unspecified'],
  ])('counts a newly issued session with %s provenance', async (source, method) => {
    const server = app();
    const recordLogin = vi.fn().mockResolvedValue(undefined);
    const auth = {
      login: vi.fn().mockResolvedValue(authenticated),
      linkPassword: vi.fn(),
      register: vi.fn(),
    };
    registerWechatAuthRoutes(server, auth, undefined, { recordLogin });
    server.get('/synthetic-protected', { preHandler: server.authenticate }, async () => ({
      ok: true,
    }));
    const response = await server.inject({
      method: 'POST',
      url: '/auth/wechat/login',
      payload: { code: 'synthetic', ...(source === undefined ? {} : { loginSource: source }) },
    });
    expect(response.statusCode).toBe(200);
    expect(recordLogin).toHaveBeenCalledExactlyOnceWith(userId, method);
    // Session restoration authenticates ordinary requests without issuing another login session.
    expect(
      (
        await server.inject({
          method: 'GET',
          url: '/synthetic-protected',
          headers: { authorization: 'Bearer synthetic' },
        })
      ).statusCode,
    ).toBe(200);
    expect(recordLogin).toHaveBeenCalledTimes(1);
  });
  it('omits pending/failed authentication and returns issued sessions when statistics fail', async () => {
    const server = app();
    const login = vi
      .fn()
      .mockResolvedValueOnce({
        status: 'link_required',
        linkToken: 'synthetic',
        expiresAt: authenticated.expiresAt,
      })
      .mockRejectedValueOnce(
        new ApiError({ code: 'AUTHENTICATION_REQUIRED', statusCode: 401, userMessage: 'Denied' }),
      )
      .mockResolvedValueOnce(authenticated);
    const recordLogin = vi.fn().mockRejectedValue(new Error('private statistics failure'));
    registerWechatAuthRoutes(
      server,
      { login, linkPassword: vi.fn(), register: vi.fn() },
      undefined,
      { recordLogin },
    );
    const request = {
      method: 'POST' as const,
      url: '/auth/wechat/login',
      payload: { code: 'synthetic' },
    };
    expect((await server.inject(request)).json().status).toBe('link_required');
    expect((await server.inject(request)).statusCode).toBe(401);
    expect(recordLogin).not.toHaveBeenCalled();
    const result = await server.inject(request);
    expect(result.statusCode).toBe(200);
    expect(result.json()).toEqual(authenticated);
    expect(recordLogin).toHaveBeenCalledTimes(1);
  });
});
