import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import {
  createTestDatabaseClient,
  migrateDatabase,
  notificationDeliveries,
  type DatabaseClient,
  type DatabaseConnectionOptions,
  withTransaction,
  groupMemberships,
  scheduleRoles,
  schedulePeriods,
  shiftTypes,
  shiftAssignments,
  groups,
} from '@schedule/database';
import { insertDirectMembership } from '@schedule/test-fixtures';
import { and, eq, sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AuthPort } from '../../adapters/auth/auth-port.js';
import { createApp } from '../../app.js';
import { NotificationRetryJob } from '../../jobs/notification-retry.js';
import { DutyReminderJob } from '../../jobs/duty-reminders.js';
import { claimBatch } from '../../jobs/notification-batch.js';
import { NotificationWriter } from '../notifications/notification-writer.js';
import { createPushDispatcher } from '../notifications/notification-dispatcher.js';
import { WechatGatewayError, type WechatGateway } from './wechat-gateway.js';
import { WechatPushDispatcher, type WechatTemplateIds } from './wechat-push-dispatcher.js';

const migrationsDirectory = fileURLToPath(new URL('../../../../../migrations', import.meta.url));
const databaseOptions = getTestDatabaseOptions();
const describeWithDatabase = databaseOptions === undefined ? describe.skip : describe;

const templateIds: WechatTemplateIds = {
  dutyReminder: 'tpl-duty',
};

