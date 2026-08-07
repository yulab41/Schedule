import { sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createDatabaseClient,
  withTransaction,
  type DatabaseClient,
  type DatabaseConnectionOptions,
} from '../src/index.js';

const databaseOptions = getTestDatabaseOptions();
const describeWithDatabase = databaseOptions === undefined ? describe.skip : describe;

describeWithDatabase('database client session initialization', () => {
  let client: DatabaseClient;

  beforeEach(async () => {
    client = createDatabaseClient({
      ...(databaseOptions as DatabaseConnectionOptions),
      connectionLimit: 2,
    });
  });

  afterEach(async () => {
    await client.close();
  });

  it('initializes every pooled connection to UTC before any query', async () => {
    const [first, second] = await Promise.all([
      client.database.execute(sql`SELECT @@session.time_zone AS timeZone`),
      client.database.execute(sql`SELECT @@session.time_zone AS timeZone`),
    ]);

    expect(first[0]).toEqual([{ timeZone: '+00:00' }]);
    expect(second[0]).toEqual([{ timeZone: '+00:00' }]);
  });

  it('initializes the connection used by transactions to UTC before begin', async () => {
    const [rows] = await withTransaction(client, (transaction) =>
      transaction.execute(sql`SELECT @@session.time_zone AS timeZone`),
    );

    expect(rows).toEqual([{ timeZone: '+00:00' }]);
  });
});

function getTestDatabaseOptions(): DatabaseConnectionOptions | undefined {
  if (process.env.NODE_ENV !== 'test') {
    return undefined;
  }

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
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65_535
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
