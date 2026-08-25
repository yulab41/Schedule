import { describe, expect, it, vi } from 'vitest';

import type { ClientTransport } from './endpoint.js';
import {
  createPlatformIdentityWriteClient,
  platformIdentityWriteEndpoints,
} from './platform-identity-write-client.js';

const userId = 'user /一';
const operationId = '11111111-1111-4111-8111-111111111111';

describe('P8 platform identity shared write boundary', () => {
  it('sets bearer auth, encoded paths, bodies, and idempotency keys', () => {
    for (const endpoint of Object.values(platformIdentityWriteEndpoints)) {
      const request =
        endpoint.id === 'platform-identity-write.password-identity-assign'
          ? { expectedAuthVersion: 3, operationId, username: 'doctor.admin' }
          : { expectedAuthVersion: 3, operationId };
      const input = { request, userId };
      expect(endpoint.auth).toBe('bearer');
      expect(endpoint.path(input as never)).toContain('/platform-admin/users/user%20%2F%E4%B8%80/');
      expect(endpoint.idempotencyKey?.(input as never)).toBe(operationId);
      expect(endpoint.body?.(input as never)).toEqual(request);
    }
  });

  it('uses the transport receiver exactly once for both writes', async () => {
    const request = vi.fn(async (endpoint: { readonly id: string }) =>
      endpoint.id.endsWith('binding-link-create')
        ? {
            authVersion: 3,
            expiresAt: '2026-08-25T12:00:00.000Z',
            urlLink: 'https://wxaurl.cn/example',
          }
        : { authVersion: 4, passwordConfigured: false, username: 'doctor.admin' },
    );
    const transport = { request } as unknown as ClientTransport;
    const client = createPlatformIdentityWriteClient(transport);

    await client.assignPasswordIdentity(userId, {
      expectedAuthVersion: 3,
      operationId,
      username: 'doctor.admin',
    });
    await client.createWechatBindingLink(userId, { expectedAuthVersion: 3, operationId });

    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.contexts).toEqual([transport, transport]);
  });
});
