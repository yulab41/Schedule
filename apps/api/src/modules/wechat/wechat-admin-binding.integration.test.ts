import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import {
  createTestDatabaseClient,
  migrateDatabase,
  type DatabaseClient,
  type DatabaseConnectionOptions,
} from '@schedule/database';
import { resetDatabase } from '@schedule/test-fixtures';
import { sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createPasswordSessionToken,
  createWechatAuthPort,
  verifyWechatSessionToken,
} from '../../adapters/auth/wechat-auth.js';
import { createApp } from '../../app.js';
import { ClientCapabilityPolicy } from '../client-capabilities/client-capability-policy.js';
import { hashPassword } from '../auth/password-auth-service.js';
import type { WechatGateway } from './wechat-gateway.js';

const migrationsDirectory = fileURLToPath(new URL('../../../../../migrations', import.meta.url));
const databaseOptions = getTestDatabaseOptions();
const describeWithDatabase = databaseOptions === undefined ? describe.skip : describe;
const TEST_SESSION_SECRET = 'test-admin-binding-secret-0123456789abcdef';
const TEST_CLIENT_CAPABILITY_POLICY = createTestClientCapabilityPolicy();
const CURRENT_APP_ID = 'admin-binding-app';
const ADMIN_ID = '00000000-0000-4000-8000-000000000001';

