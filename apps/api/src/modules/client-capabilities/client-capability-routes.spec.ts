import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../app.js';
import { registerErrorHandler } from '../../plugins/error-handler.js';
import { registerRequestContext } from '../../plugins/request-context.js';
import { registerWechatAdminBindingRoutes } from '../wechat/wechat-admin-binding-routes.js';
import type { WechatAdminBindingService } from '../wechat/wechat-admin-binding-service.js';
import { registerWechatAuthRoutes } from '../wechat/wechat-auth-routes.js';
import type { WechatAuthService } from '../wechat/wechat-auth-service.js';
import { ClientCapabilityPolicy } from './client-capability-policy.js';

const LEGACY_VERSION = '0.1.0-p6.20260824.78';
const CURRENT_VERSION = '0.1.0-p6.20260824.79';
const apps: FastifyInstance[] = [];

function createPolicy(
  overrides: Partial<Record<'global' | 'core' | 'workflows', boolean>> = {},
): ClientCapabilityPolicy {
  return new ClientCapabilityPolicy({
    capabilities: {
      core: overrides.core ?? true,
      externalMessages: false,
      global: overrides.global ?? true,
      guest: false,
      insights: false,
      organization: false,
      workflows: overrides.workflows ?? false,
    },
    legacyVersion: LEGACY_VERSION,
    supportedVersions: [LEGACY_VERSION, CURRENT_VERSION],
  });
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe('client capability discovery', () => {
  it('is public, strict, effective, and never cacheable', async () => {
    const app = createApp({ clientCapabilityPolicy: createPolicy(), logger: false });
    apps.push(app);

    const response = await app.inject({
      method: 'GET',
      url: `/client-capabilities?platform=miniprogram&version=${CURRENT_VERSION}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json()).toEqual({
      core: true,
      externalMessages: false,
      global: true,
      guest: false,
      insights: false,
      organization: false,
      platform: 'miniprogram',
      version: CURRENT_VERSION,
      workflows: false,
    });

    const invalid = await app.inject({
      method: 'GET',
      url: `/client-capabilities?platform=web&version=${CURRENT_VERSION}`,
    });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.headers['cache-control']).toBe('no-store');

    const unknown = await app.inject({
      method: 'GET',
      url: '/client-capabilities?platform=miniprogram&version=0.1.0-p6.20260824.80',
    });
    expect(unknown.statusCode).toBe(426);
    expect(unknown.headers['cache-control']).toBe('no-store');
    expect(unknown.json()).toMatchObject({ error: { code: 'CLIENT_VERSION_UNSUPPORTED' } });
  });
});

describe('signed client headers on Mini session issuance', () => {
  it('rejects a half pair and an unknown version before invoking the login service', async () => {
    const login = vi.fn(async () => ({ status: 'link_required' as const }));
    const app = createBareRouteApp();
    registerWechatAuthRoutes(app, { login } as unknown as WechatAuthService, createPolicy());

    const halfPair = await app.inject({
      headers: { 'x-schedule-client-platform': 'miniprogram' },
      method: 'POST',
      payload: { code: 'fresh-code' },
      url: '/auth/wechat/login',
    });
    expect(halfPair.statusCode).toBe(400);

    const emptyPair = await app.inject({
      headers: {
        'x-schedule-client-platform': '',
        'x-schedule-client-version': '',
      },
      method: 'POST',
      payload: { code: 'fresh-code' },
      url: '/auth/wechat/login',
    });
    expect(emptyPair.statusCode).toBe(400);

    const invalidPlatform = await app.inject({
      headers: {
        'x-schedule-client-platform': 'web',
        'x-schedule-client-version': CURRENT_VERSION,
      },
      method: 'POST',
      payload: { code: 'fresh-code' },
      url: '/auth/wechat/login',
    });
    expect(invalidPlatform.statusCode).toBe(400);

    const unknown = await app.inject({
      headers: {
        'x-schedule-client-platform': 'miniprogram',
        'x-schedule-client-version': '0.1.0-p6.20260824.80',
      },
      method: 'POST',
      payload: { code: 'fresh-code' },
      url: '/auth/wechat/login',
    });
    expect(unknown.statusCode).toBe(426);
    expect(unknown.json()).toMatchObject({ error: { code: 'CLIENT_VERSION_UNSUPPORTED' } });
    expect(login).not.toHaveBeenCalled();
  });

  it('passes the exact known version to login/link/register and admin confirm only', async () => {
    const login = vi.fn(async () => ({ status: 'link_required' as const }));
    const linkPassword = vi.fn(async () => ({ status: 'authenticated' as const }));
    const register = vi.fn(async () => ({ status: 'authenticated' as const }));
    const confirm = vi.fn(async () => ({ status: 'authenticated' as const }));
    const app = createBareRouteApp();
    registerWechatAuthRoutes(
      app,
      { linkPassword, login, register } as unknown as WechatAuthService,
      createPolicy(),
    );
    registerWechatAdminBindingRoutes(
      app,
      { confirm, preview: vi.fn() } as unknown as WechatAdminBindingService,
      createPolicy(),
    );
    const headers = {
      'x-schedule-client-platform': 'miniprogram',
      'x-schedule-client-version': CURRENT_VERSION,
    };

    await app.inject({
      headers,
      method: 'POST',
      payload: { code: 'code-a' },
      url: '/auth/wechat/login',
    });
    await app.inject({
      headers,
      method: 'POST',
      payload: { linkToken: 'token', password: 'password-123', username: 'user.name' },
      url: '/auth/wechat/link-password',
    });
    await app.inject({
      headers,
      method: 'POST',
      payload: { linkToken: 'token', realName: '测试用户' },
      url: '/auth/wechat/register',
    });
    await app.inject({
      headers,
      method: 'POST',
      payload: { code: 'code-b', ticket: 'ticket' },
      url: '/auth/wechat/admin-bind/confirm',
    });

    expect(login).toHaveBeenCalledWith('code-a', CURRENT_VERSION);
    expect(linkPassword).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      CURRENT_VERSION,
    );
    expect(register).toHaveBeenCalledWith(expect.any(Object), expect.any(String), CURRENT_VERSION);
    expect(confirm).toHaveBeenCalledWith(expect.any(Object), expect.any(String), CURRENT_VERSION);
  });

  it('keeps a headerless login as an unsigned legacy session request', async () => {
    const login = vi.fn(async () => ({ status: 'link_required' as const }));
    const app = createBareRouteApp();
    registerWechatAuthRoutes(app, { login } as unknown as WechatAuthService, createPolicy());

    const response = await app.inject({
      method: 'POST',
      payload: { code: 'legacy-code' },
      url: '/auth/wechat/login',
    });

    expect(response.statusCode).toBe(200);
    expect(login).toHaveBeenCalledWith('legacy-code', undefined);
  });
});

function createBareRouteApp(): FastifyInstance {
  const app = createApp({ logger: false });
  // createApp already installs both hooks; retaining these imports ensures the
  // route harness cannot accidentally omit the production error protocol.
  void registerErrorHandler;
  void registerRequestContext;
  apps.push(app);
  return app;
}
