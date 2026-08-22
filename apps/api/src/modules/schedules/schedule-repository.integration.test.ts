import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import {
  createDatabaseClient,
  createTestDatabaseClient,
  groups,
  groupMemberships,
  migrateDatabase,
  scheduleEvents,
  schedulePeriods,
  scheduleRoles,
  shiftAssignments,
  shiftTypes,
  swapRequests,
  userProfiles,
  users,
  withTransaction,
  type DatabaseClient,
  type DatabaseConnectionOptions,
} from '@schedule/database';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ScheduleRepository } from './schedule-repository.js';
import { ScheduleWorkflowInvalidationService } from './workflow-invalidation-service.js';

const migrationsDirectory = fileURLToPath(new URL('../../../../../migrations', import.meta.url));
const databaseOptions = getTestDatabaseOptions();
const describeWithDatabase = databaseOptions === undefined ? describe.skip : describe;

describeWithDatabase('schedule period versions and shift assignment snapshots', () => {
  let client: DatabaseClient;
  let groupId: string;
  let memberId: string;
  let ownerUserId: string;
  let scheduleRoleId: string;
  let shiftTypeId: string;

  beforeEach(async () => {
    client = createTestDatabaseClient(databaseOptions as DatabaseConnectionOptions);
    await resetDatabase(client);
    await migrateDatabase(client, migrationsDirectory);

    ownerUserId = randomUUID();
    groupId = randomUUID();
    scheduleRoleId = randomUUID();
    memberId = randomUUID();
    shiftTypeId = randomUUID();
    await seedScheduleConfiguration();
  });

  afterEach(async () => {
    await client.close();
  });

  it('persists CST business dates and immutable all-day shift snapshots in UTC', async () => {
    const repository = new ScheduleRepository(client);
    const period = await repository.createDraft(createDraftInput('2028-02', '2028-02-29'));

    await client.database
      .update(shiftTypes)
      .set({ color: '#000000', configurationVersion: 2, name: 'Changed all-day shift' })
      .where(eq(shiftTypes.id, shiftTypeId));

    const [assignment] = await client.database
      .select()
      .from(shiftAssignments)
      .where(eq(shiftAssignments.schedulePeriodId, period.id));

    expect(period).toMatchObject({
      businessMonth: '2028-02-01',
      revision: 1,
      rulesVersion: 1,
      status: 'draft',
      version: 1,
    });
    expect(assignment).toMatchObject({
      actualMemberName: 'Dr. Snapshot',
      businessDate: '2028-02-29',
      countsTowardStatistics: 1,
      crossesMidnight: 1,
      endsAt: new Date('2028-03-01T00:00:00.000Z'),
      isAllDay: 1,
      plannedMemberName: 'Dr. Snapshot',
      shiftTypeColor: '#1F5AA6',
      shiftTypeConfigurationVersion: 1,
      shiftTypeName: 'All-day',
      startsAt: new Date('2028-02-29T00:00:00.000Z'),
    });
  });

  it('moves draft periods through publication, replacement, and withdrawal with linked events', async () => {
    const repository = new ScheduleRepository(client);
    const first = await repository.createDraft(createDraftInput('2026-09', '2026-09-01'));
    const pending = await repository.submitForPublication({
      actorUserId: ownerUserId,
      expectedVersion: first.version,
      operationId: randomUUID(),
      schedulePeriodId: first.id,
    });
    const published = await repository.publish({
      actorUserId: ownerUserId,
      expectedVersion: pending.version,
      operationId: randomUUID(),
      schedulePeriodId: pending.id,
    });
    const second = await repository.createDraft(createDraftInput('2026-09', '2026-09-02'));
    const replacement = await repository.publish({
      actorUserId: ownerUserId,
      expectedVersion: second.version,
      operationId: randomUUID(),
      schedulePeriodId: second.id,
    });
    const withdrawn = await repository.withdraw({
      actorUserId: ownerUserId,
      expectedVersion: replacement.version,
      operationId: randomUUID(),
      schedulePeriodId: replacement.id,
    });
    const storedPeriods = await client.database
      .select({
        id: schedulePeriods.id,
        replacedByPeriodId: schedulePeriods.replacedByPeriodId,
        status: schedulePeriods.status,
      })
      .from(schedulePeriods)
      .where(eq(schedulePeriods.groupId, groupId))
      .orderBy(schedulePeriods.revision);
    const events = await client.database
      .select({
        eventType: scheduleEvents.eventType,
        schedulePeriodId: scheduleEvents.schedulePeriodId,
      })
      .from(scheduleEvents)
      .where(eq(scheduleEvents.groupId, groupId));

    expect(published).toMatchObject({ status: 'published', version: 3 });
    expect(withdrawn).toMatchObject({ status: 'withdrawn', version: 3 });
    expect(storedPeriods).toEqual([
      { id: first.id, replacedByPeriodId: second.id, status: 'replaced' },
      { id: second.id, replacedByPeriodId: null, status: 'withdrawn' },
    ]);
    expect(events).toEqual(
      expect.arrayContaining([
        { eventType: 'schedule_period_created', schedulePeriodId: first.id },
        { eventType: 'schedule_period_published', schedulePeriodId: first.id },
        { eventType: 'schedule_period_replaced', schedulePeriodId: first.id },
        { eventType: 'schedule_period_published', schedulePeriodId: second.id },
        { eventType: 'schedule_period_withdrawn', schedulePeriodId: second.id },
      ]),
    );
  });

  it('locks past dates into a past period when publishing or withdrawing a current month', async () => {
    const repository = new ScheduleRepository(client);
    const first = await repository.createDraft(createDraftInput('2026-08', '2026-08-01'));
    const published = await repository.publish({
      actorUserId: ownerUserId,
      expectedVersion: first.version,
      operationId: randomUUID(),
      schedulePeriodId: first.id,
    });
    expect(published).toMatchObject({ status: 'published' });

    const storedAfterFirstPublish = await client.database
      .select({
        id: schedulePeriods.id,
        status: schedulePeriods.status,
      })
      .from(schedulePeriods)
      .where(eq(schedulePeriods.groupId, groupId))
      .orderBy(schedulePeriods.revision);
    expect(storedAfterFirstPublish).toEqual(
      expect.arrayContaining([
        { id: published.id, status: 'published' },
        expect.objectContaining({ status: 'past' }),
      ]),
    );
    const [publishedAssignments] = await client.database.execute<{ count: number }>(
      sql`SELECT COUNT(*) AS count FROM shift_assignments WHERE schedule_period_id = ${published.id} AND deleted_at IS NULL`,
    );
    expect(publishedAssignments).toEqual([{ count: 0 }]);
    const [pastAssignments] = await client.database.execute<{ count: number }>(
      sql`SELECT COUNT(*) AS count FROM shift_assignments sa
          INNER JOIN schedule_periods sp ON sp.id = sa.schedule_period_id
          WHERE sp.status = 'past' AND sa.deleted_at IS NULL AND sp.deleted_at IS NULL`,
    );
    expect(pastAssignments).toEqual([{ count: 1 }]);

    const second = await repository.createDraft(createDraftInput('2026-08', '2026-08-02'));
    const replacement = await repository.publish({
      actorUserId: ownerUserId,
      expectedVersion: second.version,
      operationId: randomUUID(),
      schedulePeriodId: second.id,
    });
    const withdrawn = await repository.withdraw({
      actorUserId: ownerUserId,
      expectedVersion: replacement.version,
      operationId: randomUUID(),
      schedulePeriodId: replacement.id,
    });
    expect(withdrawn).toMatchObject({ status: 'withdrawn' });
    const [pastPeriodCount] = await client.database.execute<{ count: number }>(
      sql`SELECT COUNT(*) AS count FROM schedule_periods WHERE group_id = ${groupId} AND status = 'past' AND deleted_at IS NULL`,
    );
    expect(pastPeriodCount).toEqual([{ count: 1 }]);
  });

  it('serializes concurrent publication so a group role month has one current version', async () => {
    const firstDraft = await new ScheduleRepository(client).createDraft(
      createDraftInput('2026-09', '2026-09-01'),
    );
    const secondDraft = await new ScheduleRepository(client).createDraft(
      createDraftInput('2026-09', '2026-09-02'),
    );
    const secondClient = createDatabaseClient(databaseOptions as DatabaseConnectionOptions);

    try {
      await Promise.all([
        new ScheduleRepository(client).publish({
          actorUserId: ownerUserId,
          expectedVersion: firstDraft.version,
          operationId: randomUUID(),
          schedulePeriodId: firstDraft.id,
        }),
        new ScheduleRepository(secondClient).publish({
          actorUserId: ownerUserId,
          expectedVersion: secondDraft.version,
          operationId: randomUUID(),
          schedulePeriodId: secondDraft.id,
        }),
      ]);
    } finally {
      await secondClient.close();
    }

    const currentPeriods = await client.database
      .select({ id: schedulePeriods.id, status: schedulePeriods.status })
      .from(schedulePeriods)
      .where(
        and(
          eq(schedulePeriods.groupId, groupId),
          eq(schedulePeriods.scheduleRoleId, scheduleRoleId),
          eq(schedulePeriods.businessMonth, '2026-09-01'),
          eq(schedulePeriods.status, 'published'),
          isNull(schedulePeriods.deletedAt),
        ),
      );

    expect(currentPeriods).toHaveLength(1);
  });

  it('keeps starts_at pinned when bulk-updating shift assignments', async () => {
    const repository = new ScheduleRepository(client);
    const period = await repository.createDraft({
      ...createDraftInput('2026-10', '2026-10-01'),
      assignments: [
        {
          actualMembershipId: memberId,
          businessDate: '2026-10-01',
          plannedMembershipId: memberId,
          shiftTypeId,
          slotPosition: 1,
        },
        {
          actualMembershipId: memberId,
          businessDate: '2026-10-02',
          plannedMembershipId: memberId,
          shiftTypeId,
          slotPosition: 1,
        },
      ],
    });

    // Reproduce the CynosDB hazard (explicit_defaults_for_timestamp=OFF) where a
    // TIMESTAMP column can carry an implicit ON UPDATE CURRENT_TIMESTAMP.
    await client.database.execute(sql`
      ALTER TABLE shift_assignments
      MODIFY starts_at TIMESTAMP(3) NOT NULL DEFAULT '1970-01-01 00:00:01.000'
        ON UPDATE CURRENT_TIMESTAMP(3)
    `);

    const before = await client.database
      .select({ id: shiftAssignments.id, startsAt: shiftAssignments.startsAt })
      .from(shiftAssignments)
      .where(eq(shiftAssignments.schedulePeriodId, period.id))
      .orderBy(shiftAssignments.businessDate);

    await withTransaction(client, (transaction) =>
      repository.deleteDraftInTransaction(transaction, {
        actorUserId: ownerUserId,
        groupId,
        operationId: randomUUID(),
        schedulePeriodId: period.id,
      }),
    );

    const after = await client.database
      .select({
        deletedAt: shiftAssignments.deletedAt,
        id: shiftAssignments.id,
        startsAt: shiftAssignments.startsAt,
      })
      .from(shiftAssignments)
      .where(eq(shiftAssignments.schedulePeriodId, period.id))
      .orderBy(shiftAssignments.businessDate);

    expect(after.map((row) => row.startsAt.toISOString())).toEqual(
      before.map((row) => row.startsAt.toISOString()),
    );
    expect(after.every((row) => row.deletedAt !== null)).toBe(true);
  });

  it('keeps starts_at pinned when workflow invalidation resets assignments', async () => {
    const repository = new ScheduleRepository(client);
    const period = await repository.createDraft({
      ...createDraftInput('2026-10', '2026-10-01'),
      assignments: [
        {
          actualMembershipId: memberId,
          businessDate: '2026-10-01',
          plannedMembershipId: memberId,
          shiftTypeId,
          slotPosition: 1,
        },
        {
          actualMembershipId: memberId,
          businessDate: '2026-10-02',
          plannedMembershipId: memberId,
          shiftTypeId,
          slotPosition: 1,
        },
      ],
    });
    const assignments = await client.database
      .select()
      .from(shiftAssignments)
      .where(eq(shiftAssignments.schedulePeriodId, period.id))
      .orderBy(shiftAssignments.businessDate);
    const [first, second] = assignments;
    if (first === undefined || second === undefined) {
      throw new Error('Expected two shift assignments.');
    }

    await client.database.insert(swapRequests).values({
      groupId,
      id: randomUUID(),
      initiatorAssignmentId: first.id,
      initiatorAssignmentVersion: first.version,
      initiatorMembershipId: memberId,
      status: 'pending_target',
      targetAssignmentId: second.id,
      targetAssignmentVersion: second.version,
      targetMembershipId: memberId,
      workflowSequence: 1,
    });

    // Reproduce the CynosDB hazard (explicit_defaults_for_timestamp=OFF) where a
    // TIMESTAMP column can carry an implicit ON UPDATE CURRENT_TIMESTAMP.
    await client.database.execute(sql`
      ALTER TABLE shift_assignments
      MODIFY starts_at TIMESTAMP(3) NOT NULL DEFAULT '1970-01-01 00:00:01.000'
        ON UPDATE CURRENT_TIMESTAMP(3)
    `);

    const before = await client.database
      .select({ id: shiftAssignments.id, startsAt: shiftAssignments.startsAt })
      .from(shiftAssignments)
      .where(eq(shiftAssignments.schedulePeriodId, period.id))
      .orderBy(shiftAssignments.businessDate);

    await withTransaction(client, (transaction) =>
      new ScheduleWorkflowInvalidationService().invalidate(transaction, {
        actorUserId: ownerUserId,
        groupId,
        operationId: randomUUID(),
        periodIds: [period.id],
      }),
    );

    const after = await client.database
      .select({
        actualMembershipId: shiftAssignments.actualMembershipId,
        id: shiftAssignments.id,
        startsAt: shiftAssignments.startsAt,
        version: shiftAssignments.version,
      })
      .from(shiftAssignments)
      .where(eq(shiftAssignments.schedulePeriodId, period.id))
      .orderBy(shiftAssignments.businessDate);

    expect(after.map((row) => row.startsAt.toISOString())).toEqual(
      before.map((row) => row.startsAt.toISOString()),
    );
    expect(after.map((row) => row.actualMembershipId)).toEqual([memberId, memberId]);
    expect(after.map((row) => row.version)).toEqual([2, 2]);
  });

  function createDraftInput(businessMonth: string, businessDate: string) {
    return {
      actorUserId: ownerUserId,
      assignments: [
        {
          actualMembershipId: memberId,
          businessDate,
          plannedMembershipId: memberId,
          shiftTypeId,
          slotPosition: 1,
        },
      ],
      businessMonth,
      groupId,
      operationId: randomUUID(),
      scheduleRoleId,
    };
  }

  async function seedScheduleConfiguration(): Promise<void> {
    await client.database.insert(users).values([
      { cloudbaseUid: 'cloudbase-schedule-owner', id: ownerUserId },
      { cloudbaseUid: 'cloudbase-schedule-member', id: randomUUID() },
    ]);
    const [memberUser] = await client.database
      .select({ id: users.id })
      .from(users)
      .where(eq(users.cloudbaseUid, 'cloudbase-schedule-member'));
    if (memberUser === undefined) {
      throw new Error('Expected the schedule member user.');
    }

    await client.database
      .insert(userProfiles)
      .values({ realName: 'Dr. Snapshot', userId: memberUser.id });
    await client.database.insert(groups).values({
      groupCode: '1234',
      id: groupId,
      name: 'Schedule group',
      ownerUserId,
    });
    await client.database.insert(groupMemberships).values({
      groupId,
      id: memberId,
      role: 'member',
      userId: memberUser.id,
    });
    await client.database.insert(scheduleRoles).values({
      groupId,
      id: scheduleRoleId,
      name: 'Primary',
    });
    await client.database.insert(shiftTypes).values({
      abbreviation: 'ALL',
      color: '#1F5AA6',
      countsTowardStatistics: 1,
      crossesMidnight: 1,
      displayOrder: 1,
      endTime: '08:00:00',
      groupId,
      id: shiftTypeId,
      isAllDay: 1,
      isEnabled: 1,
      name: 'All-day',
      startTime: '08:00:00',
      textColor: '#FFFFFF',
    });
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
  await client.database.execute(sql`DROP TABLE IF EXISTS wechat_identity_detachments`);
  await client.database.execute(sql`DROP TABLE IF EXISTS wechat_link_tokens`);
  await client.database.execute(sql`DROP TABLE IF EXISTS wechat_union_accounts`);
  await client.database.execute(sql`DROP TABLE IF EXISTS user_auth_identities`);
  await client.database.execute(sql`DROP TABLE IF EXISTS user_password_credentials`);
  await client.database.execute(sql`DROP TABLE IF EXISTS users`);
  await client.database.execute(sql`DROP TABLE IF EXISTS __drizzle_migrations`);
  await client.database.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
}
