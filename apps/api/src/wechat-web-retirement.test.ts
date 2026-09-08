import { describe, expect, it, vi } from 'vitest';
import type { DatabaseClient } from '@schedule/database';
import { createApp } from './app.js';

describe('website WeChat retirement', () => {
  it('does not mount website login routes even if an old caller provides a service', async () => {
    const start = vi.fn(() => ({ authorizeUrl: 'https://example.test', state: 'old' }));
    const exchange = vi.fn(async () => ({ token: 'old' }));
    const options = {
      logger: false as const,
      authPort: { authenticate: async () => undefined },
      databaseClient: {} as DatabaseClient,
      wechatWebAuthService: { start, exchange },
    };
    const app = createApp(options);
    try {
      expect(
        (await app.inject({ method: 'GET', url: '/auth/wechat/web/start?state=0123456789012345' }))
          .statusCode,
      ).toBe(404);
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/auth/wechat/web/exchange',
            payload: { code: 'old', state: '0123456789012345' },
          })
        ).statusCode,
      ).toBe(404);
      expect(start).not.toHaveBeenCalled();
      expect(exchange).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
});
