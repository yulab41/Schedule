import { fileURLToPath } from 'node:url';

import {
  createDatabaseClient,
  createTestDatabaseClient,
  groupJoinRequests,
  groupMemberships,
  groups,
  migrateDatabase,
  rosterEntries,
  users,
  type DatabaseClient,
  type DatabaseConnectionOptions,
} from '@schedule/database';
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

    const response = await claimGroup('candidate-token', '3456');

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

  it('allows only one concurrent same-name claim to create an active membership', async () => {
    const group = await createGroup('Concurrent claim group', '4012');
    const groupId = (group.json() as { id: string }).id;
    await addRosterEntry(groupId, 'Candidate Doctor');
    const firstClient = createDatabaseClient(databaseOptions as DatabaseConnectionOptions);
    const secondClient = createDatabaseClient(databaseOptions as DatabaseConnectionOptions);

    try {
      const results = await Promise.allSettled([
        new GroupService(firstClient).claim(
          { cloudbaseUid: 'cloudbase-candidate' },
          { groupCode: '4012' },
        ),
        new GroupService(secondClient).claim(
          { cloudbaseUid: 'cloudbase-other-candidate' },
          { groupCode: '4012' },
        ),
      ]);

      expect(
        results.filter(
          (result) => result.status === 'fulfilled' && result.value.status === 'claimed',
        ),
      ).toHaveLength(1);
      expect(
        results.filter(
          (result) => result.status === 'fulfilled' && result.value.status === 'request_created',
        ),
      ).toHaveLength(1);
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

    expect(memberships).toHaveLength(1);
  });

  it('creates a generic add-person request without disclosing group data when no roster entry matches', async () => {
    const group = await createGroup('Private group', '4567');
    const groupId = (group.json() as { id: string }).id;
    await addRosterEntry(groupId, 'Candidate Doctor');

    const response = await claimGroup('outsider-token', '4567');

    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({ status: 'request_created' });
    const [request] = await client.database
      .select({
        groupId: groupJoinRequests.groupId,
        requestedRealName: groupJoinRequests.requestedRealName,
        status: groupJoinRequests.status,
      })
      .from(groupJoinRequests);

    expect(request).toEqual({
      groupId,
      requestedRealName: 'Outsider Doctor',
      status: 'pending',
    });
  });

  it('resolves an earlier add-person request when the owner later adds a matching roster entry', async () => {
    const group = await createGroup('Request resolution group', '5123');
    const groupId = (group.json() as { id: string }).id;

    const initialRequest = await claimGroup('outsider-token', '5123');
    await addRosterEntry(groupId, 'Outsider Doctor');
    const claimed = await claimGroup('outsider-token', '5123');
    const [request] = await client.database
      .select({ status: groupJoinRequests.status })
      .from(groupJoinRequests)
      .where(
        and(
          eq(groupJoinRequests.groupId, groupId),
          eq(groupJoinRequests.requestedRealName, 'Outsider Doctor'),
        ),
      );

    expect(initialRequest.statusCode).toBe(202);
    expect(claimed.statusCode).toBe(201);
    expect(request).toEqual({ status: 'resolved' });
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
    const oldCodeClaim = await claimGroup('candidate-token', '5678');
    const newCodeClaim = await claimGroup('candidate-token', '6789');

    expect(regenerated.statusCode).toBe(200);
    expect(regenerated.json()).toMatchObject({ groupCode: '6789', version: 2 });
    expect(oldCodeClaim.statusCode).toBe(404);
    expect(newCodeClaim.statusCode).toBe(201);
  });

  it('limits repeated code guesses before resolving group membership', async () => {
    const responses = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      responses.push(await claimGroup('outsider-token', '9999'));
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

  function claimGroup(token: string, groupCode: string) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: { groupCode },
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
  await client.database.execute(sql`DROP TABLE IF EXISTS rotation_members`);
  await client.database.execute(sql`DROP TABLE IF EXISTS rotation_rules`);
  await client.database.execute(sql`DROP TABLE IF EXISTS shift_types`);
  await client.database.execute(sql`DROP TABLE IF EXISTS member_schedule_roles`);
  await client.database.execute(sql`DROP TABLE IF EXISTS schedule_roles`);
  await client.database.execute(sql`DROP TABLE IF EXISTS group_join_requests`);
  await client.database.execute(sql`DROP TABLE IF EXISTS group_code_attempts`);
  await client.database.execute(sql`DROP TABLE IF EXISTS group_member_contacts`);
  await client.database.execute(sql`DROP TABLE IF EXISTS group_memberships`);
  await client.database.execute(sql`DROP TABLE IF EXISTS roster_entries`);
  await client.database.execute(sql`DROP TABLE IF EXISTS idempotency_keys`);
  await client.database.execute(sql`DROP TABLE IF EXISTS \`groups\``);
  await client.database.execute(sql`DROP TABLE IF EXISTS user_profiles`);
  await client.database.execute(sql`DROP TABLE IF EXISTS users`);
  await client.database.execute(sql`DROP TABLE IF EXISTS __drizzle_migrations`);
  await client.database.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
}
