import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  createDatabaseClient,
  migrateDatabase,
  users,
  accountOpenReceipts,
  type DatabaseClient,
  type DatabaseConnectionOptions,
} from '@schedule/database';
import { resetDatabase } from '@schedule/test-fixtures';
import { sql } from 'drizzle-orm';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { AccountActivityService, chinaActivityDay } from './account-activity-service.js';
import { PrivacyRetentionJob } from '../../jobs/privacy-retention.js';
import { createApp } from '../../app.js';
import { PasswordAuthService, hashPassword } from '../auth/password-auth-service.js';

const configured =
  process.env.NODE_ENV === 'test' &&
  process.env.TEST_MYSQL_DATABASE === 'schedule_test' &&
  process.env.TEST_MYSQL_PASSWORD !== undefined &&
  process.env.TEST_MYSQL_USER !== undefined;
const options: DatabaseConnectionOptions = {
  database: 'schedule_test',
  host: process.env.TEST_MYSQL_HOST ?? '127.0.0.1',
  password: process.env.TEST_MYSQL_PASSWORD ?? '',
  port: Number(process.env.TEST_MYSQL_PORT ?? 3307),
  user: process.env.TEST_MYSQL_USER ?? '',
};
const test =
  configured && ['127.0.0.1', 'localhost', '::1'].includes(options.host) ? describe : describe.skip;
const admin = { cloudbaseUid: 'activity-admin' },
  member = { cloudbaseUid: 'activity-member' };
