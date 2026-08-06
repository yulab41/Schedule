import { fileURLToPath } from 'node:url';

import {
  createTestDatabaseClient,
  migrateDatabase,
  type DatabaseClient,
  type DatabaseConnectionOptions,
} from '@schedule/database';
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

  beforeEach(async () => {
    client = createTestDatabaseClient(databaseOptions as DatabaseConnectionOptions);
    await resetDatabase(client);
    await migrateDatabase(client, migrationsDirectory);
    app = createApp({
      authPort: createFakeAuthPort({
        'candidate-token': 'cloudbase-candidate',
        'other-candidate-token': 'cloudbase-other-candidate',
        'owner-token': 'cloudbase-owner',
      }),
      databaseClient: client,
      logger: false,
    });
    await registerUser('owner-token', 'Owner Doctor');
    await registerUser('candidate-token', 'Candidate Doctor');
    await registerUser('other-candidate-token', 'Other Candidate');
    const createdGroup = (await createGroup('Claims group', '4321')).json() as {
      id: string;
    };
    groupId = createdGroup.id;
    const candidateJoin = await claimGroup('candidate-token', '4321', 'Candidate Doctor');
    expect(candidateJoin.statusCode).toBe(201);
    const otherCandidateJoin = await claimGroup('other-candidate-token', '4321', 'Other Candidate');
    expect(otherCandidateJoin.statusCode).toBe(201);
    const added = await addFormalMember(groupId, 'Target Doctor');
    expect(added.statusCode).toBe(200);
    const members = (await listMembers('owner-token', groupId)).json() as {
      readonly id: string;
      readonly isUnclaimed?: boolean;
      readonly realName: string;
    }[];
    memberMembershipId = members.find((member) => member.realName === 'Target Doctor')
      ?.id as string;
  });

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
    }
    if (client !== undefined) {
      await client.close();
    }
  });

  it('looks up same-name members and lets an administrator claim an unclaimed member directly', async () => {
    const lookup = await claimLookup('candidate-token', groupId, 'Target Doctor');
    expect(lookup.statusCode).toBe(200);
    expect(lookup.json()).toMatchObject({
      matches: [
        {
          isUnclaimed: true,
          membershipId: memberMembershipId,
          realName: 'Target Doctor',
          role: 'member',
        },
      ],
    });

    const membersBefore = (await listMembers('owner-token', groupId)).json() as {
      readonly id: string;
      readonly realName: string;
    }[];
    const candidateMembershipId = membersBefore.find(
      (member) => member.realName === 'Candidate Doctor',
    )?.id as string;
    const promoted = await updateRole(
      'owner-token',
      groupId,
      candidateMembershipId,
      'administrator',
    );
    expect(promoted.statusCode).toBe(200);

    const created = await createClaim('candidate-token', groupId, memberMembershipId);
    expect(created.statusCode, created.body).toBe(201);
    expect(created.json()).toEqual({ direct: true });

    const members = (await listMembers('candidate-token', groupId)).json() as {
      readonly id: string;
      readonly isClaimedByCurrentUser?: boolean;
      readonly isUnclaimed?: boolean;
      readonly realName: string;
    }[];
    const target = members.find((member) => member.realName === 'Target Doctor');
    expect(target?.isUnclaimed).toBe(false);
    expect(target?.isClaimedByCurrentUser).toBe(true);
    expect(members.some((member) => member.realName === 'Candidate Doctor')).toBe(false);
  });

  it('prevents the group owner from claiming a member identity', async () => {
    const created = await createClaim('owner-token', groupId, memberMembershipId);
    expect(created.statusCode, created.body).toBe(409);
  });

  it('lets a normal member request a claim and an owner approve it', async () => {
    const created = await createClaim('candidate-token', groupId, memberMembershipId);
    expect(created.statusCode).toBe(202);
    expect(created.json()).toMatchObject({
      direct: false,
      request: {
        requestingUserRealName: 'Candidate Doctor',
        status: 'pending',
        targetMemberRealName: 'Target Doctor',
      },
    });

    const duplicate = await createClaim('candidate-token', groupId, memberMembershipId);
    expect(duplicate.statusCode).toBe(409);

    const pending = (await listClaimRequests('owner-token', groupId)).json() as {
      readonly id: string;
      readonly status: string;
    }[];
    expect(pending).toHaveLength(1);
    const requestId = pending[0]?.id as string;

    const approved = await approveClaim('owner-token', groupId, requestId);
    expect(approved.statusCode, approved.body).toBe(200);
    expect(approved.json()).toMatchObject({ status: 'approved' });

    const members = (await listMembers('candidate-token', groupId)).json() as {
      readonly id: string;
      readonly isClaimedByCurrentUser?: boolean;
      readonly isCurrentUser: boolean;
      readonly isUnclaimed?: boolean;
      readonly realName: string;
    }[];
    const target = members.find((member) => member.realName === 'Target Doctor');
    expect(target?.isUnclaimed).toBe(false);
    expect(target?.isClaimedByCurrentUser).toBe(true);
    expect(target?.isCurrentUser).toBe(true);

    const blocked = await createClaim('other-candidate-token', groupId, memberMembershipId);
    expect(blocked.statusCode).toBe(409);
  });

  it('lets an owner reject a claim, an administrator claim directly, and the owner revoke it', async () => {
    const created = await createClaim('candidate-token', groupId, memberMembershipId);
    const requestId = (created.json() as { request: { id: string } }).request.id;

    const rejected = await rejectClaim('owner-token', groupId, requestId);
    expect(rejected.statusCode).toBe(200);
    expect(rejected.json()).toMatchObject({ status: 'rejected' });

    const membersBefore = (await listMembers('owner-token', groupId)).json() as {
      readonly id: string;
      readonly realName: string;
    }[];
    const candidateMembershipId = membersBefore.find(
      (member) => member.realName === 'Candidate Doctor',
    )?.id as string;
    await updateRole('owner-token', groupId, candidateMembershipId, 'administrator');

    const direct = await createClaim('candidate-token', groupId, memberMembershipId);
    expect(direct.statusCode, direct.body).toBe(201);

    const revoked = await revokeClaim('owner-token', groupId, memberMembershipId);
    expect(revoked.statusCode).toBe(200);
    const members = (await listMembers('owner-token', groupId)).json() as {
      readonly isUnclaimed?: boolean;
      readonly realName: string;
    }[];
    expect(members.find((member) => member.realName === 'Target Doctor')?.isUnclaimed).toBe(true);
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

  function claimGroup(token: string, groupCode: string, realName: string) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: { groupCode, realName },
      url: '/groups/claim',
    });
  }

  function updateRole(
    token: string,
    targetGroupId: string,
    membershipId: string,
    role: 'administrator' | 'member',
  ) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'PUT',
      payload: { role },
      url: `/groups/${targetGroupId}/members/${membershipId}/role`,
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
      payload: { membershipId },
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
      url: `/groups/${targetGroupId}/claim-requests/${claimRequestId}/approve`,
    });
  }

  function rejectClaim(token: string, targetGroupId: string, claimRequestId: string) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      url: `/groups/${targetGroupId}/claim-requests/${claimRequestId}/reject`,
    });
  }

  function revokeClaim(token: string, targetGroupId: string, membershipId: string) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
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
    'membership_claim_requests',
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
    'user_profiles',
    'users',
    '__drizzle_migrations',
  ];
  for (const table of tables) {
    await client.database.execute(`DROP TABLE IF EXISTS ${table}`);
  }
  await client.database.execute(`SET FOREIGN_KEY_CHECKS = 1`);
}
