import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AuthPort } from '../../adapters/auth/auth-port.js';
import { registerAuthentication } from '../../plugins/authenticate.js';
import { registerErrorHandler } from '../../plugins/error-handler.js';
import { registerRequestContext } from '../../plugins/request-context.js';
import { registerPasswordAuthRoutes } from './password-auth-routes.js';
import type { PasswordAuthService } from './password-auth-service.js';

const apps: ReturnType<typeof Fastify>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe('password auth routes', () => {
  it('protects password status and returns the default-password flag', async () => {
    const service = createService({
      getStatus: vi.fn().mockResolvedValue({
        hasPassword: true,
        mustChangePassword: true,
      }),
    });
    const app = createTestApp(service);

    const unauthorized = await app.inject({ method: 'GET', url: '/auth/password/status' });
    expect(unauthorized.statusCode).toBe(401);

    const response = await app.inject({
      headers: { authorization: 'Bearer valid-token' },
      method: 'GET',
      url: '/auth/password/status',
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ hasPassword: true, mustChangePassword: true });
    expect(service.getStatus).toHaveBeenCalledWith({ cloudbaseUid: 'password_user-1' });
  });

  it('changes a password only for an authenticated request with valid input', async () => {
    const service = createService({
      changePassword: vi.fn().mockResolvedValue({ passwordChanged: true }),
    });
    const app = createTestApp(service);

    const response = await app.inject({
      headers: { authorization: 'Bearer valid-token' },
      method: 'PATCH',
      payload: { currentPassword: '123', newPassword: 'changed-password' },
      url: '/auth/password',
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ passwordChanged: true });
    expect(service.changePassword).toHaveBeenCalledWith(
      { cloudbaseUid: 'password_user-1' },
      { currentPassword: '123', newPassword: 'changed-password' },
    );

    const invalid = await app.inject({
      headers: { authorization: 'Bearer valid-token' },
      method: 'PATCH',
      payload: { currentPassword: 'same', newPassword: 'same' },
      url: '/auth/password',
    });
    expect(invalid.statusCode).toBe(400);
    expect(service.changePassword).toHaveBeenCalledTimes(1);
  });
});

function createTestApp(service: PasswordAuthService) {
  const app = Fastify({ logger: false });
  apps.push(app);
  registerRequestContext(app);
  registerErrorHandler(app);
  const authPort: AuthPort = {
    authenticate: vi.fn(async ({ authorization }) =>
      authorization === 'Bearer valid-token' ? { cloudbaseUid: 'password_user-1' } : undefined,
    ),
  };
  registerAuthentication(app, authPort);
  registerPasswordAuthRoutes(app, service);
  return app;
}

function createService(overrides: Partial<PasswordAuthService>): PasswordAuthService {
  return {
    changePassword: vi.fn(),
    getStatus: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    ...overrides,
  } as unknown as PasswordAuthService;
}
