import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import {
  createTestDatabaseClient,
  migrateDatabase,
  type DatabaseClient,
  type DatabaseConnectionOptions,
} from '@schedule/database';
import { sql } from 'drizzle-orm';
import { insertDirectMembership } from '@schedule/test-fixtures';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AuthPort } from '../../adapters/auth/auth-port.js';
import { createApp } from '../../app.js';

const migrationsDirectory = fileURLToPath(new URL('../../../../../migrations', import.meta.url));
const databaseOptions = getTestDatabaseOptions();
const describeWithDatabase = databaseOptions === undefined ? describe.skip : describe;

describeWithDatabase('scheduling configuration', () => {
  let app: ReturnType<typeof createApp>;
  let client: DatabaseClient;

  beforeEach(async () => {
    client = createTestDatabaseClient(databaseOptions as DatabaseConnectionOptions);
    await resetDatabase(client);
    await migrateDatabase(client, migrationsDirectory);
    app = createApp({
      authPort: createFakeAuthPort({
        'candidate-token': 'cloudbase-candidate',
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
  });

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
    }

    if (client !== undefined) {
      await client.close();
    }
  });

  it('creates six group templates and requires configured times before enabling other shifts', async () => {
    const groupId = await createGroup();
    const config = await getConfig('owner-token', groupId);
    const allDayShift = config.shiftTypes.find((shiftType) => shiftType.name === '全天班');
    const aShift = config.shiftTypes.find((shiftType) => shiftType.name === 'A 班');

    expect(config.shiftTypes).toHaveLength(6);
    expect(config.shiftTypes.map((shiftType) => shiftType.name)).toEqual([
      '全天班',
      'A 班',
      'N 班',
      'P 班',
      'NP 班',
      '办公班',
    ]);
    expect(allDayShift).toMatchObject({
      crossesMidnight: true,
      endTime: '08:00',
      isAllDay: true,
      isEnabled: true,
      startTime: '08:00',
    });
    expect(aShift).toMatchObject({ isEnabled: false });
    expect(aShift).not.toHaveProperty('startTime');
    expect(aShift).not.toHaveProperty('endTime');

    const invalidEnable = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'PUT',
      payload: {
        abbreviation: aShift?.abbreviation,
        color: aShift?.color,
        countsTowardStatistics: aShift?.countsTowardStatistics,
        crossesMidnight: false,
        endTime: null,
        expectedRulesVersion: config.rulesVersion,
        expectedVersion: aShift?.version,
        isEnabled: true,
        name: aShift?.name,
        startTime: null,
      },
      url: `/groups/${groupId}/shift-types/${aShift?.id}`,
    });

    expect(invalidEnable.statusCode).toBe(400);

    const validTwentyFourHourShift = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'PUT',
      payload: {
        abbreviation: aShift?.abbreviation,
        color: aShift?.color,
        countsTowardStatistics: aShift?.countsTowardStatistics,
        crossesMidnight: true,
        endTime: '08:00',
        expectedRulesVersion: config.rulesVersion,
        expectedVersion: aShift?.version,
        isEnabled: true,
        name: aShift?.name,
        startTime: '08:00',
      },
      url: `/groups/${groupId}/shift-types/${aShift?.id}`,
    });

    expect(validTwentyFourHourShift.statusCode).toBe(200);
    expect(validTwentyFourHourShift.json()).toMatchObject({
      crossesMidnight: true,
      endTime: '08:00',
      isEnabled: true,
      startTime: '08:00',
    });
  });

  it('allows a member in multiple roles and persists only contiguous rotation positions', async () => {
    const groupId = await createClaimedGroup();
    const members = await listGroupMembers(groupId);
    const owner = members.find((member) => member.realName === 'Owner Doctor');
    const candidate = members.find((member) => member.realName === 'Candidate Doctor');
    const firstRole = await createRole(groupId, '一线');
    const configBeforeMembers = await getConfig('owner-token', groupId);

    const membersSaved = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'PUT',
      payload: {
        expectedRoleVersion: firstRole.version,
        expectedRotationRuleVersion: firstRole.rotationRule.version,
        expectedRulesVersion: configBeforeMembers.rulesVersion,
        membershipIds: [owner?.id, candidate?.id],
      },
      url: `/groups/${groupId}/schedule-roles/${firstRole.id}/members`,
    });
    const firstRoleWithMembers = membersSaved.json() as ScheduleRoleResponse;
    const rulesAfterMembers = (await getConfig('owner-token', groupId)).rulesVersion;
    const staleRoleMembers = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'PUT',
      payload: {
        expectedRoleVersion: firstRole.version,
        expectedRotationRuleVersion: firstRole.rotationRule.version,
        expectedRulesVersion: rulesAfterMembers,
        membershipIds: [owner?.id],
      },
      url: `/groups/${groupId}/schedule-roles/${firstRole.id}/members`,
    });
    const invalidOrder = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'PUT',
      payload: {
        expectedRoleVersion: firstRoleWithMembers.version,
        expectedRotationRuleVersion: firstRoleWithMembers.rotationRule.version,
        expectedRulesVersion: rulesAfterMembers,
        members: firstRoleWithMembers.members.map((member, index) => ({
          position: index + 2,
          scheduleRoleMemberId: member.id,
        })),
      },
      url: `/groups/${groupId}/schedule-roles/${firstRole.id}/rotation-members`,
    });
    const validOrder = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'PUT',
      payload: {
        expectedRoleVersion: firstRoleWithMembers.version,
        expectedRotationRuleVersion: firstRoleWithMembers.rotationRule.version,
        expectedRulesVersion: rulesAfterMembers,
        members: [...firstRoleWithMembers.members].reverse().map((member, index) => ({
          position: index + 1,
          scheduleRoleMemberId: member.id,
        })),
      },
      url: `/groups/${groupId}/schedule-roles/${firstRole.id}/rotation-members`,
    });
    const reorderedFirstRole = validOrder.json() as ScheduleRoleResponse;
    const configBeforeRule = await getConfig('owner-token', groupId);
    const defaultShiftTypeId = configBeforeRule.shiftTypes.find(
      (shiftType) => shiftType.isEnabled,
    )?.id;
    const rotationRule = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'PUT',
      payload: {
        currentPosition: 1,
        defaultShiftTypeId,
        expectedRoleVersion: reorderedFirstRole.version,
        expectedRotationRuleVersion: reorderedFirstRole.rotationRule.version,
        expectedRulesVersion: configBeforeRule.rulesVersion,
        requiredMembersPerDay: 2,
        startDate: '2026-08-31',
        startingMemberScheduleRoleId: reorderedFirstRole.members[0]?.id,
      },
      url: `/groups/${groupId}/schedule-roles/${firstRole.id}/rotation-rule`,
    });
    const secondRole = await createRole(groupId, '二线');
    const configBeforeSecondMembers = await getConfig('owner-token', groupId);
    const secondRoleMembers = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'PUT',
      payload: {
        expectedRoleVersion: secondRole.version,
        expectedRotationRuleVersion: secondRole.rotationRule.version,
        expectedRulesVersion: configBeforeSecondMembers.rulesVersion,
        membershipIds: [candidate?.id],
      },
      url: `/groups/${groupId}/schedule-roles/${secondRole.id}/members`,
    });

    expect(membersSaved.statusCode).toBe(200);
    expect(firstRoleWithMembers).toMatchObject({
      rotationRule: { version: firstRole.rotationRule.version + 1 },
      version: firstRole.version + 1,
    });
    expect(staleRoleMembers.statusCode).toBe(409);
    expect(staleRoleMembers.json()).toMatchObject({
      error: {
        latestData: {
          id: firstRole.id,
          objectType: 'schedule_role',
          version: firstRole.version + 1,
        },
      },
    });
    expect(invalidOrder.statusCode).toBe(400);
    expect(validOrder.statusCode).toBe(200);
    expect(reorderedFirstRole).toMatchObject({
      rotationRule: { version: firstRoleWithMembers.rotationRule.version + 1 },
      version: firstRoleWithMembers.version + 1,
    });
    expect(validOrder.json()).toMatchObject({
      members: [
        { position: 1, realName: 'Candidate Doctor' },
        { position: 2, realName: 'Owner Doctor' },
      ],
    });
    expect(rotationRule.statusCode).toBe(200);
    expect(rotationRule.json()).toMatchObject({
      version: reorderedFirstRole.version + 1,
      rotationRule: {
        currentPosition: 1,
        requiredMembersPerDay: 2,
        startDate: '2026-08-31',
        startingMemberScheduleRoleId: reorderedFirstRole.members[0]?.id,
        version: reorderedFirstRole.rotationRule.version + 1,
      },
    });
    expect(secondRoleMembers.statusCode).toBe(200);

    const config = await getConfig('owner-token', groupId);
    expect(config.roles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: '一线',
          members: expect.arrayContaining([
            expect.objectContaining({ realName: 'Candidate Doctor' }),
          ]),
        }),
        expect.objectContaining({
          name: '二线',
          members: expect.arrayContaining([
            expect.objectContaining({ realName: 'Candidate Doctor' }),
          ]),
        }),
      ]),
    );
  });

  it('deletes an unused role and blocks deleting a role that already has schedule periods', async () => {
    const groupId = await createClaimedGroup();
    const unusedRole = await createRole(groupId, '备用岗');

    const deleted = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'DELETE',
      payload: {
        expectedRulesVersion: (await getConfig('owner-token', groupId)).rulesVersion,
        expectedVersion: unusedRole.version,
      },
      url: `/groups/${groupId}/schedule-roles/${unusedRole.id}`,
    });
    expect(deleted.statusCode).toBe(200);

    const configAfterDelete = await getConfig('owner-token', groupId);
    expect(configAfterDelete.roles.map((role) => role.name)).not.toContain('备用岗');

    const usedRole = await createRole(groupId, '一线');
    await client.database.execute(
      sql`INSERT INTO schedule_periods (id, group_id, schedule_role_id, business_month, revision, rules_version)
          VALUES ('00000000-0000-4000-8000-000000000001', ${groupId}, ${usedRole.id}, '2026-08-01', 1, ${configAfterDelete.rulesVersion})`,
    );
    const blocked = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'DELETE',
      payload: {
        expectedRulesVersion: (await getConfig('owner-token', groupId)).rulesVersion,
        expectedVersion: usedRole.version,
      },
      url: `/groups/${groupId}/schedule-roles/${usedRole.id}`,
    });
    expect(blocked.statusCode).toBe(400);
    expect(blocked.json()).toMatchObject({
      error: {
        code: 'VALIDATION_FAILED',
        message: '该排班岗位已用于排班，为保留历史数据不能删除。',
      },
    });

    await client.database.execute(
      sql`UPDATE schedule_periods SET deleted_at = CURRENT_TIMESTAMP(3)
          WHERE id = '00000000-0000-4000-8000-000000000001'`,
    );
    const deletedAfterSoftDelete = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'DELETE',
      payload: {
        expectedRulesVersion: (await getConfig('owner-token', groupId)).rulesVersion,
        expectedVersion: usedRole.version,
      },
      url: `/groups/${groupId}/schedule-roles/${usedRole.id}`,
    });
    expect(deletedAfterSoftDelete.statusCode).toBe(200);
    expect((await getConfig('owner-token', groupId)).roles.map((role) => role.name)).not.toContain(
      '一线',
    );
  });

  it('deletes unused custom shift types and keeps built-in shift types', async () => {
    const groupId = await createClaimedGroup();
    const initialConfig = await getConfig('owner-token', groupId);
    const createShift = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      payload: {
        abbreviation: '删',
        color: '#111827',
        countsTowardStatistics: true,
        crossesMidnight: false,
        endTime: '18:00',
        expectedRulesVersion: initialConfig.rulesVersion,
        isEnabled: true,
        name: '可删除班种',
        startTime: '09:00',
      },
      url: `/groups/${groupId}/shift-types`,
    });
    expect(createShift.statusCode).toBe(201);
    const shiftType = createShift.json() as ShiftTypeResponse;
    expect(shiftType.isBuiltIn).toBe(false);

    const builtIn = (await getConfig('owner-token', groupId)).shiftTypes.find(
      (shift) => shift.isBuiltIn,
    );
    expect(builtIn).toBeDefined();
    const builtInDelete = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'DELETE',
      payload: {
        expectedRulesVersion: (await getConfig('owner-token', groupId)).rulesVersion,
        expectedVersion: builtIn?.version,
      },
      url: `/groups/${groupId}/shift-types/${builtIn?.id}`,
    });
    expect(builtInDelete.statusCode).toBe(400);

    const deleted = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'DELETE',
      payload: {
        expectedRulesVersion: (await getConfig('owner-token', groupId)).rulesVersion,
        expectedVersion: shiftType.version,
      },
      url: `/groups/${groupId}/shift-types/${shiftType.id}`,
    });
    expect(deleted.statusCode).toBe(200);
    const configAfter = await getConfig('owner-token', groupId);
    expect(configAfter.shiftTypes.find((shift) => shift.id === shiftType.id)).toBeUndefined();
  });

  it('keeps disabled shift configuration available while blocking direct member changes', async () => {
    const groupId = await createClaimedGroup();
    const initialConfig = await getConfig('owner-token', groupId);
    const createShift = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      payload: {
        abbreviation: '夜',
        color: '#312E81',
        countsTowardStatistics: true,
        crossesMidnight: true,
        endTime: '08:00',
        expectedRulesVersion: initialConfig.rulesVersion,
        isEnabled: true,
        name: '自定义夜班',
        startTime: '20:00',
      },
      url: `/groups/${groupId}/shift-types`,
    });
    const shiftType = createShift.json() as ShiftTypeResponse;
    const configBeforeDisable = await getConfig('owner-token', groupId);
    const disableShift = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'PUT',
      payload: {
        abbreviation: shiftType.abbreviation,
        color: shiftType.color,
        countsTowardStatistics: shiftType.countsTowardStatistics,
        crossesMidnight: shiftType.crossesMidnight,
        endTime: shiftType.endTime,
        expectedRulesVersion: configBeforeDisable.rulesVersion,
        expectedVersion: shiftType.version,
        isEnabled: false,
        name: shiftType.name,
        startTime: shiftType.startTime,
      },
      url: `/groups/${groupId}/shift-types/${shiftType.id}`,
    });
    const memberCreatesRole = await app.inject({
      headers: { authorization: 'Bearer candidate-token' },
      method: 'POST',
      payload: {
        expectedRulesVersion: (await getConfig('owner-token', groupId)).rulesVersion,
        name: '越权角色',
      },
      url: `/groups/${groupId}/schedule-roles`,
    });

    expect(createShift.statusCode).toBe(201);
    expect(shiftType).toMatchObject({
      crossesMidnight: true,
      endTime: '08:00',
      startTime: '20:00',
      textColor: '#FFFFFF',
    });
    expect(disableShift.statusCode).toBe(200);
    expect(disableShift.json()).toMatchObject({ configurationVersion: 2, isEnabled: false });
    expect(memberCreatesRole.statusCode).toBe(403);
    expect((await getConfig('owner-token', groupId)).shiftTypes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: shiftType.id, isEnabled: false, name: '自定义夜班' }),
      ]),
    );
  });

  it('replays role and shift-type writes before deleted targets are rechecked', async () => {
    const groupId = await createClaimedGroup();
    const initialConfig = await getConfig('owner-token', groupId);
    const roleOperationId = randomUUID();
    const rolePayload = {
      expectedRulesVersion: initialConfig.rulesVersion,
      name: '幂等岗位',
      operationId: roleOperationId,
    };
    const roleCreated = await app.inject({
      headers: { authorization: 'Bearer owner-token', 'idempotency-key': roleOperationId },
      method: 'POST',
      payload: rolePayload,
      url: `/groups/${groupId}/schedule-roles`,
    });
    const roleReplay = await app.inject({
      headers: { authorization: 'Bearer owner-token', 'idempotency-key': roleOperationId },
      method: 'POST',
      payload: rolePayload,
      url: `/groups/${groupId}/schedule-roles`,
    });
    const changedRole = await app.inject({
      headers: { authorization: 'Bearer owner-token', 'idempotency-key': roleOperationId },
      method: 'POST',
      payload: { ...rolePayload, name: '异载荷岗位' },
      url: `/groups/${groupId}/schedule-roles`,
    });
    expect(roleCreated.statusCode, roleCreated.body).toBe(201);
    expect(roleReplay.json()).toEqual(roleCreated.json());
    expect(changedRole.statusCode).toBe(409);

    const role = roleCreated.json() as ScheduleRoleResponse;
    const deleteRoleOperationId = randomUUID();
    const deleteRolePayload = {
      expectedRulesVersion: (await getConfig('owner-token', groupId)).rulesVersion,
      expectedVersion: role.version,
      operationId: deleteRoleOperationId,
    };
    const roleDeleted = await app.inject({
      headers: { authorization: 'Bearer owner-token', 'idempotency-key': deleteRoleOperationId },
      method: 'DELETE',
      payload: deleteRolePayload,
      url: `/groups/${groupId}/schedule-roles/${role.id}`,
    });
    const roleDeleteReplay = await app.inject({
      headers: { authorization: 'Bearer owner-token', 'idempotency-key': deleteRoleOperationId },
      method: 'DELETE',
      payload: deleteRolePayload,
      url: `/groups/${groupId}/schedule-roles/${role.id}`,
    });
    expect(roleDeleted.statusCode, roleDeleted.body).toBe(200);
    expect(roleDeleteReplay.statusCode, roleDeleteReplay.body).toBe(200);

    const shiftOperationId = randomUUID();
    const shiftPayload = {
      abbreviation: '幂',
      color: '#1F5AA6',
      countsTowardStatistics: true,
      crossesMidnight: false,
      endTime: '17:30',
      expectedRulesVersion: (await getConfig('owner-token', groupId)).rulesVersion,
      isEnabled: true,
      name: '幂等班种',
      operationId: shiftOperationId,
      startTime: '08:00',
    };
    const shiftCreated = await app.inject({
      headers: { authorization: 'Bearer owner-token', 'idempotency-key': shiftOperationId },
      method: 'POST',
      payload: shiftPayload,
      url: `/groups/${groupId}/shift-types`,
    });
    const shiftReplay = await app.inject({
      headers: { authorization: 'Bearer owner-token', 'idempotency-key': shiftOperationId },
      method: 'POST',
      payload: shiftPayload,
      url: `/groups/${groupId}/shift-types`,
    });
    expect(shiftCreated.statusCode, shiftCreated.body).toBe(201);
    expect(shiftReplay.json()).toEqual(shiftCreated.json());

    const shift = shiftCreated.json() as ShiftTypeResponse;
    const updateOperationId = randomUUID();
    const updatePayload = {
      ...shiftPayload,
      expectedRulesVersion: (await getConfig('owner-token', groupId)).rulesVersion,
      expectedVersion: shift.version,
      name: '幂等班种更新',
      operationId: updateOperationId,
    };
    const shiftUpdated = await app.inject({
      headers: { authorization: 'Bearer owner-token', 'idempotency-key': updateOperationId },
      method: 'PUT',
      payload: updatePayload,
      url: `/groups/${groupId}/shift-types/${shift.id}`,
    });
    const shiftUpdateReplay = await app.inject({
      headers: { authorization: 'Bearer owner-token', 'idempotency-key': updateOperationId },
      method: 'PUT',
      payload: updatePayload,
      url: `/groups/${groupId}/shift-types/${shift.id}`,
    });
    expect(shiftUpdated.statusCode, shiftUpdated.body).toBe(200);
    expect(shiftUpdateReplay.json()).toEqual(shiftUpdated.json());

    const staleOperationId = randomUUID();
    const staleShift = await app.inject({
      headers: { authorization: 'Bearer owner-token', 'idempotency-key': staleOperationId },
      method: 'PUT',
      payload: {
        ...updatePayload,
        expectedRulesVersion: (await getConfig('owner-token', groupId)).rulesVersion,
        operationId: staleOperationId,
      },
      url: `/groups/${groupId}/shift-types/${shift.id}`,
    });
    expect(staleShift.statusCode).toBe(409);
    expect(staleShift.json()).toMatchObject({
      error: {
        latestData: { id: shift.id, objectType: 'shift_type', version: shift.version + 1 },
      },
    });

    const updatedShift = shiftUpdated.json() as ShiftTypeResponse;
    const deleteShiftOperationId = randomUUID();
    const deleteShiftPayload = {
      expectedRulesVersion: (await getConfig('owner-token', groupId)).rulesVersion,
      expectedVersion: updatedShift.version,
      operationId: deleteShiftOperationId,
    };
    const shiftDeleted = await app.inject({
      headers: { authorization: 'Bearer owner-token', 'idempotency-key': deleteShiftOperationId },
      method: 'DELETE',
      payload: deleteShiftPayload,
      url: `/groups/${groupId}/shift-types/${shift.id}`,
    });
    const shiftDeleteReplay = await app.inject({
      headers: { authorization: 'Bearer owner-token', 'idempotency-key': deleteShiftOperationId },
      method: 'DELETE',
      payload: deleteShiftPayload,
      url: `/groups/${groupId}/shift-types/${shift.id}`,
    });
    expect(shiftDeleted.statusCode, shiftDeleted.body).toBe(200);
    expect(shiftDeleteReplay.statusCode, shiftDeleteReplay.body).toBe(200);
  });

  it('serializes concurrent configuration writes with one aggregate rules winner', async () => {
    const groupId = await createClaimedGroup();
    const config = await getConfig('owner-token', groupId);
    const payload = (name: string, abbreviation: string) => ({
      abbreviation,
      color: '#1F5AA6',
      countsTowardStatistics: true,
      crossesMidnight: false,
      endTime: '17:30',
      expectedRulesVersion: config.rulesVersion,
      isEnabled: true,
      name,
      operationId: randomUUID(),
      startTime: '08:00',
    });
    const firstPayload = payload('并发班种一', '并1');
    const secondPayload = payload('并发班种二', '并2');
    const responses = await Promise.all(
      [firstPayload, secondPayload].map((requestPayload) =>
        app.inject({
          headers: {
            authorization: 'Bearer owner-token',
            'idempotency-key': requestPayload.operationId,
          },
          method: 'POST',
          payload: requestPayload,
          url: `/groups/${groupId}/shift-types`,
        }),
      ),
    );

    expect(responses.map((response) => response.statusCode).sort()).toEqual([201, 409]);
    const names = (await getConfig('owner-token', groupId)).shiftTypes.map((shift) => shift.name);
    expect(names.filter((name) => name.startsWith('并发班种'))).toHaveLength(1);
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

  async function createGroup(): Promise<string> {
    const response = await app.inject({
      headers: {
        authorization: 'Bearer owner-token',
        'idempotency-key': randomUUID(),
      },
      method: 'POST',
      payload: { groupCode: '1234', name: 'Scheduling group' },
      url: '/groups',
    });

    expect(response.statusCode).toBe(201);
    return (response.json() as { id: string }).id;
  }

  async function createClaimedGroup(): Promise<string> {
    const groupId = await createGroup();
    const roster = await app.inject({
      headers: {
        authorization: 'Bearer owner-token',
        'idempotency-key': randomUUID(),
      },
      method: 'POST',
      payload: { realNames: ['Candidate Doctor'] },
      url: `/groups/${groupId}/roster-entries`,
    });
    expect(roster.statusCode).toBe(200);
    await insertDirectMembership(client, { groupCode: '1234', realName: 'Candidate Doctor' });
    return groupId;
  }

  async function createRole(groupId: string, name: string): Promise<ScheduleRoleResponse> {
    const config = await getConfig('owner-token', groupId);
    const response = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      payload: { expectedRulesVersion: config.rulesVersion, name },
      url: `/groups/${groupId}/schedule-roles`,
    });

    expect(response.statusCode).toBe(201);
    return response.json() as ScheduleRoleResponse;
  }

  async function getConfig(token: string, groupId: string): Promise<SchedulingConfigResponse> {
    const response = await app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: `/groups/${groupId}/scheduling-config`,
    });

    expect(response.statusCode).toBe(200);
    return response.json() as SchedulingConfigResponse;
  }

  async function listGroupMembers(groupId: string): Promise<MemberResponse[]> {
    const response = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'GET',
      url: `/groups/${groupId}/members`,
    });

    expect(response.statusCode).toBe(200);
    return response.json() as MemberResponse[];
  }
});

