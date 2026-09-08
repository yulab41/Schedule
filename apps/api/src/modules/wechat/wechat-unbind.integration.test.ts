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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createPasswordSessionToken,
  createWechatAuthPort,
  createWechatSessionToken,
  verifyWechatSessionToken,
} from '../../adapters/auth/wechat-auth.js';
import { createApp } from '../../app.js';
import { ClientCapabilityPolicy } from '../client-capabilities/client-capability-policy.js';
import { hashPassword } from '../auth/password-auth-service.js';
import { AuditWriter } from '../audit/audit-writer.js';
import type { WechatGateway } from './wechat-gateway.js';
import { WechatIdentityResolver } from './wechat-identity-resolver.js';

const migrationsDirectory = fileURLToPath(new URL('../../../../../migrations', import.meta.url));
const databaseOptions = getTestDatabaseOptions();
const describeWithDatabase = databaseOptions === undefined ? describe.skip : describe;
const TEST_SESSION_SECRET = 'test-wechat-session-secret-0123456789abcdef';
const TEST_CLIENT_CAPABILITY_POLICY = createTestClientCapabilityPolicy();
const CURRENT_APP_ID = 'unbind-mini-app';
const DEVELOPER_ADMIN_ID = '00000000-0000-4000-8000-000000000001';

