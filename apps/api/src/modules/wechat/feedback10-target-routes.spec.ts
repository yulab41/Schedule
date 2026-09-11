import Fastify from 'fastify';
import { describe, it, expect, vi } from 'vitest';
import { registerWechatDiagnosticsRoutes } from './wechat-diagnostics-routes.js';
import type { WechatDiagnosticsService } from './wechat-diagnostics-service.js';

describe('notification test target boundary', () => {
  it.each(['trial', 'formal', undefined])(
    'accepts %s while keeping a fixed server-owned destination',
    async (targetVersion) => {
      const { app, send } = createFixture();
      try {
        const response = await app.inject({
          method: 'POST',
          url: '/me/wechat-notification-test',
          headers: { 'idempotency-key': '11111111-1111-4111-8111-111111111111' },
          payload: {
            groupId: '22222222-2222-4222-8222-222222222222',
            issuedAt: 123,
            ...(targetVersion ? { targetVersion } : {}),
          },
        });
        expect(response.statusCode).toBe(200);
        expect(send.mock.calls[0]?.[4]).toBe(targetVersion);
      } finally {
        await app.close();
      }
    },
  );
  it.each([
    { targetVersion: 'developer' },
    { page: 'pages/other/index' },
    { targetVersion: 'https://example.com' },
  ])('rejects unsupported target %j without sending', async (extra) => {
    const { app, send } = createFixture();
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/me/wechat-notification-test',
        headers: { 'idempotency-key': '11111111-1111-4111-8111-111111111111' },
        payload: { groupId: '22222222-2222-4222-8222-222222222222', issuedAt: 123, ...extra },
      });
      expect(response.statusCode).toBe(400);
      expect(send).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
});
function createFixture() {
  const app = Fastify();
  const send = vi.fn(async (...args: unknown[]) => {
    void args;
    return { outcome: 'accepted' };
  });
  app.decorateRequest('authenticatedIdentity', null);
  app.decorate('authenticate', async (request: { authenticatedIdentity: unknown }) => {
    request.authenticatedIdentity = { cloudbaseUid: 'fixture' };
  });
  registerWechatDiagnosticsRoutes(app, { sendTest: send } as unknown as WechatDiagnosticsService);
  return { app, send };
}
