import { fileURLToPath } from 'node:url';

import type {
  HolidayCalendarVersion,
  HolidayCoverage,
  HolidayImportPreview,
  HolidayReadModel,
} from '@schedule/contracts';
import {
  createTestDatabaseClient,
  migrateDatabase,
  type DatabaseClient,
  type DatabaseConnectionOptions,
} from '@schedule/database';
import {
  holidays2025Fixture,
  holidays2026Fixture,
  holidays2027Fixture,
} from '@schedule/test-fixtures';
import { sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AuthPort } from '../../adapters/auth/auth-port.js';
import { createApp } from '../../app.js';
import { HolidayAlertJob } from '../../jobs/holiday-alerts.js';

const migrationsDirectory = fileURLToPath(new URL('../../../../../migrations', import.meta.url));
const databaseOptions = getTestDatabaseOptions();
const describeWithDatabase = databaseOptions === undefined ? describe.skip : describe;

describeWithDatabase('holiday data management', () => {
  let app: ReturnType<typeof createApp>;
  let client: DatabaseClient;

  beforeEach(async () => {
    client = createTestDatabaseClient(databaseOptions as DatabaseConnectionOptions);
    await resetDatabase(client);
    await migrateDatabase(client, migrationsDirectory);
    app = createApp({
      authPort: createFakeAuthPort({
        'admin-token': 'cloudbase-admin',
        'member-token': 'cloudbase-member',
        'outsider-token': 'cloudbase-outsider',
      }),
      databaseClient: client,
      holidayAdminUids: new Set(['cloudbase-admin']),
      logger: false,
    });
    await registerUser('admin-token', 'Platform Admin');
    await registerUser('member-token', 'Member Doctor');
    await registerUser('outsider-token', 'Outside Doctor');
  });

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
    }
    if (client !== undefined) {
      await client.close();
    }
  });

  it('restricts holiday mutations to platform administrators', async () => {
    const memberPreview = await app.inject({
      headers: { authorization: 'Bearer member-token' },
      method: 'POST',
      payload: { dates: holidays2026Fixture, year: 2026 },
      url: '/holidays/import-preview',
    });
    expect(memberPreview.statusCode).toBe(403);

    const memberImport = await app.inject({
      headers: { authorization: 'Bearer member-token' },
      method: 'POST',
      payload: { dates: holidays2026Fixture, year: 2026 },
      url: '/holidays/import',
    });
    expect(memberImport.statusCode).toBe(403);

    expect(
      (
        await app.inject({
          headers: { authorization: 'Bearer member-token' },
          method: 'GET',
          url: '/holidays/versions',
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          headers: { authorization: 'Bearer member-token' },
          method: 'GET',
          url: '/holidays/coverage',
        })
      ).statusCode,
    ).toBe(403);

    const anonymousPreview = await app.inject({
      method: 'POST',
      payload: { dates: holidays2026Fixture, year: 2026 },
      url: '/holidays/import-preview',
    });
    expect(anonymousPreview.statusCode).toBe(401);
  });

  it('previews the diff before import and never mutates a confirmed version', async () => {
    const imported = await importCalendar('admin-token', 2026, holidays2026Fixture);
    expect(imported.statusCode).toBe(201);
    const calendarVersionId = (imported.json() as { calendarVersionId: string }).calendarVersionId;

    const previewBeforeImport = (
      await importPreview('admin-token', 2026, holidays2026Fixture)
    ).json() as HolidayImportPreview;
    expect(previewBeforeImport).toMatchObject({
      addedCount: holidays2026Fixture.length,
      changedCount: 0,
      removedCount: 0,
      unchangedCount: 0,
    });

    await confirmVersion('admin-token', calendarVersionId);
    const confirmedPreview = (
      await importPreview('admin-token', 2026, holidays2026Fixture)
    ).json() as HolidayImportPreview;
    expect(confirmedPreview).toMatchObject({
      addedCount: 0,
      changedCount: 0,
      removedCount: 0,
      unchangedCount: holidays2026Fixture.length,
      latestConfirmedVersion: 1,
    });

    const lastEntry = holidays2026Fixture[holidays2026Fixture.length - 1];
    const changedInput = [
      ...holidays2026Fixture.slice(0, -1),
      {
        date: lastEntry?.date ?? '2026-10-01',
        holidayName: '国庆节调休',
        isOffDay: false,
        isWorkday: true,
      },
    ];
    const changedPreview = (
      await importPreview('admin-token', 2026, changedInput)
    ).json() as HolidayImportPreview;
    expect(changedPreview).toMatchObject({
      addedCount: 0,
      changedCount: 1,
      removedCount: 0,
      unchangedCount: holidays2026Fixture.length - 1,
    });

    const secondImport = await importCalendar('admin-token', 2026, holidays2026Fixture);
    expect(secondImport.statusCode).toBe(201);
    expect((secondImport.json() as { version: number }).version).toBe(2);

    const readAfterReimport = (await getHolidays('member-token', 2026)).json() as HolidayReadModel;
    expect(readAfterReimport.confirmed).toBe(true);
    expect(readAfterReimport.dates).toHaveLength(holidays2026Fixture.length);
    expect(readAfterReimport.dates.some((entry) => entry.holidayName === '国庆节')).toBe(true);
  });

  it('keeps confirmed holiday dates readable while drafts stay hidden', async () => {
    const draft = await importCalendar('admin-token', 2026, holidays2026Fixture);
    const calendarVersionId = (draft.json() as { calendarVersionId: string }).calendarVersionId;

    const beforeConfirm = (await getHolidays('member-token', 2026)).json() as HolidayReadModel;
    expect(beforeConfirm).toMatchObject({ confirmed: false, dates: [] });

    const versionsBefore = (
      await listVersions('admin-token', 2026)
    ).json() as HolidayCalendarVersion[];
    expect(versionsBefore).toHaveLength(1);
    expect(versionsBefore[0]).toMatchObject({
      dateCount: holidays2026Fixture.length,
      status: 'draft',
      version: 1,
      year: 2026,
    });

    const confirmed = await confirmVersion('admin-token', calendarVersionId);
    expect(confirmed.statusCode).toBe(200);
    expect((confirmed.json() as HolidayCalendarVersion).status).toBe('confirmed');

    const afterConfirm = (await getHolidays('member-token', 2026)).json() as HolidayReadModel;
    expect(afterConfirm.confirmed).toBe(true);
    expect(afterConfirm.dates).toHaveLength(holidays2026Fixture.length);
    expect(afterConfirm.dates[0]).toMatchObject({
      date: '2026-01-01',
      holidayName: '元旦',
      isOffDay: true,
      isWorkday: false,
    });

    const duplicateConfirm = await confirmVersion('admin-token', calendarVersionId);
    expect(duplicateConfirm.statusCode).toBe(409);

    const invalidImport = await app.inject({
      headers: { authorization: 'Bearer admin-token' },
      method: 'POST',
      payload: {
        dates: [{ date: '2026-01-01', holidayName: '元旦', isOffDay: true, isWorkday: true }],
        year: 2026,
      },
      url: '/holidays/import',
    });
    expect(invalidImport.statusCode).toBe(400);

    const wrongYearImport = await app.inject({
      headers: { authorization: 'Bearer admin-token' },
      method: 'POST',
      payload: {
        dates: [{ date: '2025-01-01', holidayName: '元旦', isOffDay: true, isWorkday: false }],
        year: 2026,
      },
      url: '/holidays/import',
    });
    expect(wrongYearImport.statusCode).toBe(400);

    const duplicateDateImport = await app.inject({
      headers: { authorization: 'Bearer admin-token' },
      method: 'POST',
      payload: {
        dates: [
          { date: '2026-01-01', holidayName: '元旦', isOffDay: true, isWorkday: false },
          { date: '2026-01-01', holidayName: '元旦补休', isOffDay: true, isWorkday: false },
        ],
        year: 2026,
      },
      url: '/holidays/import',
    });
    expect(duplicateDateImport.statusCode).toBe(400);
  });

  it('preserves historical versions when a newer year is imported', async () => {
    const imported2025 = await importCalendar('admin-token', 2025, holidays2025Fixture);
    const version2025 = (imported2025.json() as { calendarVersionId: string }).calendarVersionId;
    await confirmVersion('admin-token', version2025);
    await importCalendar('admin-token', 2026, holidays2026Fixture);

    const versionRows = (
      await client.database.execute(
        sql`SELECT COUNT(*) AS count, year
            FROM holiday_calendar_versions
            GROUP BY year
            ORDER BY year`,
      )
    )[0] as unknown as readonly { count: number; year: number }[];
    expect(versionRows.map((row) => ({ count: row.count, year: row.year }))).toEqual([
      { count: 1, year: 2025 },
      { count: 1, year: 2026 },
    ]);

    const holiday2025Rows = (
      await client.database.execute(
        sql`SELECT COUNT(*) AS count
            FROM holiday_dates d
            JOIN holiday_calendar_versions v ON v.id = d.calendar_version_id
            WHERE v.year = 2025`,
      )
    )[0] as unknown as readonly { count: number }[];
    expect(holiday2025Rows).toEqual([{ count: holidays2025Fixture.length }]);
  });

  it('reports coverage and alerts platform administrators when the next year is missing', async () => {
    const coverage = (
      await app.inject({
        headers: { authorization: 'Bearer admin-token' },
        method: 'GET',
        url: '/holidays/coverage',
      })
    ).json() as HolidayCoverage;
    expect(coverage.missingNextYear).toBe(true);
    expect(coverage.nextYear).toBe(2027);

    const job = new HolidayAlertJob(client, new Set(['cloudbase-admin']));
    const now = new Date('2026-08-02T00:00:00.000Z');
    const firstRun = await job.run(now);
    expect(firstRun.created).toBe(1);
    expect(firstRun.adminCount).toBe(1);

    const adminNotifications = (
      await app.inject({
        headers: { authorization: 'Bearer admin-token' },
        method: 'GET',
        url: '/notifications',
      })
    ).json() as { notifications: readonly { notificationType: string; payload?: object }[] };
    expect(adminNotifications.notifications[0]?.notificationType).toBe('holiday_data_missing');
    expect(adminNotifications.notifications[0]?.payload).toMatchObject({ year: 2027 });

    const secondRun = await job.run(now);
    expect(secondRun.created).toBe(0);
    expect(secondRun.duplicate).toBe(1);

    const imported = await importCalendar('admin-token', 2027, holidays2027Fixture);
    await confirmVersion(
      'admin-token',
      (imported.json() as { calendarVersionId: string }).calendarVersionId,
    );
    const afterImportRun = await job.run(now);
    expect(afterImportRun.created).toBe(0);
    expect(afterImportRun.duplicate).toBe(0);
  });

  it('writes audit records for imports and confirmations', async () => {
    const imported = await importCalendar('admin-token', 2026, holidays2026Fixture);
    const calendarVersionId = (imported.json() as { calendarVersionId: string }).calendarVersionId;
    await confirmVersion('admin-token', calendarVersionId);

    const auditRows = (
      await client.database.execute(sql`SELECT action FROM audit_logs ORDER BY occurred_at`)
    )[0] as unknown as readonly { action: string }[];
    expect(auditRows.map((row) => row.action)).toEqual([
      'holiday_calendar_import',
      'holiday_calendar_confirm',
    ]);
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

  async function importPreview(
    token: string,
    year: number,
    dates: readonly { date: string; holidayName: string; isOffDay: boolean; isWorkday: boolean }[],
  ) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: { dates, year },
      url: '/holidays/import-preview',
    });
  }

  async function importCalendar(
    token: string,
    year: number,
    dates: readonly { date: string; holidayName: string; isOffDay: boolean; isWorkday: boolean }[],
  ) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: { dates, year },
      url: '/holidays/import',
    });
  }

  async function confirmVersion(token: string, calendarVersionId: string) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      url: `/holidays/versions/${calendarVersionId}/confirm`,
    });
  }

  async function listVersions(token: string, year: number) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: `/holidays/versions?year=${year}`,
    });
  }

  async function getHolidays(token: string, year: number) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: `/holidays?year=${year}`,
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
