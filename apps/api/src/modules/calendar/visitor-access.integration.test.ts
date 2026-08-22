import { fileURLToPath } from 'node:url';

import {
  createTestDatabaseClient,
  migrateDatabase,
  type DatabaseClient,
  type DatabaseConnectionOptions,
} from '@schedule/database';
import { sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { insertDirectMembership } from '@schedule/test-fixtures';
import type { AuthPort } from '../../adapters/auth/auth-port.js';
import { createApp } from '../../app.js';
import { WechatGatewayError, type WechatGateway } from '../wechat/wechat-gateway.js';

const migrationsDirectory = fileURLToPath(new URL('../../../../../migrations', import.meta.url));
const databaseOptions = getTestDatabaseOptions();
const describeWithDatabase = databaseOptions === undefined ? describe.skip : describe;

describeWithDatabase('visitor access, QR codes and access logs', () => {
  let adminMembershipId: string;
  let app: ReturnType<typeof createApp>;
  let client: DatabaseClient;
  let groupId: string;
  let qrGateway: CountingGateway;

  beforeEach(async () => {
    client = createTestDatabaseClient(databaseOptions as DatabaseConnectionOptions);
    await resetDatabase(client);
    await migrateDatabase(client, migrationsDirectory);
    qrGateway = new CountingGateway();
    app = createApp({
      authPort: createFakeAuthPort({
        'admin-token': 'cloudbase-admin',
        'member-token': 'cloudbase-member',
        'owner-token': 'cloudbase-owner',
      }),
      databaseClient: client,
      logger: false,
      wechatGateway: qrGateway,
    });
    await registerUser('owner-token', 'Owner Doctor');
    await registerUser('admin-token', 'Admin Doctor');
    await registerUser('member-token', 'Member Doctor');
    groupId = await createGroup('Visitor group', '1234');
    await addRosterEntries(groupId, ['Admin Doctor', 'Member Doctor']);
    await claimGroup('admin-token', '1234', 'Admin Doctor');
    await claimGroup('member-token', '1234', 'Member Doctor');

    const members = (await listMembers(groupId)).json() as readonly {
      readonly id: string;
      readonly realName: string;
    }[];
    adminMembershipId = members.find((member) => member.realName === 'Admin Doctor')?.id as string;
    const role = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'PUT',
      payload: { role: 'administrator' },
      url: `/groups/${groupId}/members/${adminMembershipId}/role`,
    });
    expect(role.statusCode, role.body).toBe(200);
  });

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
    }
    if (client !== undefined) {
      await client.close();
    }
  });

  it('removes the public guest directory and group-code guest access', async () => {
    const directory = await app.inject({ method: 'GET', url: '/guest/groups' });
    expect(directory.statusCode).toBe(404);

    const groupCodeCalendar = await app.inject({
      method: 'POST',
      payload: { businessMonth: '2026-08', groupCode: '1234' },
      url: '/guest/calendar',
    });
    expect(groupCodeCalendar.statusCode).toBe(404);
  });

  it('regenerates the visitor key only for the owner and invalidates the old key', async () => {
    const oldKey = await getVisitorKey(groupId);

    const forbidden = await app.inject({
      headers: { authorization: 'Bearer admin-token' },
      method: 'PUT',
      url: `/groups/${groupId}/visitor-key`,
    });
    expect(forbidden.statusCode).toBe(403);

    const regenerated = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'PUT',
      url: `/groups/${groupId}/visitor-key`,
    });
    expect(regenerated.statusCode).toBe(200);
    expect(regenerated.json()).toEqual({ visitorKeyChanged: true });

    const newKey = await getVisitorKey(groupId);
    expect(newKey).not.toBe(oldKey);
    const oldResolve = await resolveVisitorKey(oldKey);
    expect(oldResolve.statusCode).toBe(404);
    const newResolve = await resolveVisitorKey(newKey);
    expect(newResolve.statusCode).toBe(200);
    expect(newResolve.json()).toMatchObject({ groupId });

    const [auditRows] = (await client.database.execute(
      sql`SELECT action FROM audit_logs WHERE action = 'visitor_key_regenerated'`,
    )) as unknown as [{ action: string }[], unknown];
    expect(auditRows).toEqual([{ action: 'visitor_key_regenerated' }]);
  });

  it('generates a cached group QR for owners and administrators only', async () => {
    const ownerQr = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'GET',
      url: `/groups/${groupId}/group-qr`,
    });
    expect(ownerQr.statusCode, ownerQr.body).toBe(200);
    expect(ownerQr.json()).toMatchObject({ imageBase64: expect.any(String) });
    expect(qrGateway.qrCalls).toBe(1);

    const adminQr = await app.inject({
      headers: { authorization: 'Bearer admin-token' },
      method: 'GET',
      url: `/groups/${groupId}/group-qr`,
    });
    expect(adminQr.statusCode).toBe(200);
    expect(qrGateway.qrCalls).toBe(1);

    const memberQr = await app.inject({
      headers: { authorization: 'Bearer member-token' },
      method: 'GET',
      url: `/groups/${groupId}/group-qr`,
    });
    expect(memberQr.statusCode).toBe(403);
  });

  it('maps WeChat QR errors to typed API errors', async () => {
    const failing = new CountingGateway();
    failing.failWith = new WechatGatewayError(
      45009,
      'reach max api daily quota limit',
      'RATE_LIMITED',
    );
    const failingApp = createApp({
      authPort: createFakeAuthPort({ 'owner-token': 'cloudbase-owner' }),
      databaseClient: client,
      logger: false,
      wechatGateway: failing,
    });

    const response = await failingApp.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'GET',
      url: `/groups/${groupId}/group-qr`,
    });
    expect(response.statusCode).toBe(429);
    expect(response.json()).toMatchObject({ error: { code: 'RATE_LIMITED' } });
    await failingApp.close();
  });

  it('records visitor access logs and lists them for owners and administrators with pagination', async () => {
    const visitorKey = await getVisitorKey(groupId);
    await readGuestCalendar(visitorKey, '2026-08');
    await readGuestCalendar(visitorKey, '2026-09');

    const ownerLogs = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'GET',
      url: `/groups/${groupId}/visitor-access-logs`,
    });
    expect(ownerLogs.statusCode, ownerLogs.body).toBe(200);
    const ownerPage = ownerLogs.json() as {
      logs: readonly { businessMonth: string; groupId: string; id: string }[];
    };
    expect(ownerPage.logs.map((log) => log.businessMonth)).toEqual(['2026-09', '2026-08']);
    expect(ownerPage.logs[0]?.groupId).toBe(groupId);

    const adminLogs = await app.inject({
      headers: { authorization: 'Bearer admin-token' },
      method: 'GET',
      url: `/groups/${groupId}/visitor-access-logs?pageSize=1`,
    });
    expect(adminLogs.statusCode).toBe(200);
    const adminPage = adminLogs.json() as {
      logs: readonly { id: string }[];
      nextCursor?: string;
    };
    expect(adminPage.logs).toHaveLength(1);
    expect(adminPage.nextCursor).toBeDefined();

    const nextPage = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'GET',
      url: `/groups/${groupId}/visitor-access-logs?cursor=${adminPage.nextCursor}`,
    });
    expect(nextPage.statusCode).toBe(200);
    expect((nextPage.json() as { logs: readonly unknown[] }).logs).toHaveLength(1);

    const memberLogs = await app.inject({
      headers: { authorization: 'Bearer member-token' },
      method: 'GET',
      url: `/groups/${groupId}/visitor-access-logs`,
    });
    expect(memberLogs.statusCode).toBe(403);
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

  async function addRosterEntries(
    targetGroupId: string,
    realNames: readonly string[],
  ): Promise<void> {
    const response = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      payload: { realNames: [...realNames] },
      url: `/groups/${targetGroupId}/roster-entries`,
    });
    expect(response.statusCode).toBe(200);
  }

  async function claimGroup(token: string, groupCode: string, realName: string): Promise<void> {
    void token;
    await insertDirectMembership(client, { groupCode, realName });
  }

  function listMembers(targetGroupId: string) {
    return app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'GET',
      url: `/groups/${targetGroupId}/members`,
    });
  }

  async function getVisitorKey(targetGroupId: string): Promise<string> {
    const [rows] = (await client.database.execute(
      sql`SELECT visitor_key AS visitorKey FROM \`groups\` WHERE id = ${targetGroupId}`,
    )) as unknown as [{ visitorKey: string }[], unknown];
    return rows[0]?.visitorKey as string;
  }

  function resolveVisitorKey(visitorKey: string) {
    return app.inject({
      method: 'POST',
      payload: { visitorKey },
      url: '/guest/groups/resolve',
    });
  }

  async function readGuestCalendar(visitorKey: string, businessMonth: string): Promise<void> {
    const response = await app.inject({
      method: 'GET',
      url: `/guest/groups/${groupId}/calendar?businessMonth=${businessMonth}&visitorKey=${visitorKey}`,
    });
    expect(response.statusCode, response.body).toBe(200);
  }
});

