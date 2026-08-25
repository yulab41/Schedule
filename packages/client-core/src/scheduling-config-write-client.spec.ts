import { describe, expect, it, vi } from 'vitest';

import type { ClientTransport } from './endpoint.js';
import {
  createSchedulingConfigWriteClient,
  schedulingConfigWriteEndpoints,
} from './scheduling-config-write-client.js';

const groupId = 'group /一';
const roleId = 'role /一';
const shiftTypeId = 'shift /一';
const operationId = '11111111-1111-4111-8111-111111111111';

describe('P8 scheduling configuration shared write boundary', () => {
  it('sets bearer auth, encoded paths, request bodies, and idempotency keys for all 8 writes', () => {
    expect(
      schedulingConfigWriteEndpoints.updateRotationRule.path({
        groupId,
        request: {
          ...roleMutationRequest(),
          currentPosition: 1,
          defaultShiftTypeId: shiftTypeId,
          requiredMembersPerDay: 1,
        },
        roleId,
      }),
    ).toBe('/groups/group%20%2F%E4%B8%80/schedule-roles/role%20%2F%E4%B8%80/rotation-rule');
    expect(
      schedulingConfigWriteEndpoints.deleteShiftType.path({
        groupId,
        request: { expectedRulesVersion: 4, expectedVersion: 5, operationId },
        shiftTypeId,
      }),
    ).toBe('/groups/group%20%2F%E4%B8%80/shift-types/shift%20%2F%E4%B8%80');
    for (const endpoint of Object.values(schedulingConfigWriteEndpoints)) {
      const input = sampleInput(endpoint.id);
      expect(endpoint.auth, endpoint.id).toBe('bearer');
      expect(endpoint.idempotencyKey?.(input as never), endpoint.id).toBe(operationId);
      expect(endpoint.body?.(input as never), endpoint.id).toEqual(
        expect.objectContaining({ expectedRulesVersion: 4, operationId }),
      );
    }
  });

  it('uses the transport receiver once for all 8 methods without retrying', async () => {
    const request = vi.fn(async (endpoint: { readonly id: string }) => responseFor(endpoint.id));
    const transport = { request } as unknown as ClientTransport;
    const client = createSchedulingConfigWriteClient(transport);

    await client.createScheduleRole(groupId, {
      expectedRulesVersion: 4,
      name: '一线',
      operationId,
    });
    await client.replaceScheduleRoleMembers(groupId, roleId, {
      ...roleMutationRequest(),
      membershipIds: ['member-1'],
    });
    await client.reorderRotationMembers(groupId, roleId, {
      ...roleMutationRequest(),
      members: [{ position: 1, scheduleRoleMemberId: 'role-member-1' }],
    });
    await client.updateRotationRule(groupId, roleId, {
      ...roleMutationRequest(),
      currentPosition: 1,
      defaultShiftTypeId: shiftTypeId,
      requiredMembersPerDay: 1,
    });
    await client.deleteScheduleRole(groupId, roleId, {
      expectedRulesVersion: 4,
      expectedVersion: 2,
      operationId,
    });
    await client.createShiftType(groupId, {
      ...shiftInput(),
      expectedRulesVersion: 4,
      operationId,
    });
    await client.updateShiftType(groupId, shiftTypeId, {
      ...shiftInput(),
      expectedRulesVersion: 4,
      expectedVersion: 5,
      operationId,
    });
    await client.deleteShiftType(groupId, shiftTypeId, {
      expectedRulesVersion: 4,
      expectedVersion: 5,
      operationId,
    });

    expect(request).toHaveBeenCalledTimes(8);
    expect(request.mock.contexts).toEqual(Array.from({ length: 8 }, () => transport));
  });
});

function roleMutationRequest() {
  return {
    expectedRoleVersion: 2,
    expectedRotationRuleVersion: 3,
    expectedRulesVersion: 4,
    operationId,
  };
}

function shiftInput() {
  return {
    abbreviation: 'D',
    color: '#1F5AA6',
    countsTowardStatistics: true,
    crossesMidnight: false,
    endTime: '17:30',
    isEnabled: true,
    name: '白班',
    startTime: '08:00',
  };
}

function sampleInput(id: string): unknown {
  if (id.includes('shift-type')) {
    return {
      groupId,
      request: {
        ...shiftInput(),
        expectedRulesVersion: 4,
        expectedVersion: 5,
        operationId,
      },
      shiftTypeId,
    };
  }
  return { groupId, request: roleMutationRequest(), roleId };
}

function responseFor(id: string): unknown {
  if (id.includes('delete')) return undefined;
  if (id.includes('shift-type')) {
    return {
      ...shiftInput(),
      configurationVersion: 5,
      displayOrder: 1,
      id: shiftTypeId,
      isAllDay: false,
      isBuiltIn: false,
      textColor: '#FFFFFF',
      version: 5,
    };
  }
  return {
    id: roleId,
    members: [],
    name: '一线',
    rotationRule: {
      currentPosition: 1,
      defaultShiftTypeId: shiftTypeId,
      requiredMembersPerDay: 1,
      version: 3,
    },
    version: 2,
  };
}
