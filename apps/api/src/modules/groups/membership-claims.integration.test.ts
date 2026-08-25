import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import {
  createTestDatabaseClient,
  groupMemberships,
  membershipClaimRequests,
  migrateDatabase,
  type DatabaseClient,
  type DatabaseConnectionOptions,
} from '@schedule/database';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AuthPort } from '../../adapters/auth/auth-port.js';
import { createApp } from '../../app.js';

const migrationsDirectory = fileURLToPath(new URL('../../../../../migrations', import.meta.url));
const databaseOptions = getTestDatabaseOptions();
const describeWithDatabase = databaseOptions === undefined ? describe.skip : describe;

describeWithDatabase('membership identity claims', () => {
  let app: ReturnType<typeof createApp>;
  let client: DatabaseClient;
  let groupId: string;
  let memberMembershipId: string;
  let memberMembershipVersion: number;

  beforeEach(async () => {
    client = createTestDatabaseClient(databaseOptions as DatabaseConnectionOptions);
    await resetDatabase(client);
    await migrateDatabase(client, migrationsDirectory);
    app = createApp({
      authPort: createFakeAuthPort({
        'candidate-token': 'cloudbase-candidate',
        'developer-token': 'password_00000000-0000-4000-8000-000000000001',
        'owner-token': 'cloudbase-owner',
      }),
      databaseClient: client,
      logger: false,
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
    await registerUser('candidate-token', 'Candidate Doctor');
    const createdGroup = (await createGroup('Claims group', '4321')).json() as {
      id: string;
    };
    groupId = createdGroup.id;
    const candidateRoster = await addFormalMember(groupId, 'Candidate Doctor');
    expect(candidateRoster.statusCode).toBe(200);
    const candidateJoin = await claimGroup('candidate-token', '4321');
    expect(candidateJoin.statusCode).toBe(201);
    const added = await addFormalMember(groupId, 'Target Doctor');
    expect(added.statusCode).toBe(200);
    const members = (await listMembers('owner-token', groupId)).json() as {
      readonly id: string;
      readonly isUnclaimed?: boolean;
      readonly realName: string;
      readonly version: number;
    }[];
    const target = members.find((member) => member.realName === 'Target Doctor');
    memberMembershipId = target?.id as string;
    memberMembershipVersion = target?.version as number;
  });

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
    }
    if (client !== undefined) {
      await client.close();
    }
  });

  it('denies normal members and group owners access to historical claim actions', async () => {
    for (const response of [
      await claimLookup('candidate-token', groupId, 'Target Doctor'),
      await createClaim('candidate-token', groupId, memberMembershipId),
      await listClaimRequests('owner-token', groupId),
    ]) {
      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({ error: { code: 'FORBIDDEN' } });
    }
  });

  it('lets only the developer administrator inspect and decide a historical claim', async () => {
    const lookup = await claimLookup('developer-token', groupId, 'Target Doctor');
    expect(lookup.statusCode).toBe(200);
    expect(lookup.json()).toMatchObject({
      matches: [{ isUnclaimed: true, membershipId: memberMembershipId, realName: 'Target Doctor' }],
    });

    const candidate = (
      await app.inject({
        headers: { authorization: 'Bearer candidate-token' },
        method: 'GET',
        url: '/users/me',
      })
    ).json() as { id: string };
    const requestId = randomUUID();
    await client.database.insert(membershipClaimRequests).values({
      groupId,
      id: requestId,
      requestingUserId: candidate.id,
      targetMembershipId: memberMembershipId,
    });

    const ownerApproval = await approveClaim('owner-token', groupId, requestId);
    expect(ownerApproval.statusCode).toBe(403);

    const approved = await approveClaim('developer-token', groupId, requestId);
    expect(approved.statusCode, approved.body).toBe(200);
    expect(approved.json()).toMatchObject({ id: requestId, status: 'approved' });

    const [boundMembership] = await client.database
      .select({ version: groupMemberships.version })
      .from(groupMemberships)
      .where(eq(groupMemberships.id, memberMembershipId));
    const revoked = await revokeClaim(
      'developer-token',
      groupId,
      memberMembershipId,
      boundMembership!.version,
    );
    expect(revoked.statusCode, revoked.body).toBe(200);
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

  function createGroup(name: string, groupCode: string) {
    return app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      payload: { groupCode, name },
      url: '/groups',
    });
  }

  function addFormalMember(targetGroupId: string, realName: string) {
    return app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      payload: { realNames: [realName] },
      url: `/groups/${targetGroupId}/members`,
    });
  }

  function claimGroup(token: string, groupCode: string) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: { groupCode },
      url: '/groups/claim',
    });
  }

  function listMembers(token: string, targetGroupId: string) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: `/groups/${targetGroupId}/members`,
    });
  }

  function claimLookup(token: string, targetGroupId: string, realName: string) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: { realName },
      url: `/groups/${targetGroupId}/claim-lookups`,
    });
  }

  function createClaim(token: string, targetGroupId: string, membershipId: string) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: { expectedMemberVersion: memberMembershipVersion, membershipId },
      url: `/groups/${targetGroupId}/claim-requests`,
    });
  }

  function listClaimRequests(token: string, targetGroupId: string) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: `/groups/${targetGroupId}/claim-requests`,
    });
  }

  function approveClaim(token: string, targetGroupId: string, claimRequestId: string) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: { expectedVersion: 1 },
      url: `/groups/${targetGroupId}/claim-requests/${claimRequestId}/approve`,
    });
  }

  function revokeClaim(
    token: string,
    targetGroupId: string,
    membershipId: string,
    expectedVersion: number,
  ) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: { expectedVersion },
      url: `/groups/${targetGroupId}/members/${membershipId}/revoke-claim`,
    });
  }
});

