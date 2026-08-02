import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createTestDatabaseClient,
  groupMemberContacts,
  groupMemberships,
  migrateDatabase,
  users,
  withTransaction,
  type DatabaseClient,
  type DatabaseConnectionOptions,
} from '../src/index.js';

const migrationsDirectory = fileURLToPath(new URL('../../../migrations', import.meta.url));
const databaseOptions = getTestDatabaseOptions();
const describeWithDatabase = databaseOptions === undefined ? describe.skip : describe;

describeWithDatabase('identity and group migrations', () => {
  let client: DatabaseClient;

  beforeEach(async () => {
    client = createTestDatabaseClient(databaseOptions as DatabaseConnectionOptions);
    await resetDatabase(client);
  });

  afterEach(async () => {
    await client.close();
  });

  it('migrates an empty database and records no duplicate migration on rerun', async () => {
    await migrateDatabase(client, migrationsDirectory);
    await migrateDatabase(client, migrationsDirectory);

    const [migrations] = await client.database.execute<{ count: number }>(
      sql`SELECT COUNT(*) AS count FROM __drizzle_migrations`,
    );
    const [tables] = await client.database.execute<{ count: number }>(
      sql`SELECT COUNT(*) AS count
          FROM information_schema.tables
          WHERE table_schema = DATABASE()
          AND table_name IN ('users', 'user_profiles', 'groups', 'roster_entries', 'group_memberships', 'group_member_contacts', 'idempotency_keys', 'group_code_attempts', 'group_join_requests', 'schedule_roles', 'member_schedule_roles', 'shift_types', 'rotation_rules', 'rotation_members', 'schedule_events', 'audit_logs', 'schedule_periods', 'shift_assignments', 'manual_schedule_templates', 'manual_schedule_template_members', 'manual_schedule_cells', 'leave_requests', 'swap_requests', 'duty_adjustments')`,
    );

    expect(migrations).toEqual([{ count: 10 }]);
    expect(tables).toEqual([{ count: 24 }]);
  });

  it('uses UTC for every MySQL session', async () => {
    const [timeZone] = await client.database.execute<{ timeZone: string }>(
      sql`SELECT @@session.time_zone AS timeZone`,
    );

    expect(timeZone).toEqual([{ timeZone: '+00:00' }]);
  });

  it('rejects an unmanaged schema instead of recording a migration over it', async () => {
    await client.database.execute(sql`
      CREATE TABLE users (
        id CHAR(36) NOT NULL,
        PRIMARY KEY (id)
      )
    `);

    await expect(migrateDatabase(client, migrationsDirectory)).rejects.toThrow();
  });

  it('matches the unsigned tinyint columns in the migration', () => {
    expect(groupMemberships.autoAcceptSwaps.getSQLType()).toBe('tinyint unsigned');
    expect(groupMemberContacts.isConfirmed.getSQLType()).toBe('tinyint unsigned');
  });

  it('enforces active group codes and pending roster names in the database', async () => {
    await migrateDatabase(client, migrationsDirectory);

    const ownerUserId = randomUUID();
    const firstGroupId = randomUUID();
    await client.database.execute(sql`
      INSERT INTO users (id, cloudbase_uid)
      VALUES (${ownerUserId}, 'cloudbase-owner')
    `);
    await client.database.execute(sql`
      INSERT INTO \`groups\` (id, name, group_code, owner_user_id)
      VALUES (${firstGroupId}, 'First group', '1234', ${ownerUserId})
    `);
    await client.database.execute(sql`
      UPDATE \`groups\`
      SET deleted_at = CURRENT_TIMESTAMP(3)
      WHERE id = ${firstGroupId}
    `);

    await expect(
      client.database.execute(sql`
        INSERT INTO \`groups\` (id, name, group_code, owner_user_id)
        VALUES (${randomUUID()}, 'Second group', '1234', ${ownerUserId})
      `),
    ).rejects.toThrow();

    await client.database.execute(sql`
      INSERT INTO roster_entries (id, group_id, real_name)
      VALUES (${randomUUID()}, ${firstGroupId}, 'Wang Li')
    `);

    await expect(
      client.database.execute(sql`
        INSERT INTO roster_entries (id, group_id, real_name)
        VALUES (${randomUUID()}, ${firstGroupId}, 'Wang Li')
      `),
    ).rejects.toThrow();
  });

  it('rolls back a failed operation through the shared transaction helper', async () => {
    await migrateDatabase(client, migrationsDirectory);
    const userId = randomUUID();

    await expect(
      withTransaction(client, async (transaction) => {
        await transaction.insert(users).values({
          cloudbaseUid: 'cloudbase-rollback',
          id: userId,
        });
        throw new Error('force rollback');
      }),
    ).rejects.toThrow('force rollback');

    const [usersAfterRollback] = await client.database.execute<{ count: number }>(
      sql`SELECT COUNT(*) AS count FROM users WHERE id = ${userId}`,
    );

    expect(usersAfterRollback).toEqual([{ count: 0 }]);
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

async function resetDatabase(client: DatabaseClient): Promise<void> {
  await client.database.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
  await client.database.execute(sql`DROP TABLE IF EXISTS manual_schedule_cells`);
  await client.database.execute(sql`DROP TABLE IF EXISTS manual_schedule_template_members`);
  await client.database.execute(sql`DROP TABLE IF EXISTS manual_schedule_templates`);
  await client.database.execute(sql`DROP TABLE IF EXISTS duty_adjustments`);
  await client.database.execute(sql`DROP TABLE IF EXISTS shift_assignments`);
  await client.database.execute(sql`DROP TABLE IF EXISTS schedule_periods`);
  await client.database.execute(sql`DROP TABLE IF EXISTS audit_logs`);
  await client.database.execute(sql`DROP TABLE IF EXISTS schedule_events`);
  await client.database.execute(sql`DROP TABLE IF EXISTS rotation_members`);
  await client.database.execute(sql`DROP TABLE IF EXISTS rotation_rules`);
  await client.database.execute(sql`DROP TABLE IF EXISTS shift_types`);
  await client.database.execute(sql`DROP TABLE IF EXISTS member_schedule_roles`);
  await client.database.execute(sql`DROP TABLE IF EXISTS schedule_roles`);
  await client.database.execute(sql`DROP TABLE IF EXISTS group_join_requests`);
  await client.database.execute(sql`DROP TABLE IF EXISTS group_code_attempts`);
  await client.database.execute(sql`DROP TABLE IF EXISTS group_member_contacts`);
  await client.database.execute(sql`DROP TABLE IF EXISTS leave_requests`);
  await client.database.execute(sql`DROP TABLE IF EXISTS swap_requests`);
  await client.database.execute(sql`DROP TABLE IF EXISTS group_memberships`);
  await client.database.execute(sql`DROP TABLE IF EXISTS roster_entries`);
  await client.database.execute(sql`DROP TABLE IF EXISTS idempotency_keys`);
  await client.database.execute(sql`DROP TABLE IF EXISTS \`groups\``);
  await client.database.execute(sql`DROP TABLE IF EXISTS user_profiles`);
  await client.database.execute(sql`DROP TABLE IF EXISTS users`);
  await client.database.execute(sql`DROP TABLE IF EXISTS __drizzle_migrations`);
  await client.database.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
}