interface MemberResponse {
  readonly id: string;
  readonly realName: string;
}

interface ScheduleRoleResponse {
  readonly id: string;
  readonly members: readonly {
    readonly id: string;
    readonly realName: string;
    readonly version: number;
  }[];
  readonly rotationRule: {
    readonly version: number;
  };
  readonly version: number;
}

interface SchedulingConfigResponse {
  readonly roles: readonly {
    readonly members: readonly { readonly realName: string }[];
    readonly name: string;
    readonly rotationRule: { readonly version: number };
    readonly version: number;
  }[];
  readonly shiftTypes: readonly ShiftTypeResponse[];
  readonly rulesVersion: number;
}

interface ShiftTypeResponse {
  readonly abbreviation: string;
  readonly color: string;
  readonly configurationVersion: number;
  readonly countsTowardStatistics: boolean;
  readonly crossesMidnight: boolean;
  readonly endTime?: string;
  readonly id: string;
  readonly isAllDay: boolean;
  readonly isBuiltIn: boolean;
  readonly isEnabled: boolean;
  readonly name: string;
  readonly startTime?: string;
  readonly textColor: string;
  readonly version: number;
}

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
  await client.database.execute(sql`DROP TABLE IF EXISTS user_auth_identities`);
  await client.database.execute(sql`DROP TABLE IF EXISTS user_password_credentials`);
  await client.database.execute(sql`DROP TABLE IF EXISTS user_profile_avatars`);
  await client.database.execute(sql`DROP TABLE IF EXISTS user_profiles`);
  await client.database.execute(sql`DROP TABLE IF EXISTS wechat_admin_binding_tickets`);
  await client.database.execute(sql`DROP TABLE IF EXISTS wechat_identity_detachments`);
  await client.database.execute(sql`DROP TABLE IF EXISTS wechat_link_tokens`);
  await client.database.execute(sql`DROP TABLE IF EXISTS wechat_union_accounts`);
  await client.database.execute(sql`DROP TABLE IF EXISTS users`);
  await client.database.execute(sql`DROP TABLE IF EXISTS __drizzle_migrations`);
  await client.database.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
}
