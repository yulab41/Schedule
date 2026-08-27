import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AuthPort } from '../../adapters/auth/auth-port.js';
import { registerAuthentication } from '../../plugins/authenticate.js';
import { registerErrorHandler } from '../../plugins/error-handler.js';
import { registerRequestContext } from '../../plugins/request-context.js';
import { registerWechatIdentityUnbindRoutes } from './wechat-identity-unbind-routes.js';
import type { WechatIdentityUnbindService } from './wechat-identity-unbind-service.js';

const apps: ReturnType<typeof Fastify>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe('Mini identity binding status route', () => {
  it('returns only bound and unbind eligibility for an authenticated user', async () => {
    const service = {
      getSelfBindingStatus: vi.fn().mockResolvedValue({ bound: true, canUnbind: false }),
      unbindAsPlatformAdmin: vi.fn(),
      unbindSelf: vi.fn(),
    } as unknown as WechatIdentityUnbindService;
    const app = createTestApp(service);

    expect(
      (await app.inject({ method: 'GET', url: '/me/wechat/miniprogram/binding' })).statusCode,
    ).toBe(401);
    const response = await app.inject({
      headers: { authorization: 'Bearer valid-token' },
      method: 'GET',
      url: '/me/wechat/miniprogram/binding',
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ bound: true, canUnbind: false });
    expect(service.getSelfBindingStatus).toHaveBeenCalledWith({ cloudbaseUid: 'user-1' });
  });
});

function createTestApp(service: WechatIdentityUnbindService) {
  const app = Fastify({ logger: false });
  apps.push(app);
  registerRequestContext(app);
  registerErrorHandler(app);
  const authPort: AuthPort = {
    authenticate: vi.fn(async ({ authorization }) =>
      authorization === 'Bearer valid-token' ? { cloudbaseUid: 'user-1' } : undefined,
    ),
  };
  registerAuthentication(app, authPort);
  registerWechatIdentityUnbindRoutes(app, service);
  return app;
}
