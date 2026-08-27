import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AuthPort } from '../../adapters/auth/auth-port.js';
import { registerAuthentication } from '../../plugins/authenticate.js';
import { registerErrorHandler } from '../../plugins/error-handler.js';
import { registerRequestContext } from '../../plugins/request-context.js';
import { MAX_USER_PROFILE_AVATAR_BYTES } from './user-avatar.js';
import { registerUserRoutes } from './user-routes.js';
import type { UserService } from './user-service.js';

const apps: ReturnType<typeof Fastify>[] = [];
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe('user avatar routes', () => {
  it('authenticates and accepts only the parsed binary image body', async () => {
    const service = createService({
      replaceCurrentAvatar: vi.fn().mockResolvedValue({ avatarVersion: 2 }),
    });
    const app = createTestApp(service);

    expect((await upload(app)).statusCode).toBe(401);
    const response = await upload(app, 'valid-token');
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toEqual({ avatarVersion: 2 });
    expect(service.replaceCurrentAvatar).toHaveBeenCalledWith(
      { cloudbaseUid: 'user-1' },
      png,
      'image/png',
    );

    const unsupported = await app.inject({
      headers: { authorization: 'Bearer valid-token', 'content-type': 'image/gif' },
      method: 'PUT',
      payload: Buffer.from('GIF89a'),
      url: '/users/me/avatar',
    });
    expect(unsupported.statusCode).toBe(415);
    expect(service.replaceCurrentAvatar).toHaveBeenCalledTimes(1);

    const oversized = Buffer.alloc(MAX_USER_PROFILE_AVATAR_BYTES + 1);
    png.copy(oversized);
    const tooLarge = await app.inject({
      headers: { authorization: 'Bearer valid-token', 'content-type': 'image/png' },
      method: 'PUT',
      payload: oversized,
      url: '/users/me/avatar',
    });
    expect(tooLarge.statusCode).toBe(413);
    expect(service.replaceCurrentAvatar).toHaveBeenCalledTimes(1);
  });

  it('returns a private ETag image and honors conditional reads', async () => {
    const service = createService({
      getCurrentAvatar: vi.fn().mockResolvedValue({
        content: png,
        contentType: 'image/png',
        sha256: 'a'.repeat(64),
        version: 3,
      }),
    });
    const app = createTestApp(service);
    const response = await app.inject({
      headers: { authorization: 'Bearer valid-token' },
      method: 'GET',
      url: '/users/me/avatar',
    });
    expect(response.statusCode).toBe(200);
    expect(response.rawPayload).toEqual(png);
    expect(response.headers['content-type']).toContain('image/png');
    expect(response.headers.etag).toBe(`"avatar-3-${'a'.repeat(64)}"`);
    expect(response.headers['cache-control']).toBe('private, no-cache');
    expect(response.headers['x-content-type-options']).toBe('nosniff');

    const unchanged = await app.inject({
      headers: {
        authorization: 'Bearer valid-token',
        'if-none-match': response.headers.etag as string,
      },
      method: 'GET',
      url: '/users/me/avatar',
    });
    expect(unchanged.statusCode).toBe(304);
    expect(unchanged.body).toBe('');
  });

  it('deletes the current avatar idempotently', async () => {
    const service = createService({
      deleteCurrentAvatar: vi.fn().mockResolvedValue({ removed: true }),
    });
    const app = createTestApp(service);
    const response = await app.inject({
      headers: { authorization: 'Bearer valid-token' },
      method: 'DELETE',
      url: '/users/me/avatar',
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ removed: true });
    expect(service.deleteCurrentAvatar).toHaveBeenCalledWith({ cloudbaseUid: 'user-1' });
  });
});

function upload(app: ReturnType<typeof Fastify>, token?: string) {
  return app.inject({
    headers: {
      ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
      'content-type': 'image/png',
    },
    method: 'PUT',
    payload: png,
    url: '/users/me/avatar',
  });
}

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
    deleteCurrentAvatar: vi.fn(),
    getCurrentAvatar: vi.fn(),
    getCurrentProfile: vi.fn(),
    register: vi.fn(),
    replaceCurrentAvatar: vi.fn(),
    updateCurrentProfile: vi.fn(),
    ...overrides,
  } as unknown as UserService;
}
