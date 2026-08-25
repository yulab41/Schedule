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

import { createWechatAuthPort, verifyWechatSessionToken } from '../../adapters/auth/wechat-auth.js';
import { createApp } from '../../app.js';
import { ClientCapabilityPolicy } from '../client-capabilities/client-capability-policy.js';
import { createMockWechatGateway } from '../wechat/wechat-gateway.js';

const migrationsDirectory = fileURLToPath(new URL('../../../../../migrations', import.meta.url));
const databaseOptions = getTestDatabaseOptions();
const describeWithDatabase = databaseOptions === undefined ? describe.skip : describe;
const TEST_SESSION_SECRET = 'test-wechat-session-secret-0123456789abcdef';
const PLATFORM_ADMIN_UID = 'wx_mock-openid-admin-source';
const HOLIDAY_ADMIN_UID = 'wx_mock-openid-holiday-source';
const TEST_CLIENT_CAPABILITY_POLICY = createTestClientCapabilityPolicy();

describeWithDatabase('invite links and identity binding', () => {
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
      holidayAdminUids: new Set([HOLIDAY_ADMIN_UID]),
      logger: false,
      platformAdminUids: new Set([PLATFORM_ADMIN_UID]),
      wechatGateway: createMockWechatGateway(),
      wechatSessionSecret: TEST_SESSION_SECRET,
    });
  });

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
    }
    if (client !== undefined) {
      await client.close();
    }
  });

  it('creates, resolves and accepts an unclaimed membership invite with a schedule role', async () => {
    const owner = await registerUser('owner', 'Owner Doctor');
    const groupId = await createGroup(owner.token, 'Invite group', '1234');
    await addMembers(owner.token, groupId, ['Alice Doctor']);
    const roleId = await createScheduleRole(owner.token, groupId, 'Primary');
    const membershipId = await membershipIdByRealName(owner.token, groupId, 'Alice Doctor');

    const created = await createInvite(owner.token, groupId, {
      permissionRole: 'administrator',
      scheduleRoleId: roleId,
      targetMembershipId: membershipId,
    });
    expect(created.statusCode, created.body).toBe(201);
    const createdBody = created.json() as {
      permissionRole: string;
      realName: string;
      scheduleRoleName?: string;
      sharePath: string;
      token: string;
    };
    expect(createdBody).toMatchObject({
      permissionRole: 'administrator',
      realName: 'Alice Doctor',
      scheduleRoleName: 'Primary',
    });
    expect(createdBody.sharePath).toContain(createdBody.token);

    const alice = await registerUser('alice', 'Alice Doctor');
    const resolved = await resolveInvite(alice.token, createdBody.token);
    expect(resolved.statusCode, resolved.body).toBe(200);
    expect(resolved.json()).toMatchObject({
      groupName: 'Invite group',
      inviteeRealName: 'Alice Doctor',
      permissionRole: 'administrator',
      scheduleRoleName: 'Primary',
    });

    const wrongName = await acceptInvite(alice.token, createdBody.token, 'Bob Doctor');
    expect(wrongName.statusCode).toBe(400);

    const accepted = await acceptInvite(alice.token, createdBody.token, 'Alice Doctor');
    expect(accepted.statusCode, accepted.body).toBe(200);
    expect(accepted.json()).toMatchObject({
      group: { id: groupId, name: 'Invite group', role: 'administrator' },
    });

    const [roleRows] = (await client.database.execute(
      sql`SELECT COUNT(*) AS count FROM member_schedule_roles`,
    )) as unknown as [{ count: number }[], unknown];
    expect(roleRows[0]?.count).toBe(1);

    const duplicate = await acceptInvite(alice.token, createdBody.token, 'Alice Doctor');
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json()).toMatchObject({ error: { code: 'INVITE_USED' } });
  });

  it('accepts a pending roster invite and claims the roster entry', async () => {
    const owner = await registerUser('owner-b', 'Owner B');
    const groupId = await createGroup(owner.token, 'Roster group', '2345');
    await addRoster(owner.token, groupId, ['Bob Doctor']);
    const rosterId = await rosterIdByRealName(owner.token, groupId, 'Bob Doctor');
    const created = await createInvite(owner.token, groupId, { targetRosterEntryId: rosterId });
    expect(created.statusCode, created.body).toBe(201);
    const token = (created.json() as { token: string }).token;

    const bob = await registerUser('bob', 'Bob Doctor');
    const accepted = await acceptInvite(bob.token, token, 'Bob Doctor');
    expect(accepted.statusCode, accepted.body).toBe(200);
    expect(accepted.json()).toMatchObject({
      group: { id: groupId, role: 'member' },
    });

    const [rosterRows] = (await client.database.execute(
      sql`SELECT status, claimed_by_user_id AS claimedByUserId FROM roster_entries WHERE id = ${rosterId}`,
    )) as unknown as [{ claimedByUserId: string; status: string }[], unknown];
    expect(rosterRows[0]?.status).toBe('claimed');
    expect(rosterRows[0]?.claimedByUserId).toBeDefined();
  });

  it('rate limits pending invites per group', async () => {
    const owner = await registerUser('owner-c', 'Owner C');
    const groupId = await createGroup(owner.token, 'Limited group', '3456');
    const names = Array.from({ length: 11 }, (_, index) => `Member ${index + 1}`);
    await addMembers(owner.token, groupId, names);

    for (const name of names.slice(0, 10)) {
      const membershipId = await membershipIdByRealName(owner.token, groupId, name);
      const created = await createInvite(owner.token, groupId, {
        targetMembershipId: membershipId,
      });
      expect(created.statusCode, created.body).toBe(201);
    }

    const lastMembershipId = await membershipIdByRealName(
      owner.token,
      groupId,
      names[10] as string,
    );
    const limited = await createInvite(owner.token, groupId, {
      targetMembershipId: lastMembershipId,
    });
    expect(limited.statusCode).toBe(429);
  });

  it('revokes pending invites and requires owner/admin permission to manage them', async () => {
    const owner = await registerUser('owner-d', 'Owner D');
    const groupId = await createGroup(owner.token, 'Revoke group', '4567');
    await addMembers(owner.token, groupId, ['Dana Doctor']);
    const membershipId = await membershipIdByRealName(owner.token, groupId, 'Dana Doctor');
    const created = await createInvite(owner.token, groupId, { targetMembershipId: membershipId });
    const token = (created.json() as { token: string }).token;

    const dana = await registerUser('dana', 'Dana Doctor');
    const forbidden = await createInvite(dana.token, groupId, {
      targetMembershipId: membershipId,
    });
    expect(forbidden.statusCode).toBe(403);

    const revoked = await revokeInvite(owner.token, groupId, token);
    expect(revoked.statusCode).toBe(204);
    expect((await resolveInvite(dana.token, token)).statusCode).toBe(400);
    expect((await acceptInvite(dana.token, token, 'Dana Doctor')).statusCode).toBe(400);
  });

  it('rejects expired invites', async () => {
    const owner = await registerUser('owner-e', 'Owner E');
    const groupId = await createGroup(owner.token, 'Expired group', '5678');
    await addMembers(owner.token, groupId, ['Eve Doctor']);
    const membershipId = await membershipIdByRealName(owner.token, groupId, 'Eve Doctor');
    const created = await createInvite(owner.token, groupId, { targetMembershipId: membershipId });
    const token = (created.json() as { token: string }).token;
    await client.database.execute(
      sql`UPDATE invite_tokens SET expires_at = ${new Date(Date.now() - 60_000)} WHERE token_hash = ${sha256(token)}`,
    );

    const eve = await registerUser('eve', 'Eve Doctor');
    const resolved = await resolveInvite(eve.token, token);
    expect(resolved.statusCode).toBe(410);
    expect(resolved.json()).toMatchObject({ error: { code: 'INVITE_EXPIRED' } });
    expect((await acceptInvite(eve.token, token, 'Eve Doctor')).statusCode).toBe(410);
  });

  it('merges a WeChat account into an already-claimed account and reissues the session', async () => {
    const owner = await registerUser('merge-owner', 'Merge Owner');
    const groupId = await createGroup(owner.token, 'Merge group', '6789');
    await addMembers(owner.token, groupId, ['Target User']);
    const targetMembershipId = await membershipIdByRealName(owner.token, groupId, 'Target User');

    const target = await registerUser('merge-target', 'Target User');
    const firstInvite = await createInvite(owner.token, groupId, {
      targetMembershipId,
    });
    const firstToken = (firstInvite.json() as { token: string }).token;
    expect((await acceptInvite(target.token, firstToken, 'Target User')).statusCode).toBe(200);
    // 模拟网页老用户：目标账号已有云身份但尚未绑定微信 openid。
    await client.database.execute(
      sql`UPDATE users SET wechat_openid = NULL WHERE id = ${target.id}`,
    );
    await client.database.execute(
      sql`DELETE FROM wechat_union_accounts WHERE user_id = ${target.id}`,
    );
    await client.database.execute(
      sql`DELETE FROM user_auth_identities WHERE user_id = ${target.id}`,
    );

    const source = await registerUser('merge-source', 'Source User');
    const sourceGroupId = await createGroup(source.token, 'Source group', '7890');
    const versionedLogin = await app.inject({
      headers: {
        'x-schedule-client-platform': 'miniprogram',
        'x-schedule-client-version': '0.1.0-p6.20260824.79',
      },
      method: 'POST',
      payload: { code: 'merge-source' },
      url: '/auth/wechat/login',
    });
    expect(versionedLogin.statusCode, versionedLogin.body).toBe(200);
    const versionedSourceToken = (versionedLogin.json() as { token: string }).token;

    const secondInvite = await createInvite(owner.token, groupId, {
      targetMembershipId,
    });
    const secondToken = (secondInvite.json() as { token: string }).token;
    const merged = await acceptInvite(versionedSourceToken, secondToken, 'Target User');
    expect(merged.statusCode, merged.body).toBe(200);
    const mergedBody = merged.json() as { group: { id: string }; token?: string };
    expect(mergedBody.group.id).toBe(groupId);
    expect(typeof mergedBody.token).toBe('string');
    expect(verifyWechatSessionToken(mergedBody.token, TEST_SESSION_SECRET)).toMatchObject({
      appId: 'mock-mini-app-id',
      authVersion: 1,
      clientVersion: '0.1.0-p6.20260824.79',
      openid: 'mock-openid-merge-source',
      provider: 'wechat_mini_program',
      sub: target.id,
    });

    const [sourceRows] = (await client.database.execute(
      sql`SELECT status, wechat_openid AS openid FROM users WHERE id = ${source.id}`,
    )) as unknown as [{ openid: string | null; status: string }[], unknown];
    expect(sourceRows[0]?.status).toBe('deleted');
    expect(sourceRows[0]?.openid).toBeNull();

    const [groupRows] = (await client.database.execute(
      sql`SELECT owner_user_id AS ownerUserId FROM \`groups\` WHERE id = ${sourceGroupId}`,
    )) as unknown as [{ ownerUserId: string }[], unknown];
    const [targetRows] = (await client.database.execute(
      sql`SELECT id FROM users WHERE cloudbase_uid = 'wx_mock-openid-merge-target'`,
    )) as unknown as [{ id: string }[], unknown];
    expect(groupRows[0]?.ownerUserId).toBe(targetRows[0]?.id);
    const [identityRows] = (await client.database.execute(sql`
      SELECT app_id AS appId, subject, user_id AS userId
      FROM user_auth_identities
      WHERE subject = 'mock-openid-merge-source'
    `)) as unknown as [{ appId: string | null; subject: string; userId: string }[], unknown];
    expect(identityRows).toEqual([
      {
        appId: 'mock-mini-app-id',
        subject: 'mock-openid-merge-source',
        userId: target.id,
      },
    ]);

    const profile = await app.inject({
      headers: { authorization: `Bearer ${mergedBody.token as string}` },
      method: 'GET',
      url: '/users/me',
    });
    expect(profile.statusCode).toBe(200);

    const groups = await app.inject({
      headers: { authorization: `Bearer ${mergedBody.token as string}` },
      method: 'GET',
      url: '/groups',
    });
    expect(groups.statusCode).toBe(200);
    expect((groups.json() as readonly { id: string }[]).map((group) => group.id).sort()).toEqual(
      [groupId, sourceGroupId].sort(),
    );
  });

  it('rejects merges with overlapping groups or admin accounts', async () => {
    const owner = await registerUser('overlap-owner', 'Overlap Owner');
    const groupId = await createGroup(owner.token, 'Overlap group', '8901');
    await addMembers(owner.token, groupId, ['Overlap Target']);
    const targetMembershipId = await membershipIdByRealName(owner.token, groupId, 'Overlap Target');
    const target = await registerUser('overlap-target', 'Overlap Target');
    const targetInvite = await createInvite(owner.token, groupId, {
      targetMembershipId,
    });
    expect(
      (
        await acceptInvite(
          target.token,
          (targetInvite.json() as { token: string }).token,
          'Overlap Target',
        )
      ).statusCode,
    ).toBe(200);

    await addMembers(owner.token, groupId, ['Overlap Source']);
    const sourceMembershipId = await membershipIdByRealName(owner.token, groupId, 'Overlap Source');
    const source = await registerUser('overlap-source', 'Overlap Source');
    const sourceInvite = await createInvite(owner.token, groupId, {
      targetMembershipId: sourceMembershipId,
    });
    expect(
      (
        await acceptInvite(
          source.token,
          (sourceInvite.json() as { token: string }).token,
          'Overlap Source',
        )
      ).statusCode,
    ).toBe(200);

    const mergeInvite = await createInvite(owner.token, groupId, { targetMembershipId });
    const overlap = await acceptInvite(
      source.token,
      (mergeInvite.json() as { token: string }).token,
      'Overlap Target',
    );
    expect(overlap.statusCode).toBe(409);

    const admin = await registerUser('admin-source', 'Admin Source');
    const adminInvite = await createInvite(owner.token, groupId, { targetMembershipId });
    const adminAccept = await acceptInvite(
      admin.token,
      (adminInvite.json() as { token: string }).token,
      'Overlap Target',
    );
    expect(adminAccept.statusCode).toBe(409);

    const holiday = await registerUser('holiday-source', 'Holiday Source');
    const holidayInvite = await createInvite(owner.token, groupId, { targetMembershipId });
    const holidayAccept = await acceptInvite(
      holiday.token,
      (holidayInvite.json() as { token: string }).token,
      'Overlap Target',
    );
    expect(holidayAccept.statusCode).toBe(409);
  });

  async function registerUser(
    code: string,
    realName: string,
  ): Promise<{ readonly id: string; readonly token: string }> {
    const userId = randomUUID();
    const openid = `mock-openid-${code}`;
    await client.database.execute(sql`
      INSERT INTO users (id, cloudbase_uid, wechat_openid, status)
      VALUES (${userId}, ${`wx_${openid}`}, ${openid}, 'active')
    `);
    await client.database.execute(sql`
      INSERT INTO user_profiles (user_id, real_name)
      VALUES (${userId}, ${realName})
    `);
    await client.database.execute(sql`
      INSERT INTO user_auth_identities (id, user_id, provider, app_id, subject)
      VALUES (${randomUUID()}, ${userId}, 'wechat_mini_program', 'mock-mini-app-id', ${openid})
    `);
    const login = await app.inject({
      method: 'POST',
      payload: { code },
      url: '/auth/wechat/login',
    });
    expect(login.statusCode).toBe(200);
    const body = login.json() as { status: string; token: string };
    expect(body.status).toBe('authenticated');
    return { id: userId, token: body.token };
  }

  async function createGroup(token: string, name: string, groupCode: string): Promise<string> {
    const response = await app.inject({
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': randomUUID(),
      },
      method: 'POST',
      payload: { groupCode, name },
      url: '/groups',
    });
    expect(response.statusCode).toBe(201);
    return (response.json() as { id: string }).id;
  }

  async function addMembers(
    token: string,
    groupId: string,
    realNames: readonly string[],
  ): Promise<void> {
    const response = await app.inject({
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': randomUUID(),
      },
      method: 'POST',
      payload: { realNames: [...realNames] },
      url: `/groups/${groupId}/members`,
    });
    expect(response.statusCode).toBe(200);
  }

  async function addRoster(
    token: string,
    groupId: string,
    realNames: readonly string[],
  ): Promise<void> {
    const response = await app.inject({
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': randomUUID(),
      },
      method: 'POST',
      payload: { realNames: [...realNames] },
      url: `/groups/${groupId}/roster-entries`,
    });
    expect(response.statusCode).toBe(200);
  }

  async function createScheduleRole(token: string, groupId: string, name: string): Promise<string> {
    const config = await app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: `/groups/${groupId}/scheduling-config`,
    });
    expect(config.statusCode).toBe(200);
    const rulesVersion = (config.json() as { rulesVersion: number }).rulesVersion;
    const response = await app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: { expectedRulesVersion: rulesVersion, name, operationId: randomUUID() },
      url: `/groups/${groupId}/schedule-roles`,
    });
    expect(response.statusCode).toBe(201);
    return (response.json() as { id: string }).id;
  }

  async function membershipIdByRealName(
    token: string,
    groupId: string,
    realName: string,
  ): Promise<string> {
    const response = await app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: `/groups/${groupId}/members`,
    });
    expect(response.statusCode).toBe(200);
    const members = response.json() as readonly { id: string; realName: string }[];
    return members.find((member) => member.realName === realName)?.id as string;
  }

  async function rosterIdByRealName(
    token: string,
    groupId: string,
    realName: string,
  ): Promise<string> {
    void token;
    const [rows] = (await client.database.execute(
      sql`SELECT id FROM roster_entries
          WHERE group_id = ${groupId} AND real_name = ${realName} AND status = 'pending'`,
    )) as unknown as [{ id: string }[], unknown];
    return rows[0]?.id as string;
  }

  function createInvite(token: string, groupId: string, payload: Record<string, unknown>) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload,
      url: `/groups/${groupId}/invite-links`,
    });
  }

  function resolveInvite(token: string, inviteToken: string) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: { token: inviteToken },
      url: '/invites/resolve',
    });
  }

  function acceptInvite(token: string, inviteToken: string, confirmRealName: string) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: { confirmRealName, token: inviteToken },
      url: '/invites/accept',
    });
  }

  function revokeInvite(token: string, groupId: string, inviteToken: string) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      url: `/groups/${groupId}/invite-links/${inviteToken}/revoke`,
    });
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
