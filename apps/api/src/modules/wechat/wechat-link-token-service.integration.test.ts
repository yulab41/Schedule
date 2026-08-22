import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import {
  createTestDatabaseClient,
  migrateDatabase,
  type DatabaseClient,
  type DatabaseConnectionOptions,
} from '@schedule/database';
import { sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { WechatLinkTokenService } from './wechat-link-token-service.js';

const migrationsDirectory = fileURLToPath(new URL('../../../../../migrations', import.meta.url));
const databaseOptions = getTestDatabaseOptions();
const describeWithDatabase = databaseOptions === undefined ? describe.skip : describe;

describeWithDatabase('WeChat link token service', () => {
  let client: DatabaseClient;
  let now: Date;
  let service: WechatLinkTokenService;

  beforeEach(async () => {
    client = createTestDatabaseClient(databaseOptions as DatabaseConnectionOptions);
    await resetDatabase(client);
    await migrateDatabase(client, migrationsDirectory);
    now = new Date('2026-08-22T10:00:00.000Z');
    service = new WechatLinkTokenService({ databaseClient: client, now: () => now });
  });

  afterEach(async () => {
    await client.close();
  });

  it('stores only the hash and consumes a valid token exactly once', async () => {
    const issued = await service.issue({
      appId: 'mini-app-id',
      existingUserId: undefined,
      subject: 'openid-1',
      unionId: 'union-1',
    });
    expect(issued.expiresAt).toBe('2026-08-22T10:10:00.000Z');

    const [rows] = (await client.database.execute(sql`
      SELECT token_hash AS tokenHash FROM wechat_link_tokens
    `)) as unknown as [{ tokenHash: string }[], unknown];
    expect(rows).toEqual([{ tokenHash: sha256(issued.linkToken) }]);
    expect(rows[0]?.tokenHash).not.toBe(issued.linkToken);

    await expect(service.consume(issued.linkToken)).resolves.toMatchObject({
      appId: 'mini-app-id',
      existingUserId: undefined,
      subject: 'openid-1',
      unionId: 'union-1',
    });
    await expect(service.consume(issued.linkToken)).rejects.toMatchObject({
      code: 'WECHAT_LINK_TOKEN_USED',
    });
    await expect(service.consume(`${issued.linkToken}x`)).rejects.toMatchObject({
      code: 'WECHAT_LINK_TOKEN_INVALID',
    });
  });

  it('allows only one concurrent consumer', async () => {
    const issued = await service.issue({
      appId: 'mini-app-id',
      existingUserId: undefined,
      subject: 'openid-concurrent',
      unionId: undefined,
    });
    const results = await Promise.allSettled([
      service.consume(issued.linkToken),
      service.consume(issued.linkToken),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
  });

  it('rolls token consumption back when the linked identity operation fails', async () => {
    const issued = await service.issue({
      appId: 'mini-app-id',
      existingUserId: undefined,
      subject: 'openid-rollback',
      unionId: undefined,
    });

    await expect(
      service.consume(issued.linkToken, async () => {
        throw new Error('force linked operation rollback');
      }),
    ).rejects.toThrow('force linked operation rollback');
    await expect(service.consume(issued.linkToken)).resolves.toMatchObject({
      subject: 'openid-rollback',
    });
  });

  it('rejects expiry without exposing the stored identity', async () => {
    const issued = await service.issue({
      appId: 'mini-app-id',
      existingUserId: undefined,
      subject: 'openid-expired',
      unionId: undefined,
    });
    now = new Date('2026-08-22T10:10:00.001Z');
    await expect(service.consume(issued.linkToken)).rejects.toMatchObject({
      code: 'WECHAT_LINK_TOKEN_EXPIRED',
    });
  });
});

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function getTestDatabaseOptions(): DatabaseConnectionOptions | undefined {
  if (process.env.NODE_ENV !== 'test') return undefined;
  const {
    TEST_MYSQL_DATABASE,
    TEST_MYSQL_HOST,
    TEST_MYSQL_PASSWORD,
    TEST_MYSQL_PORT,
    TEST_MYSQL_USER,
  } = process.env;
  const port = Number(TEST_MYSQL_PORT ?? '3307');
  if (
    TEST_MYSQL_DATABASE === undefined ||
    TEST_MYSQL_PASSWORD === undefined ||
    TEST_MYSQL_USER === undefined ||
    !Number.isInteger(port)
  ) {
    return undefined;
  }
  return {
    database: TEST_MYSQL_DATABASE,
    host: TEST_MYSQL_HOST ?? '127.0.0.1',
    password: TEST_MYSQL_PASSWORD,
    port,
    user: TEST_MYSQL_USER,
  };
}

async function resetDatabase(client: DatabaseClient): Promise<void> {
  await client.database.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
  const [tables] = (await client.database.execute(sql`
    SELECT TABLE_NAME AS tableName
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
  `)) as unknown as [readonly { tableName: string }[], unknown];
  for (const row of tables) {
    await client.database.execute(
      sql.raw(`DROP TABLE IF EXISTS \`${row.tableName.replaceAll('`', '``')}\``),
    );
  }
  await client.database.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
}