describeWithDatabase('admin WeChat binding ticket', () => {
  let app: ReturnType<typeof createApp>;
  let client: DatabaseClient;

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
      clientCapabilityPolicy: TEST_CLIENT_CAPABILITY_POLICY,
      logger: false,
      platformAdminUids: new Set(),
      wechatGateway: createBindingGateway(),
      wechatSessionSecret: TEST_SESSION_SECRET,
    });
  });

  afterEach(async () => {
    if (app !== undefined) await app.close();
    if (client !== undefined) await client.close();
  });

  it('creates a hashed ten-minute ticket, previews masked state, and confirms once', async () => {
    const target = await seedTarget('target');
    const operationId = randomUUID();
    const created = await app.inject({
      headers: {
        authorization: `Bearer ${adminToken()}`,
        'idempotency-key': operationId,
      },
      method: 'POST',
      payload: { expectedAuthVersion: 1 },
      url: `/platform-admin/users/${target.userId}/wechat-miniprogram-binding-links`,
    });
    expect(created.statusCode, created.body).toBe(200);
    const link = created.json() as { authVersion: number; expiresAt: string; urlLink: string };
    expect(link.authVersion).toBe(1);
    const ticket = new URL(link.urlLink).searchParams.get('ticket');
    expect(ticket).toEqual(expect.any(String));
    const [ticketRows] = (await client.database.execute(sql`
      SELECT ticket_hash AS ticketHash, ticket_hash AS rawTicket
      FROM wechat_admin_binding_tickets
    `)) as unknown as [{ ticketHash: string; rawTicket: string }[], unknown];
    expect(ticketRows).toHaveLength(1);
    expect(ticketRows[0]?.ticketHash).not.toBe(ticket);
    expect(ticketRows[0]?.rawTicket).not.toBe(ticket);

    const preview = await app.inject({
      method: 'POST',
      payload: { ticket },
      url: '/auth/wechat/admin-bind/preview',
    });
    expect(preview.statusCode, preview.body).toBe(200);
    expect(preview.json()).toMatchObject({ realNameMasked: '目*', usernameMasked: 'ta***' });

    const confirmed = await app.inject({
      headers: {
        'x-schedule-client-platform': 'miniprogram',
        'x-schedule-client-version': '0.1.0-p6.20260824.79',
      },
      method: 'POST',
      payload: { code: 'admin-target', ticket },
      url: '/auth/wechat/admin-bind/confirm',
    });
    expect(confirmed.statusCode, confirmed.body).toBe(200);
    const claims = verifyWechatSessionToken(
      (confirmed.json() as { token: string }).token,
      TEST_SESSION_SECRET,
    );
    expect(claims).toMatchObject({
      appId: CURRENT_APP_ID,
      clientVersion: '0.1.0-p6.20260824.79',
      sub: target.userId,
    });
    const [state] = await client.database.execute<{ identities: number; consumed: number }>(sql`
      SELECT
        (SELECT COUNT(*) FROM user_auth_identities WHERE user_id = ${target.userId}) AS identities,
        (SELECT COUNT(*) FROM wechat_admin_binding_tickets WHERE status = 'consumed') AS consumed
    `);
    expect(state).toEqual([{ identities: 1, consumed: 1 }]);

    const replay = await app.inject({
      method: 'POST',
      payload: { code: 'admin-target', ticket },
      url: '/auth/wechat/admin-bind/confirm',
    });
    expect(replay.statusCode).toBe(409);
    const usedPreview = await app.inject({
      method: 'POST',
      payload: { ticket },
      url: '/auth/wechat/admin-bind/preview',
    });
    expect(usedPreview.statusCode).toBe(409);
  });

  it('replays one binding ticket without persisting its raw URL or ticket', async () => {
    const target = await seedTarget('replay');
    const operationId = randomUUID();
    const request = { expectedAuthVersion: 1, operationId };
    const create = (payload: typeof request) =>
      app.inject({
        headers: {
          authorization: `Bearer ${adminToken()}`,
          'idempotency-key': payload.operationId,
        },
        method: 'POST',
        payload,
        url: `/platform-admin/users/${target.userId}/wechat-miniprogram-binding-links`,
      });

    const first = await create(request);
    const replay = await create(request);
    expect(first.statusCode, first.body).toBe(200);
    expect(replay.statusCode, replay.body).toBe(200);
    expect(replay.json()).toEqual(first.json());
    const body = first.json() as { authVersion: number; urlLink: string };
    const rawTicket = new URL(body.urlLink).searchParams.get('ticket') as string;
    expect(body.authVersion).toBe(1);

    const [ticketRows] = (await client.database.execute(sql`
      SELECT ticket_hash AS ticketHash FROM wechat_admin_binding_tickets
      WHERE target_user_id = ${target.userId}
    `)) as unknown as [{ ticketHash: string }[], unknown];
    expect(ticketRows).toHaveLength(1);
    expect(ticketRows[0]?.ticketHash).not.toBe(rawTicket);
    const [operationRows] = (await client.database.execute(sql`
      SELECT result FROM idempotency_keys
      WHERE operation_key = ${operationId}
        AND scope = 'platform_wechat_binding_link_create'
    `)) as unknown as [{ result: unknown }[], unknown];
    const stored = JSON.stringify(operationRows[0]?.result);
    expect(stored).not.toContain(rawTicket);
    expect(stored).not.toContain(body.urlLink);

    const changed = await create({ ...request, expectedAuthVersion: 2 });
    expect(changed.statusCode).toBe(409);
    await client.database.execute(sql`
      UPDATE users SET auth_version = auth_version + 1 WHERE id = ${target.userId}
    `);
    const staleReplay = await create(request);
    expect(staleReplay.statusCode).toBe(409);
    const stale = await create({ expectedAuthVersion: 1, operationId: randomUUID() });
    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toMatchObject({
      error: {
        latestData: {
          authVersion: 2,
          id: target.userId,
          objectType: 'platform_user',
        },
      },
    });
  });

  it('fails closed for tampered or expired tickets without consuming them', async () => {
    const target = await seedTarget('expiry');
    const created = await createLink(target.userId);
    const ticket = new URL(created.urlLink).searchParams.get('ticket') as string;
    const tampered = await app.inject({
      method: 'POST',
      payload: { ticket: `${ticket}x` },
      url: '/auth/wechat/admin-bind/preview',
    });
    expect(tampered.statusCode).toBe(401);
    await client.database.execute(sql`
      UPDATE wechat_admin_binding_tickets
      SET expires_at = DATE_SUB(CURRENT_TIMESTAMP(3), INTERVAL 1 SECOND)
      WHERE ticket_hash = SHA2(${ticket}, 256)
    `);
    const expired = await app.inject({
      method: 'POST',
      payload: { ticket },
      url: '/auth/wechat/admin-bind/preview',
    });
    expect(expired.statusCode).toBe(410);
    const [rows] = await client.database.execute<{ status: string }>(sql`
      SELECT status FROM wechat_admin_binding_tickets WHERE ticket_hash = SHA2(${ticket}, 256)
    `);
    expect(rows).toEqual([{ status: 'pending' }]);
  });

  it('invalidates a pending binding link when the target auth version changes', async () => {
    const target = await seedTarget('stale-ticket');
    const created = await createLink(target.userId);
    const ticket = new URL(created.urlLink).searchParams.get('ticket') as string;
    await client.database.execute(sql`
      UPDATE users SET auth_version = auth_version + 1 WHERE id = ${target.userId}
    `);

    const preview = await app.inject({
      method: 'POST',
      payload: { ticket },
      url: '/auth/wechat/admin-bind/preview',
    });
    expect(preview.statusCode).toBe(409);
    const confirm = await app.inject({
      method: 'POST',
      payload: { code: 'admin-stale-ticket', ticket },
      url: '/auth/wechat/admin-bind/confirm',
    });
    expect(confirm.statusCode).toBe(409);
    const [state] = await client.database.execute<{ consumed: number; identities: number }>(sql`
      SELECT
        (SELECT COUNT(*) FROM wechat_admin_binding_tickets WHERE status = 'consumed') AS consumed,
        (SELECT COUNT(*) FROM user_auth_identities WHERE user_id = ${target.userId}) AS identities
    `);
    expect(state).toEqual([{ consumed: 0, identities: 0 }]);
  });

  it('keeps an already-issued legacy ticket usable during the ten-minute rollout window', async () => {
    const target = await seedTarget('legacy-ticket');
    const ticket = 'legacy-rollout-ticket';
    await client.database.execute(sql`
      INSERT INTO wechat_admin_binding_tickets
        (id, target_user_id, app_id, ticket_hash, expires_at, status)
      VALUES
        (${randomUUID()}, ${target.userId}, ${CURRENT_APP_ID}, SHA2(${ticket}, 256),
         DATE_ADD(CURRENT_TIMESTAMP(3), INTERVAL 10 MINUTE), 'pending')
    `);

    const preview = await app.inject({
      method: 'POST',
      payload: { ticket },
      url: '/auth/wechat/admin-bind/preview',
    });
    expect(preview.statusCode, preview.body).toBe(200);
    const confirm = await app.inject({
      method: 'POST',
      payload: { code: 'admin-legacy-ticket', ticket },
      url: '/auth/wechat/admin-bind/confirm',
    });
    expect(confirm.statusCode, confirm.body).toBe(200);
  });

  it('does not bind a code belonging to another user', async () => {
    const target = await seedTarget('target-conflict');
    const other = await seedTarget('other-conflict');
    await client.database.execute(sql`
      INSERT INTO user_auth_identities (id, user_id, provider, app_id, subject)
      VALUES (${randomUUID()}, ${other.userId}, 'wechat_mini_program', ${CURRENT_APP_ID}, 'admin-openid-other-conflict')
    `);
    const created = await createLink(target.userId);
    const ticket = new URL(created.urlLink).searchParams.get('ticket') as string;
    const confirmed = await app.inject({
      method: 'POST',
      payload: { code: 'other-conflict', ticket },
      url: '/auth/wechat/admin-bind/confirm',
    });
    expect(confirmed.statusCode).toBe(409);
    const [rows] = await client.database.execute<{ status: string }>(sql`
      SELECT status FROM wechat_admin_binding_tickets WHERE ticket_hash = SHA2(${ticket}, 256)
    `);
    expect(rows).toEqual([{ status: 'pending' }]);
  });

  it('requires platform admin permission and a password-enabled target', async () => {
    const target = await seedTarget('guard');
    const outsider = await app.inject({
      headers: {
        authorization: `Bearer ${passwordToken(target.userId, target.username)}`,
        'idempotency-key': randomUUID(),
      },
      method: 'POST',
      payload: { expectedAuthVersion: 1 },
      url: `/platform-admin/users/${target.userId}/wechat-miniprogram-binding-links`,
    });
    expect(outsider.statusCode).toBe(403);
    const passwordless = await seedTarget('passwordless', false);
    const unavailable = await app.inject({
      headers: {
        authorization: `Bearer ${adminToken()}`,
        'idempotency-key': randomUUID(),
      },
      method: 'POST',
      payload: { expectedAuthVersion: 1 },
      url: `/platform-admin/users/${passwordless.userId}/wechat-miniprogram-binding-links`,
    });
    expect(unavailable.statusCode).toBe(403);
    const invalidPreview = await app.inject({
      method: 'POST',
      payload: {},
      url: '/auth/wechat/admin-bind/preview',
    });
    expect(invalidPreview.statusCode).toBe(400);
  });

  async function createLink(userId: string) {
    const operationId = randomUUID();
    const response = await app.inject({
      headers: {
        authorization: `Bearer ${adminToken()}`,
        'idempotency-key': operationId,
      },
      method: 'POST',
      payload: { expectedAuthVersion: 1 },
      url: `/platform-admin/users/${userId}/wechat-miniprogram-binding-links`,
    });
    expect(response.statusCode).toBe(200);
    return response.json() as { authVersion: number; expiresAt: string; urlLink: string };
  }

  async function seedTarget(label: string, withPassword = true) {
    const userId = randomUUID();
    const username = `target.${label}`;
    await client.database.execute(sql`
      INSERT INTO users (id, cloudbase_uid, status)
      VALUES (${userId}, ${`password_${userId}`}, 'active')
    `);
    await client.database.execute(sql`
      INSERT INTO user_profiles (user_id, real_name) VALUES (${userId}, ${`目标${label}`})
    `);
    if (withPassword) {
      await client.database.execute(sql`
        INSERT INTO user_password_credentials (user_id, username, password_hash)
        VALUES (${userId}, ${username}, ${await hashPassword('password')})
      `);
    }
    return { userId, username };
  }
});

