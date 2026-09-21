import { randomUUID } from 'node:crypto';
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
import { and, eq, sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AuthPort } from '../../adapters/auth/auth-port.js';
import { createApp } from '../../app.js';
import type { WechatGateway } from '../wechat/wechat-gateway.js';
import { GroupService } from './group-service.js';

const migrationsDirectory = fileURLToPath(new URL('../../../../../migrations', import.meta.url));
const databaseOptions = getTestDatabaseOptions();
const describeWithDatabase = databaseOptions === undefined ? describe.skip : describe;

describeWithDatabase('groups and roster claiming', () => {
  let app: ReturnType<typeof createApp>;
  let client: DatabaseClient;
  let qrGatewayCalls: string[];

  beforeEach(async () => {
    client = createTestDatabaseClient(databaseOptions as DatabaseConnectionOptions);
    qrGatewayCalls = [];
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
      wechatGateway: createQrGateway((environment) => qrGatewayCalls.push(environment)),
      wechatSessionSecret: 'group-routes-binding-secret-0123456789abcdef',
    });
    app.addHook('preValidation', (request, _reply, done) => {
      if (
        (request.method === 'POST' || request.method === 'PUT' || request.method === 'DELETE') &&
        request.headers['idempotency-key'] === undefined
      ) {
        request.headers['idempotency-key'] = randomUUID();
      }
      done();
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

  it('creates independent NULL-code groups across concurrent connections', async () => {
    const firstClient = createDatabaseClient(databaseOptions as DatabaseConnectionOptions);
    const secondClient = createDatabaseClient(databaseOptions as DatabaseConnectionOptions);

    try {
      const [first, second] = await Promise.allSettled([
        new GroupService(firstClient).create(
          { cloudbaseUid: 'cloudbase-owner' },
          { name: 'Concurrent group one', operationId: randomUUID() },
        ),
        new GroupService(secondClient).create(
          { cloudbaseUid: 'cloudbase-other-owner' },
          { name: 'Concurrent group two', operationId: randomUUID() },
        ),
      ]);

      expect([first, second].filter((result) => result.status === 'fulfilled')).toHaveLength(2);
      expect([first, second].filter((result) => result.status === 'rejected')).toHaveLength(0);
    } finally {
      await firstClient.close();
      await secondClient.close();
    }

    const [storedGroup] = await client.database
      .select({ name: groups.name })
      .from(groups)
      .where(sql`${groups.name} LIKE 'Concurrent group%'`);
    const [ownerMembership] = await client.database
      .select({ role: groupMemberships.role })
      .from(groupMemberships)
      .innerJoin(groups, eq(groups.id, groupMemberships.groupId))
      .where(
        and(
          sql`${groups.name} LIKE 'Concurrent group%'`,
          eq(groupMemberships.userId, groups.ownerUserId),
        ),
      );

    expect(storedGroup).toEqual({ name: expect.stringContaining('Concurrent') });
    expect(ownerMembership).toEqual({ role: 'owner' });
  });

  it('persists the requested visitor QR environment until the key is refreshed', async () => {
    const created = await createGroup('Permanent QR group');
    const group = created.json() as { id: string; version: number };
    const first = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'GET',
      url: `/groups/${group.id}/visitor-qr?environment=trial`,
    });
    expect(first.statusCode, first.body).toBe(200);
    expect(qrGatewayCalls).toEqual(['trial']);

    await app.close();
    app = createApp({
      authPort: createFakeAuthPort({ 'owner-token': 'cloudbase-owner' }),
      databaseClient: client,
      logger: false,
      wechatGateway: createQrGateway((environment) => qrGatewayCalls.push(environment)),
      wechatSessionSecret: 'group-routes-binding-secret-0123456789abcdef',
    });
    const persisted = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'GET',
      url: `/groups/${group.id}/visitor-qr?environment=trial`,
    });
    expect(persisted.statusCode, persisted.body).toBe(200);
    expect(qrGatewayCalls).toHaveLength(1);

    const refreshed = await app.inject({
      headers: { authorization: 'Bearer owner-token', 'idempotency-key': randomUUID() },
      method: 'PUT',
      payload: { expectedVersion: group.version },
      url: `/groups/${group.id}/visitor-key`,
    });
    expect(refreshed.statusCode, refreshed.body).toBe(200);
    const regenerated = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'GET',
      url: `/groups/${group.id}/visitor-qr?environment=trial`,
    });
    expect(regenerated.statusCode, regenerated.body).toBe(200);
    expect(qrGatewayCalls.slice(1)).toEqual(['trial']);
    expect(regenerated.json()).not.toEqual(first.json());
  });

  it('replays group and roster writes while rejecting changed fingerprints and stale versions', async () => {
    const createOperationId = randomUUID();
    const createPayload = {
      name: 'Idempotent group',
      operationId: createOperationId,
    };
    const firstCreate = await app.inject({
      headers: {
        authorization: 'Bearer owner-token',
        'idempotency-key': createOperationId,
      },
      method: 'POST',
      payload: createPayload,
      url: '/groups',
    });
    const replayCreate = await app.inject({
      headers: {
        authorization: 'Bearer owner-token',
        'idempotency-key': createOperationId,
      },
      method: 'POST',
      payload: createPayload,
      url: '/groups',
    });
    const changedCreate = await app.inject({
      headers: {
        authorization: 'Bearer owner-token',
        'idempotency-key': createOperationId,
      },
      method: 'POST',
      payload: { ...createPayload, name: 'Changed group' },
      url: '/groups',
    });
    expect(firstCreate.statusCode, firstCreate.body).toBe(201);
    expect(replayCreate.statusCode, replayCreate.body).toBe(201);
    expect(replayCreate.json()).toEqual(firstCreate.json());
    expect(changedCreate.statusCode).toBe(409);

    const group = firstCreate.json() as { id: string; version: number };
    const rosterOperationId = randomUUID();
    const rosterPayload = { operationId: rosterOperationId, realNames: ['Replay Doctor'] };
    const firstRoster = await app.inject({
      headers: {
        authorization: 'Bearer owner-token',
        'idempotency-key': rosterOperationId,
      },
      method: 'POST',
      payload: rosterPayload,
      url: `/groups/${group.id}/roster-entries`,
    });
    const replayRoster = await app.inject({
      headers: {
        authorization: 'Bearer owner-token',
        'idempotency-key': rosterOperationId,
      },
      method: 'POST',
      payload: rosterPayload,
      url: `/groups/${group.id}/roster-entries`,
    });
    expect(firstRoster.statusCode, firstRoster.body).toBe(200);
    expect(replayRoster.json()).toEqual(firstRoster.json());

    const renameOperationId = randomUUID();
    const renamePayload = {
      expectedVersion: group.version,
      name: 'Idempotent group renamed',
      operationId: renameOperationId,
    };
    const renamed = await app.inject({
      headers: {
        authorization: 'Bearer owner-token',
        'idempotency-key': renameOperationId,
      },
      method: 'PUT',
      payload: renamePayload,
      url: `/groups/${group.id}/name`,
    });
    const renameReplay = await app.inject({
      headers: {
        authorization: 'Bearer owner-token',
        'idempotency-key': renameOperationId,
      },
      method: 'PUT',
      payload: renamePayload,
      url: `/groups/${group.id}/name`,
    });
    const staleOperationId = randomUUID();
    const staleRename = await app.inject({
      headers: {
        authorization: 'Bearer owner-token',
        'idempotency-key': staleOperationId,
      },
      method: 'PUT',
      payload: {
        expectedVersion: group.version,
        name: 'Stale rename',
        operationId: staleOperationId,
      },
      url: `/groups/${group.id}/name`,
    });
    expect(renamed.statusCode, renamed.body).toBe(200);
    expect(renameReplay.json()).toEqual(renamed.json());
    expect(staleRename.statusCode).toBe(409);
    expect(staleRename.json()).toMatchObject({
      error: { latestData: { id: group.id, objectType: 'group', version: group.version + 1 } },
    });

    const [counts] = await client.database.execute<{ count: number }>(
      sql`SELECT COUNT(*) AS count FROM roster_entries
          WHERE group_id = ${group.id} AND real_name = 'Replay Doctor'`,
    );
    expect(counts).toEqual([{ count: 1 }]);
  });

  it('creates without a code and never claims via retired code routes', async () => {
    const missingCode = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      payload: { name: 'No code group' },
      url: '/groups',
    });
    const group = await createGroup('Manual code group');
    const groupId = (group.json() as { id: string }).id;
    const unknownClaim = await app.inject({
      headers: { authorization: 'Bearer outsider-token' },
      method: 'POST',
      payload: { groupCode: '7654' },
      url: '/groups/claim',
    });
    await addRosterEntry(groupId, 'Candidate Doctor');
    const matchingClaim = await app.inject({
      headers: { authorization: 'Bearer candidate-token' },
      method: 'POST',
      payload: { groupCode: '7654' },
      url: '/groups/claim',
    });

    expect(missingCode.statusCode).toBe(201);
    expect(unknownClaim.statusCode).toBe(404);
    expect(matchingClaim.statusCode).toBe(404);
  });

  it('rejects duplicate pending roster names and keeps roster changes owner-only', async () => {
    const group = await createGroup('Roster group');
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
    const group = await createGroup('Roster merge group');
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
      payload: { expectedVersion: 0, shortPhone: '6601' },
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

    await insertDirectMembership(client, { groupId, realName: 'Outsider Doctor' });
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
    const group = await createGroup('Delete member group');
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
      readonly version: number;
    }[];
    const outsider = rows.find((row) => row.realName === 'Outsider Doctor');
    const owner = rows.find((row) => row.role === 'owner');
    expect(outsider).toBeDefined();
    expect(owner).toBeDefined();

    const contact = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'PUT',
      payload: { expectedVersion: 0, shortPhone: '6602' },
      url: `/groups/${groupId}/members/${outsider?.id}/contact`,
    });
    expect(contact.statusCode).toBe(200);
    await client.database.execute(
      sql`INSERT INTO leave_requests (id, group_id, membership_id, leave_type, starts_at, ends_at, reason, status)
          VALUES ('00000000-0000-4000-8000-000000000003', ${groupId}, ${outsider?.id}, 'sick',
                  '2026-08-05 00:00:00', '2026-08-05 23:59:59', 'test', 'pending')`,
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
      payload: { expectedVersion: 1 },
      url: `/groups/${groupId}/members/00000000-0000-4000-8000-000000000004`,
    });
    expect(memberForbidden.statusCode).toBe(403);

    const deletedRoster = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'DELETE',
      payload: { expectedVersion: 1 },
      url: `/groups/${groupId}/members/00000000-0000-4000-8000-000000000004`,
    });
    expect(deletedRoster.statusCode).toBe(200);

    const deletedMember = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'DELETE',
      payload: { expectedVersion: outsider?.version },
      url: `/groups/${groupId}/members/${outsider?.id}`,
    });
    expect(deletedMember.statusCode).toBe(200);

    const ownerBlocked = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'DELETE',
      payload: { expectedVersion: owner?.version },
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

  it('does not offer code regeneration or claim even to the owner', async () => {
    const group = await createGroup('Code rotation group');
    const groupSnapshot = group.json() as { id: string; version: number };
    const groupId = groupSnapshot.id;
    await addRosterEntry(groupId, 'Candidate Doctor');

    const regenerated = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'PUT',
      payload: { expectedVersion: groupSnapshot.version, groupCode: '6789' },
      url: `/groups/${groupId}/group-code`,
    });
    const oldCodeClaim = await app.inject({
      headers: { authorization: 'Bearer candidate-token' },
      method: 'POST',
      payload: { groupCode: '5678' },
      url: '/groups/claim',
    });

    expect(regenerated.statusCode).toBe(404);
    const [stored] = await client.database
      .select({ id: groups.id })
      .from(groups)
      .where(eq(groups.id, groupId));
    expect(stored?.id).toBe(groupId);
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
        { name: 'Blocked group', operationId: randomUUID() },
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 });

    const storedGroups = await client.database
      .select({ id: groups.id })
      .from(groups)
      .where(eq(groups.name, 'Blocked group'));

    expect(storedGroups).toEqual([]);
  });

  it('supports guest join, guest leave, and member leave without legacy rejoin links', async () => {
    const group = await createGroup('Membership group');
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
      groupId,
      realName: 'Candidate Doctor',
    });

    await client.database.execute(
      sql`UPDATE users SET mobile_phone='13800005555',mobile_phone_updated_at='2026-09-01 08:00:00' WHERE cloudbase_uid='cloudbase-candidate'`,
    );
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
      version: number;
    }>;
    expect(memberRows.find((row) => row.realName === 'Candidate Doctor')?.isUnclaimed).toBe(true);

    const unclaimedMembershipId = memberRows.find((row) => row.realName === 'Candidate Doctor')
      ?.id as string;
    const [placeholderPhone] = await client.database.execute(
      sql`SELECT u.mobile_phone AS phone FROM users u JOIN group_memberships m ON m.user_id=u.id WHERE m.id=${unclaimedMembershipId}`,
    );
    expect((placeholderPhone as unknown as { phone: string }[])[0]!.phone).toBe('13800005555');
    const retired = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      url: `/groups/${groupId}/invite-links`,
    });
    expect(retired.statusCode).toBe(404);
  });

  it('rejects owner leave and non-owner group name changes', async () => {
    const group = await createGroup('Owner group');
    const groupSnapshot = group.json() as { id: string; version: number };
    const groupId = groupSnapshot.id;

    const ownerLeave = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      url: `/groups/${groupId}/leave`,
    });
    expect(ownerLeave.statusCode).toBe(409);

    const outsiderRename = await app.inject({
      headers: { authorization: 'Bearer other-owner-token' },
      method: 'PUT',
      payload: { expectedVersion: groupSnapshot.version, name: 'Renamed by outsider' },
      url: `/groups/${groupId}/name`,
    });
    expect(outsiderRename.statusCode).toBe(403);

    const ownerRename = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'PUT',
      payload: { expectedVersion: groupSnapshot.version, name: 'Renamed group' },
      url: `/groups/${groupId}/name`,
    });
    expect(ownerRename.statusCode).toBe(200);
    expect((ownerRename.json() as { name: string }).name).toBe('Renamed group');
  });

  it('supports dissolve and restore by the owner', async () => {
    const group = await createGroup('Dissolve group');
    const groupSnapshot = group.json() as { id: string; version: number };
    const groupId = groupSnapshot.id;

    const dissolve = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'DELETE',
      payload: { expectedVersion: groupSnapshot.version },
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
    const dissolvedGroup = (dissolved.json() as Array<{ version: number }>)[0]!;

    const restore = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      payload: { expectedVersion: dissolvedGroup.version },
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

  function createGroup(name: string) {
    return app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      payload: { name },
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

function createQrGateway(onQr: (environment: string) => void): WechatGateway {
  let sequence = 0;
  return {
    isConfigured: true,
    async exchangeCode() {
      throw new Error('not used');
    },
    async getUnlimitedQr(scene, _page, environment) {
      onQr(environment);
      sequence += 1;
      return Uint8Array.from([0x89, 0x50, 0x4e, 0x47, ...Buffer.from(scene), sequence]);
    },
    async sendSubscribeMessage() {
      throw new Error('not used');
    },
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
  await client.database.execute(sql`DROP TABLE IF EXISTS group_visitor_qr_assets`);
  await client.database.execute(sql`DROP TABLE IF EXISTS group_calendar_changes`);
  await client.database.execute(sql`DROP TABLE IF EXISTS group_visitor_links`);
  await client.database.execute(sql`DROP TABLE IF EXISTS group_memberships`);
  await client.database.execute(sql`DROP TABLE IF EXISTS roster_entries`);
  await client.database.execute(sql`DROP TABLE IF EXISTS idempotency_keys`);
  await client.database.execute(sql`DROP TABLE IF EXISTS \`groups\``);
  await client.database.execute(sql`DROP TABLE IF EXISTS user_auth_identities`);
  await client.database.execute(sql`DROP TABLE IF EXISTS user_password_credentials`);
  await client.database.execute(sql`DROP TABLE IF EXISTS user_profile_avatars`);
  await client.database.execute(sql`DROP TABLE IF EXISTS user_profiles`);
  await client.database.execute(sql`DROP TABLE IF EXISTS wechat_admin_binding_tickets`);
  await client.database.execute(sql`DROP TABLE IF EXISTS wechat_identity_detachments`);
  await client.database.execute(sql`DROP TABLE IF EXISTS wechat_link_tokens`);
  await client.database.execute(sql`DROP TABLE IF EXISTS wechat_union_accounts`);
  await client.database.execute(sql`DROP TABLE IF EXISTS users`);
  await client.database.execute(sql`DROP TABLE IF EXISTS __drizzle_migrations`);
  await client.database.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
}
