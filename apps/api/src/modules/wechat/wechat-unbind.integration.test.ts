import { createHash, randomUUID } from 'node:crypto';
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
  createWechatSessionToken,
  verifyWechatSessionToken,
} from '../../adapters/auth/wechat-auth.js';
import { createApp } from '../../app.js';
import { hashPassword } from '../auth/password-auth-service.js';
import type { WechatGateway } from './wechat-gateway.js';

const migrationsDirectory = fileURLToPath(new URL('../../../../../migrations', import.meta.url));
const databaseOptions = getTestDatabaseOptions();
const describeWithDatabase = databaseOptions === undefined ? describe.skip : describe;
const TEST_SESSION_SECRET = 'test-wechat-session-secret-0123456789abcdef';
const CURRENT_APP_ID = 'unbind-mini-app';
const DEVELOPER_ADMIN_ID = '00000000-0000-4000-8000-000000000001';

describeWithDatabase('current Mini AppID identity unbind', () => {
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
      logger: false,
      wechatGateway: createProofGateway(),
      wechatSessionSecret: TEST_SESSION_SECRET,
    });
  });

  afterEach(async () => {
    if (app !== undefined) await app.close();
    if (client !== undefined) await client.close();
  });

  it('unbinds only the current Mini identity, invalidates the old session, and requires explicit rebind', async () => {
    const user = await seedBoundUser('self', {
      withBusinessReference: true,
      withWebIdentity: true,
    });
    const operationId = randomUUID();
    const response = await selfUnbind(user.token, operationId, 'proof-self');

    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toEqual({ unbound: true });
    const [state] = (await client.database.execute(sql`
      SELECT
        (SELECT auth_version FROM users WHERE id = ${user.userId}) AS authVersion,
        (SELECT wechat_openid FROM users WHERE id = ${user.userId}) AS wechatOpenid,
        (
          SELECT COUNT(*) FROM user_auth_identities
          WHERE user_id = ${user.userId}
            AND provider = 'wechat_mini_program'
            AND app_id = ${CURRENT_APP_ID}
        ) AS currentMiniIdentities,
        (
          SELECT COUNT(*) FROM user_auth_identities
          WHERE user_id = ${user.userId} AND provider = 'wechat_web'
        ) AS webIdentities,
        (SELECT COUNT(*) FROM wechat_union_accounts WHERE user_id = ${user.userId}) AS unionsCount,
        (SELECT COUNT(*) FROM user_profiles WHERE user_id = ${user.userId}) AS profilesCount,
        (
          SELECT COUNT(*) FROM user_password_credentials WHERE user_id = ${user.userId}
        ) AS passwordsCount,
        (
          SELECT COUNT(*) FROM group_memberships WHERE user_id = ${user.userId}
        ) AS membershipsCount
    `)) as unknown as [
      {
        authVersion: number;
        currentMiniIdentities: number;
        membershipsCount: number;
        passwordsCount: number;
        profilesCount: number;
        unionsCount: number;
        webIdentities: number;
        wechatOpenid: string | null;
      }[],
      unknown,
    ];
    expect(state).toEqual([
      {
        authVersion: 2,
        currentMiniIdentities: 0,
        membershipsCount: 1,
        passwordsCount: 1,
        profilesCount: 1,
        unionsCount: 1,
        webIdentities: 1,
        wechatOpenid: null,
      },
    ]);
    const [detachments] = (await client.database.execute(sql`
      SELECT subject_hash AS subjectHash, user_id AS userId
      FROM wechat_identity_detachments
    `)) as unknown as [{ subjectHash: string; userId: string }[], unknown];
    expect(detachments).toEqual([{ subjectHash: sha256(user.subject), userId: user.userId }]);
    expect(detachments[0]?.subjectHash).not.toBe(user.subject);
    const [audits] = (await client.database.execute(sql`
      SELECT action, actor_user_id AS actorUserId, target_id AS targetId
      FROM audit_logs WHERE action = 'wechat_miniprogram_unbound'
    `)) as unknown as [
      { action: string; actorUserId: string | null; targetId: string | null }[],
      unknown,
    ];
    expect(audits).toEqual([
      {
        action: 'wechat_miniprogram_unbound',
        actorUserId: user.userId,
        targetId: user.userId,
      },
    ]);

    const stale = await app.inject({
      headers: { authorization: `Bearer ${user.token}` },
      method: 'GET',
      url: '/users/me',
    });
    expect(stale.statusCode).toBe(401);
    const login = await app.inject({
      method: 'POST',
      payload: { code: 'proof-self' },
      url: '/auth/wechat/login',
    });
    expect(login.statusCode).toBe(200);
    expect(login.json()).toMatchObject({ status: 'link_required' });
    const linkToken = (login.json() as { linkToken: string }).linkToken;
    const rebound = await app.inject({
      method: 'POST',
      payload: {
        linkToken,
        password: user.password,
        username: user.username,
      },
      url: '/auth/wechat/link-password',
    });
    expect(rebound.statusCode, rebound.body).toBe(200);
    const reboundClaims = verifyWechatSessionToken(
      (rebound.json() as { token: string }).token,
      TEST_SESSION_SECRET,
    );
    expect(reboundClaims).toMatchObject({ authVersion: 2, sub: user.userId });
    const [afterRebind] = (await client.database.execute(sql`
      SELECT
        (SELECT COUNT(*) FROM wechat_identity_detachments) AS detachmentsCount,
        (
          SELECT COUNT(*) FROM user_auth_identities
          WHERE user_id = ${user.userId}
            AND provider = 'wechat_mini_program'
            AND app_id = ${CURRENT_APP_ID}
        ) AS identitiesCount
    `)) as unknown as [{ detachmentsCount: number; identitiesCount: number }[], unknown];
    expect(afterRebind).toEqual([{ detachmentsCount: 0, identitiesCount: 1 }]);
  });

  it('rejects a mismatched fresh code and users without a usable password', async () => {
    const protectedUser = await seedBoundUser('protected');
    const wrongProof = await selfUnbind(protectedUser.token, randomUUID(), 'proof-other');
    expect(wrongProof.statusCode).toBe(409);
    expect(wrongProof.json()).toMatchObject({ error: { code: 'CONFLICT' } });

    const passwordless = await seedBoundUser('passwordless', { withPassword: false });
    const noPassword = await selfUnbind(passwordless.token, randomUUID(), 'proof-passwordless');
    expect(noPassword.statusCode).toBe(403);
    expect(noPassword.json()).toMatchObject({ error: { code: 'FORBIDDEN' } });

    const [rows] = (await client.database.execute(sql`
      SELECT id, auth_version AS authVersion FROM users
      WHERE id IN (${protectedUser.userId}, ${passwordless.userId}) ORDER BY id
    `)) as unknown as [{ authVersion: number; id: string }[], unknown];
    expect(rows.every((row) => row.authVersion === 1)).toBe(true);
    const [identityRows] = await client.database.execute<{ count: number }>(sql`
      SELECT COUNT(*) AS count FROM user_auth_identities
      WHERE provider = 'wechat_mini_program' AND app_id = ${CURRENT_APP_ID}
    `);
    expect(identityRows).toEqual([{ count: 2 }]);
  });

  it('treats a second proven self-unbind as a no-op without another version or audit', async () => {
    const user = await seedBoundUser('self-retry');
    const first = await selfUnbind(user.token, randomUUID(), 'proof-self-retry');
    expect(first.statusCode).toBe(200);
    const passwordToken = createPasswordSessionToken(
      { authVersion: 2, sub: user.userId, username: user.username },
      TEST_SESSION_SECRET,
    );
    const second = await selfUnbind(passwordToken, randomUUID(), 'proof-self-retry');
    expect(second.statusCode).toBe(200);
    expect(second.json()).toEqual({ unbound: true });

    const [rows] = (await client.database.execute(sql`
      SELECT
        (SELECT auth_version FROM users WHERE id = ${user.userId}) AS authVersion,
        (
          SELECT COUNT(*) FROM audit_logs
          WHERE action = 'wechat_miniprogram_unbound' AND target_id = ${user.userId}
        ) AS auditsCount,
        (
          SELECT COUNT(*) FROM wechat_identity_detachments WHERE user_id = ${user.userId}
        ) AS detachmentsCount
    `)) as unknown as [
      { auditsCount: number; authVersion: number; detachmentsCount: number }[],
      unknown,
    ];
    expect(rows).toEqual([{ auditsCount: 1, authVersion: 2, detachmentsCount: 1 }]);
  });

  it('lets a platform administrator unbind concurrently exactly once and preserves other identities', async () => {
    const target = await seedBoundUser('admin-target', { withWebIdentity: true });
    await client.database.execute(sql`
      INSERT INTO user_auth_identities (id, user_id, provider, app_id, subject)
      VALUES (
        ${randomUUID()}, ${target.userId}, 'wechat_mini_program',
        'another-mini-app', 'another-mini-subject'
      )
    `);
    const operationId = randomUUID();
    const request = () =>
      app.inject({
        headers: {
          authorization: `Bearer ${developerAdminToken()}`,
          'idempotency-key': operationId,
        },
        method: 'POST',
        payload: { reason: '用户本人联系平台申请解绑' },
        url: `/platform-admin/users/${target.userId}/wechat/miniprogram/unbind`,
      });
    const responses = await Promise.all([request(), request()]);
    expect(responses.map((response) => response.statusCode)).toEqual([200, 200]);
    expect(responses.map((response) => response.json())).toEqual([
      { unbound: true },
      { unbound: true },
    ]);

    const changedReason = await app.inject({
      headers: {
        authorization: `Bearer ${developerAdminToken()}`,
        'idempotency-key': operationId,
      },
      method: 'POST',
      payload: { reason: '另一条原因' },
      url: `/platform-admin/users/${target.userId}/wechat/miniprogram/unbind`,
    });
    expect(changedReason.statusCode).toBe(409);
    const [state] = (await client.database.execute(sql`
      SELECT
        (SELECT auth_version FROM users WHERE id = ${target.userId}) AS authVersion,
        (
          SELECT COUNT(*) FROM user_auth_identities
          WHERE user_id = ${target.userId}
            AND provider = 'wechat_mini_program'
            AND app_id = ${CURRENT_APP_ID}
        ) AS currentMiniIdentities,
        (
          SELECT COUNT(*) FROM user_auth_identities
          WHERE user_id = ${target.userId}
            AND NOT (provider = 'wechat_mini_program' AND app_id = ${CURRENT_APP_ID})
        ) AS otherIdentities,
        (
          SELECT COUNT(*) FROM audit_logs
          WHERE action = 'wechat_miniprogram_admin_unbound' AND target_id = ${target.userId}
        ) AS auditsCount
    `)) as unknown as [
      {
        auditsCount: number;
        authVersion: number;
        currentMiniIdentities: number;
        otherIdentities: number;
      }[],
      unknown,
    ];
    expect(state).toEqual([
      {
        auditsCount: 1,
        authVersion: 2,
        currentMiniIdentities: 0,
        otherIdentities: 2,
      },
    ]);
    expect(
      (
        await app.inject({
          headers: { authorization: `Bearer ${target.token}` },
          method: 'GET',
          url: '/users/me',
        })
      ).statusCode,
    ).toBe(401);
  });

  it('rejects non-admin callers, missing idempotency keys, and passwordless targets', async () => {
    const target = await seedBoundUser('admin-guard');
    const nonAdmin = await app.inject({
      headers: {
        authorization: `Bearer ${target.token}`,
        'idempotency-key': randomUUID(),
      },
      method: 'POST',
      payload: { reason: 'not allowed' },
      url: `/platform-admin/users/${target.userId}/wechat/miniprogram/unbind`,
    });
    expect(nonAdmin.statusCode).toBe(403);

    const missingKey = await app.inject({
      headers: { authorization: `Bearer ${developerAdminToken()}` },
      method: 'POST',
      payload: { reason: 'missing key' },
      url: `/platform-admin/users/${target.userId}/wechat/miniprogram/unbind`,
    });
    expect(missingKey.statusCode).toBe(400);

    const passwordless = await seedBoundUser('admin-passwordless', { withPassword: false });
    const noPassword = await app.inject({
      headers: {
        authorization: `Bearer ${developerAdminToken()}`,
        'idempotency-key': randomUUID(),
      },
      method: 'POST',
      payload: { reason: 'cannot strand account' },
      url: `/platform-admin/users/${passwordless.userId}/wechat/miniprogram/unbind`,
    });
    expect(noPassword.statusCode).toBe(403);
    const [identities] = await client.database.execute<{ count: number }>(sql`
      SELECT COUNT(*) AS count FROM user_auth_identities
      WHERE provider = 'wechat_mini_program' AND app_id = ${CURRENT_APP_ID}
    `);
    expect(identities).toEqual([{ count: 2 }]);
  });

  it('never removes an identity belonging to another Mini AppID', async () => {
    const target = await seedBoundUser('other-app', { appId: 'another-mini-app' });
    const response = await app.inject({
      headers: {
        authorization: `Bearer ${developerAdminToken()}`,
        'idempotency-key': randomUUID(),
      },
      method: 'POST',
      payload: { reason: 'current app only' },
      url: `/platform-admin/users/${target.userId}/wechat/miniprogram/unbind`,
    });

    expect(response.statusCode).toBe(404);
    const [identities] = (await client.database.execute(sql`
      SELECT app_id AS appId FROM user_auth_identities WHERE user_id = ${target.userId}
    `)) as unknown as [{ appId: string | null }[], unknown];
    expect(identities).toEqual([{ appId: 'another-mini-app' }]);
    const [userRows] = (await client.database.execute(sql`
      SELECT auth_version AS authVersion FROM users WHERE id = ${target.userId}
    `)) as unknown as [{ authVersion: number }[], unknown];
    expect(userRows).toEqual([{ authVersion: 1 }]);
  });

  async function selfUnbind(token: string, operationId: string, code: string) {
    return app.inject({
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': operationId,
      },
      method: 'POST',
      payload: { code },
      url: '/me/wechat/miniprogram/unbind',
    });
  }

  async function seedBoundUser(
    label: string,
    options: {
      readonly appId?: string;
      readonly withBusinessReference?: boolean;
      readonly withPassword?: boolean;
      readonly withWebIdentity?: boolean;
    } = {},
  ) {
    const appId = options.appId ?? CURRENT_APP_ID;
    const password = `password-${label}`;
    const subject = `unbind-openid-${label}`;
    const unionId = `unbind-union-${label}`;
    const userId = randomUUID();
    const username = `${label}.user`;
    await client.database.execute(sql`
      INSERT INTO users (id, cloudbase_uid, wechat_openid, status)
      VALUES (${userId}, ${`password_${userId}`}, ${subject}, 'active')
    `);
    await client.database.execute(sql`
      INSERT INTO user_profiles (user_id, real_name) VALUES (${userId}, ${`User ${label}`})
    `);
    if (options.withPassword !== false) {
      await client.database.execute(sql`
        INSERT INTO user_password_credentials (user_id, username, password_hash)
        VALUES (${userId}, ${username}, ${await hashPassword(password)})
      `);
    }
    await client.database.execute(sql`
      INSERT INTO user_auth_identities (id, user_id, provider, app_id, subject)
      VALUES (${randomUUID()}, ${userId}, 'wechat_mini_program', ${appId}, ${subject})
    `);
    await client.database.execute(sql`
      INSERT INTO wechat_union_accounts (id, user_id, union_id)
      VALUES (${randomUUID()}, ${userId}, ${unionId})
    `);
    if (options.withWebIdentity === true) {
      await client.database.execute(sql`
        INSERT INTO user_auth_identities (id, user_id, provider, app_id, subject)
        VALUES (${randomUUID()}, ${userId}, 'wechat_web', 'web-app-id', ${`web-${subject}`})
      `);
    }
    if (options.withBusinessReference === true) {
      const groupId = randomUUID();
      await client.database.execute(sql`
        INSERT INTO \`groups\` (id, name, group_code, visitor_key, owner_user_id)
        VALUES (${groupId}, 'Preserved Group', '7319', ${randomUUID()}, ${userId})
      `);
      await client.database.execute(sql`
        INSERT INTO group_memberships (id, group_id, user_id, role, status)
        VALUES (${randomUUID()}, ${groupId}, ${userId}, 'owner', 'active')
      `);
    }
    return {
      password,
      subject,
      token: createWechatSessionToken(
        {
          appId,
          authVersion: 1,
          openid: subject,
          provider: 'wechat_mini_program',
          sub: userId,
        },
        TEST_SESSION_SECRET,
      ),
      unionId,
      userId,
      username,
    };
  }
});

function createProofGateway(): WechatGateway {
  return {
    appId: CURRENT_APP_ID,
    isConfigured: true,
    async exchangeCode(code) {
      const label = code.startsWith('proof-') ? code.slice('proof-'.length) : code;
      return {
        openid: `unbind-openid-${label}`,
        sessionKey: undefined,
        unionid: `unbind-union-${label}`,
      };
    },
    async getUnlimitedQr() {
      return new Uint8Array();
    },
    async sendSubscribeMessage() {
      return { messageId: null };
    },
  };
}

function developerAdminToken(): string {
  return createPasswordSessionToken(
    { authVersion: 1, sub: DEVELOPER_ADMIN_ID, username: 'admin' },
    TEST_SESSION_SECRET,
  );
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
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
