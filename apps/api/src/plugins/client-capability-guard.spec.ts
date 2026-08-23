import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AuthenticatedIdentity, AuthPort } from '../adapters/auth/auth-port.js';
import { ClientCapabilityPolicy } from '../modules/client-capabilities/client-capability-policy.js';
import { registerErrorHandler } from './error-handler.js';
import { registerAuthentication } from './authenticate.js';
import { createPublicMiniCapabilityGuard } from './client-capability-guard.js';

const LEGACY_VERSION = '0.1.0-p6.20260824.78';
const CURRENT_VERSION = '0.1.0-p6.20260824.79';
const apps: FastifyInstance[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe('Mini capability guard', () => {
  it('allows current core routes for signed and mapped legacy Mini identities', async () => {
    const signed = await createGuardApp(
      { clientPlatform: 'miniprogram', clientVersion: CURRENT_VERSION, cloudbaseUid: 'mini-user' },
      { core: true, global: true },
    );
    const legacy = await createGuardApp(
      { clientPlatform: 'miniprogram', cloudbaseUid: 'legacy-mini-user' },
      { core: true, global: true },
    );

    expect((await signed.app.inject({ method: 'GET', url: '/users/me' })).statusCode).toBe(200);
    expect((await signed.app.inject({ method: 'GET', url: '/groups' })).statusCode).toBe(200);
    expect(
      (await signed.app.inject({ method: 'GET', url: '/groups/123/calendar' })).statusCode,
    ).toBe(200);
    expect(
      (
        await signed.app.inject({
          method: 'POST',
          url: '/groups/123/manual-schedule-templates',
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (await signed.app.inject({ method: 'POST', url: '/groups/123/schedules/generate' }))
        .statusCode,
    ).toBe(200);
    expect(
      (
        await signed.app.inject({
          method: 'POST',
          url: '/groups/123/past-schedules/backfill-batches',
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await signed.app.inject({
          method: 'PUT',
          payload: { consented: true },
          url: '/groups/123/mobile-phone-consent',
        })
      ).statusCode,
    ).toBe(200);
    expect((await legacy.app.inject({ method: 'GET', url: '/holidays' })).statusCode).toBe(200);
  });

  it('maps workflows, organization, insights, external messages, and guest independently', async () => {
    const { app } = await createGuardApp(
      { clientPlatform: 'miniprogram', clientVersion: CURRENT_VERSION, cloudbaseUid: 'mini-user' },
      { core: true, global: true },
    );

    for (const request of [
      { method: 'POST' as const, url: '/groups/123/leave-requests' },
      { method: 'POST' as const, url: '/groups' },
      { method: 'GET' as const, url: '/groups/123/statistics' },
      { method: 'PUT' as const, url: '/notifications/push-subscription' },
      { method: 'PUT' as const, url: '/groups/123/visitor-key' },
    ]) {
      const response = await app.inject(request);
      expect(response.statusCode, request.url).toBe(503);
      expect(response.json()).toMatchObject({ error: { code: 'CLIENT_CAPABILITY_DISABLED' } });
    }
  });

  it('allows each mapped module only when its own capability is enabled', async () => {
    const cases = [
      {
        capability: 'workflows' as const,
        method: 'POST' as const,
        url: '/groups/123/leave-requests',
      },
      { capability: 'organization' as const, method: 'POST' as const, url: '/groups' },
      { capability: 'insights' as const, method: 'GET' as const, url: '/groups/123/statistics' },
      {
        capability: 'externalMessages' as const,
        method: 'PUT' as const,
        url: '/notifications/push-subscription',
      },
      { capability: 'guest' as const, method: 'PUT' as const, url: '/groups/123/visitor-key' },
    ];
    for (const testCase of cases) {
      const { app } = await createGuardApp(
        {
          clientPlatform: 'miniprogram',
          clientVersion: CURRENT_VERSION,
          cloudbaseUid: `mini-${testCase.capability}`,
        },
        { [testCase.capability]: true, global: true },
      );
      expect(
        (await app.inject({ method: testCase.method, url: testCase.url })).statusCode,
        testCase.capability,
      ).toBe(200);
      expect((await app.inject({ method: 'GET', url: '/groups' })).statusCode).toBe(503);
    }
  });

  it('fails closed for an unclassified Mini route before its business mutation', async () => {
    const { app, mutation } = await createGuardApp(
      { clientPlatform: 'miniprogram', clientVersion: CURRENT_VERSION, cloudbaseUid: 'mini-user' },
      { core: true, global: true },
    );

    const response = await app.inject({ method: 'POST', url: '/future-unclassified-mutation' });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ error: { code: 'CLIENT_CAPABILITY_DISABLED' } });
    expect(mutation).not.toHaveBeenCalled();
  });

  it('allows privacy escape routes while global is off, but still guards phone consent grants', async () => {
    const { app, mutation } = await createGuardApp(
      { clientPlatform: 'miniprogram', clientVersion: CURRENT_VERSION, cloudbaseUid: 'mini-user' },
      { core: true, global: false },
    );

    expect(
      (await app.inject({ method: 'POST', url: '/me/wechat/miniprogram/unbind' })).statusCode,
    ).toBe(200);
    expect(
      (await app.inject({ method: 'GET', url: '/groups/123/mobile-phone-consent' })).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: 'PUT',
          payload: { consented: false },
          url: '/groups/123/mobile-phone-consent',
        })
      ).statusCode,
    ).toBe(200);

    const grant = await app.inject({
      method: 'PUT',
      payload: { consented: true },
      url: '/groups/123/mobile-phone-consent',
    });
    expect(grant.statusCode).toBe(503);
    expect(mutation).toHaveBeenCalledTimes(3);
  });

  it('keeps privacy escapes available after an old version leaves the allowlist', async () => {
    const { app, mutation } = await createGuardApp(
      {
        clientPlatform: 'miniprogram',
        clientVersion: '0.1.0-p6.20260824.80',
        cloudbaseUid: 'outdated-mini-user',
      },
      { core: true, global: false },
    );

    expect(
      (await app.inject({ method: 'POST', url: '/me/wechat/miniprogram/unbind' })).statusCode,
    ).toBe(200);
    expect(
      (await app.inject({ method: 'GET', url: '/groups/123/mobile-phone-consent' })).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: 'PUT',
          payload: { consented: false },
          url: '/groups/123/mobile-phone-consent',
        })
      ).statusCode,
    ).toBe(200);

    const grant = await app.inject({
      method: 'PUT',
      payload: { consented: true },
      url: '/groups/123/mobile-phone-consent',
    });
    expect(grant.statusCode).toBe(426);
    expect(mutation).toHaveBeenCalledTimes(3);
  });

  it('guards paired public Mini guest requests while preserving headerless Web access', async () => {
    const app = Fastify({ logger: false });
    apps.push(app);
    registerErrorHandler(app);
    const policy = new ClientCapabilityPolicy({
      capabilities: {
        core: true,
        externalMessages: false,
        global: true,
        guest: false,
        insights: false,
        organization: false,
        workflows: false,
      },
      legacyVersion: LEGACY_VERSION,
      supportedVersions: [LEGACY_VERSION, CURRENT_VERSION],
    });
    const handler = vi.fn(async () => ({ ok: true }));
    app.get('/public-guest', { preHandler: createPublicMiniCapabilityGuard(policy) }, handler);

    expect((await app.inject({ method: 'GET', url: '/public-guest' })).statusCode).toBe(200);
    expect(
      (
        await app.inject({
          headers: { 'x-schedule-client-platform': 'miniprogram' },
          method: 'GET',
          url: '/public-guest',
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          headers: {
            'x-schedule-client-platform': 'miniprogram',
            'x-schedule-client-version': '0.1.0-p6.20260824.80',
          },
          method: 'GET',
          url: '/public-guest',
        })
      ).statusCode,
    ).toBe(426);
    expect(
      (
        await app.inject({
          headers: {
            'x-schedule-client-platform': 'miniprogram',
            'x-schedule-client-version': CURRENT_VERSION,
          },
          method: 'GET',
          url: '/public-guest',
        })
      ).statusCode,
    ).toBe(503);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not change password, Web WeChat, or dev identity permissions', async () => {
    for (const identity of [
      { cloudbaseUid: 'password-user' },
      { cloudbaseUid: 'web-wechat-user' },
      { cloudbaseUid: 'dev-user' },
    ]) {
      const { app } = await createGuardApp(identity, { core: false, global: false });
      expect(
        (await app.inject({ method: 'POST', url: '/future-unclassified-mutation' })).statusCode,
      ).toBe(200);
    }
  });
});