class CountingGateway implements WechatGateway {
  public failWith: WechatGatewayError | undefined;
  public qrCalls = 0;
  public readonly isConfigured = true;

  public async exchangeCode(
    code: string,
  ): Promise<{ openid: string; sessionKey: undefined; unionid: undefined }> {
    return { openid: `mock-openid-${code}`, sessionKey: undefined, unionid: undefined };
  }

  public async getUnlimitedQr(): Promise<Uint8Array> {
    this.qrCalls += 1;
    if (this.failWith !== undefined) {
      throw this.failWith;
    }
    return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x01, 0x02, 0x03]);
  }

  public async sendSubscribeMessage(): Promise<{ messageId: null }> {
    return { messageId: null };
  }
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

function createFakeAuthPort(tokens: Readonly<Record<string, string>>): AuthPort {
  return {
    async authenticate({ authorization }) {
      const token = authorization?.replace(/^Bearer\s+/iu, '');
      const cloudbaseUid = token === undefined ? undefined : tokens[token];
      return cloudbaseUid === undefined ? undefined : { cloudbaseUid };
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
  await client.database.execute(sql`DROP TABLE IF EXISTS group_memberships`);
  await client.database.execute(sql`DROP TABLE IF EXISTS roster_entries`);
  await client.database.execute(sql`DROP TABLE IF EXISTS idempotency_keys`);
  await client.database.execute(sql`DROP TABLE IF EXISTS \`groups\``);
  await client.database.execute(sql`DROP TABLE IF EXISTS user_profiles`);
  await client.database.execute(sql`DROP TABLE IF EXISTS wechat_identity_detachments`);
  await client.database.execute(sql`DROP TABLE IF EXISTS wechat_link_tokens`);
  await client.database.execute(sql`DROP TABLE IF EXISTS wechat_union_accounts`);
  await client.database.execute(sql`DROP TABLE IF EXISTS user_auth_identities`);
  await client.database.execute(sql`DROP TABLE IF EXISTS user_password_credentials`);
  await client.database.execute(sql`DROP TABLE IF EXISTS users`);
  await client.database.execute(sql`DROP TABLE IF EXISTS __drizzle_migrations`);
  await client.database.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
}
