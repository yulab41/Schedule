import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import {
  createTestDatabaseClient,
  migrateDatabase,
  type DatabaseClient,
  type DatabaseConnectionOptions,
} from '@schedule/database';
import { sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createWechatAuthPort,
  createWechatSessionToken,
  verifyWechatSessionToken,
} from '../../adapters/auth/wechat-auth.js';
import { createApp } from '../../app.js';
import { ClientCapabilityPolicy } from '../client-capabilities/client-capability-policy.js';
import { hashPassword, PasswordAuthService } from '../auth/password-auth-service.js';
import {
  WechatGatewayError,
  createMockWechatGateway,
  type WechatGateway,
  type WechatWebGateway,
} from './wechat-gateway.js';
import { createWechatWebState, WechatWebAuthService } from './wechat-web-auth-service.js';

const migrationsDirectory = fileURLToPath(new URL('../../../../../migrations', import.meta.url));
const databaseOptions = getTestDatabaseOptions();
const describeWithDatabase = databaseOptions === undefined ? describe.skip : describe;
const TEST_SESSION_SECRET = 'test-wechat-session-secret-0123456789abcdef';
const TEST_CLIENT_CAPABILITY_POLICY = createTestClientCapabilityPolicy();

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
      clientCapabilityPolicy: TEST_CLIENT_CAPABILITY_POLICY,
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

  it('returns link_required for an unknown WeChat identity without creating a user', async () => {
    const login = await app.inject({
      method: 'POST',
      payload: { code: 'code-a' },
      url: '/auth/wechat/login',
    });

    expect(login.statusCode).toBe(200);
    const body = login.json() as {
      expiresAt: string;
      linkToken: string;
      status: string;
    };
    expect(body.status).toBe('link_required');
    expect(typeof body.linkToken).toBe('string');
    expect(new Date(body.expiresAt).valueOf()).toBeGreaterThan(Date.now());

    const [rows] = (await client.database.execute(
      sql`SELECT COUNT(*) AS count FROM users WHERE is_developer_admin = 0`,
    )) as unknown as [{ count: number }[], unknown];
    expect(rows).toEqual([{ count: 0 }]);
    const [identityRows] = await client.database.execute<{ count: number }>(
      sql`SELECT COUNT(*) AS count FROM user_auth_identities`,
    );
    const [unionRows] = await client.database.execute<{ count: number }>(
      sql`SELECT COUNT(*) AS count FROM wechat_union_accounts`,
    );
    expect(identityRows).toEqual([{ count: 0 }]);
    expect(unionRows).toEqual([{ count: 0 }]);
    const [linkRows] = (await client.database.execute(sql`
      SELECT token_hash AS tokenHash FROM wechat_link_tokens
    `)) as unknown as [{ tokenHash: string }[], unknown];
    expect(linkRows).toEqual([{ tokenHash: sha256(body.linkToken) }]);
    expect(linkRows[0]?.tokenHash).not.toBe(body.linkToken);

    const [auditRows] = (await client.database.execute(
      sql`SELECT action FROM audit_logs WHERE target_type = 'user'`,
    )) as unknown as [{ action: string }[], unknown];
    expect(auditRows).toEqual([]);
  });

  it('issues independent one-time link tokens on repeated unknown logins without creating users', async () => {
    const firstLogin = await loginForLink('code-a');
    const secondLogin = await loginForLink('code-a');

    expect(firstLogin.linkToken).not.toBe(secondLogin.linkToken);

    const [rows] = (await client.database.execute(
      sql`SELECT COUNT(*) AS count FROM users WHERE is_developer_admin = 0`,
    )) as unknown as [{ count: number }[], unknown];
    expect(rows[0]?.count).toBe(0);
    const [links] = await client.database.execute<{ count: number }>(
      sql`SELECT COUNT(*) AS count FROM wechat_link_tokens`,
    );
    expect(links).toEqual([{ count: 2 }]);
  });

  it('signs the exact paired Mini client version and rejects unknown versions before the gateway', async () => {
    await seedKnownMiniUser('signed-client-version');
    const signed = await app.inject({
      headers: {
        'x-schedule-client-platform': 'miniprogram',
        'x-schedule-client-version': '0.1.0-p6.20260824.79',
      },
      method: 'POST',
      payload: { code: 'signed-client-version' },
      url: '/auth/wechat/login',
    });
    expect(signed.statusCode, signed.body).toBe(200);
    const signedToken = (signed.json() as { token: string }).token;
    expect(verifyWechatSessionToken(signedToken, TEST_SESSION_SECRET)).toMatchObject({
      clientVersion: '0.1.0-p6.20260824.79',
      provider: 'wechat_mini_program',
    });
    expect(
      await createWechatAuthPort({
        allowDevTokens: false,
        databaseClient: client,
        sessionSecret: TEST_SESSION_SECRET,
      }).authenticate({ authorization: `Bearer ${signedToken}` }),
    ).toMatchObject({
      clientPlatform: 'miniprogram',
      clientVersion: '0.1.0-p6.20260824.79',
    });
    expect((await readProfile(signedToken)).statusCode).toBe(200);

    let gatewayCalls = 0;
    const countingGateway: WechatGateway = {
      appId: 'counting-mini-app',
      isConfigured: true,
      async exchangeCode() {
        gatewayCalls += 1;
        return { openid: 'must-not-run', sessionKey: undefined, unionid: undefined };
      },
      async getUnlimitedQr() {
        return new Uint8Array();
      },
      async sendSubscribeMessage() {
        return { messageId: null };
      },
    };
    const countingApp = createApp({
      authPort: createWechatAuthPort({
        allowDevTokens: false,
        databaseClient: client,
        sessionSecret: TEST_SESSION_SECRET,
      }),
      clientCapabilityPolicy: TEST_CLIENT_CAPABILITY_POLICY,
      databaseClient: client,
      logger: false,
      wechatGateway: countingGateway,
      wechatSessionSecret: TEST_SESSION_SECRET,
    });
    extraApps.push(countingApp);
    const unsupported = await countingApp.inject({
      headers: {
        'x-schedule-client-platform': 'miniprogram',
        'x-schedule-client-version': '0.1.0-p6.20260824.80',
      },
      method: 'POST',
      payload: { code: 'unknown-client-version' },
      url: '/auth/wechat/login',
    });
    expect(unsupported.statusCode).toBe(426);
    expect(unsupported.json()).toMatchObject({ error: { code: 'CLIENT_VERSION_UNSUPPORTED' } });
    expect(gatewayCalls).toBe(0);
  });

  it('accepts rollout-era version-1 tokens and rejects old and new tokens after authVersion changes', async () => {
    await seedKnownMiniUser('versioned');
    const loginResponse = await login('versioned');
    const [rows] = (await client.database.execute(sql`
      SELECT id FROM users WHERE wechat_openid = 'mock-openid-versioned'
    `)) as unknown as [{ id: string }[], unknown];
    const userId = rows[0]?.id as string;
    const legacyToken = createWechatSessionToken(
      {
        openid: 'mock-openid-versioned',
        provider: 'wechat_mini_program',
        sub: userId,
      },
      TEST_SESSION_SECRET,
    );

    expect((await readProfile(loginResponse.token)).statusCode).toBe(200);
    expect((await readProfile(legacyToken)).statusCode).toBe(200);

    await client.database.execute(sql`
      UPDATE users SET auth_version = 2 WHERE id = ${userId}
    `);

    expect((await readProfile(loginResponse.token)).statusCode).toBe(401);
    expect((await readProfile(legacyToken)).statusCode).toBe(401);
  });

  it('requires new Mini tokens to match their AppID-scoped identity', async () => {
    await seedKnownMiniUser('scoped');
    const loginResponse = await login('scoped');
    const claims = verifyWechatSessionToken(loginResponse.token, TEST_SESSION_SECRET);
    if (claims === undefined) throw new Error('expected signed Mini claims');
    const wrongAppToken = createWechatSessionToken(
      {
        appId: 'another-mini-app',
        authVersion: 1,
        openid: claims.openid,
        provider: 'wechat_mini_program',
        sub: claims.sub,
      },
      TEST_SESSION_SECRET,
    );

    expect((await readProfile(wrongAppToken)).statusCode).toBe(401);
    await client.database.execute(
      sql`DELETE FROM user_auth_identities WHERE user_id = ${claims.sub}`,
    );
    expect((await readProfile(loginResponse.token)).statusCode).toBe(401);
  });

  it('issues versioned password sessions and rejects them after authVersion changes', async () => {
    const userId = '20000000-0000-4000-8000-000000000001';
    await client.database.execute(sql`
      INSERT INTO users (id, cloudbase_uid, status)
      VALUES (${userId}, ${`password_${userId}`}, 'active')
    `);
    await client.database.execute(sql`
      INSERT INTO user_profiles (user_id, real_name)
      VALUES (${userId}, 'Password User')
    `);
    await client.database.execute(sql`
      INSERT INTO user_password_credentials (user_id, username, password_hash)
      VALUES (${userId}, 'password-user', ${await hashPassword('password')})
    `);
    const passwordService = new PasswordAuthService({
      databaseClient: client,
      sessionSecret: TEST_SESSION_SECRET,
    });
    const passwordApp = createApp({
      authPort: createWechatAuthPort({
        allowDevTokens: false,
        databaseClient: client,
        sessionSecret: TEST_SESSION_SECRET,
      }),
      databaseClient: client,
      clientCapabilityPolicy: TEST_CLIENT_CAPABILITY_POLICY,
      logger: false,
      passwordAuthService: passwordService,
    });
    extraApps.push(passwordApp);

    const loginResponse = await passwordApp.inject({
      method: 'POST',
      payload: { password: 'password', username: 'password-user' },
      url: '/auth/password/login',
    });
    expect(loginResponse.statusCode).toBe(200);
    const token = (loginResponse.json() as { token: string }).token;
    const legacyToken = createWechatSessionToken(
      { openid: 'password-user', provider: 'password', sub: userId },
      TEST_SESSION_SECRET,
    );
    expect(verifyWechatSessionToken(token, TEST_SESSION_SECRET)).toMatchObject({
      authVersion: 1,
      openid: 'password-user',
      provider: 'password',
      sub: userId,
    });
    const profile = await passwordApp.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: '/users/me',
    });
    expect(profile.statusCode).toBe(200);
    const legacyProfile = await passwordApp.inject({
      headers: { authorization: `Bearer ${legacyToken}` },
      method: 'GET',
      url: '/users/me',
    });
    expect(legacyProfile.statusCode).toBe(200);

    await client.database.execute(sql`UPDATE users SET auth_version = 2 WHERE id = ${userId}`);
    const stale = await passwordApp.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: '/users/me',
    });
    const staleLegacy = await passwordApp.inject({
      headers: { authorization: `Bearer ${legacyToken}` },
      method: 'GET',
      url: '/users/me',
    });
    expect(stale.statusCode).toBe(401);
    expect(staleLegacy.statusCode).toBe(401);
  });

  it('lazily adopts the exact legacy Mini openid without creating another user', async () => {
    const legacyUserId = '10000000-0000-4000-8000-000000000001';
    await client.database.execute(sql`
      INSERT INTO users (id, cloudbase_uid, wechat_openid, status)
      VALUES (${legacyUserId}, 'wx_mock-openid-legacy', 'mock-openid-legacy', 'active')
    `);

    const response = await loginForLink('legacy');
    expect(response.status).toBe('link_required');
    const [usersAfter] = (await client.database.execute(sql`
      SELECT COUNT(*) AS count FROM users WHERE is_developer_admin = 0
    `)) as unknown as [{ count: number }[], unknown];
    expect(usersAfter).toEqual([{ count: 1 }]);
    const [identities] = (await client.database.execute(sql`
      SELECT app_id AS appId, subject, user_id AS userId
      FROM user_auth_identities
    `)) as unknown as [{ appId: string | null; subject: string; userId: string }[], unknown];
    expect(identities).toEqual([
      { appId: 'mock-mini-app-id', subject: 'mock-openid-legacy', userId: legacyUserId },
    ]);
  });

  it('scopes an existing legacy identity with a null AppID on its next exact login', async () => {
    const userId = '30000000-0000-4000-8000-000000000001';
    await client.database.execute(sql`
      INSERT INTO users (id, cloudbase_uid, wechat_openid, status)
      VALUES (${userId}, 'wx_mock-openid-legacy-identity', 'mock-openid-legacy-identity', 'active')
    `);
    await client.database.execute(sql`
      INSERT INTO user_auth_identities (id, user_id, provider, app_id, subject)
      VALUES (
        '30000000-0000-4000-8000-000000000002', ${userId},
        'wechat_mini_program', NULL, 'mock-openid-legacy-identity'
      )
    `);

    const response = await loginForLink('legacy-identity');
    expect(response.status).toBe('link_required');
    const [identityRows] = (await client.database.execute(sql`
      SELECT app_id AS appId FROM user_auth_identities WHERE user_id = ${userId}
    `)) as unknown as [{ appId: string | null }[], unknown];
    expect(identityRows).toEqual([{ appId: 'mock-mini-app-id' }]);
  });

  it('uses one Union account for Web and Mini identities of the same natural person', async () => {
    const unionId = 'shared-union-id';
    const webGateway: WechatWebGateway = {
      appId: 'web-app-id',
      isConfigured: true,
      async exchangeCode() {
        return { openid: 'web-openid', sessionKey: undefined, unionid: unionId };
      },
    };
    const webService = new WechatWebAuthService({
      databaseClient: client,
      gateway: webGateway,
      redirectUri: 'https://example.test/callback',
      sessionSecret: TEST_SESSION_SECRET,
    });
    const webState = createWechatWebState(
      'cross-channel-state',
      TEST_SESSION_SECRET,
      Math.floor(Date.now() / 1000),
    );
    const webLogin = await webService.exchange('web-code', webState);
    const initialWebClaims = verifyWechatSessionToken(webLogin.token, TEST_SESSION_SECRET);
    if (initialWebClaims === undefined) throw new Error('expected signed Web claims');
    await client.database.execute(sql`
      INSERT INTO user_profiles (user_id, real_name)
      VALUES (${initialWebClaims.sub}, 'Cross Channel User')
    `);

    const miniGateway: WechatGateway = {
      appId: 'mini-app-id',
      isConfigured: true,
      async exchangeCode() {
        return { openid: 'mini-openid', sessionKey: undefined, unionid: unionId };
      },
      async getUnlimitedQr() {
        return new Uint8Array();
      },
      async sendSubscribeMessage() {
        return { messageId: null };
      },
    };
    const crossChannelApp = createApp({
      authPort: createWechatAuthPort({
        allowDevTokens: false,
        databaseClient: client,
        sessionSecret: TEST_SESSION_SECRET,
      }),
      databaseClient: client,
      clientCapabilityPolicy: TEST_CLIENT_CAPABILITY_POLICY,
      logger: false,
      wechatGateway: miniGateway,
      wechatSessionSecret: TEST_SESSION_SECRET,
    });
    extraApps.push(crossChannelApp);
    const miniLogin = await crossChannelApp.inject({
      method: 'POST',
      payload: { code: 'mini-code' },
      url: '/auth/wechat/login',
    });
    expect(miniLogin.statusCode, miniLogin.body).toBe(200);

    const miniToken = (miniLogin.json() as { token: string }).token;
    const webClaims = initialWebClaims;
    const miniClaims = verifyWechatSessionToken(miniToken, TEST_SESSION_SECRET);
    if (webClaims === undefined || miniClaims === undefined) {
      throw new Error('expected signed cross-channel claims');
    }
    expect(miniClaims.sub).toBe(webClaims.sub);
    expect(webClaims).toMatchObject({ appId: 'web-app-id', authVersion: 1 });
    expect(miniClaims).toMatchObject({ appId: 'mini-app-id', authVersion: 1 });

    const [identityRows] = (await client.database.execute(sql`
      SELECT app_id AS appId, provider, union_id AS unionId, user_id AS userId
      FROM user_auth_identities
      ORDER BY provider
    `)) as unknown as [
      { appId: string | null; provider: string; unionId: string | null; userId: string }[],
      unknown,
    ];
    expect(identityRows).toHaveLength(2);
    expect(new Set(identityRows.map((row) => row.userId))).toEqual(new Set([webClaims.sub]));
    expect(identityRows.map((row) => row.unionId)).toEqual([null, null]);
    const [unionRows] = (await client.database.execute(sql`
      SELECT union_id AS unionId, user_id AS userId FROM wechat_union_accounts
    `)) as unknown as [{ unionId: string; userId: string }[], unknown];
    expect(unionRows).toEqual([{ unionId, userId: webClaims.sub }]);

    const webProfile = await crossChannelApp.inject({
      headers: { authorization: `Bearer ${webLogin.token}` },
      method: 'GET',
      url: '/users/me',
    });
    expect(webProfile.statusCode).toBe(200);
    expect(webProfile.json()).toMatchObject({ realName: 'Cross Channel User' });
    await client.database.execute(sql`
      UPDATE users SET auth_version = 2 WHERE id = ${webClaims.sub}
    `);
    const staleWeb = await crossChannelApp.inject({
      headers: { authorization: `Bearer ${webLogin.token}` },
      method: 'GET',
      url: '/users/me',
    });
    const staleMini = await crossChannelApp.inject({
      headers: { authorization: `Bearer ${miniToken}` },
      method: 'GET',
      url: '/users/me',
    });
    expect(staleWeb.statusCode).toBe(401);
    expect(staleMini.statusCode).toBe(401);
  });

  it('fails closed instead of merging an exact identity with another user Union account', async () => {
    const unionUserId = '40000000-0000-4000-8000-000000000001';
    const identityUserId = '40000000-0000-4000-8000-000000000002';
    await client.database.execute(sql`
      INSERT INTO users (id, cloudbase_uid, status)
      VALUES
        (${unionUserId}, 'wx_union-owner', 'active'),
        (${identityUserId}, 'wx_identity-owner', 'active')
    `);
    await client.database.execute(sql`
      INSERT INTO wechat_union_accounts (id, user_id, union_id)
      VALUES ('40000000-0000-4000-8000-000000000003', ${unionUserId}, 'conflict-union')
    `);
    await client.database.execute(sql`
      INSERT INTO user_auth_identities (id, user_id, provider, app_id, subject)
      VALUES (
        '40000000-0000-4000-8000-000000000004', ${identityUserId},
        'wechat_mini_program', 'conflict-mini-app', 'conflict-openid'
      )
    `);

    const conflictGateway: WechatGateway = {
      appId: 'conflict-mini-app',
      isConfigured: true,
      async exchangeCode() {
        return {
          openid: 'conflict-openid',
          sessionKey: undefined,
          unionid: 'conflict-union',
        };
      },
      async getUnlimitedQr() {
        return new Uint8Array();
      },
      async sendSubscribeMessage() {
        return { messageId: null };
      },
    };
    const conflictApp = createApp({
      authPort: createWechatAuthPort({
        allowDevTokens: false,
        databaseClient: client,
        sessionSecret: TEST_SESSION_SECRET,
      }),
      databaseClient: client,
      clientCapabilityPolicy: TEST_CLIENT_CAPABILITY_POLICY,
      logger: false,
      wechatGateway: conflictGateway,
      wechatSessionSecret: TEST_SESSION_SECRET,
    });
    extraApps.push(conflictApp);
    const response = await conflictApp.inject({
      method: 'POST',
      payload: { code: 'conflict' },
      url: '/auth/wechat/login',
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: { code: 'CONFLICT' } });
    const [rows] = (await client.database.execute(sql`
      SELECT user_id AS userId FROM user_auth_identities WHERE subject = 'conflict-openid'
    `)) as unknown as [{ userId: string }[], unknown];
    expect(rows).toEqual([{ userId: identityUserId }]);
  });

  it('returns link_required for a known identity without a profile and records the target user', async () => {
    const userId = await seedKnownMiniUser('code-b', { withProfile: false });
    const loginResponse = await loginForLink('code-b');

    const [rows] = (await client.database.execute(sql`
      SELECT existing_user_id AS existingUserId
      FROM wechat_link_tokens
      WHERE token_hash = ${sha256(loginResponse.linkToken)}
    `)) as unknown as [{ existingUserId: string | null }[], unknown];
    expect(rows).toEqual([{ existingUserId: userId }]);
  });

  it('rehomes an empty legacy Mini identity when password proof selects the account', async () => {
    const legacyUserId = await seedKnownMiniUser('legacy-password-link', { withProfile: false });
    const targetUserId = await seedPasswordUser('legacy.target', 'correct-password', {
      realName: 'Password User',
    });
    const pending = await loginForLink('legacy-password-link');

    const response = await app.inject({
      method: 'POST',
      payload: {
        linkToken: pending.linkToken,
        password: 'correct-password',
        username: 'legacy.target',
      },
      url: '/auth/wechat/link-password',
    });

    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toMatchObject({
      profile: { id: targetUserId, realName: 'Password User' },
      status: 'authenticated',
    });

    const [identityRows] = (await client.database.execute(sql`
      SELECT user_id AS userId
      FROM user_auth_identities
      WHERE subject = 'mock-openid-legacy-password-link'
    `)) as unknown as [{ userId: string }[], unknown];
    expect(identityRows).toEqual([{ userId: targetUserId }]);

    const [legacyRows] = (await client.database.execute(sql`
      SELECT
        status,
        cloudbase_uid AS cloudbaseUid,
        wechat_openid AS wechatOpenid,
        deleted_at IS NOT NULL AS isDeleted
      FROM users
      WHERE id = ${legacyUserId}
    `)) as unknown as [
      {
        cloudbaseUid: string | null;
        isDeleted: number;
        status: string;
        wechatOpenid: string | null;
      }[],
      unknown,
    ];
    expect(legacyRows).toEqual([
      { cloudbaseUid: null, isDeleted: 1, status: 'deleted', wechatOpenid: null },
    ]);
    expect(await readLinkStatus(pending.linkToken)).toBe('consumed');
  });

  it('rehomes a legacy Mini identity with a matching profile created by first use', async () => {
    const legacyUserId = await seedKnownMiniUser('legacy-profile-password-link', {
      withProfile: false,
    });
    const pending = await loginForLink('legacy-profile-password-link');
    await client.database.execute(sql`
      INSERT INTO user_profiles (user_id, real_name)
      VALUES (${legacyUserId}, 'User legacy-profile-password-link')
    `);
    const targetUserId = await seedPasswordUser('legacy.profile.target', 'correct-password', {
      realName: 'User legacy-profile-password-link',
    });

    const response = await app.inject({
      method: 'POST',
      payload: {
        linkToken: pending.linkToken,
        password: 'correct-password',
        username: 'legacy.profile.target',
      },
      url: '/auth/wechat/link-password',
    });

    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toMatchObject({
      profile: { id: targetUserId, realName: 'User legacy-profile-password-link' },
      status: 'authenticated',
    });

    const [legacyProfileRows] = (await client.database.execute(sql`
      SELECT deleted_at IS NOT NULL AS isDeleted
      FROM user_profiles
      WHERE user_id = ${legacyUserId}
    `)) as unknown as [{ isDeleted: number }[], unknown];
    expect(legacyProfileRows).toEqual([{ isDeleted: 1 }]);
  });

  it('keeps a legacy Mini identity pending when the profile does not match the password account', async () => {
    const legacyUserId = await seedKnownMiniUser('legacy-profile-mismatch', {
      withProfile: false,
    });
    const pending = await loginForLink('legacy-profile-mismatch');
    await client.database.execute(sql`
      INSERT INTO user_profiles (user_id, real_name)
      VALUES (${legacyUserId}, 'Different Profile')
    `);
    await seedPasswordUser('legacy.mismatch.target', 'correct-password', {
      realName: 'Password User',
    });

    const response = await app.inject({
      method: 'POST',
      payload: {
        linkToken: pending.linkToken,
        password: 'correct-password',
        username: 'legacy.mismatch.target',
      },
      url: '/auth/wechat/link-password',
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: { code: 'CONFLICT' } });
    expect(await readLinkStatus(pending.linkToken)).toBe('pending');
  });

  it('links a pending Mini identity to a password account and preserves its authVersion', async () => {
    const userId = await seedPasswordUser('doctor.one', 'correct-password', {
      authVersion: 3,
      realName: 'Doctor One',
    });
    const pending = await loginForLink('password-link');

    const response = await app.inject({
      headers: {
        'x-schedule-client-platform': 'miniprogram',
        'x-schedule-client-version': '0.1.0-p6.20260824.79',
      },
      method: 'POST',
      payload: {
        linkToken: pending.linkToken,
        password: 'correct-password',
        username: '  Doctor.One  ',
      },
      url: '/auth/wechat/link-password',
    });

    expect(response.statusCode, response.body).toBe(200);
    const body = response.json() as {
      profile: { id: string; realName: string; version: number };
      status: string;
      token: string;
    };
    expect(body).toMatchObject({
      profile: { id: userId, realName: 'Doctor One', version: 1 },
      status: 'authenticated',
    });
    expect(verifyWechatSessionToken(body.token, TEST_SESSION_SECRET)).toMatchObject({
      appId: 'mock-mini-app-id',
      authVersion: 3,
      clientVersion: '0.1.0-p6.20260824.79',
      openid: 'mock-openid-password-link',
      provider: 'wechat_mini_program',
      sub: userId,
    });
    expect((await readProfile(body.token)).statusCode).toBe(200);

    const [identities] = (await client.database.execute(sql`
      SELECT app_id AS appId, subject, user_id AS userId
      FROM user_auth_identities
    `)) as unknown as [{ appId: string; subject: string; userId: string }[], unknown];
    expect(identities).toEqual([
      {
        appId: 'mock-mini-app-id',
        subject: 'mock-openid-password-link',
        userId,
      },
    ]);
    const [usersAfter] = (await client.database.execute(sql`
      SELECT auth_version AS authVersion, wechat_openid AS wechatOpenid
      FROM users WHERE id = ${userId}
    `)) as unknown as [{ authVersion: number; wechatOpenid: string | null }[], unknown];
    expect(usersAfter).toEqual([{ authVersion: 3, wechatOpenid: 'mock-openid-password-link' }]);
    expect(await readLinkStatus(pending.linkToken)).toBe('consumed');
    const [audits] = (await client.database.execute(sql`
      SELECT action, actor_user_id AS actorUserId FROM audit_logs
      WHERE action = 'wechat_miniprogram_password_linked'
    `)) as unknown as [{ action: string; actorUserId: string | null }[], unknown];
    expect(audits).toEqual([{ action: 'wechat_miniprogram_password_linked', actorUserId: userId }]);
  });

  it('keeps a link token pending after wrong username or password so valid proof can retry', async () => {
    await seedPasswordUser('retry.user', 'correct-password');
    const pending = await loginForLink('password-retry');

    for (const credentials of [
      { password: 'correct-password', username: 'missing.user' },
      { password: 'wrong-password', username: 'retry.user' },
    ]) {
      const response = await app.inject({
        method: 'POST',
        payload: { ...credentials, linkToken: pending.linkToken },
        url: '/auth/wechat/link-password',
      });
      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({ error: { code: 'AUTHENTICATION_REQUIRED' } });
      expect(await readLinkStatus(pending.linkToken)).toBe('pending');
    }

    const linked = await app.inject({
      method: 'POST',
      payload: {
        linkToken: pending.linkToken,
        password: 'correct-password',
        username: 'retry.user',
      },
      url: '/auth/wechat/link-password',
    });
    expect(linked.statusCode, linked.body).toBe(200);
  });

  it('registers a new Mini-only user, profile, identity, and session in one transaction', async () => {
    const pending = await loginForLink('new-registration');
    const response = await app.inject({
      headers: {
        'x-schedule-client-platform': 'miniprogram',
        'x-schedule-client-version': '0.1.0-p6.20260824.79',
      },
      method: 'POST',
      payload: { linkToken: pending.linkToken, realName: '  李医生  ' },
      url: '/auth/wechat/register',
    });

    expect(response.statusCode, response.body).toBe(201);
    const body = response.json() as {
      profile: { id: string; realName: string; version: number };
      status: string;
      token: string;
    };
    expect(body).toMatchObject({
      profile: { realName: '李医生', version: 1 },
      status: 'authenticated',
    });
    const claims = verifyWechatSessionToken(body.token, TEST_SESSION_SECRET);
    expect(claims).toMatchObject({
      appId: 'mock-mini-app-id',
      authVersion: 1,
      clientVersion: '0.1.0-p6.20260824.79',
      openid: 'mock-openid-new-registration',
      provider: 'wechat_mini_program',
      sub: body.profile.id,
    });

    const [counts] = (await client.database.execute(sql`
      SELECT
        (SELECT COUNT(*) FROM users WHERE is_developer_admin = 0) AS usersCount,
        (
          SELECT COUNT(*) FROM user_profiles
          INNER JOIN users ON users.id = user_profiles.user_id
          WHERE users.is_developer_admin = 0
        ) AS profilesCount,
        (SELECT COUNT(*) FROM user_auth_identities) AS identitiesCount,
        (
          SELECT COUNT(*) FROM user_password_credentials
          INNER JOIN users ON users.id = user_password_credentials.user_id
          WHERE users.is_developer_admin = 0
        ) AS passwordsCount
    `)) as unknown as [
      {
        identitiesCount: number;
        passwordsCount: number;
        profilesCount: number;
        usersCount: number;
      }[],
      unknown,
    ];
    expect(counts).toEqual([
      { identitiesCount: 1, passwordsCount: 0, profilesCount: 1, usersCount: 1 },
    ]);
    expect(await readLinkStatus(pending.linkToken)).toBe('consumed');
    const [audits] = (await client.database.execute(sql`
      SELECT action, actor_user_id AS actorUserId FROM audit_logs
      WHERE action = 'wechat_miniprogram_registered'
    `)) as unknown as [{ action: string; actorUserId: string | null }[], unknown];
    expect(audits).toEqual([
      { action: 'wechat_miniprogram_registered', actorUserId: body.profile.id },
    ]);

    const nextLogin = await login('new-registration');
    expect(verifyWechatSessionToken(nextLogin.token, TEST_SESSION_SECRET)).toMatchObject({
      sub: body.profile.id,
    });
  });

  it('adds a profile to the existing linked user without creating a second user', async () => {
    const userId = await seedKnownMiniUser('profile-registration', { withProfile: false });
    await client.database.execute(sql`
      UPDATE users SET auth_version = 4 WHERE id = ${userId}
    `);
    const pending = await loginForLink('profile-registration');

    const response = await app.inject({
      method: 'POST',
      payload: { linkToken: pending.linkToken, realName: 'Existing Mini User' },
      url: '/auth/wechat/register',
    });

    expect(response.statusCode, response.body).toBe(201);
    const body = response.json() as {
      profile: { id: string; realName: string; version: number };
      token: string;
    };
    expect(body.profile).toEqual({ id: userId, realName: 'Existing Mini User', version: 1 });
    expect(verifyWechatSessionToken(body.token, TEST_SESSION_SECRET)).toMatchObject({
      authVersion: 4,
      sub: userId,
    });
    const [counts] = (await client.database.execute(sql`
      SELECT
        (SELECT COUNT(*) FROM users WHERE is_developer_admin = 0) AS usersCount,
        (
          SELECT COUNT(*) FROM user_profiles
          INNER JOIN users ON users.id = user_profiles.user_id
          WHERE users.is_developer_admin = 0
        ) AS profilesCount,
        (SELECT COUNT(*) FROM user_auth_identities) AS identitiesCount
    `)) as unknown as [
      { identitiesCount: number; profilesCount: number; usersCount: number }[],
      unknown,
    ];
    expect(counts).toEqual([{ identitiesCount: 1, profilesCount: 1, usersCount: 1 }]);

    const replay = await app.inject({
      method: 'POST',
      payload: { linkToken: pending.linkToken, realName: 'Replay Name' },
      url: '/auth/wechat/register',
    });
    expect(replay.statusCode).toBe(409);
    expect(replay.json()).toMatchObject({ error: { code: 'WECHAT_LINK_TOKEN_USED' } });
  });

  it('rejects tampered and expired link tokens without creating users or consuming them', async () => {
    const tamperPending = await loginForLink('tamper-registration');
    const tampered = await app.inject({
      method: 'POST',
      payload: { linkToken: `${tamperPending.linkToken}x`, realName: 'Tampered User' },
      url: '/auth/wechat/register',
    });
    expect(tampered.statusCode).toBe(401);
    expect(tampered.json()).toMatchObject({ error: { code: 'WECHAT_LINK_TOKEN_INVALID' } });
    expect(await readLinkStatus(tamperPending.linkToken)).toBe('pending');

    const expiredPending = await loginForLink('expired-registration');
    await client.database.execute(sql`
      UPDATE wechat_link_tokens
      SET expires_at = DATE_SUB(CURRENT_TIMESTAMP(3), INTERVAL 1 SECOND)
      WHERE token_hash = ${sha256(expiredPending.linkToken)}
    `);
    const expired = await app.inject({
      method: 'POST',
      payload: { linkToken: expiredPending.linkToken, realName: 'Expired User' },
      url: '/auth/wechat/register',
    });
    expect(expired.statusCode).toBe(410);
    expect(expired.json()).toMatchObject({ error: { code: 'WECHAT_LINK_TOKEN_EXPIRED' } });
    expect(await readLinkStatus(expiredPending.linkToken)).toBe('pending');

    const [usersAfter] = (await client.database.execute(sql`
      SELECT COUNT(*) AS count FROM users WHERE is_developer_admin = 0
    `)) as unknown as [{ count: number }[], unknown];
    expect(usersAfter).toEqual([{ count: 0 }]);
  });

  it('rolls registration and token consumption back when session signing is unavailable', async () => {
    const secretless = createApp({
      authPort: createWechatAuthPort({
        allowDevTokens: false,
        databaseClient: client,
        sessionSecret: undefined,
      }),
      databaseClient: client,
      clientCapabilityPolicy: TEST_CLIENT_CAPABILITY_POLICY,
      logger: false,
      wechatGateway: createMockWechatGateway(),
      wechatSessionSecret: undefined,
    });
    extraApps.push(secretless);
    const loginResponse = await secretless.inject({
      method: 'POST',
      payload: { code: 'secretless-registration' },
      url: '/auth/wechat/login',
    });
    expect(loginResponse.statusCode).toBe(200);
    const pending = loginResponse.json() as { linkToken: string };

    const response = await secretless.inject({
      method: 'POST',
      payload: { linkToken: pending.linkToken, realName: 'No Session User' },
      url: '/auth/wechat/register',
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: { code: 'AUTHENTICATION_REQUIRED' } });
    expect(await readLinkStatus(pending.linkToken)).toBe('pending');
    const [counts] = (await client.database.execute(sql`
      SELECT
        (SELECT COUNT(*) FROM users WHERE is_developer_admin = 0) AS usersCount,
        (SELECT COUNT(*) FROM user_auth_identities) AS identitiesCount,
        (SELECT COUNT(*) FROM audit_logs WHERE action = 'wechat_miniprogram_registered') AS auditsCount
    `)) as unknown as [
      { auditsCount: number; identitiesCount: number; usersCount: number }[],
      unknown,
    ];
    expect(counts).toEqual([{ auditsCount: 0, identitiesCount: 0, usersCount: 0 }]);
  });

  it('allows only one concurrent registration for the same link token', async () => {
    const pending = await loginForLink('concurrent-registration');
    const responses = await Promise.all([
      app.inject({
        method: 'POST',
        payload: { linkToken: pending.linkToken, realName: 'Concurrent User' },
        url: '/auth/wechat/register',
      }),
      app.inject({
        method: 'POST',
        payload: { linkToken: pending.linkToken, realName: 'Concurrent User' },
        url: '/auth/wechat/register',
      }),
    ]);

    expect(responses.map((response) => response.statusCode).sort()).toEqual([201, 409]);
    expect(responses.find((response) => response.statusCode === 409)?.json()).toMatchObject({
      error: { code: 'WECHAT_LINK_TOKEN_USED' },
    });
    const [counts] = (await client.database.execute(sql`
      SELECT
        (SELECT COUNT(*) FROM users WHERE is_developer_admin = 0) AS usersCount,
        (
          SELECT COUNT(*) FROM user_profiles
          INNER JOIN users ON users.id = user_profiles.user_id
          WHERE users.is_developer_admin = 0
        ) AS profilesCount,
        (SELECT COUNT(*) FROM user_auth_identities) AS identitiesCount,
        (SELECT COUNT(*) FROM audit_logs WHERE action = 'wechat_miniprogram_registered') AS auditsCount
    `)) as unknown as [
      {
        auditsCount: number;
        identitiesCount: number;
        profilesCount: number;
        usersCount: number;
      }[],
      unknown,
    ];
    expect(counts).toEqual([
      { auditsCount: 1, identitiesCount: 1, profilesCount: 1, usersCount: 1 },
    ]);
  });

  it('fails closed when a stale link token UnionID belongs to another user', async () => {
    const unionGateway: WechatGateway = {
      appId: 'union-mini-app',
      isConfigured: true,
      async exchangeCode() {
        return {
          openid: 'union-openid',
          sessionKey: undefined,
          unionid: 'union-conflict',
        };
      },
      async getUnlimitedQr() {
        return new Uint8Array();
      },
      async sendSubscribeMessage() {
        return { messageId: null };
      },
    };
    const unionApp = createApp({
      authPort: createWechatAuthPort({
        allowDevTokens: false,
        databaseClient: client,
        sessionSecret: TEST_SESSION_SECRET,
      }),
      databaseClient: client,
      clientCapabilityPolicy: TEST_CLIENT_CAPABILITY_POLICY,
      logger: false,
      wechatGateway: unionGateway,
      wechatSessionSecret: TEST_SESSION_SECRET,
    });
    extraApps.push(unionApp);
    const loginResponse = await unionApp.inject({
      method: 'POST',
      payload: { code: 'union-code' },
      url: '/auth/wechat/login',
    });
    expect(loginResponse.statusCode).toBe(200);
    const pending = loginResponse.json() as { linkToken: string };
    const targetUserId = await seedPasswordUser('union.target', 'correct-password');
    const unionOwnerId = randomUUID();
    await client.database.execute(sql`
      INSERT INTO users (id, cloudbase_uid, status)
      VALUES (${unionOwnerId}, ${`wechat_mini_${unionOwnerId}`}, 'active')
    `);
    await client.database.execute(sql`
      INSERT INTO wechat_union_accounts (id, user_id, union_id)
      VALUES (${randomUUID()}, ${unionOwnerId}, 'union-conflict')
    `);

    const response = await unionApp.inject({
      method: 'POST',
      payload: {
        linkToken: pending.linkToken,
        password: 'correct-password',
        username: 'union.target',
      },
      url: '/auth/wechat/link-password',
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: { code: 'CONFLICT' } });
    expect(await readLinkStatus(pending.linkToken)).toBe('pending');
    const [identityRows] = await client.database.execute<{ count: number }>(sql`
      SELECT COUNT(*) AS count FROM user_auth_identities
    `);
    expect(identityRows).toEqual([{ count: 0 }]);
    const [targetRows] = (await client.database.execute(sql`
      SELECT wechat_openid AS wechatOpenid FROM users WHERE id = ${targetUserId}
    `)) as unknown as [{ wechatOpenid: string | null }[], unknown];
    expect(targetRows).toEqual([{ wechatOpenid: null }]);
  });

  it('rejects expired and tampered session tokens with 401', async () => {
    await seedKnownMiniUser('code-c');
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
    await seedKnownMiniUser('code-d');
    const secretless = createApp({
      authPort: createWechatAuthPort({
        allowDevTokens: false,
        databaseClient: client,
        sessionSecret: undefined,
      }),
      databaseClient: client,
      clientCapabilityPolicy: TEST_CLIENT_CAPABILITY_POLICY,
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
      clientCapabilityPolicy: TEST_CLIENT_CAPABILITY_POLICY,
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
      appId: 'failing-mini-app-id',
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
      clientCapabilityPolicy: TEST_CLIENT_CAPABILITY_POLICY,
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
    readonly expiresAt: string;
    readonly profile: { readonly id: string; readonly realName: string; readonly version: number };
    readonly status: 'authenticated';
    readonly token: string;
  }> {
    const response = await app.inject({
      method: 'POST',
      payload: { code },
      url: '/auth/wechat/login',
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      expiresAt: string;
      profile: { id: string; realName: string; version: number };
      status: 'authenticated';
      token: string;
    };
    expect(body.status).toBe('authenticated');
    return body;
  }

  async function loginForLink(code: string): Promise<{
    readonly expiresAt: string;
    readonly linkToken: string;
    readonly status: 'link_required';
  }> {
    const response = await app.inject({
      method: 'POST',
      payload: { code },
      url: '/auth/wechat/login',
    });
    expect(response.statusCode).toBe(200);
    return response.json() as {
      expiresAt: string;
      linkToken: string;
      status: 'link_required';
    };
  }

  async function readLinkStatus(linkToken: string): Promise<string | undefined> {
    const [rows] = (await client.database.execute(sql`
      SELECT status FROM wechat_link_tokens WHERE token_hash = ${sha256(linkToken)}
    `)) as unknown as [{ status: string }[], unknown];
    return rows[0]?.status;
  }

  async function seedPasswordUser(
    username: string,
    password: string,
    options: { readonly authVersion?: number; readonly realName?: string } = {},
  ): Promise<string> {
    const userId = randomUUID();
    await client.database.execute(sql`
      INSERT INTO users (id, cloudbase_uid, auth_version, status)
      VALUES (
        ${userId}, ${`password_${userId}`}, ${options.authVersion ?? 1}, 'active'
      )
    `);
    await client.database.execute(sql`
      INSERT INTO user_profiles (user_id, real_name)
      VALUES (${userId}, ${options.realName ?? 'Password User'})
    `);
    await client.database.execute(sql`
      INSERT INTO user_password_credentials (user_id, username, password_hash)
      VALUES (${userId}, ${username}, ${await hashPassword(password)})
    `);
    return userId;
  }

  async function readProfile(token: string) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: '/users/me',
    });
  }

  async function seedKnownMiniUser(
    code: string,
    options: { readonly withProfile?: boolean } = {},
  ): Promise<string> {
    const userId = randomUUID();
    const openid = `mock-openid-${code}`;
    await client.database.execute(sql`
      INSERT INTO users (id, cloudbase_uid, wechat_openid, status)
      VALUES (${userId}, ${`wx_${openid}`}, ${openid}, 'active')
    `);
    await client.database.execute(sql`
      INSERT INTO user_auth_identities (id, user_id, provider, app_id, subject)
      VALUES (${randomUUID()}, ${userId}, 'wechat_mini_program', 'mock-mini-app-id', ${openid})
    `);
    if (options.withProfile !== false) {
      await client.database.execute(sql`
        INSERT INTO user_profiles (user_id, real_name)
        VALUES (${userId}, ${`User ${code}`})
      `);
    }
    return userId;
  }
});

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

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
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
