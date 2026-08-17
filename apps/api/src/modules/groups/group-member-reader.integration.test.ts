import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import {
  createTestDatabaseClient,
  migrateDatabase,
  type DatabaseClient,
  type DatabaseConnectionOptions,
  withTransaction,
} from '@schedule/database';
import { sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { GroupMemberReader } from './group-member-reader.js';

const migrationsDirectory = fileURLToPath(new URL('../../../../../migrations', import.meta.url));
const databaseOptions = getTestDatabaseOptions();
const describeWithDatabase = databaseOptions === undefined ? describe.skip : describe;

describeWithDatabase('group member reader', () => {
  let client: DatabaseClient;
  const reader = new GroupMemberReader();

  beforeEach(async () => {
    client = createTestDatabaseClient(databaseOptions as DatabaseConnectionOptions);
    await resetDatabase(client);
    await migrateDatabase(client, migrationsDirectory);
  });

  afterEach(async () => {
    if (client !== undefined) {
      await client.close();
    }
  });

  it('applies the explicit auto-accept default only when a member never set the preference', async () => {
    const fixture = await seedReaderFixture(client);

    await withTransaction(client, async (transaction) => {
      const swapMembers = await reader.loadMembers(
        transaction,
        fixture.groupId,
        fixture.membershipIds,
        { autoAcceptSwapsDefault: 1 },
      );
      expect(swapMembers.get(fixture.neverSetMembershipId)).toMatchObject({
        autoAcceptSwaps: 1,
        isActive: true,
        realName: 'Never Set',
      });
      expect(swapMembers.get(fixture.explicitDeclineMembershipId)).toMatchObject({
        autoAcceptSwaps: 0,
      });
      expect(swapMembers.get(fixture.explicitAcceptMembershipId)).toMatchObject({
        autoAcceptSwaps: 1,
      });

      const dutyMembers = await reader.loadMembers(
        transaction,
        fixture.groupId,
        fixture.membershipIds,
        { autoAcceptSwapsDefault: 0 },
      );
      expect(dutyMembers.get(fixture.neverSetMembershipId)).toMatchObject({
        autoAcceptSwaps: 0,
      });
      expect(dutyMembers.get(fixture.explicitDeclineMembershipId)).toMatchObject({
        autoAcceptSwaps: 0,
      });
      expect(dutyMembers.get(fixture.explicitAcceptMembershipId)).toMatchObject({
        autoAcceptSwaps: 1,
      });
    });
  });

  it('marks suspended users and inactive memberships as inactive and hides soft-deleted memberships', async () => {
    const fixture = await seedReaderFixture(client);

    await withTransaction(client, async (transaction) => {
      const members = await reader.loadMembers(
        transaction,
        fixture.groupId,
        fixture.membershipIds,
        { autoAcceptSwapsDefault: 0 },
      );
      expect(members.get(fixture.neverSetMembershipId)).toMatchObject({ isActive: true });
      expect(members.get(fixture.suspendedMembershipId)).toMatchObject({ isActive: false });
      expect(members.get(fixture.inactiveMembershipId)).toMatchObject({ isActive: false });
      expect(members.has(fixture.softDeletedMembershipId)).toBe(false);
    });
  });

  it('loads role names and excludes soft-deleted roles', async () => {
    const fixture = await seedReaderFixture(client);

    await withTransaction(client, async (transaction) => {
      const roleNames = await reader.loadRoleNames(transaction, [
        fixture.activeRoleId,
        fixture.deletedRoleId,
        randomUUID(),
      ]);
      expect(roleNames).toEqual(new Map([[fixture.activeRoleId, '一线']]));
    });
  });

  it('returns empty maps for empty id lists and supports row locking', async () => {
    const fixture = await seedReaderFixture(client);

    await withTransaction(client, async (transaction) => {
      expect(
        await reader.loadMembers(transaction, fixture.groupId, [], { autoAcceptSwapsDefault: 0 }),
      ).toEqual(new Map());
      expect(await reader.loadRoleNames(transaction, [])).toEqual(new Map());

      const lockedMembers = await reader.loadMembers(
        transaction,
        fixture.groupId,
        [fixture.neverSetMembershipId],
        { autoAcceptSwapsDefault: 1 },
        true,
      );
      expect(lockedMembers.get(fixture.neverSetMembershipId)).toMatchObject({
        autoAcceptSwaps: 1,
        realName: 'Never Set',
      });
    });
  });
});

interface ReaderFixture {
  readonly activeRoleId: string;
  readonly deletedRoleId: string;
  readonly explicitAcceptMembershipId: string;
  readonly explicitDeclineMembershipId: string;
  readonly groupId: string;
  readonly inactiveMembershipId: string;
  readonly membershipIds: readonly string[];
  readonly neverSetMembershipId: string;
  readonly softDeletedMembershipId: string;
  readonly suspendedMembershipId: string;
}

async function seedReaderFixture(client: DatabaseClient): Promise<ReaderFixture> {
  const groupId = randomUUID();
  const ownerUserId = randomUUID();
  await client.database.execute(
    sql`INSERT INTO users (id, cloudbase_uid) VALUES (${ownerUserId}, 'reader-owner')`,
  );
  await client.database.execute(
    sql`INSERT INTO user_profiles (user_id, real_name) VALUES (${ownerUserId}, 'Owner Doctor')`,
  );
  await client.database.execute(
    sql`INSERT INTO \`groups\` (id, name, group_code, owner_user_id, visitor_key)
        VALUES (${groupId}, 'Reader Group', '1111', ${ownerUserId}, ${'e'.repeat(32)})`,
  );

  const createMember = async (realName: string) => {
    const membershipId = randomUUID();
    const userId = randomUUID();
    await client.database.execute(
      sql`INSERT INTO users (id, cloudbase_uid) VALUES (${userId}, ${realName})`,
    );
    await client.database.execute(
      sql`INSERT INTO user_profiles (user_id, real_name) VALUES (${userId}, ${realName})`,
    );
    await client.database.execute(
      sql`INSERT INTO group_memberships (id, group_id, user_id)
          VALUES (${membershipId}, ${groupId}, ${userId})`,
    );
    return { membershipId, userId };
  };

  const neverSet = await createMember('Never Set');
  const explicitDecline = await createMember('Explicit Decline');
  const explicitAccept = await createMember('Explicit Accept');
  const suspended = await createMember('Suspended User');
  const inactive = await createMember('Inactive Membership');
  const softDeleted = await createMember('Soft-Deleted Membership');

  await client.database.execute(
    sql`UPDATE group_memberships
        SET auto_accept_swaps = 0, auto_accept_swaps_manually_set = 1
        WHERE id = ${explicitDecline.membershipId}`,
  );
  await client.database.execute(
    sql`UPDATE group_memberships
        SET auto_accept_swaps = 1, auto_accept_swaps_manually_set = 1
        WHERE id = ${explicitAccept.membershipId}`,
  );
  await client.database.execute(
    sql`UPDATE users SET status = 'suspended' WHERE id = ${suspended.userId}`,
  );
  await client.database.execute(
    sql`UPDATE group_memberships SET status = 'inactive' WHERE id = ${inactive.membershipId}`,
  );
  await client.database.execute(
    sql`UPDATE group_memberships SET deleted_at = CURRENT_TIMESTAMP(3)
        WHERE id = ${softDeleted.membershipId}`,
  );

  const activeRoleId = randomUUID();
  const deletedRoleId = randomUUID();
  await client.database.execute(
    sql`INSERT INTO schedule_roles (id, group_id, name)
        VALUES (${activeRoleId}, ${groupId}, '一线'), (${deletedRoleId}, ${groupId}, '已删角色')`,
  );
  await client.database.execute(
    sql`UPDATE schedule_roles SET deleted_at = CURRENT_TIMESTAMP(3) WHERE id = ${deletedRoleId}`,
  );

  return {
    activeRoleId,
    deletedRoleId,
    explicitAcceptMembershipId: explicitAccept.membershipId,
    explicitDeclineMembershipId: explicitDecline.membershipId,
    groupId,
    inactiveMembershipId: inactive.membershipId,
    membershipIds: [
      neverSet.membershipId,
      explicitDecline.membershipId,
      explicitAccept.membershipId,
      suspended.membershipId,
      inactive.membershipId,
      softDeleted.membershipId,
    ],
    neverSetMembershipId: neverSet.membershipId,
    softDeletedMembershipId: softDeleted.membershipId,
    suspendedMembershipId: suspended.membershipId,
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
  await client.database.execute(sql`DROP TABLE IF EXISTS user_auth_identities`);
  await client.database.execute(sql`DROP TABLE IF EXISTS user_password_credentials`);
  await client.database.execute(sql`DROP TABLE IF EXISTS user_profiles`);
  await client.database.execute(sql`DROP TABLE IF EXISTS users`);
  await client.database.execute(sql`DROP TABLE IF EXISTS __drizzle_migrations`);
  await client.database.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
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
    Number.isNaN(port)
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
