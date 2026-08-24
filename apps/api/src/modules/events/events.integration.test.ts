import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import {
  auditLogs,
  createTestDatabaseClient,
  groups,
  migrateDatabase,
  scheduleEvents,
  users,
  withTransaction,
  type DatabaseClient,
  type DatabaseConnectionOptions,
} from '@schedule/database';
import { eq, sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AuditWriter } from '../audit/audit-writer.js';
import { EventQuery } from './event-query.js';
import { EventWriter } from './event-writer.js';

const migrationsDirectory = fileURLToPath(new URL('../../../../../migrations', import.meta.url));
const databaseOptions = getTestDatabaseOptions();
const describeWithDatabase = databaseOptions === undefined ? describe.skip : describe;

describeWithDatabase('immutable schedule events and security audits', () => {
  let client: DatabaseClient;
  let otherGroupId: string;
  let ownerUserId: string;
  let primaryGroupId: string;

  beforeEach(async () => {
    client = createTestDatabaseClient(databaseOptions as DatabaseConnectionOptions);
    await resetDatabase(client);
    await migrateDatabase(client, migrationsDirectory);

    ownerUserId = randomUUID();
    primaryGroupId = randomUUID();
    otherGroupId = randomUUID();
    await client.database.insert(users).values({
      cloudbaseUid: 'cloudbase-event-owner',
      id: ownerUserId,
    });
    await client.database.insert(groups).values([
      {
        groupCode: '1234',
        id: primaryGroupId,
        name: 'Primary event group',
        ownerUserId,
      },
      {
        groupCode: '5678',
        id: otherGroupId,
        name: 'Other event group',
        ownerUserId,
      },
    ]);
  });

  afterEach(async () => {
    await client.close();
  });

  it('rolls back an appended event with its enclosing business transaction', async () => {
    const eventWriter = new EventWriter();
    const operationId = randomUUID();

    await expect(
      withTransaction(client, async (transaction) => {
        await transaction
          .update(groups)
          .set({ rulesVersion: sql`${groups.rulesVersion} + 1` })
          .where(eq(groups.id, primaryGroupId));
        await eventWriter.append(transaction, createEventInput(operationId));
        throw new Error('force rollback');
      }),
    ).rejects.toThrow('force rollback');

    const [eventCount] = await client.database.execute<{ count: number }>(
      sql`SELECT COUNT(*) AS count FROM schedule_events`,
    );
    const [group] = await client.database
      .select({ rulesVersion: groups.rulesVersion })
      .from(groups)
      .where(eq(groups.id, primaryGroupId));

    expect(eventCount).toEqual([{ count: 0 }]);
    expect(group).toEqual({ rulesVersion: 1 });
  });

  it('keeps corrections as separate appended business events and audit records', async () => {
    const eventWriter = new EventWriter();
    const auditWriter = new AuditWriter();
    const eventId = await withTransaction(client, (transaction) =>
      eventWriter.append(transaction, createEventInput(randomUUID())),
    );
    const correctionId = await withTransaction(client, (transaction) =>
      eventWriter.append(transaction, {
        ...createEventInput(randomUUID()),
        eventType: 'schedule_role_corrected',
        parentEventId: eventId,
      }),
    );
    const auditLogId = await withTransaction(client, (transaction) =>
      auditWriter.append(transaction, {
        action: 'group_code_regenerated',
        actorUserId: ownerUserId,
        groupId: primaryGroupId,
        metadata: { source: 'test' },
        operationId: randomUUID(),
        outcome: 'success',
      }),
    );

    const events = await client.database
      .select({ id: scheduleEvents.id, parentEventId: scheduleEvents.parentEventId })
      .from(scheduleEvents)
      .where(eq(scheduleEvents.groupId, primaryGroupId));
    const [auditLog] = await client.database
      .select({ action: auditLogs.action, id: auditLogs.id })
      .from(auditLogs)
      .where(eq(auditLogs.id, auditLogId));

    expect(events).toEqual(
      expect.arrayContaining([
        { id: eventId, parentEventId: null },
        { id: correctionId, parentEventId: eventId },
      ]),
    );
    expect(auditLog).toEqual({ action: 'group_code_regenerated', id: auditLogId });
    expect(Object.getOwnPropertyNames(EventWriter.prototype).sort()).toEqual([
      'append',
      'constructor',
    ]);
    expect(Object.getOwnPropertyNames(AuditWriter.prototype).sort()).toEqual([
      'append',
      'constructor',
    ]);
  });

  it('paginates constrained event queries by group, date, member, and event type', async () => {
    const eventWriter = new EventWriter();
    const membershipId = randomUUID();

    await withTransaction(client, async (transaction) => {
      await eventWriter.append(transaction, {
        ...createEventInput(randomUUID()),
        affectedMembershipIds: [membershipId],
        eventType: 'schedule_role_changed',
        occurredAt: new Date('2026-08-01T08:00:00.000Z'),
      });
      await eventWriter.append(transaction, {
        ...createEventInput(randomUUID()),
        affectedMembershipIds: [membershipId],
        eventType: 'rotation_order_changed',
        occurredAt: new Date('2026-08-02T08:00:00.000Z'),
      });
      await eventWriter.append(transaction, {
        ...createEventInput(randomUUID()),
        affectedMembershipIds: [randomUUID()],
        eventType: 'shift_type_changed',
        occurredAt: new Date('2026-08-03T08:00:00.000Z'),
      });
      await eventWriter.append(transaction, {
        ...createEventInput(randomUUID(), otherGroupId),
        eventType: 'rotation_order_changed',
        occurredAt: new Date('2026-08-04T08:00:00.000Z'),
      });
    });

    const eventQuery = new EventQuery(client);
    const filtered = await eventQuery.list({
      eventTypes: ['rotation_order_changed'],
      from: '2026-08-02T00:00:00.000Z',
      groupId: primaryGroupId,
      membershipId,
      to: '2026-08-02T23:59:59.999Z',
    });
    const firstPage = await eventQuery.list({ groupId: primaryGroupId, pageSize: 1 });

    if (firstPage.nextCursor === undefined) {
      throw new Error('Expected the first page to include a cursor.');
    }

    const secondPage = await eventQuery.list({
      cursor: firstPage.nextCursor,
      groupId: primaryGroupId,
      pageSize: 1,
    });

    expect(filtered.events).toHaveLength(1);
    expect(filtered.events[0]).toMatchObject({
      eventType: 'rotation_order_changed',
      groupId: primaryGroupId,
    });
    expect(firstPage.events).toHaveLength(1);
    expect(firstPage.nextCursor).toEqual(expect.any(String));
    expect(secondPage.events).toHaveLength(1);
    expect(secondPage.events[0]?.id).not.toBe(firstPage.events[0]?.id);
    await expect(eventQuery.list({ groupId: primaryGroupId, pageSize: 101 })).rejects.toMatchObject(
      {
        code: 'VALIDATION_FAILED',
        statusCode: 400,
      },
    );
  });

  it('redacts sensitive security-audit metadata before persistence', async () => {
    const auditWriter = new AuditWriter();
    const auditLogId = await withTransaction(client, (transaction) =>
      auditWriter.append(transaction, {
        action: 'login_failed',
        metadata: {
          accessToken: 'access-token',
          authorization: 'Bearer secret',
          mobile: '13911112222',
          mobilePhone: '13800000000',
          password: 'plaintext-password',
          phone: '13711112222',
          phoneNumber: '13611112222',
          refreshToken: 'refresh-token',
          request: { authorization: 'Bearer nested', telephone: '010-12345678' },
          shortPhone: '6666',
          telephone: '010-87654321',
          token: 'nested-token',
          username: 'doctor',
        },
        operationId: randomUUID(),
        outcome: 'failure',
      }),
    );
    const [auditLog] = await client.database
      .select({ metadata: auditLogs.metadata })
      .from(auditLogs)
      .where(eq(auditLogs.id, auditLogId));

    expect(auditLog?.metadata).toEqual({
      accessToken: '[REDACTED]',
      authorization: '[REDACTED]',
      mobile: '[REDACTED]',
      mobilePhone: '[REDACTED]',
      password: '[REDACTED]',
      phone: '[REDACTED]',
      phoneNumber: '[REDACTED]',
      refreshToken: '[REDACTED]',
      request: { authorization: '[REDACTED]', telephone: '[REDACTED]' },
      shortPhone: '[REDACTED]',
      telephone: '[REDACTED]',
      token: '[REDACTED]',
      username: 'doctor',
    });
  });

  function createEventInput(operationId: string, groupId = primaryGroupId) {
    return {
      affectedShiftIds: [randomUUID()],
      afterData: { state: 'after' },
      beforeData: { state: 'before' },
      eventStatus: 'completed',
      eventType: 'schedule_role_changed',
      groupId,
      initiatedByUserId: ownerUserId,
      objectId: randomUUID(),
      objectType: 'schedule_role',
      operationId,
      operatorUserId: ownerUserId,
      reason: 'Task 11 integration test',
      statisticsDelta: { plannedAssignments: 1 },
    };
  }
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
  await client.database.execute(sql`DROP TABLE IF EXISTS directory_search_aliases`);
  await client.database.execute(sql`DROP TABLE IF EXISTS directory_contact_methods`);
  await client.database.execute(sql`DROP TABLE IF EXISTS directory_entries`);
  await client.database.execute(sql`DROP TABLE IF EXISTS directory_source_documents`);
  await client.database.execute(sql`DROP TABLE IF EXISTS directory_import_batches`);
  await client.database.execute(sql`DROP TABLE IF EXISTS directory_campuses`);
  await client.database.execute(sql`DROP TABLE IF EXISTS invite_tokens`);
  await client.database.execute(sql`DROP TABLE IF EXISTS miniprogram_telemetry_events`);
  await client.database.execute(sql`DROP TABLE IF EXISTS visitor_access_monthly_aggregates`);
  await client.database.execute(sql`DROP TABLE IF EXISTS visitor_access_logs`);
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
  await client.database.execute(sql`DROP TABLE IF EXISTS wechat_admin_binding_tickets`);
  await client.database.execute(sql`DROP TABLE IF EXISTS wechat_identity_detachments`);
  await client.database.execute(sql`DROP TABLE IF EXISTS wechat_link_tokens`);
  await client.database.execute(sql`DROP TABLE IF EXISTS wechat_union_accounts`);
  await client.database.execute(sql`DROP TABLE IF EXISTS user_auth_identities`);
  await client.database.execute(sql`DROP TABLE IF EXISTS user_password_credentials`);
  await client.database.execute(sql`DROP TABLE IF EXISTS users`);
  await client.database.execute(sql`DROP TABLE IF EXISTS __drizzle_migrations`);
  await client.database.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
}