describeWithDatabase('wechat notification deliveries', () => {
  let app: ReturnType<typeof createApp>;
  let client: DatabaseClient;
  let groupId: string;
  let memberUserId: string;
  const savedEnv = new Map<string, string | undefined>();

  beforeEach(async () => {
    client = createTestDatabaseClient(databaseOptions as DatabaseConnectionOptions);
    await resetDatabase(client);
    await migrateDatabase(client, migrationsDirectory);
    app = createApp({
      authPort: createFakeAuthPort({
        'member-token': 'cloudbase-member',
        'owner-token': 'cloudbase-owner',
      }),
      databaseClient: client,
      logger: false,
    });
    await registerUser('owner-token', 'Owner Doctor');
    memberUserId = await registerUser('member-token', 'Member Doctor');
    groupId = (await createGroup('Notify group', '1234')).id;
    await insertDirectMembership(client, { groupId, realName: 'Member Doctor' });
    await client.database.execute(
      sql`UPDATE users SET wechat_openid = 'mock-openid-member' WHERE id = ${memberUserId}`,
    );

    for (const key of wechatEnvKeys) {
      savedEnv.set(key, process.env[key]);
    }
    process.env.WECHAT_MOCK_MODE = 'true';
    process.env.WECHAT_DUTY_REMINDER_TEMPLATE_ID = 'tpl-duty';
  });

  afterEach(async () => {
    for (const key of wechatEnvKeys) {
      const previous = savedEnv.get(key);
      if (previous === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous;
      }
    }
    savedEnv.clear();
    if (app !== undefined) {
      await app.close();
    }
    if (client !== undefined) {
      await client.close();
    }
  });

  it('does not send a queued duty reminder after its group was dissolved', async () => {
    await appendDutyReminder(memberUserId);
    await client.database
      .update(groups)
      .set({ deletedAt: new Date() })
      .where(eq(groups.id, groupId));
    const gateway = new RecordingGateway();
    const result = await new NotificationRetryJob(
      client,
      createPushDispatcher({}),
      new WechatPushDispatcher(client, gateway, templateIds),
    ).run();
    expect(result.sent).toBe(0);
    expect(gateway.sends).toHaveLength(0);
  });

  it('creates one reminder for the new assignee without redirecting or duplicating the old queued reminder', async () => {
    await appendDutyReminder(memberUserId);
    const [assignment] = await client.database.select().from(shiftAssignments).limit(1);
    const [owners] = (await client.database.execute(
      sql`SELECT u.id user_id,m.id membership_id FROM users u JOIN group_memberships m ON m.user_id=u.id WHERE u.cloudbase_uid='cloudbase-owner' AND m.group_id=${groupId}`,
    )) as unknown as [{ user_id: string; membership_id: string }[], unknown];
    const owner = owners[0]!;
    await withTransaction(client, (tx) =>
      claimBatch(tx, `duty-reminder:${assignment!.id}:24`, 'duty_reminder'),
    );
    await client.database.execute(
      sql`UPDATE users SET wechat_openid='mock-owner-openid' WHERE id=${owner.user_id}`,
    );
    await client.database
      .update(shiftAssignments)
      .set({ actualMembershipId: owner.membership_id, actualMemberName: '新值班人' })
      .where(eq(shiftAssignments.id, assignment!.id));
    const job = new DutyReminderJob(client);
    expect((await job.run()).created).toBe(1);
    expect((await job.run()).created).toBe(0);
    const gateway = new RecordingGateway();
    await new NotificationRetryJob(
      client,
      createPushDispatcher({}),
      new WechatPushDispatcher(client, gateway, templateIds),
    ).run();
    expect(gateway.sends).toHaveLength(1);
    expect(gateway.sends[0]!.openid).toBe('mock-owner-openid');
  });

  it('creates wechat deliveries for openid users and sends them through the mock gateway', async () => {
    await appendDutyReminder(memberUserId);
    expect((await new DutyReminderJob(client).run()).created).toBe(0);
    const [rows] = (await client.database.execute(
      sql`SELECT channel, status FROM notification_deliveries`,
    )) as unknown as [{ channel: string; status: string }[], unknown];
    expect(rows).toEqual([{ channel: 'wechat', status: 'pending' }]);

    const gateway = new RecordingGateway();
    const retry = new NotificationRetryJob(
      client,
      createPushDispatcher({}),
      new WechatPushDispatcher(client, gateway, templateIds),
    );
    const result = await retry.run();
    expect(result.sent).toBe(1);

    const [delivery] = await client.database
      .select({
        externalMessageId: notificationDeliveries.externalMessageId,
        status: notificationDeliveries.status,
      })
      .from(notificationDeliveries)
      .where(eq(notificationDeliveries.channel, 'wechat'))
      .limit(1);
    expect(delivery).toEqual({ externalMessageId: 'mock-message-id', status: 'sent' });
    expect(gateway.sends).toHaveLength(1);
    expect(gateway.sends[0]).toMatchObject({
      openid: 'mock-openid-member',
      templateId: 'tpl-duty',
    });
  });

  it('does not redirect an old account pending message to the new owner of its WeChat identity', async () => {
    await appendDutyReminder(memberUserId);
    // State after a committed unlink/rebind: the original business recipient is unchanged.
    await client.database.execute(
      sql`UPDATE users SET wechat_openid = NULL WHERE id = ${memberUserId}`,
    );
    await client.database.execute(
      sql`UPDATE users SET wechat_openid = 'mock-openid-member' WHERE cloudbase_uid = 'cloudbase-owner'`,
    );
    const gateway = new RecordingGateway();
    const retry = new NotificationRetryJob(
      client,
      createPushDispatcher({}),
      new WechatPushDispatcher(client, gateway, templateIds),
    );
    expect((await retry.run()).skipped).toBe(1);
    expect(gateway.sends).toHaveLength(0);
    await appendDutyReminderToOwner();
    expect((await retry.run()).sent).toBe(1);
    expect(gateway.sends).toHaveLength(1);
    expect(gateway.sends[0]?.openid).toBe('mock-openid-member');
  });

  it('skips wechat deliveries when the preference is off or the user has no openid', async () => {
    const preferences = await app.inject({
      headers: { authorization: 'Bearer member-token' },
      method: 'PUT',
      payload: { wechatNotificationsEnabled: false },
      url: `/groups/${groupId}/notification-preferences/mine`,
    });
    expect(preferences.statusCode).toBe(200);

    await appendDutyReminder(memberUserId);
    const [disabledRows] = (await client.database.execute(
      sql`SELECT COUNT(*) AS count FROM notification_deliveries WHERE channel = 'wechat'`,
    )) as unknown as [{ count: number }[], unknown];
    expect(disabledRows[0]?.count).toBe(0);

    await appendDutyReminderToOwner();
    const [ownerRows] = (await client.database.execute(
      sql`SELECT COUNT(*) AS count FROM notification_deliveries WHERE channel = 'wechat'`,
    )) as unknown as [{ count: number }[], unknown];
    expect(ownerRows[0]?.count).toBe(0);
  });

  it('marks user refusal as skipped and retries system errors', async () => {
    await appendDutyReminder(memberUserId);
    const refusing = new NotificationRetryJob(
      client,
      createPushDispatcher({}),
      new WechatPushDispatcher(client, new RefusingGateway(), templateIds),
    );
    expect((await refusing.run()).skipped).toBe(1);
    const [skipped] = await client.database
      .select({ status: notificationDeliveries.status })
      .from(notificationDeliveries)
      .where(eq(notificationDeliveries.channel, 'wechat'))
      .limit(1);
    expect(skipped?.status).toBe('skipped');

    await client.database.execute(
      sql`DELETE FROM notification_deliveries WHERE channel = 'wechat'`,
    );
    await appendDutyReminder(memberUserId);
    const flaky = new NotificationRetryJob(
      client,
      createPushDispatcher({}),
      new WechatPushDispatcher(client, new FlakyGateway(1), templateIds),
    );
    expect((await flaky.run()).failed).toBe(1);
    const [retrying] = await client.database
      .select({ attempts: notificationDeliveries.attempts, status: notificationDeliveries.status })
      .from(notificationDeliveries)
      .where(eq(notificationDeliveries.channel, 'wechat'))
      .limit(1);
    expect(retrying).toMatchObject({ attempts: 1, status: 'pending' });

    expect((await flaky.run(new Date(Date.now() + 6 * 60 * 1000))).sent).toBe(1);
  });

  it('exposes and updates the wechat notification preference', async () => {
    const initial = await app.inject({
      headers: { authorization: 'Bearer member-token' },
      method: 'GET',
      url: `/groups/${groupId}/notification-preferences/mine`,
    });
    expect(initial.statusCode).toBe(200);
    expect(initial.json()).toMatchObject({ wechatNotificationsEnabled: true });

    const updated = await app.inject({
      headers: { authorization: 'Bearer member-token' },
      method: 'PUT',
      payload: { wechatNotificationsEnabled: false },
      url: `/groups/${groupId}/notification-preferences/mine`,
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({ wechatNotificationsEnabled: false });
  });

  async function registerUser(token: string, realName: string): Promise<string> {
    const response = await app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: { realName },
      url: '/users',
    });
    expect(response.statusCode).toBe(201);
    return (response.json() as { id: string }).id;
  }

  async function createGroup(name: string, groupCode: string): Promise<{ readonly id: string }> {
    const response = await app.inject({
      headers: {
        authorization: 'Bearer owner-token',
        'idempotency-key': randomUUID(),
      },
      method: 'POST',
      payload: { groupCode, name },
      url: '/groups',
    });
    expect(response.statusCode).toBe(201);
    return response.json() as { id: string };
  }

  async function appendDutyReminder(recipientUserId: string): Promise<void> {
    const [member] = await client.database
      .select({ id: groupMemberships.id })
      .from(groupMemberships)
      .where(
        and(eq(groupMemberships.userId, recipientUserId), eq(groupMemberships.groupId, groupId)),
      )
      .limit(1);
    if (!member) throw new Error('test member missing');
    const roleId = randomUUID(),
      shiftId = randomUUID(),
      periodId = randomUUID(),
      assignmentId = randomUUID();
    const startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const businessDate = startsAt.toISOString().slice(0, 10);
    await client.database.insert(scheduleRoles).values({ id: roleId, groupId, name: '测试岗位' });
    await client.database.insert(shiftTypes).values({
      id: shiftId,
      groupId,
      name: '全天班',
      abbreviation: '全',
      displayOrder: 99,
      color: '#267d70',
      textColor: '#ffffff',
    });
    await client.database.insert(schedulePeriods).values({
      id: periodId,
      groupId,
      scheduleRoleId: roleId,
      businessMonth: `${businessDate.slice(0, 7)}-01`,
      revision: 1,
      rulesVersion: 1,
      status: 'published',
    });
    await client.database.insert(shiftAssignments).values({
      id: assignmentId,
      schedulePeriodId: periodId,
      businessDate,
      slotPosition: 1,
      shiftTypeId: shiftId,
      shiftTypeName: '全天班',
      shiftTypeAbbreviation: '全',
      shiftTypeColor: '#267d70',
      shiftTypeTextColor: '#ffffff',
      shiftTypeConfigurationVersion: 1,
      shiftStartTime: '08:00:00',
      shiftEndTime: '08:00:00',
      crossesMidnight: 1,
      isAllDay: 1,
      countsTowardStatistics: 1,
      startsAt,
      endsAt: new Date(startsAt.valueOf() + 24 * 60 * 60 * 1000),
      plannedMembershipId: member.id,
      plannedMemberName: '测试成员',
    });
    await withTransaction(client, (transaction) =>
      new NotificationWriter().append(transaction, {
        body: '您值班将在 2 小时后开始。',
        groupId,
        notificationType: 'duty_reminder',
        recipientUserIds: [recipientUserId],
        title: '值班提醒',
        shiftAssignmentId: assignmentId,
        payload: { leadHours: 24 },
      }),
    );
  }

  async function appendDutyReminderToOwner(): Promise<void> {
    const [ownerRows] = (await client.database.execute(
      sql`SELECT id FROM users WHERE cloudbase_uid = 'cloudbase-owner'`,
    )) as unknown as [{ id: string }[], unknown];
    await appendDutyReminder(ownerRows[0]?.id as string);
  }
});

