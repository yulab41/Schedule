import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

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
          AND table_name IN ('users', 'user_profiles', 'groups', 'roster_entries', 'group_memberships', 'group_member_contacts', 'idempotency_keys', 'group_code_attempts', 'guest_schedule_access_attempts', 'group_join_requests', 'membership_claim_requests', 'schedule_roles', 'member_schedule_roles', 'shift_types', 'rotation_rules', 'rotation_members', 'schedule_events', 'audit_logs', 'schedule_periods', 'shift_assignments', 'manual_schedule_templates', 'manual_schedule_template_members', 'manual_schedule_cells', 'leave_requests', 'swap_requests', 'duty_adjustments', 'workflow_sequence_allocations', 'notifications', 'notification_deliveries', 'notification_settings', 'notification_preferences', 'web_push_subscriptions', 'notification_batches', 'holiday_calendar_versions', 'holiday_dates', 'statistics_snapshots', 'statistics_recalc_checks', 'export_jobs', 'platform_job_runs', 'backup_archives')`,
    );

    expect(migrations).toEqual([{ count: 32 }]);
    expect(tables).toEqual([{ count: 40 }]);
  });

  it('accepts the guest membership role after migration 0032', async () => {
    await migrateDatabase(client, migrationsDirectory);
    const ownerId = randomUUID();
    const groupId = randomUUID();

    await client.database.execute(sql`INSERT INTO users (id) VALUES (${ownerId})`);
    await client.database.execute(sql`
      INSERT INTO \`groups\` (id, name, group_code, owner_user_id)
      VALUES (${groupId}, 'Guest Group', '1234', ${ownerId})
    `);
    await client.database.execute(sql`
      INSERT INTO group_memberships (id, group_id, user_id, role)
      VALUES (${randomUUID()}, ${groupId}, ${ownerId}, 'guest')
    `);
  });

  it('allows identity detachment through a nullable cloudbase UID', async () => {
    await migrateDatabase(client, migrationsDirectory);
    const userId = randomUUID();

    await client.database.execute(sql`INSERT INTO users (id) VALUES (${userId})`);

    const [rows] = (await client.database.execute(
      sql`SELECT cloudbase_uid FROM users WHERE id = ${userId}`,
    )) as unknown as [{ cloudbase_uid: string | null }[], unknown];
    expect(rows[0]?.cloudbase_uid).toBeNull();
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

  it('pins explicit defaults for leave request timestamps to prevent ON UPDATE drift', async () => {
    await migrateDatabase(client, migrationsDirectory);
    const rows = (
      await client.database.execute(sql`
        SELECT EXTRA AS extra
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'leave_requests'
          AND COLUMN_NAME = 'starts_at'
      `)
    )[0] as unknown as readonly { extra: string }[];
    expect(rows[0]?.extra).not.toContain('on update');
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

  it('backfills workflow sequences from one ranking in allocator order', async () => {
    await migrateDatabase(client, migrationsDirectory);
    await client.database.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
    try {
      await insertSwap(client, 'swap-latest', new Date('2026-08-01T00:00:00.000Z'));
      await insertDuty(client, 'duty-middle', new Date('2026-07-31T00:00:00.000Z'));
      await insertSwap(client, 'swap-earliest', new Date('2026-07-30T00:00:00.000Z'));
      // 模拟 0029 在已有数据上的播种：顺序必须与回填排序一致。
      await client.database.execute(sql`
        INSERT INTO workflow_sequence_allocations (allocated_at)
        SELECT created_at
        FROM (
          SELECT id, created_at, 0 AS workflow_kind FROM swap_requests
          UNION ALL
          SELECT id, created_at, 1 AS workflow_kind FROM duty_adjustments
        ) AS existing_workflows
        ORDER BY created_at ASC, workflow_kind ASC, id ASC
      `);
      await runMigrationFile(client, '0030_backfill_swap_workflow_sequence');
      await runMigrationFile(client, '0031_backfill_duty_adjustment_workflow_sequence');
    } finally {
      await client.database.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
    }

    const [rows] = (await client.database.execute(sql`
      SELECT 'swap' AS kind, id, workflow_sequence FROM swap_requests
      UNION ALL
      SELECT 'duty', id, workflow_sequence FROM duty_adjustments
      ORDER BY workflow_sequence
    `)) as unknown as [{ id: string; kind: string; workflow_sequence: number }[], unknown];
    expect(rows.map((row) => `${row.kind}:${row.id}`)).toEqual([
      'swap:swap-earliest',
      'duty:duty-middle',
      'swap:swap-latest',
    ]);
    expect(rows.map((row) => row.workflow_sequence)).toEqual([1, 2, 3]);

    const [allocations] = (await client.database.execute(
      sql`SELECT MAX(id) AS max_id FROM workflow_sequence_allocations`,
    )) as unknown as [{ max_id: number | null }[], unknown];
    expect(allocations[0]?.max_id).toBe(3);
  });

  it('rejects workflow sequence backfills that overlap future allocations', async () => {
    await migrateDatabase(client, migrationsDirectory);
    await client.database.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
    try {
      await insertSwap(client, 'swap-a', new Date('2026-08-01T00:00:00.000Z'));
      await insertSwap(client, 'swap-b', new Date('2026-07-31T00:00:00.000Z'));
      await insertSwap(client, 'swap-c', new Date('2026-07-30T00:00:00.000Z'));
      // 只播种两条分配，模拟 0029 之后、回填之前又产生了一条工作流。
      await client.database.execute(sql`
        INSERT INTO workflow_sequence_allocations (allocated_at)
        VALUES
          ('2026-07-30 00:00:00.000'),
          ('2026-07-31 00:00:00.000')
      `);
      await runMigrationFile(client, '0030_backfill_swap_workflow_sequence');
      await expect(
        runMigrationFile(client, '0031_backfill_duty_adjustment_workflow_sequence'),
      ).rejects.toThrow(/Failed query: INSERT INTO `_workflow_sequence_validation`/);
    } finally {
      await client.database.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
    }
  });
});

async function runMigrationFile(client: DatabaseClient, migrationName: string): Promise<void> {
  const filePath = join(migrationsDirectory, `${migrationName}.sql`);
  const sqlText = await readFile(filePath, 'utf8');
  for (const statement of sqlText.split('--> statement-breakpoint')) {
    const trimmed = statement.trim();
    if (trimmed.length > 0) {
      await client.database.execute(sql.raw(trimmed));
    }
  }
}

async function insertSwap(client: DatabaseClient, id: string, createdAt: Date): Promise<void> {
  const foreignId = randomUUID();
  await client.database.execute(sql`
    INSERT INTO swap_requests (
      id, group_id, initiator_membership_id, target_membership_id,
      initiator_assignment_id, target_assignment_id,
      initiator_assignment_version, target_assignment_version,
      status, created_at
    )
    VALUES (
      ${id}, ${foreignId}, ${foreignId}, ${foreignId},
      ${foreignId}, ${foreignId}, 1, 1,
      'completed', ${createdAt}
    )
  `);
}

async function insertDuty(client: DatabaseClient, id: string, createdAt: Date): Promise<void> {
  const foreignId = randomUUID();
  await client.database.execute(sql`
    INSERT INTO duty_adjustments (
      id, group_id, covered_assignment_id, overtime_membership_id,
      deducted_membership_id, assignment_version, status, created_at
    )
    VALUES (
      ${id}, ${foreignId}, ${foreignId}, ${foreignId},
      ${foreignId}, 1, 'completed', ${createdAt}
    )
  `);
}

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
  await client.database.execute(sql`DROP TABLE IF EXISTS backup_archives`);
  await client.database.execute(sql`DROP TABLE IF EXISTS platform_job_runs`);
  await client.database.execute(sql`DROP TABLE IF EXISTS manual_schedule_cells`);
  await client.database.execute(sql`DROP TABLE IF EXISTS manual_schedule_template_members`);
  await client.database.execute(sql`DROP TABLE IF EXISTS manual_schedule_templates`);
  await client.database.execute(sql`DROP TABLE IF EXISTS duty_adjustments`);
  await client.database.execute(sql`DROP TABLE IF EXISTS workflow_sequence_allocations`);
  await client.database.execute(sql`DROP TABLE IF EXISTS notification_deliveries`);
  await client.database.execute(sql`DROP TABLE IF EXISTS notifications`);
  await client.database.execute(sql`DROP TABLE IF EXISTS notification_preferences`);
  await client.database.execute(sql`DROP TABLE IF EXISTS notification_settings`);
  await client.database.execute(sql`DROP TABLE IF EXISTS web_push_subscriptions`);
  await client.database.execute(sql`DROP TABLE IF EXISTS notification_batches`);
  await client.database.execute(sql`DROP TABLE IF EXISTS holiday_dates`);
  await client.database.execute(sql`DROP TABLE IF EXISTS holiday_calendar_versions`);
  await client.database.execute(sql`DROP TABLE IF EXISTS statistics_recalc_checks`);
  await client.database.execute(sql`DROP TABLE IF EXISTS statistics_snapshots`);
  await client.database.execute(sql`DROP TABLE IF EXISTS export_jobs`);
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
  await client.database.execute(sql`DROP TABLE IF EXISTS guest_schedule_access_attempts`);
  await client.database.execute(sql`DROP TABLE IF EXISTS membership_claim_requests`);
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
