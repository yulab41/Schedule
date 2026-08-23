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
  createWechatSessionToken,
} from '../../adapters/auth/wechat-auth.js';
import { createApp } from '../../app.js';
import { ClientCapabilityPolicy } from '../client-capabilities/client-capability-policy.js';
import { hashPassword, PasswordAuthService } from './password-auth-service.js';
import type { WechatGateway } from '../wechat/wechat-gateway.js';

const migrationsDirectory = fileURLToPath(new URL('../../../../../migrations', import.meta.url));
const databaseOptions = getTestDatabaseOptions();
const describeWithDatabase = databaseOptions === undefined ? describe.skip : describe;
const TEST_SESSION_SECRET = 'test-password-identity-secret-0123456789abcdef';
const TEST_CLIENT_CAPABILITY_POLICY = createTestClientCapabilityPolicy();
const CURRENT_APP_ID = 'password-proof-app';
const DEVELOPER_ADMIN_ID = '00000000-0000-4000-8000-000000000001';

describeWithDatabase('admin password identity and proof', () => {
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
      passwordAuthService: new PasswordAuthService({
        databaseClient: client,
        gateway: createProofGateway(),
        sessionSecret: TEST_SESSION_SECRET,
      }),
      wechatGateway: createProofGateway(),
      wechatSessionSecret: TEST_SESSION_SECRET,
    });
  });

  afterEach(async () => {
    if (app !== undefined) await app.close();
    if (client !== undefined) await client.close();
  });

  it('lists redacted account state and assigns a username plus missing password locator', async () => {
    const user = await seedUser('assigned', { withCredential: false, withMini: false });
    const userId = user.userId;
    const list = await app.inject({
      headers: { authorization: `Bearer ${developerAdminToken()}` },
      method: 'GET',
      url: '/platform-admin/users',
    });
    expect(list.statusCode).toBe(200);
    const listed = (list.json() as { users: readonly Record<string, unknown>[] }).users.find(
      (user) => user.id === userId,
    );
    expect(listed).toEqual({
      authVersion: 1,
      hasPassword: false,
      id: userId,
      status: 'active',
    });
    expect(listed).not.toHaveProperty('realName');

    const assigned = await app.inject({
      headers: { authorization: `Bearer ${developerAdminToken()}` },
      method: 'PUT',
      payload: { username: '  Assigned.User  ' },
      url: `/platform-admin/users/${userId}/password-identity`,
    });
    expect(assigned.statusCode, assigned.body).toBe(200);
    expect(assigned.json()).toEqual({ passwordConfigured: false, username: 'assigned.user' });
    const [rows] = (await client.database.execute(sql`
      SELECT
        u.auth_version AS authVersion,
        u.cloudbase_uid AS cloudbaseUid,
        c.username,
        c.password_hash AS passwordHash
      FROM users u INNER JOIN user_password_credentials c ON c.user_id = u.id
      WHERE u.id = ${userId}
    `)) as unknown as [
      [
        {
          authVersion: number;
          cloudbaseUid: string;
          passwordHash: string | null;
          username: string;
        }[],
        unknown,
      ],
    ];
    expect(rows).toEqual([
      {
        authVersion: 2,
        cloudbaseUid: `password_${userId}`,
        passwordHash: null,
        username: 'assigned.user',
      },
    ]);

    const repeated = await app.inject({
      headers: { authorization: `Bearer ${developerAdminToken()}` },
      method: 'PUT',
      payload: { username: 'assigned.user' },
      url: `/platform-admin/users/${userId}/password-identity`,
    });
    expect(repeated.statusCode).toBe(200);
    const [versionRows] = (await client.database.execute(sql`
      SELECT auth_version AS authVersion FROM users WHERE id = ${userId}
    `)) as unknown as [{ authVersion: number }[], unknown];
    expect(versionRows).toEqual([{ authVersion: 2 }]);
  });

  it('rejects non-admin assignment and duplicate usernames without changing the target', async () => {
    const target = await seedUser('assignment-target', { withCredential: false, withMini: false });
    const owner = await seedUser('existing-name', { withCredential: true, withMini: false });
    const outsider = await app.inject({
      headers: { authorization: `Bearer ${passwordToken(owner.userId, owner.username, 1)}` },
      method: 'PUT',
      payload: { username: 'new-name' },
      url: `/platform-admin/users/${target.userId}/password-identity`,
    });
    expect(outsider.statusCode).toBe(403);

    const duplicate = await app.inject({
      headers: { authorization: `Bearer ${developerAdminToken()}` },
      method: 'PUT',
      payload: { username: owner.username },
      url: `/platform-admin/users/${target.userId}/password-identity`,
    });
    expect(duplicate.statusCode).toBe(409);
    const [rows] = (await client.database.execute(sql`
      SELECT auth_version AS authVersion, cloudbase_uid AS cloudbaseUid
      FROM users WHERE id = ${target.userId}
    `)) as unknown as [{ authVersion: number; cloudbaseUid: string | null }[], unknown];
    expect(rows).toEqual([{ authVersion: 1, cloudbaseUid: null }]);
  });

  it('changes a password with current proof and immediately invalidates the old session', async () => {
    const user = await seedUser('current-proof', { password: 'old-password', withMini: false });
    const token = passwordToken(user.userId, user.username, 1);
    const changed = await app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'PUT',
      payload: { currentPassword: 'old-password', newPassword: 'new-password' },
      url: '/me/password',
    });
    expect(changed.statusCode, changed.body).toBe(200);
    expect(changed.json()).toEqual({ passwordChanged: true });
    expect(
      (
        await app.inject({
          headers: { authorization: `Bearer ${token}` },
          method: 'GET',
          url: '/users/me',
        })
      ).statusCode,
    ).toBe(401);
    const login = await app.inject({
      method: 'POST',
      payload: { password: 'new-password', username: user.username },
      url: '/auth/password/login',
    });
    expect(login.statusCode).toBe(200);
  });

  it('sets a preallocated password through a matching current-AppID WeChat code proof', async () => {
    const user = await seedUser('code-proof', { withCredential: false, withMini: true });
    const assignment = await app.inject({
      headers: { authorization: `Bearer ${developerAdminToken()}` },
      method: 'PUT',
      payload: { username: user.username },
      url: `/platform-admin/users/${user.userId}/password-identity`,
    });
    expect(assignment.statusCode).toBe(200);
    const token = createWechatSessionToken(
      {
        appId: CURRENT_APP_ID,
        authVersion: 2,
        openid: user.subject,
        provider: 'wechat_mini_program',
        sub: user.userId,
      },
      TEST_SESSION_SECRET,
    );
    const changed = await app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'PUT',
      payload: { code: 'proof-code-proof', newPassword: 'new-password' },
      url: '/me/password',
    });
    expect(changed.statusCode, changed.body).toBe(200);
    const stale = await app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: '/users/me',
    });
    expect(stale.statusCode).toBe(401);
    const login = await app.inject({
      method: 'POST',
      payload: { password: 'new-password', username: user.username },
      url: '/auth/password/login',
    });
    expect(login.statusCode).toBe(200);
  });

  it('fails closed for wrong password/code proof and ambiguous proof bodies', async () => {
    const user = await seedUser('proof-errors', { password: 'old-password', withMini: true });
    const token = passwordToken(user.userId, user.username, 1);
    const wrongPassword = await app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'PUT',
      payload: { currentPassword: 'wrong-password', newPassword: 'new-password' },
      url: '/me/password',
    });
    expect(wrongPassword.statusCode).toBe(400);
    const wrongCode = await app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'PUT',
      payload: { code: 'proof-other', newPassword: 'new-password' },
      url: '/me/password',
    });
    expect(wrongCode.statusCode).toBe(401);
    const ambiguous = await app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'PUT',
      payload: {
        code: 'proof-errors',
        currentPassword: 'old-password',
        newPassword: 'new-password',
      },
      url: '/me/password',
    });
    expect(ambiguous.statusCode).toBe(400);
    const [rows] = (await client.database.execute(sql`
      SELECT auth_version AS authVersion, password_hash AS passwordHash
      FROM users u INNER JOIN user_password_credentials c ON c.user_id = u.id
      WHERE u.id = ${user.userId}
    `)) as unknown as [{ authVersion: number; passwordHash: string }[], unknown];
    expect(rows[0]?.authVersion).toBe(1);
    expect(rows[0]?.passwordHash).toContain('scrypt$');
  });

  function developerAdminToken(): string {
    return passwordToken(DEVELOPER_ADMIN_ID, 'admin', 1);
  }

  async function seedUser(
    label: string,
    options: {
      readonly password?: string;
      readonly withCredential?: boolean;
      readonly withMini: boolean;
    },
  ) {
    const userId = randomUUID();
    const username = `${label}.user`;
    const subject = `proof-openid-${label}`;
    const cloudbaseUid =
      options.withCredential === false && options.withMini === true
        ? `password_${userId}`
        : options.withCredential === false
          ? null
          : `password_${userId}`;
    await client.database.execute(sql`
      INSERT INTO users (id, cloudbase_uid, status)
      VALUES (${userId}, ${cloudbaseUid}, 'active')
    `);
    await client.database.execute(sql`
      INSERT INTO user_profiles (user_id, real_name) VALUES (${userId}, ${`User ${label}`})
    `);
    if (options.withCredential !== false) {
      await client.database.execute(sql`
        INSERT INTO user_password_credentials (user_id, username, password_hash)
        VALUES (${userId}, ${username}, ${await hashPassword(options.password ?? 'old-password')})
      `);
    }
    if (options.withMini) {
      await client.database.execute(sql`
        INSERT INTO user_auth_identities (id, user_id, provider, app_id, subject)
        VALUES (${randomUUID()}, ${userId}, 'wechat_mini_program', ${CURRENT_APP_ID}, ${subject})
      `);
    }
    return { password: options.password ?? 'old-password', subject, userId, username };
  }
});

function createProofGateway(): WechatGateway {
  return {
    appId: CURRENT_APP_ID,
    isConfigured: true,
    async exchangeCode(code) {
      const label = code.startsWith('proof-') ? code.slice('proof-'.length) : code;
      return { openid: `proof-openid-${label}`, sessionKey: undefined, unionid: undefined };
    },
    async getUnlimitedQr() {
      return new Uint8Array();
    },
    async sendSubscribeMessage() {
      return { messageId: null };
    },
  };
}

function passwordToken(userId: string, username: string, authVersion: number): string {
  return createPasswordSessionToken({ authVersion, sub: userId, username }, TEST_SESSION_SECRET);
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