function createBindingGateway(): WechatGateway {
  return {
    appId: CURRENT_APP_ID,
    isConfigured: true,
    async exchangeCode(code) {
      return { openid: `admin-openid-${code}`, sessionKey: undefined, unionid: undefined };
    },
    async generateUrlLink(path, query, envVersion) {
      return `https://mock.example.test/launch?${query}&path=${encodeURIComponent(path)}&env=${envVersion}`;
    },
    async getUnlimitedQr() {
      return new Uint8Array();
    },
    async sendSubscribeMessage() {
      return { messageId: null };
    },
  };
}

function adminToken(): string {
  return passwordToken(ADMIN_ID, 'admin');
}

function passwordToken(userId: string, username: string): string {
  return createPasswordSessionToken({ authVersion: 1, sub: userId, username }, TEST_SESSION_SECRET);
}

function createTestClientCapabilityPolicy(): ClientCapabilityPolicy {
  return new ClientCapabilityPolicy({
    capabilities: {
      core: true,
      externalMessages: true,
      global: true,
      guest: true,
      insights: true,
      organization: true,
      workflows: true,
    },
    legacyVersion: '0.1.0-p6.20260824.78',
    supportedVersions: ['0.1.0-p6.20260824.78', '0.1.0-p6.20260824.79'],
  });
}

function getTestDatabaseOptions(): DatabaseConnectionOptions | undefined {
  if (process.env.NODE_ENV !== 'test') return undefined;
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
  )
    return undefined;
  return {
    database: TEST_MYSQL_DATABASE,
    host: TEST_MYSQL_HOST ?? '127.0.0.1',
    password: TEST_MYSQL_PASSWORD,
    port,
    user: TEST_MYSQL_USER,
  };
}
