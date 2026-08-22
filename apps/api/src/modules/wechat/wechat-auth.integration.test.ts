import { fileURLToPath } from 'node:url';

import {
  createTestDatabaseClient,
  migrateDatabase,
  type DatabaseClient,
  type DatabaseConnectionOptions,
} from '@schedule/database';
import { sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createWechatAuthPort, createWechatSessionToken } from '../../adapters/auth/wechat-auth.js';
import { createApp } from '../../app.js';
import {
  WechatGatewayError,
  createMockWechatGateway,
  type WechatGateway,
} from './wechat-gateway.js';

const migrationsDirectory = fileURLToPath(new URL('../../../../../migrations', import.meta.url));
const databaseOptions = getTestDatabaseOptions();
const describeWithDatabase = databaseOptions === undefined ? describe.skip : describe;
const TEST_SESSION_SECRET = 'test-wechat-session-secret-0123456789abcdef';

describeWithDatabase('wechat authentication and sessions', () => {
  let app: ReturnType<typeof createApp>;
  let client: DatabaseClient;
  const extraApps: ReturnType<typeof createApp>[] = [];

  beforeEach(async () => {
    client = createTestDatabaseClient(databaseOptions as DatabaseConnectionOptions);
    await resetDatabase(client);
    await migrateDatabase(client, migrationsDirectory);
    app = createApp({
      authPort: createWechatAuthPort({
        allowDevTokens: false,
        databaseClient: client,
        sessionSecret: TEST_SESSION_SECRET,
      }),
      databaseClient: client,
      logger: false,
      wechatGateway: createMockWechatGateway(),
      wechatSessionSecret: TEST_SESSION_SECRET,
    });
  });

  afterEach(async () => {
    await Promise.all(extraApps.splice(0).map((instance) => instance.close()));
    if (app !== undefined) {
      await app.close();
    }
    if (client !== undefined) {
      await client.close();
    }
  });

  it('logs in a new WeChat user, creates an account without a profile, and audits it', async () => {
    const login = await app.inject({
      method: 'POST',
      payload: { code: 'code-a' },
      url: '/auth/wechat/login',
    });

    expect(login.statusCode).toBe(200);
    const body = login.json() as {
      isNewUser: boolean;
      profile?: unknown;
      token: string;
    };
    expect(body).toMatchObject({ isNewUser: true });
    expect(body.profile).toBeUndefined();
    expect(typeof body.token).toBe('string');

    const [rows] = (await client.database.execute(
      sql`SELECT cloudbase_uid AS cloudbaseUid, wechat_openid AS openid FROM users`,
    )) as unknown as [{ cloudbaseUid: string; openid: string }[], unknown];
    expect(rows).toEqual([{ cloudbaseUid: 'wx_mock-openid-code-a', openid: 'mock-openid-code-a' }]);

    const [auditRows] = (await client.database.execute(
      sql`SELECT action FROM audit_logs WHERE target_type = 'user'`,
    )) as unknown as [{ action: string }[], unknown];
    expect(auditRows).toEqual([{ action: 'wechat_user_created' }]);

    const profile = await app.inject({
      headers: { authorization: `Bearer ${body.token}` },
      method: 'GET',
      url: '/users/me',
    });
    expect(profile.statusCode).toBe(404);
  });

  it('returns the same account on repeated logins without creating a second user', async () => {
    const firstLogin = await login('code-a');
    const secondLogin = await login('code-a');

    expect(firstLogin.isNewUser).toBe(true);
    expect(secondLogin.isNewUser).toBe(false);
    expect(secondLogin.profile).toBeUndefined();

    const [rows] = (await client.database.execute(
      sql`SELECT COUNT(*) AS count FROM users`,
    )) as unknown as [{ count: number }[], unknown];
    expect(rows[0]?.count).toBe(1);
  });

  it('completes the profile through the existing register endpoint after login', async () => {
    const loginResponse = await login('code-b');

    const register = await app.inject({
      headers: { authorization: `Bearer ${loginResponse.token}` },
      method: 'POST',
      payload: { realName: '张三' },
      url: '/users',
    });
    expect(register.statusCode).toBe(201);
    expect(register.json()).toMatchObject({ realName: '张三', version: 1 });

    const profile = await app.inject({
      headers: { authorization: `Bearer ${loginResponse.token}` },
      method: 'GET',
      url: '/users/me',
    });
    expect(profile.statusCode).toBe(200);
    expect(profile.json()).toMatchObject({ realName: '张三', version: 1 });
  });

  it('rejects expired and tampered session tokens with 401', async () => {
    const loginResponse = await login('code-c');
    const [rows] = (await client.database.execute(
      sql`SELECT id FROM users WHERE wechat_openid = 'mock-openid-code-c'`,
    )) as unknown as [{ id: string }[], unknown];
    const userId = rows[0]?.id as string;

    const expired = createWechatSessionToken(
      { openid: 'mock-openid-code-c', sub: userId },
      TEST_SESSION_SECRET,
      Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60 - 10,
    );
    const expiredResponse = await app.inject({
      headers: { authorization: `Bearer ${expired}` },
      method: 'GET',
      url: '/users/me',
    });
    expect(expiredResponse.statusCode).toBe(401);
    expect(expiredResponse.json()).toMatchObject({ error: { code: 'AUTHENTICATION_REQUIRED' } });

    const tampered = `${loginResponse.token.slice(0, -1)}${loginResponse.token.endsWith('a') ? 'b' : 'a'}`;
    const tamperedResponse = await app.inject({
      headers: { authorization: `Bearer ${tampered}` },
      method: 'GET',
      url: '/users/me',
    });
    expect(tamperedResponse.statusCode).toBe(401);
  });

  it('fails closed with 401 when the session secret is missing', async () => {
    const secretless = createApp({
      authPort: createWechatAuthPort({
        allowDevTokens: false,
        databaseClient: client,
        sessionSecret: undefined,
      }),
      databaseClient: client,
      logger: false,
      wechatGateway: createMockWechatGateway(),
    });
    extraApps.push(secretless);

    const login = await secretless.inject({
      method: 'POST',
      payload: { code: 'code-d' },
      url: '/auth/wechat/login',
    });
    expect(login.statusCode).toBe(401);
    expect(login.json()).toMatchObject({ error: { code: 'AUTHENTICATION_REQUIRED' } });
  });

  it('keeps dev bearer tokens working when dev compatibility is enabled', async () => {
    const devApp = createApp({
      authPort: createWechatAuthPort({
        allowDevTokens: true,
        databaseClient: client,
        sessionSecret: TEST_SESSION_SECRET,
      }),
      databaseClient: client,
      logger: false,
    });
    extraApps.push(devApp);

    const response = await devApp.inject({
      headers: { authorization: 'Bearer local-admin' },
      method: 'GET',
      url: '/users/me',
    });
    expect(response.statusCode).toBe(404);
  });

  it('maps invalid WeChat login codes to 401 WECHAT_LOGIN_FAILED', async () => {
    const failingGateway: WechatGateway = {
      isConfigured: true,
      async exchangeCode() {
        throw new WechatGatewayError(40029, 'invalid code', 'WECHAT_LOGIN_FAILED');
      },
      async getUnlimitedQr() {
        return new Uint8Array();
      },
      async sendSubscribeMessage() {
        return { messageId: null };
      },
    };
    const failingApp = createApp({
      authPort: createWechatAuthPort({
        allowDevTokens: false,
        databaseClient: client,
        sessionSecret: TEST_SESSION_SECRET,
      }),
      databaseClient: client,
      logger: false,
      wechatGateway: failingGateway,
      wechatSessionSecret: TEST_SESSION_SECRET,
    });
    extraApps.push(failingApp);

    const response = await failingApp.inject({
      method: 'POST',
      payload: { code: 'bad-code' },
      url: '/auth/wechat/login',
    });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: { code: 'WECHAT_LOGIN_FAILED' } });
  });

  async function login(code: string): Promise<{
    isNewUser: boolean;
    profile?: unknown;
    token: string;
  }> {
    const response = await app.inject({
      method: 'POST',
      payload: { code },
      url: '/auth/wechat/login',
    });
    expect(response.statusCode).toBe(200);
    return response.json() as { isNewUser: boolean; profile?: unknown; token: string };
  }
});

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
  await client.database.execute(sql`DROP TABLE IF EXISTS wechat_union_accounts`);
  await client.database.execute(sql`DROP TABLE IF EXISTS user_auth_identities`);
  await client.database.execute(sql`DROP TABLE IF EXISTS user_password_credentials`);
  await client.database.execute(sql`DROP TABLE IF EXISTS users`);
  await client.database.execute(sql`DROP TABLE IF EXISTS __drizzle_migrations`);
  await client.database.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
}
