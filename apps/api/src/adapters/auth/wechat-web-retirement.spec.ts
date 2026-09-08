import { describe, expect, it, vi } from 'vitest';
import { createWechatAuthPort, createWechatSessionToken } from './wechat-auth.js';
import type { DatabaseClient } from '@schedule/database';

const secret = 'retired-web-test-secret-123456789012345';
describe('retired website WeChat sessions', () => {
  it.each([false, true])(
    'rejects a signed website session before querying identities (dev=%s)',
    async (allowDevTokens) => {
      const select = vi.fn(() => {
        throw new Error('retired provider must not reach database');
      });
      const port = createWechatAuthPort({
        allowDevTokens,
        databaseClient: { database: { select } } as unknown as DatabaseClient,
        sessionSecret: secret,
      });
      const token = createWechatSessionToken(
        {
          appId: 'retired-web',
          openid: 'retired-subject',
          provider: 'wechat_web',
          sub: 'old-user',
        },
        secret,
      );
      await expect(
        port.authenticate({ authorization: `Bearer ${token}` }),
      ).resolves.toBeUndefined();
      expect(select).not.toHaveBeenCalled();
    },
  );
});
