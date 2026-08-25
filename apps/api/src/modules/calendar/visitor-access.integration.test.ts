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

import { insertDirectMembership } from '@schedule/test-fixtures';
import type { AuthPort } from '../../adapters/auth/auth-port.js';
import { createApp } from '../../app.js';
import { VisitorAccessLogService } from './visitor-access-log.js';
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
        'developer-token': 'cloudbase-developer',
        'member-token': 'cloudbase-member',
        'owner-token': 'cloudbase-owner',
        'platform-token': 'cloudbase-platform',
      }),
      databaseClient: client,
      logger: false,
      platformAdminUids: new Set(['cloudbase-platform']),
      wechatGateway: qrGateway,
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
    await registerUser('admin-token', 'Admin Doctor');
    await registerUser('member-token', 'Member Doctor');
    await registerUser('platform-token', 'Platform Doctor');
    await registerUser('developer-token', 'Developer Doctor');
    await client.database.execute(sql`
      UPDATE users SET is_developer_admin = 1 WHERE cloudbase_uid = 'cloudbase-developer'
    `);
    groupId = await createGroup('Visitor group', '1234');
    await addRosterEntries(groupId, ['Admin Doctor', 'Member Doctor']);
    await claimGroup('admin-token', '1234', 'Admin Doctor');
    await claimGroup('member-token', '1234', 'Member Doctor');

    const members = (await listMembers(groupId)).json() as readonly {
      readonly id: string;
      readonly realName: string;
      readonly version: number;
    }[];
    const admin = members.find((member) => member.realName === 'Admin Doctor');
    adminMembershipId = admin?.id as string;
    const role = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'PUT',
      payload: { expectedVersion: admin?.version, role: 'administrator' },
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

  it('hides raw rows before 90 days and lets both platform-admin classes read without membership', async () => {
    const oldId = randomId();
    const retainedId = randomId();
    await client.database.execute(sql`
      INSERT INTO visitor_access_logs
        (id, group_id, business_month, client_ip, request_id, created_at)
      VALUES
        (${oldId}, ${groupId}, '2026-07', '203.0.113.1', ${randomId()},
         ${new Date(Date.now() - 91 * 24 * 60 * 60 * 1000)}),
        (${retainedId}, ${groupId}, '2026-08', '203.0.113.2', ${randomId()},
         ${new Date(Date.now() - 89 * 24 * 60 * 60 * 1000)})
    `);

    for (const token of ['owner-token', 'admin-token', 'platform-token', 'developer-token']) {
      const response = await app.inject({
        headers: { authorization: `Bearer ${token}` },
        method: 'GET',
        url: `/groups/${groupId}/visitor-access-logs`,
      });
      expect(response.statusCode, `${token}: ${response.body}`).toBe(200);
      const ids = (response.json() as { logs: readonly { id: string }[] }).logs.map(
        (entry) => entry.id,
      );
      expect(ids).toContain(retainedId);
      expect(ids).not.toContain(oldId);
    }
  });

  it('returns only anonymous aggregate fields to group and platform administrators', async () => {
    const aggregateTableExists = await hasAggregateTable();
    if (!aggregateTableExists) {
      const unavailable = await app.inject({
        headers: { authorization: 'Bearer owner-token' },
        method: 'GET',
        url: `/groups/${groupId}/visitor-access-aggregates`,
      });
      expect(unavailable.statusCode).toBe(503);
      return;
    }
    await client.database.execute(sql`
      INSERT INTO visitor_access_monthly_aggregates
        (group_id, access_month, business_month, access_count)
      VALUES (${groupId}, '2026-05', '2026-08', 42)
    `);
    await expect(
      new VisitorAccessLogService(client).listAggregates(
        { cloudbaseUid: 'cloudbase-owner' },
        groupId,
        undefined,
      ),
    ).resolves.toEqual({
      aggregates: [{ accessCount: '42', accessMonth: '2026-05', businessMonth: '2026-08' }],
    });

    for (const token of ['owner-token', 'admin-token', 'platform-token', 'developer-token']) {
      const response = await app.inject({
        headers: { authorization: `Bearer ${token}` },
        method: 'GET',
        url: `/groups/${groupId}/visitor-access-aggregates`,
      });
      expect(response.statusCode, `${token}: ${response.body}`).toBe(200);
      expect(response.json()).toEqual({
        aggregates: [{ accessCount: '42', accessMonth: '2026-05', businessMonth: '2026-08' }],
      });
      expect(response.body).not.toMatch(/clientIp|requestId|groupId/iu);
    }

    const member = await app.inject({
      headers: { authorization: 'Bearer member-token' },
      method: 'GET',
      url: `/groups/${groupId}/visitor-access-aggregates`,
    });
    expect(member.statusCode).toBe(403);
  });

  it('fails the aggregate endpoint closed while the runtime bridge is still on schema 49', async () => {
    await client.database.execute(sql`DROP TABLE IF EXISTS visitor_access_monthly_aggregates`);
    const response = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'GET',
      url: `/groups/${groupId}/visitor-access-aggregates`,
    });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ error: { code: 'SERVICE_UNAVAILABLE' } });
  });

  it('uses the nearest trusted proxy value and stores no invalid IP text', async () => {
    const visitorKey = await getVisitorKey(groupId);
    const spoofed = await app.inject({
      headers: { 'x-forwarded-for': '198.51.100.99, 203.0.113.7' },
      method: 'GET',
      remoteAddress: '127.0.0.1',
      url: `/guest/groups/${groupId}/calendar?businessMonth=2026-08&visitorKey=${visitorKey}`,
    });
    expect(spoofed.statusCode, spoofed.body).toBe(200);
    const invalid = await app.inject({
      headers: { 'x-forwarded-for': 'not-an-ip' },
      method: 'GET',
      remoteAddress: '127.0.0.1',
      url: `/guest/groups/${groupId}/calendar?businessMonth=2026-09&visitorKey=${visitorKey}`,
    });
    expect(invalid.statusCode, invalid.body).toBe(200);

    const [rows] = (await client.database.execute(sql`
      SELECT business_month AS businessMonth, client_ip AS clientIp
      FROM visitor_access_logs
      ORDER BY created_at
    `)) as unknown as [readonly { businessMonth: string; clientIp: string | null }[], unknown];
    expect(rows).toEqual([
      { businessMonth: '2026-08', clientIp: '203.0.113.7' },
      { businessMonth: '2026-09', clientIp: null },
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

  async function createGroup(name: string, groupCode: string): Promise<string> {
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
    return (response.json() as { id: string }).id;
  }

  async function addRosterEntries(
    targetGroupId: string,
    realNames: readonly string[],
  ): Promise<void> {
    const response = await app.inject({
      headers: {
        authorization: 'Bearer owner-token',
        'idempotency-key': randomUUID(),
      },
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

  async function hasAggregateTable(): Promise<boolean> {
    const [rows] = (await client.database.execute(sql`
      SELECT COUNT(*) AS count
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = 'visitor_access_monthly_aggregates'
    `)) as unknown as [readonly { count: number }[], unknown];
    return (rows[0]?.count ?? 0) === 1;
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

function randomId(): string {
  return randomUUID();
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
  await client.database.execute(sql`DROP TABLE IF EXISTS group_memberships`);
  await client.database.execute(sql`DROP TABLE IF EXISTS roster_entries`);
  await client.database.execute(sql`DROP TABLE IF EXISTS idempotency_keys`);
  await client.database.execute(sql`DROP TABLE IF EXISTS \`groups\``);
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