test('account activity transactional statistics', () => {
  let client: DatabaseClient;
  let service: AccountActivityService;
  let memberId: string;
  let clock: Date;
  beforeEach(async () => {
    client = createDatabaseClient({ ...options, connectionLimit: 8 });
    await resetDatabase(client);
    await migrateDatabase(
      client,
      fileURLToPath(new URL('../../../../../migrations', import.meta.url)),
    );
    clock = new Date('2026-09-30T15:59:59.999Z');
    memberId = randomUUID();
    await client.database.insert(users).values([
      { id: randomUUID(), cloudbaseUid: admin.cloudbaseUid },
      { id: memberId, cloudbaseUid: member.cloudbaseUid },
    ]);
    service = new AccountActivityService(client, new Set([admin.cloudbaseUid]), () => clock);
  });
  afterEach(async () => {
    await client?.close();
  });
  const event = (time: Date) => ({ eventId: randomUUID(), openedAt: time.toISOString() });
  it('uses Beijing midnight, has honest empty history and resets only daily counters', async () => {
    expect(chinaActivityDay(clock)).toBe('2026-09-30');
    expect(await service.summary(admin, memberId)).toEqual({
      todayLoginCount: 0,
      todayOpenCount: 0,
      totalOpenCount: 0,
    });
    await service.recordLogin(memberId, 'wechat_manual');
    await service.recordOpen(member, event(clock));
    const first = await service.summary(admin, memberId);
    expect(first).toMatchObject({
      todayLoginCount: 1,
      todayOpenCount: 1,
      totalOpenCount: 1,
      lastLoginMethod: 'wechat_manual',
    });
    clock = new Date('2026-09-30T16:00:00.000Z');
    expect(await service.summary(admin, memberId)).toMatchObject({
      todayLoginCount: 0,
      todayOpenCount: 0,
      totalOpenCount: 1,
    });
    await service.recordLogin(memberId, 'wechat_auto');
    await service.recordOpen(member, event(clock));
    expect(await service.summary(admin, memberId)).toMatchObject({
      startedAt: first.startedAt,
      todayLoginCount: 1,
      todayOpenCount: 1,
      totalOpenCount: 2,
      lastLoginMethod: 'wechat_auto',
    });
  });
  it('deduplicates concurrent retries in a transaction and serializes distinct opens and logins', async () => {
    const input = event(clock);
    const results = await Promise.all(
      Array.from({ length: 8 }, () => service.recordOpen(member, input)),
    );
    expect(results.filter((result) => result.recorded)).toHaveLength(1);
    await Promise.all([
      service.recordLogin(memberId, 'password'),
      service.recordLogin(memberId, 'wechat_auto'),
      ...Array.from({ length: 5 }, () => service.recordOpen(member, event(clock))),
    ]);
    expect(await service.summary(admin, memberId)).toMatchObject({
      totalOpenCount: 6,
      todayOpenCount: 6,
      todayLoginCount: 2,
    });
  });
  it('attributes late retries to the original day and never lowers recent access', async () => {
    const yesterday = new Date(clock.valueOf() - 86400000);
    await service.recordOpen(member, event(clock));
    await service.recordOpen(member, event(yesterday));
    expect(await service.summary(admin, memberId)).toMatchObject({
      todayOpenCount: 1,
      totalOpenCount: 2,
      lastOpenedAt: clock.toISOString(),
    });
  });
  it('retains exact 30-day receipt boundary and cumulative summary; rejects expired replay', async () => {
    await service.recordOpen(member, event(clock));
    const boundary = new Date(clock.valueOf() - 30 * 86400000);
    await client.database.insert(accountOpenReceipts).values([
      { userId: memberId, eventId: randomUUID(), openedAt: boundary },
      { userId: memberId, eventId: randomUUID(), openedAt: new Date(boundary.valueOf() - 1) },
    ]);
    await new PrivacyRetentionJob(client, { batchSize: 1 }).run(clock);
    expect(await client.database.select().from(accountOpenReceipts)).toHaveLength(2);
    expect(await service.summary(admin, memberId)).toMatchObject({ totalOpenCount: 1 });
    await expect(service.recordOpen(member, event(boundary))).rejects.toMatchObject({
      statusCode: 400,
    });
  });
  it('rolls back receipt and summary together on database failure', async () => {
    await client.database.execute(
      sql.raw(
        "CREATE TRIGGER fail_activity_update BEFORE UPDATE ON account_activity_summaries FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'test failure'",
      ),
    );
    try {
      await expect(service.recordOpen(member, event(clock))).rejects.toThrow();
    } finally {
      await client.database.execute(sql.raw('DROP TRIGGER fail_activity_update'));
    }
    expect(await client.database.select().from(accountOpenReceipts)).toHaveLength(0);
    expect(await service.summary(admin, memberId)).toMatchObject({ totalOpenCount: 0 });
  });
  it('isolates switched accounts, denies anonymous/member summary and rejects spoofed IDs', async () => {
    const otherId = randomUUID();
    await client.database.insert(users).values({ id: otherId, cloudbaseUid: 'other' });
    const input = event(clock);
    await service.recordOpen(member, input);
    await service.recordOpen({ cloudbaseUid: 'other' }, input);
    expect(await service.summary(admin, otherId)).toMatchObject({ totalOpenCount: 1 });
    await expect(service.summary(member, otherId)).rejects.toMatchObject({ statusCode: 403 });
    const app = createApp({
      databaseClient: client,
      platformAdminUids: new Set([admin.cloudbaseUid]),
      authPort: {
        authenticate: async (request) =>
          request.authorization === 'Bearer member'
            ? member
            : request.authorization === 'Bearer admin'
              ? admin
              : undefined,
      },
      logger: false,
    });
    try {
      expect(
        (await app.inject({ method: 'POST', url: '/me/activity/opens', payload: input }))
          .statusCode,
      ).toBe(401);
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/me/activity/opens',
            headers: { authorization: 'Bearer member' },
            payload: { ...event(new Date()), userId: otherId },
          })
        ).statusCode,
      ).toBe(400);
      expect(
        (
          await app.inject({
            method: 'GET',
            url: `/platform-admin/users/${memberId}/activity`,
            headers: { authorization: 'Bearer member' },
          })
        ).statusCode,
      ).toBe(403);
    } finally {
      await app.close();
    }
  });
  it('counts successful password session issuance, omits failed login and survives statistics faults', async () => {
    await client.database.execute(
      sql`INSERT INTO user_password_credentials (user_id, username, password_hash) VALUES (${memberId}, 'activity.user', ${await hashPassword('test-secret')})`,
    );
    const auth = new PasswordAuthService({
      databaseClient: client,
      sessionSecret: 'activity-session-secret-with-32-characters',
    });
    await expect(auth.login('activity.user', 'wrong')).rejects.toMatchObject({ statusCode: 401 });
    expect(await service.summary(admin, memberId)).toMatchObject({ todayLoginCount: 0 });
    await auth.login('activity.user', 'test-secret');
    // Real clock used by authentication; exact method and existence are asserted, daily count is checked against its own UTC+8 day.
    expect(
      (
        await client.database.execute(
          sql`SELECT last_login_method AS method, today_login_count AS count FROM account_activity_summaries WHERE user_id = ${memberId}`,
        )
      )[0],
    ).toEqual([expect.objectContaining({ method: 'password', count: 1 })]);
    await client.database.execute(sql.raw('DROP TABLE account_open_receipts'));
    await client.database.execute(sql.raw('DROP TABLE account_activity_summaries'));
    await expect(auth.login('activity.user', 'test-secret')).resolves.toMatchObject({
      isNewUser: false,
      token: expect.any(String),
    });
  });
});
