import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { registerDutyAdjustmentRoutes } from '../duty-adjustments/duty-adjustment-routes.js';
import type { DutyAdjustmentService } from '../duty-adjustments/duty-adjustment-service.js';
import { registerLeaveRoutes } from '../leaves/leave-routes.js';
import type { LeaveService } from '../leaves/leave-service.js';
import { registerSwapRoutes } from '../swaps/swap-routes.js';
import type { SwapService } from '../swaps/swap-service.js';

const groupId = '11111111-1111-4111-8111-111111111111';
const objectId = '22222222-2222-4222-8222-222222222222';
const firstOperationId = '33333333-3333-4333-8333-333333333333';
const secondOperationId = '44444444-4444-4444-8444-444444444444';
const identity = {
  cloudbaseUid: 'test-user',
} satisfies AuthenticatedIdentity;

describe('workflow route operation-id boundary', () => {
  let app: FastifyInstance;
  let serviceCalls: Record<string, ReturnType<typeof vi.fn>>;

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
      void reply
        .code(Number.isInteger(statusCode) ? statusCode : 500)
        .send({ error: error instanceof Error ? error.message : 'unknown error' });
    });
    const serviceCall = () => vi.fn(async (...args: unknown[]) => args.at(-1));
    serviceCalls = Object.fromEntries(
      [
        'leaveApprove',
        'leaveCancel',
        'leaveCreate',
        'leaveReject',
        'leaveRevoke',
        'swapAccept',
        'swapApprove',
        'swapCancel',
        'swapCreate',
        'swapDirectCreate',
        'swapReject',
        'swapRevoke',
        'dutyAccept',
        'dutyApprove',
        'dutyCancel',
        'dutyCreate',
        'dutyDirectCreate',
        'dutyReject',
        'dutyRevoke',
      ].map((name) => [name, serviceCall()]),
    );
    registerLeaveRoutes(app, {
      approve: serviceCalls.leaveApprove,
      cancel: serviceCalls.leaveCancel,
      reject: serviceCalls.leaveReject,
      revoke: serviceCalls.leaveRevoke,
      submit: serviceCalls.leaveCreate,
    } as unknown as LeaveService);
    registerSwapRoutes(app, {
      accept: serviceCalls.swapAccept,
      approve: serviceCalls.swapApprove,
      cancel: serviceCalls.swapCancel,
      create: serviceCalls.swapCreate,
      createDirect: serviceCalls.swapDirectCreate,
      reject: serviceCalls.swapReject,
      revokeCompleted: serviceCalls.swapRevoke,
    } as unknown as SwapService);
    registerDutyAdjustmentRoutes(app, {
      accept: serviceCalls.dutyAccept,
      approve: serviceCalls.dutyApprove,
      cancel: serviceCalls.dutyCancel,
      create: serviceCalls.dutyCreate,
      createDirect: serviceCalls.dutyDirectCreate,
      reject: serviceCalls.dutyReject,
      revoke: serviceCalls.dutyRevoke,
    } as unknown as DutyAdjustmentService);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('passes matching create operation ids to every workflow service', async () => {
    const leave = await inject('/groups/' + groupId + '/leave-requests', {
      endsAt: '2026-09-02T00:00:00.000Z',
      isAllDay: true,
      leaveType: 'sick',
      operationId: firstOperationId,
      startsAt: '2026-09-01T00:00:00.000Z',
    });
    const swap = await inject('/groups/' + groupId + '/swaps', {
      initiatorAssignmentId: objectId,
      operationId: firstOperationId,
      targetAssignmentId: '55555555-5555-4555-8555-555555555555',
      targetMembershipId: '66666666-6666-4666-8666-666666666666',
    });
    const duty = await inject('/groups/' + groupId + '/duty-adjustments', {
      coveredAssignmentId: objectId,
      operationId: firstOperationId,
      overtimeMembershipId: '66666666-6666-4666-8666-666666666666',
    });

    expect([leave.statusCode, swap.statusCode, duty.statusCode]).toEqual([201, 201, 201]);
    expect(serviceCalls.leaveCreate).toHaveBeenCalledWith(
      identity,
      groupId,
      expect.objectContaining({
        operationId: firstOperationId,
      }),
    );
    expect(serviceCalls.swapCreate).toHaveBeenCalledWith(
      identity,
      groupId,
      expect.objectContaining({
        operationId: firstOperationId,
      }),
    );
    expect(serviceCalls.dutyCreate).toHaveBeenCalledWith(
      identity,
      groupId,
      expect.objectContaining({
        operationId: firstOperationId,
      }),
    );
  });

  it('accepts a header-only operation id through every dangerous route parser', async () => {
    const mutation = { expectedVersion: 1 };
    const requests = [
      [
        inject('/groups/' + groupId + '/leave-requests', {
          endsAt: '2026-09-02T00:00:00.000Z',
          leaveType: 'sick',
          startsAt: '2026-09-01T00:00:00.000Z',
        }),
        201,
      ],
      [
        injectObjectMutation('leave-requests', 'approve', {
          expectedPeriodVersions: {},
          expectedRulesVersion: 1,
          expectedVersion: 1,
        }),
        200,
      ],
      [injectObjectMutation('leave-requests', 'reject', mutation), 200],
      [injectObjectMutation('leave-requests', 'cancel', mutation), 200],
      [injectObjectMutation('leave-requests', 'revoke', mutation), 200],
      [
        inject('/groups/' + groupId + '/swaps', {
          initiatorAssignmentId: objectId,
          targetAssignmentId: '55555555-5555-4555-8555-555555555555',
          targetMembershipId: '66666666-6666-4666-8666-666666666666',
        }),
        201,
      ],
      [
        inject('/groups/' + groupId + '/swaps/direct', {
          initiatorAssignmentId: objectId,
          targetAssignmentId: '55555555-5555-4555-8555-555555555555',
        }),
        201,
      ],
      [injectObjectMutation('swaps', 'accept', mutation), 200],
      [injectObjectMutation('swaps', 'approve', mutation), 200],
      [injectObjectMutation('swaps', 'reject', mutation), 200],
      [injectObjectMutation('swaps', 'cancel', mutation), 200],
      [injectObjectMutation('swaps', 'revoke', mutation), 200],
      [
        inject('/groups/' + groupId + '/duty-adjustments', {
          coveredAssignmentId: objectId,
          overtimeMembershipId: '66666666-6666-4666-8666-666666666666',
        }),
        201,
      ],
      [
        inject('/groups/' + groupId + '/duty-adjustments/direct', {
          coveredAssignmentId: objectId,
          overtimeMembershipId: '66666666-6666-4666-8666-666666666666',
        }),
        201,
      ],
      [injectObjectMutation('duty-adjustments', 'accept', mutation), 200],
      [injectObjectMutation('duty-adjustments', 'approve', mutation), 200],
      [injectObjectMutation('duty-adjustments', 'reject', mutation), 200],
      [injectObjectMutation('duty-adjustments', 'cancel', mutation), 200],
      [injectObjectMutation('duty-adjustments', 'revoke', mutation), 200],
    ] as const;

    expect(
      await Promise.all(requests.map(async ([request]) => (await request).statusCode)),
    ).toEqual(requests.map(([, statusCode]) => statusCode));
    for (const service of Object.values(serviceCalls)) {
      expect(service).toHaveBeenCalledOnce();
      expect(service.mock.calls[0]?.at(-1)).toEqual(
        expect.objectContaining({ operationId: firstOperationId }),
      );
    }
  });

  it('rejects mismatched create and mutation operation ids before service calls', async () => {
    const requests = [
      inject(
        '/groups/' + groupId + '/leave-requests',
        {
          endsAt: '2026-09-02T00:00:00.000Z',
          leaveType: 'sick',
          operationId: secondOperationId,
          startsAt: '2026-09-01T00:00:00.000Z',
        },
        firstOperationId,
      ),
      inject(
        '/groups/' + groupId + '/swaps',
        {
          initiatorAssignmentId: objectId,
          operationId: secondOperationId,
          targetAssignmentId: '55555555-5555-4555-8555-555555555555',
          targetMembershipId: '66666666-6666-4666-8666-666666666666',
        },
        firstOperationId,
      ),
      inject(
        '/groups/' + groupId + '/duty-adjustments',
        {
          coveredAssignmentId: objectId,
          operationId: secondOperationId,
          overtimeMembershipId: '66666666-6666-4666-8666-666666666666',
        },
        firstOperationId,
      ),
      injectObjectMutation('leave-requests', 'approve', {
        expectedPeriodVersions: {},
        expectedRulesVersion: 1,
        expectedVersion: 1,
        operationId: secondOperationId,
      }),
      injectObjectMutation('leave-requests', 'reject'),
      injectObjectMutation('leave-requests', 'cancel'),
      injectObjectMutation('leave-requests', 'revoke'),
      inject(
        '/groups/' + groupId + '/swaps/direct',
        {
          initiatorAssignmentId: objectId,
          operationId: secondOperationId,
          targetAssignmentId: '55555555-5555-4555-8555-555555555555',
        },
        firstOperationId,
      ),
      injectObjectMutation('swaps', 'accept'),
      injectObjectMutation('swaps', 'approve'),
      injectObjectMutation('swaps', 'reject'),
      injectObjectMutation('swaps', 'cancel'),
      injectObjectMutation('swaps', 'revoke'),
      inject(
        '/groups/' + groupId + '/duty-adjustments/direct',
        {
          coveredAssignmentId: objectId,
          operationId: secondOperationId,
          overtimeMembershipId: '66666666-6666-4666-8666-666666666666',
        },
        firstOperationId,
      ),
      injectObjectMutation('duty-adjustments', 'accept'),
      injectObjectMutation('duty-adjustments', 'approve'),
      injectObjectMutation('duty-adjustments', 'reject'),
      injectObjectMutation('duty-adjustments', 'cancel'),
      injectObjectMutation('duty-adjustments', 'revoke'),
    ];

    expect((await Promise.all(requests)).map((response) => response.statusCode)).toEqual([
      ...Array.from({ length: 19 }, () => 400),
    ]);
    for (const service of Object.values(serviceCalls)) {
      expect(service).not.toHaveBeenCalled();
    }
  });

  function injectObjectMutation(
    resource: 'duty-adjustments' | 'leave-requests' | 'swaps',
    action: 'accept' | 'approve' | 'cancel' | 'reject' | 'revoke',
    payload: object = { expectedVersion: 1, operationId: secondOperationId },
  ) {
    return inject(
      `/groups/${groupId}/${resource}/${objectId}/${action}`,
      payload,
      firstOperationId,
    );
  }

  function inject(url: string, payload: object, operationId = firstOperationId) {
    return app.inject({
      headers: { 'idempotency-key': operationId },
      method: 'POST',
      payload,
      url,
    });
  }
});
