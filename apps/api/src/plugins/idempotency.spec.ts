import { describe, expect, it, vi } from 'vitest';

import type { DatabaseTransaction } from '@schedule/database';

import { withIdempotentOperation } from './idempotency.js';

function duplicateKeyError(): Error {
  return Object.assign(new Error('duplicate key'), { code: 'ER_DUP_ENTRY' });
}

function createTransaction(): {
  readonly insertValues: ReturnType<typeof vi.fn>;
  readonly transaction: DatabaseTransaction;
} {
  const insertValues = vi
    .fn()
    .mockRejectedValueOnce(duplicateKeyError())
    .mockRejectedValueOnce(duplicateKeyError());
  const transaction = {
    insert: vi.fn(() => ({ values: insertValues })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => ({
            for: vi.fn(() => Promise.resolve([])),
          })),
        })),
      })),
    })),
  } as unknown as DatabaseTransaction;

  return { insertValues, transaction };
}

describe('withIdempotentOperation', () => {
  it('stores only serialized safe data and rehydrates a secret result on replay', async () => {
    const storedSet = vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) }));
    const firstTransaction = {
      insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
      update: vi.fn(() => ({ set: storedSet })),
    } as unknown as DatabaseTransaction;
    const codec = {
      deserialize: async (stored: Record<string, unknown>) => {
        if (typeof stored['safe'] !== 'string') throw new Error('invalid stored result');
        return { safe: stored['safe'], secret: 'reissued-secret' };
      },
      serialize: (result: { readonly safe: string; readonly secret: string }) => ({
        safe: result.safe,
      }),
    };

    await expect(
      withIdempotentOperation(
        firstTransaction,
        {
          actorUserId: 'user-1',
          operationId: 'operation-1',
          requestFingerprint: 'fingerprint-1',
          scope: 'scope-1',
        },
        async () => ({ safe: 'stored', secret: 'raw-secret' }),
        codec,
      ),
    ).resolves.toEqual({ safe: 'stored', secret: 'raw-secret' });
    expect(storedSet).toHaveBeenCalledWith(expect.objectContaining({ result: { safe: 'stored' } }));

    const replayTransaction = {
      insert: vi.fn(() => ({ values: vi.fn().mockRejectedValue(duplicateKeyError()) })),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => ({
              for: vi.fn(() =>
                Promise.resolve([
                  {
                    expiresAt: new Date(Date.now() + 60_000),
                    requestFingerprint: 'fingerprint-1',
                    result: { safe: 'stored' },
                    status: 'completed',
                  },
                ]),
              ),
            })),
          })),
        })),
      })),
    } as unknown as DatabaseTransaction;

    await expect(
      withIdempotentOperation(
        replayTransaction,
        {
          actorUserId: 'user-1',
          operationId: 'operation-1',
          requestFingerprint: 'fingerprint-1',
          scope: 'scope-1',
        },
        vi.fn(async () => ({ safe: 'unused', secret: 'unused' })),
        codec,
      ),
    ).resolves.toEqual({ safe: 'stored', secret: 'reissued-secret' });
  });

  it('maps a duplicate key on the retry insert to 409 instead of a driver error', async () => {
    const { insertValues, transaction } = createTransaction();

    await expect(
      withIdempotentOperation(
        transaction,
        {
          actorUserId: 'user-1',
          operationId: 'operation-1',
          requestFingerprint: 'fingerprint-1',
          scope: 'scope-1',
        },
        async () => ({ ok: true }),
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT', statusCode: 409 });

    expect(insertValues).toHaveBeenCalledTimes(2);
  });

  it('deletes an expired completed row and allows the key to be reused with a new payload', async () => {
    const insertValues = vi
      .fn()
      .mockRejectedValueOnce(duplicateKeyError())
      .mockResolvedValueOnce(undefined);
    const deleteWhere = vi.fn().mockResolvedValue(undefined);
    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const operation = vi.fn(async () => ({ generation: 2 }));
    const transaction = {
      delete: vi.fn(() => ({ where: deleteWhere })),
      insert: vi.fn(() => ({ values: insertValues })),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => ({
              for: vi.fn(() =>
                Promise.resolve([
                  {
                    actorUserId: 'user-1',
                    completedAt: new Date(Date.now() - 60_000),
                    expiresAt: new Date(Date.now() - 1),
                    operationKey: 'operation-1',
                    requestFingerprint: 'old-fingerprint',
                    result: { generation: 1 },
                    scope: 'scope-1',
                    status: 'completed',
                  },
                ]),
              ),
            })),
          })),
        })),
      })),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: updateWhere })) })),
    } as unknown as DatabaseTransaction;

    await expect(
      withIdempotentOperation(
        transaction,
        {
          actorUserId: 'user-1',
          operationId: 'operation-1',
          requestFingerprint: 'new-fingerprint',
          scope: 'scope-1',
        },
        operation,
      ),
    ).resolves.toEqual({ generation: 2 });

    expect(deleteWhere).toHaveBeenCalledTimes(1);
    expect(insertValues).toHaveBeenCalledTimes(2);
    expect(operation).toHaveBeenCalledTimes(1);
    expect(updateWhere).toHaveBeenCalledTimes(1);
  });
});