describeWithDatabase('current Mini AppID identity unbind', () => {
  let app: ReturnType<typeof createApp>;
  let client: DatabaseClient;
  let gateway: WechatGateway;

  beforeEach(async () => {
    client = createTestDatabaseClient(databaseOptions as DatabaseConnectionOptions);
    await resetDatabase(client);
    await migrateDatabase(client, migrationsDirectory);
    gateway = createProofGateway();
    app = createApp({
      authPort: createWechatAuthPort({
        allowDevTokens: false,
        databaseClient: client,
        sessionSecret: TEST_SESSION_SECRET,
      }),
      databaseClient: client,
      clientCapabilityPolicy: TEST_CLIENT_CAPABILITY_POLICY,
      logger: false,
      wechatGateway: gateway,
      wechatSessionSecret: TEST_SESSION_SECRET,
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
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

  it('reports current AppID binding without exposing identity subjects', async () => {
    const bound = await seedBoundUser('status-bound');
    const passwordless = await seedBoundUser('status-passwordless', { withPassword: false });
    const otherApp = await seedBoundUser('status-other-app', { appId: 'another-mini-app' });

    for (const [token, expected] of [
      [bound.token, { bound: true, canUnbind: true }],
      [passwordless.token, { bound: true, canUnbind: false }],
      [otherApp.token, { bound: false, canUnbind: false }],
    ] as const) {
      const response = await app.inject({
        headers: { authorization: `Bearer ${token}` },
        method: 'GET',
        url: '/me/wechat/miniprogram/binding',
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(expected);
      expect(response.body).not.toMatch(/openid|subject|union/iu);
    }
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

  it.each([false, true])(
    'allows a complete cross-account round trip with historical union records=%s',
    async (withUnion) => {
      const first = await seedBoundUser('roundtrip-a', {
        withBusinessReference: true,
        withWebIdentity: true,
      });
      const second = await seedBoundUser('roundtrip-b');
      if (!withUnion) await client.database.execute(sql`DELETE FROM wechat_union_accounts`);
      expect((await selfUnbind(first.token, randomUUID(), 'proof-roundtrip-a')).statusCode).toBe(
        200,
      );
      expect((await selfUnbind(second.token, randomUUID(), 'proof-roundtrip-b')).statusCode).toBe(
        200,
      );
      const login = await app.inject({
        method: 'POST',
        url: '/auth/wechat/login',
        payload: { code: 'proof-roundtrip-a' },
      });
      expect(login.json().status).toBe('link_required');
      const sibling = await app.inject({
        method: 'POST',
        url: '/auth/wechat/login',
        payload: { code: 'proof-roundtrip-a' },
      });
      const linked = await app.inject({
        method: 'POST',
        url: '/auth/wechat/link-password',
        payload: {
          linkToken: login.json().linkToken,
          username: second.username,
          password: second.password,
        },
      });
      expect(linked.statusCode, linked.body).toBe(200);
      expect(linked.json().profile.id).toBe(second.userId);
      const currentLogin = await app.inject({
        method: 'POST',
        url: '/auth/wechat/login',
        payload: { code: 'proof-roundtrip-a' },
      });
      expect(currentLogin.json().profile.id).toBe(second.userId);
      expect(
        (await selfUnbind(linked.json().token, randomUUID(), 'proof-roundtrip-a')).statusCode,
      ).toBe(200);
      const stale = await app.inject({
        method: 'POST',
        url: '/auth/wechat/link-password',
        payload: {
          linkToken: sibling.json().linkToken,
          username: first.username,
          password: first.password,
        },
      });
      expect(stale.json().error.code).toBe('WECHAT_LINK_TOKEN_USED');
      const fresh = await app.inject({
        method: 'POST',
        url: '/auth/wechat/login',
        payload: { code: 'proof-roundtrip-a' },
      });
      const returned = await app.inject({
        method: 'POST',
        url: '/auth/wechat/link-password',
        payload: {
          linkToken: fresh.json().linkToken,
          username: first.username,
          password: first.password,
        },
      });
      expect(returned.statusCode, returned.body).toBe(200);
      expect(returned.json().profile.id).toBe(first.userId);
      const [rows] = await client.database.execute(
        sql`SELECT id, wechat_openid AS openid FROM users WHERE id IN (${first.userId}, ${second.userId}) ORDER BY id`,
      );
      expect(rows).toEqual(
        expect.arrayContaining([
          { id: first.userId, openid: first.subject },
          { id: second.userId, openid: null },
        ]),
      );
      const [members] = await client.database.execute(
        sql`SELECT user_id AS userId FROM group_memberships WHERE user_id = ${first.userId}`,
      );
      expect(members).toEqual([{ userId: first.userId }]);
    },
  );

  it('invalidates pending password proofs and legacy admin tickets on unbind and new binding', async () => {
    const first = await seedBoundUser('stale-a');
    const second = await seedBoundUser('stale-b');
    await seedPendingProof('before-unbind', first.subject);
    await seedLegacyTicket('old-admin-a', first.userId);
    expect((await selfUnbind(first.token, randomUUID(), 'proof-stale-a')).statusCode).toBe(200);
    expect((await selfUnbind(second.token, randomUUID(), 'proof-stale-b')).statusCode).toBe(200);
    await seedLegacyTicket('old-admin-b', second.userId);
    const login = await app.inject({
      method: 'POST',
      url: '/auth/wechat/login',
      payload: { code: 'proof-stale-a' },
    });
    const linked = await passwordLink(login.json().linkToken, second);
    expect(linked.statusCode, linked.body).toBe(200);
    const [tokens] = await client.database.execute(
      sql`SELECT status FROM wechat_link_tokens WHERE subject = ${first.subject}`,
    );
    expect(tokens).toEqual([{ status: 'consumed' }, { status: 'consumed' }]);
    const [tickets] = await client.database.execute(
      sql`SELECT status FROM wechat_admin_binding_tickets`,
    );
    expect(tickets).toEqual([{ status: 'consumed' }, { status: 'consumed' }]);
    const preview = await app.inject({
      method: 'POST',
      url: '/auth/wechat/admin-bind/preview',
      payload: { ticket: 'old-admin-b' },
    });
    expect(preview.json().error.code).toBe('WECHAT_LINK_TOKEN_USED');
  });

  it('uses the same detached-target checks for administrator ticket binding', async () => {
    const first = await seedBoundUser('ticket-a');
    const second = await seedBoundUser('ticket-b');
    expect((await selfUnbind(first.token, randomUUID(), 'proof-ticket-a')).statusCode).toBe(200);
    expect((await selfUnbind(second.token, randomUUID(), 'proof-ticket-b')).statusCode).toBe(200);
    await seedLegacyTicket('ticket-roundtrip', second.userId);
    const pending = await app.inject({
      method: 'POST',
      url: '/auth/wechat/login',
      payload: { code: 'proof-ticket-a' },
    });
    const bound = await app.inject({
      method: 'POST',
      url: '/auth/wechat/admin-bind/confirm',
      payload: { ticket: 'ticket-roundtrip', code: 'proof-ticket-a' },
    });
    expect(bound.statusCode, bound.body).toBe(200);
    expect(bound.json().profile.id).toBe(second.userId);
    const old = await passwordLink(pending.json().linkToken, first);
    expect(old.json().error.code).toBe('WECHAT_LINK_TOKEN_USED');
    expect((await selfUnbind(bound.json().token, randomUUID(), 'proof-ticket-a')).statusCode).toBe(
      200,
    );
  });

  it('rejects occupied identities, occupied targets and wrong AppID without changing state', async () => {
    const first = await seedBoundUser('occupied-a');
    const second = await seedBoundUser('occupied-b');
    await seedPendingProof('occupied-proof', first.subject);
    const occupied = await passwordLink('occupied-proof', second);
    expect(occupied.json().error.code).toBe('WECHAT_IDENTITY_IN_USE');
    await seedPendingProof('new-proof', 'new-subject');
    const targetBound = await passwordLink('new-proof', second);
    expect(targetBound.json().error.code).toBe('WECHAT_ACCOUNT_ALREADY_BOUND');
    await seedPendingProof('other-app-proof', 'new-subject', 'other-mini-app');
    const otherApp = await passwordLink('other-app-proof', second);
    expect(otherApp.json().error.code).toBe('WECHAT_APP_ID_MISMATCH');
    const [tokens] = await client.database.execute(sql`SELECT status FROM wechat_link_tokens`);
    expect(tokens).toEqual([{ status: 'pending' }, { status: 'pending' }, { status: 'pending' }]);
    const [identities] = await client.database.execute(
      sql`SELECT COUNT(*) AS count FROM user_auth_identities WHERE provider = 'wechat_mini_program'`,
    );
    expect(identities).toEqual([{ count: 2 }]);
  });

  it('allows only one concurrent claim of a subject and only one subject per target', async () => {
    const first = await seedBoundUser('race-a');
    const second = await seedBoundUser('race-b');
    expect((await selfUnbind(first.token, randomUUID(), 'proof-race-a')).statusCode).toBe(200);
    expect((await selfUnbind(second.token, randomUUID(), 'proof-race-b')).statusCode).toBe(200);
    await seedPendingProof('race-proof-a', 'race-subject');
    await seedPendingProof('race-proof-b', 'race-subject');
    const results = await Promise.all([
      passwordLink('race-proof-a', first),
      passwordLink('race-proof-b', second),
    ]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    const loser = results[0]?.statusCode === 200 ? second : first;
    await seedPendingProof('target-proof-a', 'target-subject-a');
    await seedPendingProof('target-proof-b', 'target-subject-b');
    const targetResults = await Promise.all([
      passwordLink('target-proof-a', loser),
      passwordLink('target-proof-b', loser),
    ]);
    expect(targetResults.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    const [counts] = await client.database.execute(
      sql`SELECT COUNT(*) AS count FROM user_auth_identities WHERE user_id = ${loser.userId} AND provider = 'wechat_mini_program'`,
    );
    expect(counts).toEqual([{ count: 1 }]);
  });

  it('rolls back all binding writes and proof invalidation if the audit fails', async () => {
    const first = await seedBoundUser('rollback-a');
    const second = await seedBoundUser('rollback-b');
    await selfUnbind(first.token, randomUUID(), 'proof-rollback-a');
    await selfUnbind(second.token, randomUUID(), 'proof-rollback-b');
    await seedPendingProof('rollback-proof', first.subject);
    await seedLegacyTicket('rollback-ticket', second.userId);
    const audit = vi
      .spyOn(AuditWriter.prototype, 'append')
      .mockRejectedValueOnce(new Error('test audit unavailable'));
    const failed = await passwordLink('rollback-proof', second);
    expect(failed.statusCode).toBe(500);
    audit.mockRestore();
    const [before] = await client.database.execute(
      sql`SELECT status FROM wechat_link_tokens WHERE token_hash = ${sha256('rollback-proof')}`,
    );
    const [tickets] = await client.database.execute(
      sql`SELECT status FROM wechat_admin_binding_tickets WHERE ticket_hash = ${sha256('rollback-ticket')}`,
    );
    const [identities] = await client.database.execute(
      sql`SELECT COUNT(*) AS count FROM user_auth_identities WHERE provider = 'wechat_mini_program'`,
    );
    expect(before).toEqual([{ status: 'pending' }]);
    expect(tickets).toEqual([{ status: 'pending' }]);
    expect(identities).toEqual([{ count: 0 }]);
    const success = await passwordLink('rollback-proof', second);
    expect(success.statusCode, success.body).toBe(200);
  });

  it.each([1, 3])(
    'bounds database retries and exchanges each unbind code once (deadlocks=%i)',
    async (failures) => {
      const first = await seedBoundUser('retry');
      const exchange = vi.spyOn(gateway, 'exchangeCode');
      const original = AuditWriter.prototype.append;
      let attempts = 0;
      const audit = vi.spyOn(AuditWriter.prototype, 'append').mockImplementation(function (
        this: AuditWriter,
        ...args
      ) {
        attempts += 1;
        if (attempts <= failures) return Promise.reject({ code: 'ER_LOCK_DEADLOCK' });
        return original.apply(this, args);
      });
      const result = await selfUnbind(first.token, randomUUID(), 'proof-retry');
      expect(result.statusCode).toBe(failures === 1 ? 200 : 500);
      expect(exchange).toHaveBeenCalledTimes(1);
      expect(audit).toHaveBeenCalledTimes(failures === 1 ? 2 : 3);
      const [rows] = await client.database.execute(
        sql`SELECT auth_version AS authVersion, wechat_openid AS openid FROM users WHERE id = ${first.userId}`,
      );
      expect(rows).toEqual([
        { authVersion: failures === 1 ? 2 : 1, openid: failures === 1 ? null : first.subject },
      ]);
    },
  );

  it('rejects invalid and consumed admin tickets before exchanging the WeChat code', async () => {
    const account = await seedBoundUser('replayed-ticket');
    await seedLegacyTicket('used-ticket', account.userId);
    await client.database.execute(sql`UPDATE wechat_admin_binding_tickets SET status = 'consumed'`);
    const exchange = vi.spyOn(gateway, 'exchangeCode');
    for (const [ticket, code] of [
      ['used-ticket', 'WECHAT_LINK_TOKEN_USED'],
      ['unknown-ticket', 'WECHAT_LINK_TOKEN_INVALID'],
    ]) {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/wechat/admin-bind/confirm',
        payload: { ticket, code: 'proof-replayed-ticket' },
      });
      expect(response.json().error.code).toBe(code);
    }
    expect(exchange).not.toHaveBeenCalled();
  });

  it('cannot issue a still-usable proof from a login resolved before a concurrent binding', async () => {
    const first = await seedBoundUser('issuance');
    await selfUnbind(first.token, randomUUID(), 'proof-issuance');
    const pending = await app.inject({
      method: 'POST',
      url: '/auth/wechat/login',
      payload: { code: 'proof-issuance' },
    });
    let release = () => {};
    let entered = () => {};
    const paused = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const resume = new Promise<void>((resolve) => {
      release = resolve;
    });
    const original = WechatIdentityResolver.prototype.resolveInTransaction;
    let once = true;
    vi.spyOn(WechatIdentityResolver.prototype, 'resolveInTransaction').mockImplementation(
      async function (this: WechatIdentityResolver, ...args) {
        const result = await original.apply(this, args);
        if (once) {
          once = false;
          entered();
          await resume;
        }
        return result;
      },
    );
    const lateLogin = app.inject({
      method: 'POST',
      url: '/auth/wechat/login',
      payload: { code: 'proof-issuance' },
    });
    // app.inject starts when awaited/thened; explicitly start while observing the pause.
    const lateResult = Promise.resolve(lateLogin);
    await paused;
    let settled = false;
    const binding = passwordLink(pending.json().linkToken, first).then((result) => {
      settled = true;
      return result;
    });
    try {
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(settled).toBe(false);
    } finally {
      release();
    }
    const [late, bound] = await Promise.all([lateResult, binding]);
    expect(bound.statusCode, bound.body).toBe(200);
    expect(late.json().status).toBe('link_required');
    await selfUnbind(bound.json().token, randomUUID(), 'proof-issuance');
    const stale = await passwordLink(late.json().linkToken, first);
    expect(stale.json().error.code).toBe('WECHAT_LINK_TOKEN_USED');
  });

  async function seedPendingProof(token: string, subject: string, appId = CURRENT_APP_ID) {
    await client.database.execute(
      sql`INSERT INTO wechat_link_tokens (id, token_hash, app_id, subject, expires_at) VALUES (${randomUUID()}, ${sha256(token)}, ${appId}, ${subject}, DATE_ADD(NOW(3), INTERVAL 10 MINUTE))`,
    );
  }

  async function seedLegacyTicket(ticket: string, target: string) {
    await client.database.execute(
      sql`INSERT INTO wechat_admin_binding_tickets (id, ticket_hash, app_id, target_user_id, expires_at) VALUES (${randomUUID()}, ${sha256(ticket)}, ${CURRENT_APP_ID}, ${target}, DATE_ADD(NOW(3), INTERVAL 10 MINUTE))`,
    );
  }

  async function passwordLink(linkToken: string, account: { username: string; password: string }) {
    return app.inject({
      method: 'POST',
      url: '/auth/wechat/link-password',
      payload: { linkToken, username: account.username, password: account.password },
    });
  }

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
