import type { DatabaseClient } from '@schedule/database';
import { describe, expect, it, vi } from 'vitest';

import {
  hashPassword,
  isDefaultPassword,
  PasswordAuthService,
  verifyPassword,
} from './password-auth-service.js';
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

  it('identifies only the configured initial password as the default password', () => {
    expect(isDefaultPassword('123')).toBe(true);
    expect(isDefaultPassword(' 123 ')).toBe(false);
    expect(isDefaultPassword('changed-password')).toBe(false);
  });

  it('verifies the current password, replaces the hash, and writes an audit record', async () => {
    const existingHash = await hashPassword('123');
    const updateWhere = vi.fn().mockResolvedValue(undefined);
    let replacementHash: string | undefined;
    const updateSet = vi.fn((values: { readonly passwordHash: string }) => {
      replacementHash = values.passwordHash;
      return { where: updateWhere };
    });
    const insertValues = vi.fn().mockResolvedValue(undefined);
    const transaction = {
      insert: vi.fn(() => ({ values: insertValues })),
      select: vi.fn(() => createLockedSelect([{ passwordHash: existingHash, userId: 'user-1' }])),
      update: vi.fn(() => ({ set: updateSet })),
    };
    const databaseClient = {
      close: vi.fn(),
      database: { transaction: vi.fn(async (operation) => operation(transaction)) },
    } as unknown as DatabaseClient;
    const service = new PasswordAuthService({ databaseClient, sessionSecret: 's'.repeat(32) });

    await expect(
      service.changePassword(
        { cloudbaseUid: 'password_user-1' },
        { currentPassword: 'wrong', newPassword: 'changed-password' },
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(updateWhere).not.toHaveBeenCalled();

    await expect(
      service.changePassword(
        { cloudbaseUid: 'password_user-1' },
        { currentPassword: '123', newPassword: 'changed-password' },
      ),
    ).resolves.toEqual({ passwordChanged: true });
    expect(updateWhere).toHaveBeenCalledOnce();
    if (typeof replacementHash !== 'string') throw new Error('replacement hash was not written');
    expect(await verifyPassword('123', replacementHash)).toBe(false);
    expect(await verifyPassword('changed-password', replacementHash)).toBe(true);
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'password_changed', actorUserId: 'user-1' }),
    );
  });
});

function createLockedSelect(rows: readonly unknown[]) {
  const chain = {
    for: vi.fn().mockResolvedValue(rows),
    from: vi.fn(),
    innerJoin: vi.fn(),
    limit: vi.fn(),
    where: vi.fn(),
  };
  chain.from.mockReturnValue(chain);
  chain.innerJoin.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return chain;
}
