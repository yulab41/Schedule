import { fileURLToPath } from 'node:url';

import {
  createDatabaseClient,
  createTestDatabaseClient,
  groupJoinRequests,
  groupMemberships,
  groups,
  migrateDatabase,
  rosterEntries,
  userProfiles,
  users,
  type DatabaseClient,
  type DatabaseConnectionOptions,
} from '@schedule/database';
import { randomUUID } from 'node:crypto';

import { and, eq, sql } from 'drizzle-orm';
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

  it('claims an exact roster match atomically and exposes group data only after a successful claim', async () => {
    const group = await createGroup('Claiming group', '3456');
    const groupId = (group.json() as { id: string }).id;
    await addRosterEntry(groupId, 'Candidate Doctor');

    const response = await claimGroup('candidate-token', '3456', 'Candidate Doctor');

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      group: {
        groupCode: '3456',
        id: groupId,
        name: 'Claiming group',
        role: 'member',
        version: 1,
      },
      status: 'claimed',
    });

    const [rosterEntry] = await client.database
      .select({ claimedByUserId: rosterEntries.claimedByUserId, status: rosterEntries.status })
      .from(rosterEntries)
      .where(eq(rosterEntries.groupId, groupId));
    const [membership] = await client.database
      .select({ role: groupMemberships.role })
      .from(groupMemberships)
      .where(and(eq(groupMemberships.groupId, groupId), eq(groupMemberships.role, 'member')));

    expect(rosterEntry).toEqual({ claimedByUserId: expect.any(String), status: 'claimed' });
    expect(membership).toEqual({ role: 'member' });
  });

  it('lets concurrent same-name claims join without conflicts', async () => {
    const group = await createGroup('Concurrent claim group', '4012');
    const groupId = (group.json() as { id: string }).id;
    await addRosterEntry(groupId, 'Candidate Doctor');
    const firstClient = createDatabaseClient(databaseOptions as DatabaseConnectionOptions);
    const secondClient = createDatabaseClient(databaseOptions as DatabaseConnectionOptions);

    try {
      const results = await Promise.allSettled([
        new GroupService(firstClient).claim(
          { cloudbaseUid: 'cloudbase-candidate' },
          { groupCode: '4012', realName: 'Candidate Doctor' },
        ),
        new GroupService(secondClient).claim(
          { cloudbaseUid: 'cloudbase-other-candidate' },
          { groupCode: '4012', realName: 'Candidate Doctor' },
        ),
      ]);

      expect(
        results.filter(
          (result) => result.status === 'fulfilled' && result.value.status === 'claimed',
        ),
      ).toHaveLength(2);
    } finally {
      await firstClient.close();
      await secondClient.close();
    }

    const memberships = await client.database
      .select({ id: groupMemberships.id })
      .from(groupMemberships)
      .where(
        and(
          eq(groupMemberships.groupId, groupId),
          eq(groupMemberships.role, 'member'),
          eq(groupMemberships.status, 'active'),
        ),
      );

    expect(memberships).toHaveLength(2);
    const claimedRosterEntries = await client.database
      .select({ id: rosterEntries.id })
      .from(rosterEntries)
      .where(and(eq(rosterEntries.groupId, groupId), eq(rosterEntries.status, 'claimed')));
    expect(claimedRosterEntries).toHaveLength(1);
  });

  it('joins directly with the profile real name when no roster entry matches', async () => {
    const group = await createGroup('Private group', '4567');
    const groupId = (group.json() as { id: string }).id;
    await addRosterEntry(groupId, 'Candidate Doctor');

    const response = await claimGroup('outsider-token', '4567', 'Outsider Doctor');

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      group: { id: groupId, name: 'Private group' },
      status: 'claimed',
    });
    const [outsider] = await client.database
      .select({ id: users.id })
      .from(users)
      .where(eq(users.cloudbaseUid, 'cloudbase-outsider'));
    const memberships = await client.database
      .select({ id: groupMemberships.id })
      .from(groupMemberships)
      .where(
        and(
          eq(groupMemberships.groupId, groupId),
          eq(groupMemberships.userId, outsider?.id as string),
        ),
      );
    expect(memberships).toHaveLength(1);
    const pendingRequests = await client.database
      .select({ id: groupJoinRequests.id })
      .from(groupJoinRequests)
      .where(eq(groupJoinRequests.status, 'pending'));
    expect(pendingRequests).toHaveLength(0);
  });

  it('uses the entered real name when claiming and updates the profile', async () => {
    const group = await createGroup('Real name claim group', '6543');
    const groupId = (group.json() as { id: string }).id;
    await addRosterEntry(groupId, 'Lin Enyu');

    const response = await claimGroup('outsider-token', '6543', 'Lin Enyu');
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ status: 'claimed' });

    const [outsider] = await client.database
      .select({ id: users.id })
      .from(users)
      .where(eq(users.cloudbaseUid, 'cloudbase-outsider'));
    const [profile] = await client.database
      .select({ realName: userProfiles.realName })
      .from(userProfiles)
      .where(eq(userProfiles.userId, outsider?.id as string));
    expect(profile?.realName).toBe('Lin Enyu');
    const members = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'GET',
      url: `/groups/${groupId}/members`,
    });
    const rows = members.json() as { realName: string }[];
    expect(rows.some((row) => row.realName === 'Lin Enyu')).toBe(true);
  });

  it('resolves an earlier pending join request when the member joins directly', async () => {
    const group = await createGroup('Request resolution group', '5123');
    const groupId = (group.json() as { id: string }).id;
    const [outsider] = await client.database
      .select({ id: users.id })
      .from(users)
      .where(eq(users.cloudbaseUid, 'cloudbase-outsider'));
    await client.database.insert(groupJoinRequests).values({
      groupId,
      id: randomUUID(),
      requestedRealName: 'Outsider Doctor',
      requestingUserId: outsider?.id as string,
    });

    const claimed = await claimGroup('outsider-token', '5123', 'Outsider Doctor');
    const [request] = await client.database
      .select({ status: groupJoinRequests.status })
      .from(groupJoinRequests)
      .where(
        and(
          eq(groupJoinRequests.groupId, groupId),
          eq(groupJoinRequests.requestedRealName, 'Outsider Doctor'),
        ),
      );

    expect(claimed.statusCode).toBe(201);
    expect(claimed.json()).toMatchObject({ status: 'claimed' });
    expect(request).toEqual({ status: 'resolved' });
  });

  it('adds members directly and binds the identity when the member claims the group', async () => {
    const group = await createGroup('Direct member group', '3456');
    const groupId = (group.json() as { id: string }).id;

    const added = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      payload: { realNames: ['Outsider Doctor'] },
      url: `/groups/${groupId}/members`,
    });
    expect(added.statusCode).toBe(200);
    expect(added.json()).toEqual({ added: 1 });

    const members = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'GET',
      url: `/groups/${groupId}/members`,
    });
    expect(members.statusCode).toBe(200);
    const outsiderMembership = (
      members.json() as {
        readonly id: string;
        readonly realName: string;
        readonly role: string;
      }[]
    ).find((member) => member.realName === 'Outsider Doctor');
    expect(outsiderMembership).toMatchObject({ role: 'member' });

    const contact = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'PUT',
      payload: { mobilePhone: '13800000000' },
      url: `/groups/${groupId}/members/${outsiderMembership?.id}/contact`,
    });
    expect(contact.statusCode).toBe(200);

    const duplicate = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      payload: { realNames: ['Outsider Doctor'] },
      url: `/groups/${groupId}/members`,
    });
    expect(duplicate.statusCode).toBe(409);

    const memberForbidden = await app.inject({
      headers: { authorization: 'Bearer candidate-token' },
      method: 'POST',
      payload: { realNames: ['Blocked Name'] },
      url: `/groups/${groupId}/members`,
    });
    expect(memberForbidden.statusCode).toBe(403);

    const claimed = await claimGroup('outsider-token', '3456', 'Outsider Doctor');
    expect(claimed.statusCode).toBe(201);
    expect(claimed.json()).toMatchObject({ status: 'claimed' });

    const [membership] = await client.database
      .select({ userId: groupMemberships.userId })
      .from(groupMemberships)
      .where(eq(groupMemberships.id, outsiderMembership?.id as string));
    const [outsider] = await client.database
      .select({ id: users.id })
      .from(users)
      .where(eq(users.cloudbaseUid, 'cloudbase-outsider'));
    expect(membership?.userId).toBe(outsider?.id);
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

    const claimed = await claimGroup('outsider-token', '8901', 'Outsider Doctor');
    expect(claimed.statusCode).toBe(201);
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
    const oldCodeClaim = await claimGroup('candidate-token', '5678', 'Candidate Doctor');
    const newCodeClaim = await claimGroup('candidate-token', '6789', 'Candidate Doctor');

    expect(regenerated.statusCode).toBe(200);
    expect(regenerated.json()).toMatchObject({ groupCode: '6789', version: 2 });
    expect(oldCodeClaim.statusCode).toBe(404);
    expect(newCodeClaim.statusCode).toBe(201);
  });

  it('limits repeated code guesses before resolving group membership', async () => {
    const responses = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      responses.push(await claimGroup('outsider-token', '9999', 'Outsider Doctor'));
    }

    expect(responses.filter((response) => response.statusCode === 404)).toHaveLength(5);
    expect(responses.filter((response) => response.statusCode === 429)).toHaveLength(1);
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

  function claimGroup(token: string, groupCode: string, realName: string) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: { groupCode, realName },
      url: '/groups/claim',
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
