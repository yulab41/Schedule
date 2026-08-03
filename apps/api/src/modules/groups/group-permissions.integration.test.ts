import { fileURLToPath } from 'node:url';

import {
  createTestDatabaseClient,
  groupMemberships,
  groups,
  migrateDatabase,
  users,
  type DatabaseClient,
  type DatabaseConnectionOptions,
} from '@schedule/database';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AuthPort } from '../../adapters/auth/auth-port.js';
import { createApp } from '../../app.js';

const migrationsDirectory = fileURLToPath(new URL('../../../../../migrations', import.meta.url));
const databaseOptions = getTestDatabaseOptions();
const describeWithDatabase = databaseOptions === undefined ? describe.skip : describe;

describeWithDatabase('group permissions, contacts, and ownership', () => {
  let app: ReturnType<typeof createApp>;
  let client: DatabaseClient;

  beforeEach(async () => {
    client = createTestDatabaseClient(databaseOptions as DatabaseConnectionOptions);
    await resetDatabase(client);
    await migrateDatabase(client, migrationsDirectory);
    app = createApp({
      authPort: createFakeAuthPort({
        'candidate-token': 'cloudbase-candidate',
        'other-owner-token': 'cloudbase-other-owner',
        'owner-token': 'cloudbase-owner',
      }),
      databaseClient: client,
      logger: false,
    });
    await registerUser('owner-token', 'Owner Doctor');
    await registerUser('candidate-token', 'Candidate Doctor');
    await registerUser('other-owner-token', 'Other Owner Doctor');
  });

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
    }

    if (client !== undefined) {
      await client.close();
    }
  });

  it('lets only the owner add and remove administrators, while administrators manage the roster', async () => {
    const groupId = await createClaimedGroup();
    const candidate = await getMember(groupId, 'Candidate Doctor');

    const makeAdministrator = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'PUT',
      payload: { role: 'administrator' },
      url: `/groups/${groupId}/members/${candidate.id}/role`,
    });
    const administratorRoster = await app.inject({
      headers: { authorization: 'Bearer candidate-token' },
      method: 'POST',
      payload: { realNames: ['Administrator Added Doctor'] },
      url: `/groups/${groupId}/roster-entries`,
    });
    const removeAdministrator = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'PUT',
      payload: { role: 'member' },
      url: `/groups/${groupId}/members/${candidate.id}/role`,
    });

    expect(makeAdministrator.statusCode).toBe(200);
    expect(makeAdministrator.json()).toMatchObject({ id: candidate.id, role: 'administrator' });
    expect(administratorRoster.statusCode).toBe(200);
    expect(removeAdministrator.statusCode).toBe(200);
    expect(removeAdministrator.json()).toMatchObject({ id: candidate.id, role: 'member' });
  });

  it('prevents members from changing another member contact or any administrator role', async () => {
    const groupId = await createClaimedGroup();
    const owner = await getMember(groupId, 'Owner Doctor');

    const roleUpdate = await app.inject({
      headers: { authorization: 'Bearer candidate-token' },
      method: 'PUT',
      payload: { role: 'member' },
      url: `/groups/${groupId}/members/${owner.id}/role`,
    });
    const contactUpdate = await app.inject({
      headers: { authorization: 'Bearer candidate-token' },
      method: 'PUT',
      payload: { mobilePhone: '13800000000' },
      url: `/groups/${groupId}/members/${owner.id}/contact`,
    });

    expect(roleUpdate.statusCode).toBe(403);
    expect(contactUpdate.statusCode).toBe(403);
  });

  it('limits contacts to active members of the same group and records member confirmation', async () => {
    const groupId = await createClaimedGroup();
    const candidate = await getMember(groupId, 'Candidate Doctor');

    const prefill = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'PUT',
      payload: { mobilePhone: '13800000000', shortPhone: '8000' },
      url: `/groups/${groupId}/members/${candidate.id}/contact`,
    });
    const unconfirmedUpdate = await app.inject({
      headers: { authorization: 'Bearer candidate-token' },
      method: 'PUT',
      payload: { shortPhone: '8001' },
      url: `/groups/${groupId}/members/${candidate.id}/contact`,
    });
    const confirmed = await app.inject({
      headers: { authorization: 'Bearer candidate-token' },
      method: 'PUT',
      payload: { confirm: true, shortPhone: '8002' },
      url: `/groups/${groupId}/members/${candidate.id}/contact`,
    });
    const otherGroup = await createGroup('other-owner-token', 'Other group', '4567');
    const crossGroupRead = await app.inject({
      headers: { authorization: 'Bearer other-owner-token' },
      method: 'GET',
      url: `/groups/${groupId}/contacts`,
    });
    const sameGroupRead = await app.inject({
      headers: { authorization: 'Bearer candidate-token' },
      method: 'GET',
      url: `/groups/${groupId}/contacts`,
    });

    expect(prefill.statusCode).toBe(200);
    expect(prefill.json()).toMatchObject({
      isConfirmed: false,
      membershipId: candidate.id,
      mobilePhone: '13800000000',
      shortPhone: '8000',
    });
    expect(unconfirmedUpdate.statusCode).toBe(200);
    expect(unconfirmedUpdate.json()).toMatchObject({
      isConfirmed: false,
      membershipId: candidate.id,
      mobilePhone: '13800000000',
      shortPhone: '8001',
    });
    expect(confirmed.statusCode).toBe(200);
    expect(confirmed.json()).toMatchObject({
      isConfirmed: true,
      membershipId: candidate.id,
      mobilePhone: '13800000000',
      shortPhone: '8002',
    });
    expect(otherGroup.statusCode).toBe(201);
    expect(crossGroupRead.statusCode).toBe(403);
    expect(crossGroupRead.json()).not.toHaveProperty('contacts');
    expect(sameGroupRead.statusCode).toBe(200);
    expect(sameGroupRead.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          isConfirmed: true,
          membershipId: candidate.id,
          mobilePhone: '13800000000',
          shortPhone: '8002',
        }),
      ]),
    );
  });

  it('keeps exactly one owner when transfer validation fails and when a transfer succeeds', async () => {
    const groupId = await createClaimedGroup();
    const candidate = await getMember(groupId, 'Candidate Doctor');
    const [ownerUser] = await client.database
      .select({ id: users.id })
      .from(users)
      .where(eq(users.cloudbaseUid, 'cloudbase-owner'));

    const invalidTransfer = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      payload: { membershipId: '00000000-0000-4000-8000-000000000000' },
      url: `/groups/${groupId}/owner-transfer`,
    });
    await expectOwnerState(groupId, ownerUser?.id);

    const successfulTransfer = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      payload: { membershipId: candidate.id },
      url: `/groups/${groupId}/owner-transfer`,
    });
    const [candidateUser] = await client.database
      .select({ id: users.id })
      .from(users)
      .where(eq(users.cloudbaseUid, 'cloudbase-candidate'));
    await expectOwnerState(groupId, candidateUser?.id);

    expect(invalidTransfer.statusCode).toBe(404);
    expect(successfulTransfer.statusCode).toBe(200);
    expect(successfulTransfer.json()).toMatchObject({ id: groupId, role: 'administrator' });
  });

  it('soft deletes a group and excludes it from subsequent group switching data', async () => {
    const group = await createGroup('owner-token', 'Recoverable group', '5678');
    const groupId = (group.json() as { id: string }).id;

    const deleted = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'DELETE',
      url: `/groups/${groupId}`,
    });
    const listed = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'GET',
      url: '/groups',
    });
    const [storedGroup] = await client.database
      .select({ deletedAt: groups.deletedAt })
      .from(groups)
      .where(eq(groups.id, groupId));

    expect(deleted.statusCode).toBe(204);
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: groupId })]),
    );
    expect(storedGroup?.deletedAt).toBeInstanceOf(Date);
  });

  async function createClaimedGroup(): Promise<string> {
    const group = await createGroup('owner-token', 'Primary group', '1234');
    const groupId = (group.json() as { id: string }).id;
    const roster = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      payload: { realNames: ['Candidate Doctor'] },
      url: `/groups/${groupId}/roster-entries`,
    });
    const claim = await app.inject({
      headers: { authorization: 'Bearer candidate-token' },
      method: 'POST',
      payload: { groupCode: '1234', realName: 'Candidate Doctor' },
      url: '/groups/claim',
    });

    expect(group.statusCode).toBe(201);
    expect(roster.statusCode).toBe(200);
    expect(claim.statusCode).toBe(201);
    return groupId;
  }

  async function createGroup(token: string, name: string, groupCode: string) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: { groupCode, name },
      url: '/groups',
    });
  }

  async function getMember(groupId: string, realName: string) {
    const response = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'GET',
      url: `/groups/${groupId}/members`,
    });

    expect(response.statusCode).toBe(200);
    const member = (response.json() as { id: string; realName: string }[]).find(
      (entry) => entry.realName === realName,
    );
    expect(member).toBeDefined();
    return member as { id: string; realName: string };
  }

  async function expectOwnerState(
    groupId: string,
    expectedOwnerUserId: string | undefined,
  ): Promise<void> {
    const ownerMemberships = await client.database
      .select({ userId: groupMemberships.userId })
      .from(groupMemberships)
      .where(
        and(
          eq(groupMemberships.groupId, groupId),
          eq(groupMemberships.role, 'owner'),
          eq(groupMemberships.status, 'active'),
          isNull(groupMemberships.deletedAt),
        ),
      );
    const [group] = await client.database
      .select({ ownerUserId: groups.ownerUserId })
      .from(groups)
      .where(eq(groups.id, groupId));

    expect(ownerMemberships).toEqual([{ userId: expectedOwnerUserId }]);
    expect(group).toEqual({ ownerUserId: expectedOwnerUserId });
  }

  async function registerUser(token: string, realName: string): Promise<void> {
    const response = await app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: { realName },
      url: '/users',
    });

    expect(response.statusCode).toBe(201);
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
