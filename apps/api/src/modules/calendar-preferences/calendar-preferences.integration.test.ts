import { fileURLToPath } from 'node:url';

import type { CalendarPreferences, SchedulingConfig } from '@schedule/contracts';
import {
  createTestDatabaseClient,
  migrateDatabase,
  type DatabaseClient,
  type DatabaseConnectionOptions,
} from '@schedule/database';
import { insertDirectMembership } from '@schedule/test-fixtures';
import { sql } from 'drizzle-orm';
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
    const groupId = await createGroup('Nurse schedule', '7319');
    await insertDirectMembership(client, { groupCode: '7319', realName: 'Member Nurse' });
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
    const groupId = await createGroup('First group', '7320');
    const otherGroupId = await createGroup('Other group', '7321');
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

  async function createGroup(name: string, groupCode: string): Promise<string> {
    const response = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      payload: { groupCode, name },
      url: '/groups',
    });
    expect(response.statusCode).toBe(201);
    return (response.json() as { id: string }).id;
  }

  function getConfig(groupId: string) {
    return app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'GET',
      url: `/groups/${groupId}/config`,
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

async function resetDatabase(client: DatabaseClient): Promise<void> {
  await client.database.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
  const tables = [
    'directory_search_aliases',
    'directory_contact_methods',
    'directory_entries',
    'directory_source_documents',
    'directory_import_batches',
    'directory_campuses',
    'invite_tokens',
    'visitor_access_logs',
    'backup_archives',
    'platform_job_runs',
    'manual_schedule_cells',
    'manual_schedule_template_members',
    'manual_schedule_templates',
    'duty_adjustments',
    'workflow_sequence_allocations',
    'notification_deliveries',
    'notifications',
    'notification_preferences',
    'notification_settings',
    'web_push_subscriptions',
    'notification_batches',
    'holiday_dates',
    'holiday_calendar_versions',
    'statistics_recalc_checks',
    'statistics_snapshots',
    'export_jobs',
    'shift_assignments',
    'schedule_periods',
    'audit_logs',
    'schedule_events',
    'rotation_members',
    'rotation_rules',
    'shift_types',
    'member_schedule_roles',
    'schedule_roles',
    'group_join_requests',
    'guest_schedule_access_attempts',
    'membership_claim_requests',
    'group_code_attempts',
    'group_member_contacts',
    'leave_requests',
    'swap_requests',
    'group_memberships',
    'roster_entries',
    'idempotency_keys',
    'groups',
    'user_password_credentials',
    'user_auth_identities',
    'user_profiles',
    'users',
    '__drizzle_migrations',
  ] as const;
  for (const table of tables) {
    await client.database.execute(sql.raw(`DROP TABLE IF EXISTS \`${table}\``));
  }
  await client.database.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
}
