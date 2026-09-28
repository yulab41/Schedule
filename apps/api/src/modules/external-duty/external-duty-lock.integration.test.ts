import { fileURLToPath } from 'node:url';

import {
  createTestDatabaseClient,
  migrateDatabase,
  type DatabaseConnectionOptions,
  withTransaction,
} from '@schedule/database';
import { describe, expect, it } from 'vitest';

import { lockExternalDutyGroup } from './external-duty-service.js';

const options: DatabaseConnectionOptions | undefined =
  process.env.NODE_ENV === 'test' &&
  process.env.TEST_MYSQL_DATABASE === 'schedule_test' &&
  ['127.0.0.1', 'localhost', '::1'].includes(process.env.TEST_MYSQL_HOST ?? '127.0.0.1') &&
  process.env.TEST_MYSQL_USER &&
  process.env.TEST_MYSQL_PASSWORD
    ? {
        host: process.env.TEST_MYSQL_HOST ?? '127.0.0.1',
        port: Number(process.env.TEST_MYSQL_PORT ?? '3307'),
        database: 'schedule_test',
        user: process.env.TEST_MYSQL_USER,
        password: process.env.TEST_MYSQL_PASSWORD,
      }
    : undefined;

const describeWithDatabase = options ? describe : describe.skip;
const migrationsDirectory = fileURLToPath(new URL('../../../../../migrations', import.meta.url));

describeWithDatabase('external duty scan transaction lock', () => {
  it('uses a valid MySQL row lock on the group table', async () => {
    const client = createTestDatabaseClient(options!);
    try {
      await migrateDatabase(client, migrationsDirectory);
      await expect(
        withTransaction(client, (transaction) =>
          lockExternalDutyGroup(transaction, '00000000-0000-4000-8000-000000000000'),
        ),
      ).resolves.toBeUndefined();
    } finally {
      await client.close();
    }
  });
});
