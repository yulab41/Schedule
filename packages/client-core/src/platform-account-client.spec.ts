import { describe, expect, it, vi } from 'vitest';
import type { ClientTransport } from './endpoint.js';
import {
  createPlatformAccountClient,
  platformAccountEndpoints,
} from './platform-account-client.js';

describe('platform account management boundary', () => {
  it('keeps credentials in the authenticated body with a separate idempotency header', async () => {
    const request = {
      operationId: '11111111-1111-4111-8111-111111111111',
      expectedAuthVersion: 2,
      newPassword: 'synthetic-secret',
    };
    const input = { userId: 'user /一', request };
    const endpoint = platformAccountEndpoints.password;
    expect(endpoint.auth).toBe('bearer');
    expect(endpoint.path(input)).toBe('/platform-admin/users/user%20%2F%E4%B8%80/password');
    expect(endpoint.idempotencyKey?.(input)).toBe(request.operationId);
    expect(endpoint.body?.(input)).toEqual(request);
    expect(
      endpoint.decoder.safeDecode({
        authVersion: 3,
        passwordConfigured: true,
        passwordHash: 'secret',
      }).success,
    ).toBe(false);
    const send = vi.fn(async () => ({ authVersion: 3, passwordConfigured: true }));
    const transport = { request: send } as unknown as ClientTransport;
    await createPlatformAccountClient(transport).resetPassword(input.userId, request);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.contexts[0]).toBe(transport);
  });
});
