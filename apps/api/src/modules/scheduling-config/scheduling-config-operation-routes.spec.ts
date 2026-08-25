import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { registerSchedulingConfigRoutes } from './scheduling-config-routes.js';
import type { SchedulingConfigService } from './scheduling-config-service.js';

const groupId = '11111111-1111-4111-8111-111111111111';
const roleId = '22222222-2222-4222-8222-222222222222';
const shiftTypeId = '33333333-3333-4333-8333-333333333333';
const memberId = '44444444-4444-4444-8444-444444444444';
const roleMemberId = '55555555-5555-4555-8555-555555555555';
const firstOperationId = '66666666-6666-4666-8666-666666666666';
const secondOperationId = '77777777-7777-4777-8777-777777777777';
const identity = { cloudbaseUid: 'test-user' } satisfies AuthenticatedIdentity;

describe('P8 scheduling configuration route operation and version boundary', () => {
  let app: FastifyInstance;
  let calls: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    app.decorate('authenticate', async (request: { authenticatedIdentity?: unknown }) => {
      request.authenticatedIdentity = identity;
    });
    app.setErrorHandler((error, _request, reply) => {
      const statusCode =
        typeof error === 'object' && error !== null && 'statusCode' in error
          ? Number(error.statusCode)
          : 500;
      void reply.code(Number.isInteger(statusCode) ? statusCode : 500).send({
        error: error instanceof Error ? error.message : 'unknown error',
      });
    });
    const serviceCall = (result: unknown) => vi.fn(async () => result);
    calls = {
      createRole: serviceCall(role()),
      createShiftType: serviceCall(shiftType()),
      deleteRole: serviceCall({ completed: true }),
      deleteShiftType: serviceCall({ completed: true }),
      reorderRotationMembers: serviceCall(role()),
      replaceRoleMembers: serviceCall(role()),
      updateRotationRule: serviceCall(role()),
      updateShiftType: serviceCall(shiftType()),
    };
    registerSchedulingConfigRoutes(app, {
      ...calls,
      getConfig: vi.fn(),
    } as unknown as SchedulingConfigService);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('accepts header-only operation ids and forwards all aggregate and entity versions', async () => {
    const responses = await Promise.all(
      mutationRequests(firstOperationId).map((request) => app.inject(request)),
    );

    expect(responses.map((response) => response.statusCode)).toEqual([
      201, 200, 200, 200, 200, 201, 200, 200,
    ]);
    for (const call of Object.values(calls)) {
      expect(call).toHaveBeenCalledOnce();
      expect(call.mock.calls[0]?.at(-1)).toEqual(
        expect.objectContaining({ expectedRulesVersion: 4, operationId: firstOperationId }),
      );
    }
    expect(calls.replaceRoleMembers!.mock.calls[0]?.at(-1)).toEqual(
      expect.objectContaining({ expectedRoleVersion: 2, expectedRotationRuleVersion: 3 }),
    );
    expect(calls.updateShiftType!.mock.calls[0]?.at(-1)).toEqual(
      expect.objectContaining({ expectedVersion: 5 }),
    );
  });

  it('rejects missing and mismatched operation ids before any service call', async () => {
    const missing = await Promise.all(
      mutationRequests(undefined).map((request) => app.inject(request)),
    );
    const mismatched = await Promise.all(
      mutationRequests(firstOperationId, secondOperationId).map((request) => app.inject(request)),
    );

    expect(missing.every((response) => response.statusCode === 400)).toBe(true);
    expect(mismatched.every((response) => response.statusCode === 400)).toBe(true);
    for (const call of Object.values(calls)) expect(call).not.toHaveBeenCalled();
  });
});

function mutationRequests(headerOperationId: string | undefined, bodyOperationId?: string) {
  const headers = headerOperationId === undefined ? {} : { 'idempotency-key': headerOperationId };
  const operation = bodyOperationId === undefined ? {} : { operationId: bodyOperationId };
  const request = (
    method: 'DELETE' | 'POST' | 'PUT',
    url: string,
    payload: Readonly<Record<string, unknown>>,
  ) => ({ headers, method, payload: { ...payload, ...operation }, url });
  const roleVersions = {
    expectedRoleVersion: 2,
    expectedRotationRuleVersion: 3,
    expectedRulesVersion: 4,
  };
  return [
    request('POST', `/groups/${groupId}/schedule-roles`, {
      expectedRulesVersion: 4,
      name: '一线',
    }),
    request('PUT', `/groups/${groupId}/schedule-roles/${roleId}/members`, {
      ...roleVersions,
      membershipIds: [memberId],
    }),
    request('PUT', `/groups/${groupId}/schedule-roles/${roleId}/rotation-members`, {
      ...roleVersions,
      members: [{ position: 1, scheduleRoleMemberId: roleMemberId }],
    }),
    request('PUT', `/groups/${groupId}/schedule-roles/${roleId}/rotation-rule`, {
      ...roleVersions,
      currentPosition: 1,
      defaultShiftTypeId: shiftTypeId,
      requiredMembersPerDay: 1,
    }),
    request('DELETE', `/groups/${groupId}/schedule-roles/${roleId}`, {
      expectedRulesVersion: 4,
      expectedVersion: 2,
    }),
    request('POST', `/groups/${groupId}/shift-types`, {
      ...shiftInput(),
      expectedRulesVersion: 4,
    }),
    request('PUT', `/groups/${groupId}/shift-types/${shiftTypeId}`, {
      ...shiftInput(),
      expectedRulesVersion: 4,
      expectedVersion: 5,
    }),
    request('DELETE', `/groups/${groupId}/shift-types/${shiftTypeId}`, {
      expectedRulesVersion: 4,
      expectedVersion: 5,
    }),
  ];
}

function role() {
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

function shiftType() {
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