class RecordingGateway implements WechatGateway {
  public readonly isConfigured = true;
  public readonly sends: Array<{ data: unknown; openid: string; templateId: string }> = [];

  public async exchangeCode(code: string) {
    return { openid: `mock-openid-${code}`, sessionKey: undefined, unionid: undefined };
  }

  public async getUnlimitedQr() {
    return new Uint8Array();
  }

  public async sendSubscribeMessage(openid: string, templateId: string, data: unknown) {
    this.sends.push({ data, openid, templateId });
    return { messageId: 'mock-message-id' };
  }
}

class RefusingGateway implements WechatGateway {
  public readonly isConfigured = true;

  public async exchangeCode(code: string) {
    return { openid: `mock-openid-${code}`, sessionKey: undefined, unionid: undefined };
  }

  public async getUnlimitedQr() {
    return new Uint8Array();
  }

  public async sendSubscribeMessage(): Promise<{ messageId: null }> {
    throw new WechatGatewayError(
      43101,
      'user refuse to accept the msg',
      'WECHAT_MESSAGE_SEND_FAILED',
    );
  }
}

class FlakyGateway implements WechatGateway {
  public readonly isConfigured = true;
  private failuresLeft: number;

  public constructor(failuresLeft: number) {
    this.failuresLeft = failuresLeft;
  }

