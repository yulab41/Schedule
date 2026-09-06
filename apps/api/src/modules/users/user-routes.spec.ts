import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AuthPort } from '../../adapters/auth/auth-port.js';
import { registerAuthentication } from '../../plugins/authenticate.js';
import { registerErrorHandler } from '../../plugins/error-handler.js';
import { registerRequestContext } from '../../plugins/request-context.js';
import { registerUserRoutes } from './user-routes.js';
import type { UserService } from './user-service.js';

const apps: ReturnType<typeof Fastify>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe('retired photo routes', () => {
  it('does not expose reads, writes or deletion, while profile authentication remains active', async () => {
    const service = createService({
      getCurrentProfile: vi
        .fn()
        .mockResolvedValue({ id: 'user-1', realName: '示例用户', version: 1 }),
    });
    const app = createTestApp(service);
    for (const method of ['GET', 'PUT', 'DELETE'] as const) {
      const result = await app.inject({
        method,
        url: '/users/me/avatar',
        headers: { authorization: 'Bearer valid-token' },
      });
      expect(result.statusCode).toBe(404);
    }
    expect((await app.inject({ method: 'GET', url: '/users/me' })).statusCode).toBe(401);
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/users/me',
          headers: { authorization: 'Bearer valid-token' },
        })
      ).json(),
    ).toEqual({ id: 'user-1', realName: '示例用户', version: 1 });
  });
});

function createTestApp(service: UserService) {
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
  registerUserRoutes(app, service);
  return app;
}

function createService(overrides: Partial<UserService> = {}): UserService {
  return {
    getCurrentProfile: vi.fn(),
    register: vi.fn(),
    updateCurrentProfile: vi.fn(),
    ...overrides,
  } as unknown as UserService;
}
