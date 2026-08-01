import type { UserProfile } from '@schedule/contracts';
import { describe, expect, it, vi } from 'vitest';

import type { CloudbaseAuthClient } from '../auth/cloudbase.js';
import { createApiClient } from './client.js';

vi.mock('@cloudbase/js-sdk', () => ({
  default: { init: vi.fn() },
}));

const profile: UserProfile = {
  id: 'profile-1',
  realName: '张医生',
  version: 1,
};

describe('Web API client', () => {
  it('sends the current CloudBase access token to the profile endpoint', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(profile), { status: 201 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.createCurrentProfile({ realName: profile.realName })).resolves.toEqual(
      profile,
    );

    expect(fetchImplementation).toHaveBeenCalledWith(
      '/api/users',
      expect.objectContaining({
        body: JSON.stringify({ realName: profile.realName }),
        headers: {
          Authorization: 'Bearer signed-in-token',
          'Content-Type': 'application/json',
        },
        method: 'POST',
      }),
    );
  });

  it('maps the API conflict contract to a typed client error', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: 'CONFLICT',
            message: '资料已发生变化。',
            requestId: 'request-1',
          },
        }),
        { status: 409 },
      ),
    );
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.getCurrentProfile()).rejects.toMatchObject({
      code: 'CONFLICT',
      requestId: 'request-1',
      status: 409,
    });
  });

  it('rejects a malformed successful profile response', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ id: profile.id }), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.getCurrentProfile()).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('maps forbidden and network failures to recoverable client errors', async () => {
    const forbiddenClient = createApiClient({
      auth: createAuthClient(),
      fetch: vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: 'FORBIDDEN',
              message: '当前账户无权执行此操作。',
              requestId: 'request-2',
            },
          }),
          { status: 403 },
        ),
      ),
    });
    const networkClient = createApiClient({
      auth: createAuthClient(),
      fetch: vi.fn<typeof fetch>().mockRejectedValue(new TypeError('network unavailable')),
    });

    await expect(forbiddenClient.getCurrentProfile()).rejects.toMatchObject({
      code: 'FORBIDDEN',
      status: 403,
    });
    await expect(networkClient.getCurrentProfile()).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    });
  });
});

function createAuthClient(): CloudbaseAuthClient {
  return {
    getSession: vi.fn().mockResolvedValue({
      data: {
        session: {
          access_token: 'signed-in-token',
          user: { is_anonymous: false },
        },
      },
    }),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    signUp: vi.fn(),
  };
}