function createFakeAuthPort(tokens: Readonly<Record<string, string>>): AuthPort {
  return {
    authenticate: async ({ authorization }) => {
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
  await client.database.execute(`SET FOREIGN_KEY_CHECKS = 0`);
  const tables = [
    'directory_search_aliases',
    'directory_contact_methods',
    'directory_entries',
    'directory_source_documents',
    'directory_import_batches',
    'directory_campuses',
    'membership_claim_requests',
    'invite_tokens',
    'miniprogram_telemetry_events',
    'visitor_access_monthly_aggregates',
    'visitor_access_logs',
    'platform_job_runs',
    'backup_archives',
    'manual_schedule_cells',
    'manual_schedule_template_members',
    'manual_schedule_templates',
    'duty_adjustments',
    'notification_deliveries',
    'notifications',
    'notification_preferences',
    'notification_settings',
    'web_push_subscriptions',
    'notification_batches',
    'holiday_dates',
    'holiday_calendar_versions',
    'statistics_recalc_checks',
    'statistics_snapshots',
    'export_jobs',
    'shift_assignments',
    'schedule_periods',
    'audit_logs',
    'schedule_events',
    'rotation_members',
    'rotation_rules',
    'shift_types',
    'member_schedule_roles',
    'schedule_roles',
    'group_join_requests',
    'guest_schedule_access_attempts',
    'group_code_attempts',
    'group_member_contacts',
    'leave_requests',
    'swap_requests',
    'workflow_sequence_allocations',
    'group_memberships',
    'roster_entries',
    'idempotency_keys',
    '`groups`',
    'wechat_link_tokens',
    'wechat_admin_binding_tickets',
    'wechat_identity_detachments',
    'wechat_union_accounts',
    'user_auth_identities',
    'user_password_credentials',
    'user_profiles',
    'users',
    '__drizzle_migrations',
  ];
  for (const table of tables) {
    await client.database.execute(`DROP TABLE IF EXISTS ${table}`);
  }
  await client.database.execute(`SET FOREIGN_KEY_CHECKS = 1`);
}