  public async exchangeCode(code: string) {
    return { openid: `mock-openid-${code}`, sessionKey: undefined, unionid: undefined };
  }

  public async getUnlimitedQr() {
    return new Uint8Array();
  }

  public async sendSubscribeMessage() {
    if (this.failuresLeft > 0) {
      this.failuresLeft -= 1;
      throw new WechatGatewayError(null, null, 'SERVICE_UNAVAILABLE', 'temporary failure');
    }
    return { messageId: 'mock-message-id' };
  }
}

const wechatEnvKeys = ['WECHAT_DUTY_REMINDER_TEMPLATE_ID', 'WECHAT_MOCK_MODE'] as const;

function createFakeAuthPort(tokens: Readonly<Record<string, string>>): AuthPort {
  return {
    async authenticate({ authorization }) {
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
  await client.database.execute(sql`DROP TABLE IF EXISTS group_visitor_links`);
  await client.database.execute(sql`DROP TABLE IF EXISTS group_memberships`);
  await client.database.execute(sql`DROP TABLE IF EXISTS roster_entries`);
  await client.database.execute(sql`DROP TABLE IF EXISTS idempotency_keys`);
  await client.database.execute(sql`DROP TABLE IF EXISTS \`groups\``);
  await client.database.execute(sql`DROP TABLE IF EXISTS user_profile_avatars`);
  await client.database.execute(sql`DROP TABLE IF EXISTS user_profiles`);
  await client.database.execute(sql`DROP TABLE IF EXISTS wechat_admin_binding_tickets`);
  await client.database.execute(sql`DROP TABLE IF EXISTS wechat_identity_detachments`);
  await client.database.execute(sql`DROP TABLE IF EXISTS wechat_link_tokens`);
  await client.database.execute(sql`DROP TABLE IF EXISTS wechat_union_accounts`);
  await client.database.execute(sql`DROP TABLE IF EXISTS user_auth_identities`);
  await client.database.execute(sql`DROP TABLE IF EXISTS user_password_credentials`);
  await client.database.execute(sql`DROP TABLE IF EXISTS users`);
  await client.database.execute(sql`DROP TABLE IF EXISTS __drizzle_migrations`);
  await client.database.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
}
