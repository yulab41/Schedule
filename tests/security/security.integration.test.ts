import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import {
  createTestDatabaseClient,
  migrateDatabase,
  type DatabaseClient,
  type DatabaseConnectionOptions,
} from '@schedule/database';
import { sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../apps/api/src/app.js';

const migrationsDirectory = fileURLToPath(new URL('../../migrations', import.meta.url));
const databaseOptions = getTestDatabaseOptions();
const describeWithDatabase = databaseOptions === undefined ? describe.skip : describe;

describeWithDatabase('security acceptance matrix', () => {
  let app: ReturnType<typeof createApp>;
  let client: DatabaseClient;

  beforeEach(async () => {
    client = createTestDatabaseClient(databaseOptions as DatabaseConnectionOptions);
    await resetDatabase(client);
    await migrateDatabase(client, migrationsDirectory);
    app = createApp({
      authPort: createFakeAuthPort({
        'group-a-owner': 'uid-a-owner',
        'group-a-member': 'uid-a-member',
        'group-b-owner': 'uid-b-owner',
      }),
      databaseClient: client,
      logger: false,
      platformAdminUids: new Set(['uid-a-owner']),
    });
    await registerUser('group-a-owner', 'A Owner');
    await registerUser('group-a-member', 'A Member');
    await registerUser('group-b-owner', 'B Owner');
  });

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
    }
    if (client !== undefined) {
      await client.close();
    }
  });

  it('never returns another group data to an authorized member of a different group', async () => {
    const groupA = await createGroup('group-a-owner', 'Group A', '1111');
    const groupB = await createGroup('group-b-owner', 'Group B', '2222');
    await app.inject({
      headers: { authorization: 'Bearer group-b-owner' },
      method: 'POST',
      payload: { realNames: ['Secret B Person'] },
      url: `/groups/${groupB}/roster-entries`,
    });

    const readEndpoints = [
      { method: 'GET', url: `/groups/${groupB}/calendar?businessMonth=2026-09` },
      { method: 'GET', url: `/groups/${groupB}/members` },
      { method: 'GET', url: `/groups/${groupB}/contacts` },
      { method: 'GET', url: `/groups/${groupB}/events` },
      { method: 'GET', url: `/groups/${groupB}/scheduling-config` },
    ] as const;
    for (const request of readEndpoints) {
      const response = await app.inject({
        headers: { authorization: 'Bearer group-a-member' },
        method: request.method,
        url: request.url,
      });
      expect(response.statusCode).toBe(403);
      expect(response.body).not.toContain('Group B');
      expect(response.body).not.toContain('2222');
      expect(response.body).not.toContain('Secret B Person');
    }

    const exportResponse = await app.inject({
      headers: { authorization: 'Bearer group-a-member' },
      method: 'POST',
      payload: { exportType: 'schedule', period: '2026-09' },
      url: `/groups/${groupB}/exports`,
    });
    expect(exportResponse.statusCode).toBe(403);
    expect(exportResponse.body).not.toContain('Group B');

    const eventDetail = await app.inject({
      headers: { authorization: 'Bearer group-a-member' },
      method: 'GET',
      url: `/groups/${groupB}/events/${randomUUID()}`,
    });
    expect(eventDetail.statusCode).toBe(403);

    void groupA;
  });

  it('rate-limits group-code guessing after five failed attempts', async () => {
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await app.inject({
        headers: { authorization: 'Bearer group-a-member' },
        method: 'POST',
        payload: { groupCode: '9999' },
        url: '/groups/claim',
      });
      statuses.push(response.statusCode);
    }

    expect(statuses.slice(0, 5)).toEqual([404, 404, 404, 404, 404]);
    expect(statuses[5]).toBe(429);
  });

  it('replays an idempotent approval without duplicating events or assignments', async () => {
    const groupA = await createGroup('group-a-owner', 'Group A', '3333');
    await joinGroupAsMember('group-a-owner', 'group-a-member', groupA, '3333', 'A Member');
    const startsAt = '2026-09-10T00:00:00.000Z';
    const endsAt = '2026-09-12T00:00:00.000Z';
    const created = await app.inject({
      headers: { authorization: 'Bearer group-a-member' },
      method: 'POST',
      payload: {
        endsAt,
        isAllDay: true,
        leaveType: 'sick',
        reason: '安全验收病假',
        startsAt,
      },
      url: `/groups/${groupA}/leave-requests`,
    });
    expect(created.statusCode).toBe(201);
    const leave = created.json() as { id: string; version: number };

    const preview = (
      await app.inject({
        headers: { authorization: 'Bearer group-a-owner' },
        method: 'POST',
        payload: {},
        url: `/groups/${groupA}/leave-requests/${leave.id}/preview`,
      })
    ).json() as {
      leaveRequestVersion: number;
      periodVersions: Record<string, number>;
      rulesVersion: number;
    };
    const operationId = randomUUID();
    const approvePayload = {
      expectedPeriodVersions: preview.periodVersions,
      expectedRulesVersion: preview.rulesVersion,
      expectedVersion: preview.leaveRequestVersion,
      operationId,
    };

    const first = await app.inject({
      headers: { authorization: 'Bearer group-a-owner' },
      method: 'POST',
      payload: approvePayload,
      url: `/groups/${groupA}/leave-requests/${leave.id}/approve`,
    });
    expect(first.statusCode).toBe(200);
    const second = await app.inject({
      headers: { authorization: 'Bearer group-a-owner' },
      method: 'POST',
      payload: approvePayload,
      url: `/groups/${groupA}/leave-requests/${leave.id}/approve`,
    });
    expect(second.statusCode).toBe(200);

    const [eventRows] = (await client.database.execute(
      sql`SELECT COUNT(*) AS count
          FROM schedule_events
          WHERE event_type = 'leave_request_approved' AND operation_id = ${operationId}`,
    )) as unknown as [{ count: number }[], unknown];
    expect(eventRows[0]?.count).toBe(1);

    const [auditRows] = (await client.database.execute(
      sql`SELECT COUNT(*) AS count FROM audit_logs WHERE operation_id = ${operationId}`,
    )) as unknown as [{ count: number }[], unknown];
    expect(auditRows[0]?.count).toBeLessThanOrEqual(1);

    const [leaves] = (await client.database.execute(
      sql`SELECT COUNT(*) AS count FROM leave_requests WHERE id = ${leave.id}`,
    )) as unknown as [{ count: number }[], unknown];
    expect(leaves[0]?.count).toBe(1);
  });

  it('rolls back a rejected approval without partial events', async () => {
    const groupA = await createGroup('group-a-owner', 'Group A', '4444');
    await joinGroupAsMember('group-a-owner', 'group-a-member', groupA, '4444', 'A Member');
    const created = await app.inject({
      headers: { authorization: 'Bearer group-a-member' },
      method: 'POST',
      payload: {
        endsAt: '2026-10-12T00:00:00.000Z',
        isAllDay: true,
        leaveType: 'other',
        reason: '回滚验收',
        startsAt: '2026-10-10T00:00:00.000Z',
      },
      url: `/groups/${groupA}/leave-requests`,
    });
    expect(created.statusCode).toBe(201);
    const leave = created.json() as { id: string; version: number };

    const staleApprove = await app.inject({
      headers: { authorization: 'Bearer group-a-owner' },
      method: 'POST',
      payload: {
        expectedPeriodVersions: {},
        expectedRulesVersion: 1,
        expectedVersion: leave.version + 99,
        operationId: randomUUID(),
      },
      url: `/groups/${groupA}/leave-requests/${leave.id}/approve`,
    });
    expect(staleApprove.statusCode).toBe(409);

    const [eventRows] = (await client.database.execute(
      sql`SELECT COUNT(*) AS count
          FROM schedule_events
          WHERE event_type = 'leave_request_approved'`,
    )) as unknown as [{ count: number }[], unknown];
    expect(eventRows[0]?.count).toBe(0);
  });

  async function registerUser(token: string, realName: string): Promise<void> {
    const response = await app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: { realName },
      url: '/users',
    });
    expect(response.statusCode).toBe(201);
  }

  async function createGroup(token: string, name: string, groupCode: string): Promise<string> {
    const response = await app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: { groupCode, name },
      url: '/groups',
    });
    expect(response.statusCode).toBe(201);
    return (response.json() as { id: string }).id;
  }

  async function joinGroupAsMember(
    ownerToken: string,
    memberToken: string,
    groupId: string,
    groupCode: string,
    realName: string,
  ): Promise<void> {
    const roster = await app.inject({
      headers: { authorization: `Bearer ${ownerToken}` },
      method: 'POST',
      payload: { realNames: [realName] },
      url: `/groups/${groupId}/roster-entries`,
    });
    expect(roster.statusCode).toBe(200);

    const claim = await app.inject({
      headers: { authorization: `Bearer ${memberToken}` },
      method: 'POST',
      payload: { groupCode },
      url: '/groups/claim',
    });
    expect(claim.statusCode).toBe(201);
  }
});

function createFakeAuthPort(tokens: Readonly<Record<string, string>>) {
  return {
    authenticate: async ({ authorization }: { authorization: string | undefined }) => {
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

async function resetDatabase(databaseClient: DatabaseClient): Promise<void> {
  await databaseClient.database.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
  const [tables] = (await databaseClient.database.execute(
    sql`SELECT TABLE_NAME AS t FROM information_schema.tables WHERE table_schema = DATABASE()`,
  )) as unknown as [{ t: string }[], unknown];
  for (const row of tables) {
    await databaseClient.database.execute(
      sql.raw(`DROP TABLE IF EXISTS \`${row.t.replaceAll('`', '``')}\``),
    );
  }
  await databaseClient.database.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
}
