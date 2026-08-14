import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword } from './password-auth-service.js';
import {
  createPasswordSessionToken,
  verifyWechatSessionToken,
} from '../../adapters/auth/wechat-auth.js';

describe('password authentication primitives', () => {
  it('stores passwords as salted scrypt hashes and verifies only the original password', async () => {
    const firstHash = await hashPassword('correct horse battery staple');
    const secondHash = await hashPassword('correct horse battery staple');

    expect(firstHash).not.toBe(secondHash);
    expect(await verifyPassword('correct horse battery staple', firstHash)).toBe(true);
    expect(await verifyPassword('wrong password', firstHash)).toBe(false);
    expect(firstHash.startsWith('scrypt$')).toBe(true);
    expect(firstHash).not.toContain('correct horse battery staple');
  });

  it('rejects malformed password hashes without throwing', async () => {
    await expect(verifyPassword('password', 'not-a-password-hash')).resolves.toBe(false);
    await expect(verifyPassword('password', 'scrypt$1$1$1$bad$bad')).resolves.toBe(false);
  });

  it('issues a password session that the shared auth port can distinguish from WeChat', () => {
    const token = createPasswordSessionToken(
      { sub: 'user-1', username: 'linenyu' },
      's'.repeat(32),
      1_000,
    );

    expect(verifyWechatSessionToken(token, 's'.repeat(32), 1_001)).toMatchObject({
      openid: 'linenyu',
      provider: 'password',
      sub: 'user-1',
    });
  });
});
