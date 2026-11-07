import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import type { CalendarPreferences, SchedulingConfig } from '@schedule/contracts';
import {
  createTestDatabaseClient,
  migrateDatabase,
  type DatabaseClient,
  type DatabaseConnectionOptions,
} from '@schedule/database';
import { insertDirectMembership, resetDatabase } from '@schedule/test-fixtures';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AuthPort } from '../../adapters/auth/auth-port.js';
import { createApp } from '../../app.js';

const migrationsDirectory = fileURLToPath(new URL('../../../../../migrations', import.meta.url));
const databaseOptions = getTestDatabaseOptions();
const describeWithDatabase = databaseOptions === undefined ? describe.skip : describe;

describeWithDatabase('calendar preferences', () => {
  let app: ReturnType<typeof createApp>;
  let client: DatabaseClient;

  beforeEach(async () => {
    client = createTestDatabaseClient(databaseOptions as DatabaseConnectionOptions);
    await resetDatabase(client);
    await migrateDatabase(client, migrationsDirectory);
    app = createApp({
      authPort: createFakeAuthPort({
        'member-token': 'calendar-member',
        'outsider-token': 'calendar-outsider',
        'owner-token': 'calendar-owner',
      }),
      databaseClient: client,
      logger: false,
    });
    await registerUser('owner-token', 'Owner Nurse');
    await registerUser('member-token', 'Member Nurse');
    await registerUser('outsider-token', 'Outside Nurse');
  });

  afterEach(async () => {
    await app?.close();
    await client?.close();
  });

  it('persists administrator defaults and lets a member override only their own view', async () => {
    const groupId = await createGroup('Nurse schedule');
    await insertDirectMembership(client, { groupId, realName: 'Member Nurse' });
    const config = (await getConfig(groupId)).json() as SchedulingConfig;
    const shiftTypeId = config.shiftTypes.find((shiftType) => shiftType.isEnabled)?.id;
    expect(shiftTypeId).toBeDefined();

    const initial = (await getPreferences('member-token', groupId)).json() as CalendarPreferences;
    expect(initial).toMatchObject({
      canManageGroupDefaults: false,
      effectiveMonthShiftTypeId: null,
      effectiveView: 'month',
      memberDefaultView: null,
    });

    const groupUpdate = await updateGroupDefaults('owner-token', groupId, {
      defaultMonthShiftTypeId: shiftTypeId as string,
      defaultView: 'week',
    });
    expect(groupUpdate.statusCode).toBe(200);
    expect(groupUpdate.json()).toMatchObject({
      canManageGroupDefaults: true,
      effectiveMonthShiftTypeId: shiftTypeId,
      effectiveView: 'week',
    });

    const memberUpdate = await updateMine('member-token', groupId, {
      defaultMonthShiftTypeId: null,
      defaultView: 'list',
    });
    expect(memberUpdate.statusCode).toBe(200);
    expect(memberUpdate.json()).toMatchObject({
      effectiveMonthShiftTypeId: shiftTypeId,
      effectiveView: 'list',
      groupDefaultView: 'week',
      memberDefaultView: 'list',
    });

    const resetPreference = await updateMine('member-token', groupId, {
      defaultMonthShiftTypeId: null,
      defaultView: null,
    });
    expect(resetPreference.statusCode).toBe(200);
    expect((await getPreferences('member-token', groupId)).json()).toMatchObject({
      effectiveView: 'week',
      groupDefaultView: 'week',
      memberDefaultView: null,
    });

    expect(
      (
        await updateGroupDefaults('member-token', groupId, {
          defaultMonthShiftTypeId: null,
          defaultView: 'month',
        })
      ).statusCode,
    ).toBe(403);
    expect((await getPreferences('outsider-token', groupId)).statusCode).toBe(403);
  });

  it('rejects a default shift type that is not enabled in the current group', async () => {
    const groupId = await createGroup('First group');
    const otherGroupId = await createGroup('Other group');
    const otherConfig = (await getConfig(otherGroupId)).json() as SchedulingConfig;
    const otherShiftTypeId = otherConfig.shiftTypes.find((shiftType) => shiftType.isEnabled)?.id;

    const response = await updateGroupDefaults('owner-token', groupId, {
      defaultMonthShiftTypeId: otherShiftTypeId as string,
      defaultView: 'month',
    });
    expect(response.statusCode).toBe(400);
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

  async function createGroup(name: string): Promise<string> {
    const response = await app.inject({
      headers: {
        authorization: 'Bearer owner-token',
        'idempotency-key': randomUUID(),
      },
      method: 'POST',
      payload: { name },
      url: '/groups',
    });
    expect(response.statusCode).toBe(201);
    return (response.json() as { id: string }).id;
  }

  function getConfig(groupId: string) {
    return app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'GET',
      url: `/groups/${groupId}/scheduling-config`,
    });
  }

  function getPreferences(token: string, groupId: string) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: `/groups/${groupId}/calendar-preferences`,
    });
  }

  function updateGroupDefaults(
    token: string,
    groupId: string,
    payload: { readonly defaultMonthShiftTypeId: string | null; readonly defaultView: string },
  ) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'PUT',
      payload,
      url: `/groups/${groupId}/calendar-settings`,
    });
  }

  function updateMine(
    token: string,
    groupId: string,
    payload: {
      readonly defaultMonthShiftTypeId: string | null;
      readonly defaultView: string | null;
    },
  ) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'PUT',
      payload,
      url: `/groups/${groupId}/calendar-preferences/mine`,
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

function getTestDatabaseOptions(): DatabaseConnectionOptions | undefined {
  if (process.env.NODE_ENV !== 'test') return undefined;
  const port = Number(process.env.TEST_MYSQL_PORT ?? '3307');
  if (
    process.env.TEST_MYSQL_DATABASE === undefined ||
    process.env.TEST_MYSQL_PASSWORD === undefined ||
    process.env.TEST_MYSQL_USER === undefined ||
    !Number.isInteger(port)
  ) {
    return undefined;
  }
  return {
    database: process.env.TEST_MYSQL_DATABASE,
    host: process.env.TEST_MYSQL_HOST ?? '127.0.0.1',
    password: process.env.TEST_MYSQL_PASSWORD,
    port,
    user: process.env.TEST_MYSQL_USER,
  };
}