async function createGuardApp(
  identity: AuthenticatedIdentity,
  enabled: {
    readonly core?: boolean;
    readonly externalMessages?: boolean;
    readonly global: boolean;
    readonly guest?: boolean;
    readonly insights?: boolean;
    readonly organization?: boolean;
    readonly workflows?: boolean;
  },
) {
  const app = Fastify({ logger: false });
  apps.push(app);
  registerErrorHandler(app);
  const authPort: AuthPort = { authenticate: vi.fn(async () => identity) };
  const policy = new ClientCapabilityPolicy({
    capabilities: {
      core: enabled.core ?? false,
      externalMessages: enabled.externalMessages ?? false,
      global: enabled.global,
      guest: enabled.guest ?? false,
      insights: enabled.insights ?? false,
      organization: enabled.organization ?? false,
      workflows: enabled.workflows ?? false,
    },
    legacyVersion: LEGACY_VERSION,
    supportedVersions: [LEGACY_VERSION, CURRENT_VERSION],
  });
  registerAuthentication(app, authPort, policy);
  const mutation = vi.fn(async () => ({ ok: true }));
  const guarded = { preHandler: app.authenticate };
  app.get('/users/me', guarded, mutation);
  app.get('/groups', guarded, mutation);
  app.get('/groups/:groupId/calendar', guarded, mutation);
  app.post('/groups/:groupId/manual-schedule-templates', guarded, mutation);
  app.post('/groups/:groupId/schedules/generate', guarded, mutation);
  app.post('/groups/:groupId/past-schedules/backfill-batches', guarded, mutation);
  app.get('/holidays', guarded, mutation);
  app.post('/groups/:groupId/leave-requests', guarded, mutation);
  app.post('/groups', guarded, mutation);
  app.get('/groups/:groupId/statistics', guarded, mutation);
  app.put('/notifications/push-subscription', guarded, mutation);
  app.put('/groups/:groupId/visitor-key', guarded, mutation);
  app.post('/future-unclassified-mutation', guarded, mutation);
  app.post('/me/wechat/miniprogram/unbind', guarded, mutation);
  app.get('/groups/:groupId/mobile-phone-consent', guarded, mutation);
  app.put('/groups/:groupId/mobile-phone-consent', guarded, mutation);
  await app.ready();
  return { app, mutation };
}
