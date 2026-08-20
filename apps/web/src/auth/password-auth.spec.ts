import { describe, expect, it, vi } from 'vitest';

import { createPasswordAuthClient } from './password-auth.js';

const responseBody = {
  isNewUser: false,
  mustChangePassword: false,
  token: 'password-session-token',
};

describe('password auth client', () => {
  it('posts normalized credentials to the password login endpoint', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(responseBody), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }),
    );
    const client = createPasswordAuthClient({
      apiBaseUrl: '/api',
      fetch: fetchImplementation,
    });

    await expect(client.login({ password: 'password-1', username: 'linenyu' })).resolves.toEqual(
      responseBody,
    );
    expect(fetchImplementation).toHaveBeenCalledWith(
      '/api/auth/password/login',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ password: 'password-1', username: 'linenyu' }),
      }),
    );
  });

  it('parses duplicate-registration errors without exposing response internals', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: 'CONFLICT',
            message: '该账号已存在，请换一个账号。',
            requestId: 'request-1',
          },
        }),
        { status: 409 },
      ),
    );
    const client = createPasswordAuthClient({ fetch: fetchImplementation });

    await expect(
      client.register({ password: 'password-1', username: 'linenyu' }),
    ).rejects.toMatchObject({
      message: '该账号已存在，请换一个账号。',
      status: 409,
    });
  });

  it('uses the active bearer session for password status and password changes', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ hasPassword: true, mustChangePassword: true }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ passwordChanged: true }), { status: 200 }),
      );
    const auth = {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'active-token' } },
      }),
    };
    const client = createPasswordAuthClient({ auth, fetch: fetchImplementation });

    await expect(client.getStatus()).resolves.toEqual({
      hasPassword: true,
      mustChangePassword: true,
    });
    await expect(
      client.changePassword({ currentPassword: '123', newPassword: 'changed-password' }),
    ).resolves.toEqual({ passwordChanged: true });
    expect(fetchImplementation).toHaveBeenNthCalledWith(
      2,
      '/api/auth/password',
      expect.objectContaining({
        body: JSON.stringify({ currentPassword: '123', newPassword: 'changed-password' }),
        headers: expect.objectContaining({ Authorization: 'Bearer active-token' }),
        method: 'PATCH',
      }),
    );
  });
});
