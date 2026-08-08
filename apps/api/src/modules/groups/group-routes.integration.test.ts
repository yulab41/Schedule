import { fileURLToPath } from 'node:url';

import {
  createDatabaseClient,
  createTestDatabaseClient,
  groupMemberships,
  groups,
  migrateDatabase,
  users,
  type DatabaseClient,
  type DatabaseConnectionOptions,
} from '@schedule/database';
import { insertDirectMembership } from '@schedule/test-fixtures';
import { eq, sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AuthPort } from '../../adapters/auth/auth-port.js';
import { createApp } from '../../app.js';
import { GroupService } from './group-service.js';

const migrationsDirectory = fileURLToPath(new URL('../../../../../migrations', import.meta.url));
const databaseOptions = getTestDatabaseOptions();
const describeWithDatabase = databaseOptions === undefined ? describe.skip : describe;

describeWithDatabase('groups and roster claiming', () => {
  let app: ReturnType<typeof createApp>;
  let client: DatabaseClient;

  beforeEach(async () => {
    client = createTestDatabaseClient(databaseOptions as DatabaseConnectionOptions);
    await resetDatabase(client);
    await migrateDatabase(client, migrationsDirectory);
    app = createApp({
      authPort: createFakeAuthPort({
        'candidate-token': 'cloudbase-candidate',
        'other-candidate-token': 'cloudbase-other-candidate',
        'other-owner-token': 'cloudbase-other-owner',
        'owner-token': 'cloudbase-owner',
        'outsider-token': 'cloudbase-outsider',
      }),
      databaseClient: client,
      logger: false,
    });
    await registerUser('owner-token', 'Owner Doctor');
    await registerUser('other-owner-token', 'Other Owner Doctor');
    await registerUser('candidate-token', 'Candidate Doctor');
    await registerUser('other-candidate-token', 'Candidate Doctor');
    await registerUser('outsider-token', 'Outsider Doctor');
  });

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
    }

    if (client !== undefined) {
      await client.close();
    }
  });

  it('uses the database uniqueness constraint across independent concurrent connections', async () => {
    const firstClient = createDatabaseClient(databaseOptions as DatabaseConnectionOptions);
    const secondClient = createDatabaseClient(databaseOptions as DatabaseConnectionOptions);

    try {
      const [first, second] = await Promise.allSettled([
        new GroupService(firstClient).create(
          { cloudbaseUid: 'cloudbase-owner' },
          { groupCode: '1234', name: 'Concurrent group one' },
        ),
        new GroupService(secondClient).create(
          { cloudbaseUid: 'cloudbase-other-owner' },
          { groupCode: '1234', name: 'Concurrent group two' },
        ),
      ]);

      expect([first, second].filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect([first, second].filter((result) => result.status === 'rejected')).toHaveLength(1);
    } finally {
      await firstClient.close();
      await secondClient.close();
    }

    const [storedGroup] = await client.database
      .select({ groupCode: groups.groupCode, name: groups.name })
      .from(groups)
      .where(eq(groups.groupCode, '1234'));
    const [ownerMembership] = await client.database
      .select({ role: groupMemberships.role })
      .from(groupMemberships)
      .innerJoin(groups, eq(groups.id, groupMemberships.groupId))
      .where(eq(groups.groupCode, '1234'));

    expect(storedGroup).toEqual({ groupCode: '1234', name: expect.stringContaining('Concurrent') });
    expect(ownerMembership).toEqual({ role: 'owner' });
  });

  it('rejects duplicate pending roster names and keeps roster changes owner-only', async () => {
    const group = await createGroup('Roster group', '2345');
    const groupId = (group.json() as { id: string }).id;

    const firstRoster = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      payload: { realNames: ['Candidate Doctor', 'Other Candidate'] },
      url: `/groups/${groupId}/roster-entries`,
    });
    const duplicateRoster = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      payload: { realNames: ['Candidate Doctor'] },
      url: `/groups/${groupId}/roster-entries`,
    });
    const duplicateWithinRequest = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      payload: { realNames: ['New Doctor', 'New Doctor'] },
      url: `/groups/${groupId}/roster-entries`,
    });
    const nonOwnerRoster = await app.inject({
      headers: { authorization: 'Bearer candidate-token' },
      method: 'POST',
      payload: { realNames: ['Unauthorized Doctor'] },
      url: `/groups/${groupId}/roster-entries`,
    });

    expect(firstRoster.statusCode).toBe(200);
    expect(firstRoster.json()).toEqual({ added: 2 });
    expect(duplicateRoster.statusCode).toBe(409);
    expect(duplicateWithinRequest.statusCode).toBe(409);
    expect(nonOwnerRoster.statusCode).toBe(403);
  });

  it('lists pending roster entries as unclaimed members and converts them to formal members', async () => {
    const group = await createGroup('Roster merge group', '8901');
    const groupId = (group.json() as { id: string }).id;

    await client.database.execute(
      sql`INSERT INTO roster_entries (id, group_id, real_name)
          VALUES ('00000000-0000-4000-8000-000000000002', ${groupId}, 'Legacy Doctor')`,
    );
    await addRosterEntry(groupId, 'Outsider Doctor');

    const members = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'GET',
      url: `/groups/${groupId}/members`,
    });
    expect(members.statusCode).toBe(200);
    const rows = members.json() as {
      readonly id: string;
      readonly isPendingRoster?: boolean;
      readonly isUnclaimed?: boolean;
      readonly realName: string;
    }[];
    const legacy = rows.find((row) => row.realName === 'Legacy Doctor');
    expect(legacy).toMatchObject({ isPendingRoster: true, isUnclaimed: true });
    const outsider = rows.find((row) => row.realName === 'Outsider Doctor');
    expect(outsider).toMatchObject({ isUnclaimed: true });
    expect(outsider?.isPendingRoster).not.toBe(true);

    const converted = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      payload: { realNames: ['Legacy Doctor'] },
      url: `/groups/${groupId}/roster-entries/convert`,
    });
    expect(converted.statusCode).toBe(200);
    expect(converted.json()).toEqual({ converted: 1, skipped: 0 });

    const afterMembers = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'GET',
      url: `/groups/${groupId}/members`,
    });
    const convertedRow = (
      afterMembers.json() as {
        readonly id: string;
        readonly isPendingRoster?: boolean;
        readonly isUnclaimed?: boolean;
        readonly realName: string;
      }[]
    ).find((row) => row.realName === 'Legacy Doctor');
    expect(convertedRow).toMatchObject({ isUnclaimed: true });
    expect(convertedRow?.isPendingRoster).not.toBe(true);

    const contact = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'PUT',
      payload: { mobilePhone: '13900000000' },
      url: `/groups/${groupId}/members/${convertedRow?.id}/contact`,
    });
    expect(contact.statusCode).toBe(200);

    const again = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      payload: { realNames: ['Legacy Doctor'] },
      url: `/groups/${groupId}/roster-entries/convert`,
    });
    expect(again.json()).toEqual({ converted: 0, skipped: 1 });

    await insertDirectMembership(client, { groupCode: '8901', realName: 'Outsider Doctor' });
    const [membership] = await client.database
      .select({ userId: groupMemberships.userId })
      .from(groupMemberships)
      .where(eq(groupMemberships.id, outsider?.id as string));
    const [outsiderUser] = await client.database
      .select({ id: users.id })
      .from(users)
      .where(eq(users.cloudbaseUid, 'cloudbase-outsider'));
    expect(membership?.userId).toBe(outsiderUser?.id);
  });

  it('deletes unclaimed and formal members and auto-removes their workflow rows', async () => {
    const group = await createGroup('Delete member group', '9012');
    const groupId = (group.json() as { id: string }).id;
    await addRosterEntry(groupId, 'Outsider Doctor');

    const members = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'GET',
      url: `/groups/${groupId}/members`,
    });
    const rows = members.json() as {
      readonly id: string;
      readonly isCurrentUser: boolean;
      readonly isPendingRoster?: boolean;
      readonly realName: string;
      readonly role: string;
    }[];
    const outsider = rows.find((row) => row.realName === 'Outsider Doctor');
    const owner = rows.find((row) => row.role === 'owner');
    expect(outsider).toBeDefined();
    expect(owner).toBeDefined();

    const contact = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'PUT',
      payload: { mobilePhone: '13700000000' },
      url: `/groups/${groupId}/members/${outsider?.id}/contact`,
    });
    expect(contact.statusCode).toBe(200);
    await client.database.execute(
      sql`INSERT INTO leave_requests (id, group_id, membership_id, leave_type, starts_at, ends_at, reason, status, reflow_strategy)
          VALUES ('00000000-0000-4000-8000-000000000003', ${groupId}, ${outsider?.id}, 'sick',
                  '2026-08-05 00:00:00', '2026-08-05 23:59:59', 'test', 'pending', 'keep-original-order')`,
    );
    const [placeholderUser] = await client.database
      .select({ userId: groupMemberships.userId })
      .from(groupMemberships)
      .where(eq(groupMemberships.id, outsider?.id as string));

    await client.database.execute(
      sql`INSERT INTO roster_entries (id, group_id, real_name)
          VALUES ('00000000-0000-4000-8000-000000000004', ${groupId}, 'Legacy Roster Doctor')`,
    );
    const memberForbidden = await app.inject({
      headers: { authorization: 'Bearer candidate-token' },
      method: 'DELETE',
      url: `/groups/${groupId}/members/00000000-0000-4000-8000-000000000004`,
    });
    expect(memberForbidden.statusCode).toBe(403);

    const deletedRoster = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'DELETE',
      url: `/groups/${groupId}/members/00000000-0000-4000-8000-000000000004`,
    });
    expect(deletedRoster.statusCode).toBe(200);

    const deletedMember = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'DELETE',
      url: `/groups/${groupId}/members/${outsider?.id}`,
    });
    expect(deletedMember.statusCode).toBe(200);

    const ownerBlocked = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'DELETE',
      url: `/groups/${groupId}/members/${owner?.id}`,
    });
    expect(ownerBlocked.statusCode).toBe(409);

    const afterMembers = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'GET',
      url: `/groups/${groupId}/members`,
    });
    const afterRows = afterMembers.json() as { readonly realName: string }[];
    expect(afterRows.map((row) => row.realName)).not.toContain('Outsider Doctor');
    expect(afterRows.map((row) => row.realName)).not.toContain('Legacy Roster Doctor');

    const [leaveCount] = await client.database.execute<{ count: number }>(
      sql`SELECT COUNT(*) AS count FROM leave_requests WHERE membership_id = ${outsider?.id}`,
    );
    const [contactCount] = await client.database.execute<{ count: number }>(
      sql`SELECT COUNT(*) AS count FROM group_member_contacts WHERE membership_id = ${outsider?.id}`,
    );
    const [membershipCount] = await client.database.execute<{ count: number }>(
      sql`SELECT COUNT(*) AS count FROM group_memberships WHERE id = ${outsider?.id}`,
    );
    const [userCount] = await client.database.execute<{ count: number }>(
      sql`SELECT COUNT(*) AS count FROM users WHERE id = ${placeholderUser?.userId}`,
    );
    expect(leaveCount).toEqual([{ count: 0 }]);
    expect(contactCount).toEqual([{ count: 0 }]);
    expect(membershipCount).toEqual([{ count: 0 }]);
    expect(userCount).toEqual([{ count: 0 }]);
  });

  it('invalidates the previous code immediately when the owner regenerates it', async () => {
    const group = await createGroup('Code rotation group', '5678');
    const groupId = (group.json() as { id: string }).id;
    await addRosterEntry(groupId, 'Candidate Doctor');

    const regenerated = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'PUT',
      payload: { groupCode: '6789' },
      url: `/groups/${groupId}/group-code`,
    });
    const oldCodeClaim = await app.inject({
      headers: { authorization: 'Bearer candidate-token' },
      method: 'POST',
      payload: { groupCode: '5678' },
      url: '/groups/claim',
    });

    expect(regenerated.statusCode).toBe(200);
    expect(regenerated.json()).toMatchObject({ groupCode: '6789', version: 2 });
    expect(oldCodeClaim.statusCode).toBe(404);
  });

  it('rechecks that the actor remains active inside a group-write transaction', async () => {
    const [owner] = await client.database
      .select({ id: users.id })
      .from(users)
      .where(eq(users.cloudbaseUid, 'cloudbase-owner'));
    const service = new GroupService(createSuspendingDatabaseClient(client, owner?.id));

    await expect(
      service.create(
        { cloudbaseUid: 'cloudbase-owner' },
        { groupCode: '7890', name: 'Blocked group' },
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 });

    const storedGroups = await client.database
      .select({ id: groups.id })
      .from(groups)
      .where(eq(groups.groupCode, '7890'));

    expect(storedGroups).toEqual([]);
  });

  it('supports guest join, leave, and member leave/rejoin', async () => {
    const group = await createGroup('Membership group', '3456');
    const groupId = (group.json() as { id: string }).id;
    await addRosterEntry(groupId, 'Candidate Doctor');

    const guestJoin = await app.inject({
      headers: { authorization: 'Bearer outsider-token' },
      method: 'POST',
      url: `/groups/${groupId}/join-guest`,
    });
    expect(guestJoin.statusCode).toBe(201);

    const guestLeave = await app.inject({
      headers: { authorization: 'Bearer outsider-token' },
      method: 'POST',
      url: `/groups/${groupId}/leave`,
    });
    expect(guestLeave.statusCode).toBe(204);

    await insertDirectMembership(client, {
      cloudbaseUid: 'cloudbase-candidate',
      groupCode: '3456',
      realName: 'Candidate Doctor',
    });

    const memberLeave = await app.inject({
      headers: { authorization: 'Bearer candidate-token' },
      method: 'POST',
      url: `/groups/${groupId}/leave`,
    });
    expect(memberLeave.statusCode).toBe(204);

    const members = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'GET',
      url: `/groups/${groupId}/members`,
    });
    const memberRows = members.json() as Array<{
      id: string;
      isUnclaimed?: boolean;
      realName: string;
    }>;
    expect(memberRows.find((row) => row.realName === 'Candidate Doctor')?.isUnclaimed).toBe(true);

    const unclaimedMembershipId = memberRows.find((row) => row.realName === 'Candidate Doctor')
      ?.id as string;
    const invite = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      payload: { targetMembershipId: unclaimedMembershipId },
      url: `/groups/${groupId}/invite-links`,
    });
    expect(invite.statusCode, invite.body).toBe(201);
    const inviteToken = (invite.json() as { token: string }).token;
    const rejoin = await app.inject({
      headers: { authorization: 'Bearer candidate-token' },
      method: 'POST',
      payload: { confirmRealName: 'Candidate Doctor', token: inviteToken },
      url: '/invites/accept',
    });
    expect(rejoin.statusCode, rejoin.body).toBe(200);
    expect((rejoin.json() as { group: { role: string } }).group.role).toBe('member');
  });

  it('rejects owner leave and non-owner group name changes', async () => {
    const group = await createGroup('Owner group', '4567');
    const groupId = (group.json() as { id: string }).id;

    const ownerLeave = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      url: `/groups/${groupId}/leave`,
    });
    expect(ownerLeave.statusCode).toBe(409);

    const outsiderRename = await app.inject({
      headers: { authorization: 'Bearer other-owner-token' },
      method: 'PUT',
      payload: { name: 'Renamed by outsider' },
      url: `/groups/${groupId}/name`,
    });
    expect(outsiderRename.statusCode).toBe(403);

    const ownerRename = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'PUT',
      payload: { name: 'Renamed group' },
      url: `/groups/${groupId}/name`,
    });
    expect(ownerRename.statusCode).toBe(200);
    expect((ownerRename.json() as { name: string }).name).toBe('Renamed group');
  });

  it('supports dissolve and restore by the owner', async () => {
    const group = await createGroup('Dissolve group', '5678');
    const groupId = (group.json() as { id: string }).id;

    const dissolve = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'DELETE',
      url: `/groups/${groupId}`,
    });
    expect(dissolve.statusCode).toBe(204);

    const dissolved = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'GET',
      url: '/groups/dissolved',
    });
    expect(dissolved.statusCode).toBe(200);
    expect(dissolved.json()).toHaveLength(1);

    const restore = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      url: `/groups/${groupId}/restore`,
    });
    expect(restore.statusCode).toBe(204);

    const afterRestore = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'GET',
      url: `/groups/${groupId}/members`,
    });
    expect(afterRestore.statusCode).toBe(200);
  });

  async function registerUser(token: string, realName: string) {
    const response = await app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: { realName },
      url: '/users',
    });

    expect(response.statusCode).toBe(201);
  }

  function createGroup(name: string, groupCode: string) {
    return app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      payload: { groupCode, name },
      url: '/groups',
    });
  }

  function addRosterEntry(groupId: string, realName: string) {
    return app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      payload: { realNames: [realName] },
      url: `/groups/${groupId}/roster-entries`,
    });
  }
});

function createFakeAuthPort(tokens: Readonly<Record<string, string>>): AuthPort {
  return {
    authenticate: async ({ authorization }) => {
      const token = authorization?.replace(/^Bearer\s+/iu, '');
      const cloudbaseUid = token === undefined ? undefined : tokens[token];

      return cloudbaseUid === undefined ? undefined : { cloudbaseUid };
    },
  };
}

function createSuspendingDatabaseClient(
  client: DatabaseClient,
  userId: string | undefined,
): DatabaseClient {
  let suspended = false;
  const database = new Proxy(client.database, {
    get(target, property) {
      if (property !== 'transaction') {
        const value = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
      }

      return async (...argumentsList: Parameters<typeof target.transaction>) => {
        if (!suspended && userId !== undefined) {
          suspended = true;
          await client.database
            .update(users)
            .set({ status: 'suspended' })
            .where(eq(users.id, userId));
        }

        return target.transaction(...argumentsList);
      };
    },
  });

  return { ...client, database };
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
  await client.database.execute(sql`DROP TABLE IF EXISTS users`);
  await client.database.execute(sql`DROP TABLE IF EXISTS __drizzle_migrations`);
  await client.database.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
}
