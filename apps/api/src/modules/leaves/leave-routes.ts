import type {
  ApproveLeaveRequestInput,
  CreateLeaveRequestInput,
  LeaveAffectedShiftsInput,
  LeaveRequestMutationInput,
  PreviewLeaveRequestInput,
  RejectLeaveRequestInput,
  UpdateGroupLeaveReflowStrategyInput,
} from '@schedule/contracts';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { ApiError } from '../../plugins/error-handler.js';
import { resolveDangerousOperationId } from '../../plugins/operation-id.js';
import { LeaveService } from './leave-service.js';

const groupIdSchema = z.string().uuid();
const leaveRequestIdSchema = z.string().uuid();
const operationIdSchema = z.string().uuid();
const leaveTypeSchema = z.enum(['training', 'rotation', 'sick', 'maternity', 'other']);
const strategySchema = z.enum(['keep-original-order', 'shift-forward']);
const resolutionModeSchema = z.enum(['manual', 'shift-forward']);
const datetimeSchema = z.string().datetime({ offset: true });
const versionSchema = z.number().int().min(1);
const periodVersionsSchema = z.record(z.string().uuid(), versionSchema);

const createLeaveInputSchema = z
  .object({
    endsAt: datetimeSchema,
    isAllDay: z.boolean().optional(),
    leaveType: leaveTypeSchema,
    operationId: operationIdSchema.optional(),
    reason: z.string().trim().min(1).max(1000).optional(),
    resolutionMode: resolutionModeSchema.optional(),
    startsAt: datetimeSchema,
  })
  .strict();

const affectedShiftsInputSchema = z
  .object({
    endsAt: datetimeSchema,
    isAllDay: z.boolean().optional(),
    startsAt: datetimeSchema,
  })
  .strict();

const previewInputSchema = z
  .object({
    strategy: strategySchema.optional(),
  })
  .strict();

const approveInputSchema = z
  .object({
    acknowledgeBlockers: z.boolean().optional(),
    expectedPeriodVersions: periodVersionsSchema,
    expectedRulesVersion: versionSchema,
    expectedVersion: versionSchema,
    operationId: operationIdSchema.optional(),
    strategy: strategySchema.optional(),
  })
  .strict();

const rejectInputSchema = z
  .object({
    expectedVersion: versionSchema,
    operationId: operationIdSchema.optional(),
  })
  .strict();

const mutationInputSchema = rejectInputSchema;

const updateStrategyInputSchema = z
  .object({
    strategy: strategySchema,
  })
  .strict();

export function registerLeaveRoutes(app: FastifyInstance, leaveService: LeaveService): void {
  app.post('/groups/:groupId/leave-requests', { preHandler: app.authenticate }, (request, reply) =>
    leaveService
      .submit(getAuthenticatedIdentity(request), parseGroupId(request), parseCreateInput(request))
      .then((leaveRequest) => reply.code(201).send(leaveRequest)),
  );

  app.get('/groups/:groupId/leave-requests', { preHandler: app.authenticate }, (request) =>
    leaveService.listMine(getAuthenticatedIdentity(request), parseGroupId(request)),
  );

  app.post(
    '/groups/:groupId/leave-requests/affected-shifts',
    { preHandler: app.authenticate },
    (request) =>
      leaveService.affectedShifts(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseAffectedShiftsInput(request.body),
      ),
  );

  app.get(
    '/groups/:groupId/leave-requests/approvals',
    { preHandler: app.authenticate },
    (request) =>
      leaveService.listForApproval(getAuthenticatedIdentity(request), parseGroupId(request)),
  );

  app.post(
    '/groups/:groupId/leave-requests/:leaveRequestId/preview',
    { preHandler: app.authenticate },
    (request) =>
      leaveService.preview(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseLeaveRequestId(request),
        parsePreviewInput(request.body),
      ),
  );

  app.post(
    '/groups/:groupId/leave-requests/:leaveRequestId/approve',
    { preHandler: app.authenticate },
    (request) =>
      leaveService.approve(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseLeaveRequestId(request),
        parseApproveInput(request),
      ),
  );

  app.post(
    '/groups/:groupId/leave-requests/:leaveRequestId/reject',
    { preHandler: app.authenticate },
    (request) =>
      leaveService.reject(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseLeaveRequestId(request),
        parseRejectInput(request),
      ),
  );

  app.post(
    '/groups/:groupId/leave-requests/:leaveRequestId/cancel',
    { preHandler: app.authenticate },
    (request) =>
      leaveService.cancel(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseLeaveRequestId(request),
        parseMutationInput(request),
      ),
  );

  app.post(
    '/groups/:groupId/leave-requests/:leaveRequestId/revoke',
    { preHandler: app.authenticate },
    (request) =>
      leaveService.revoke(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseLeaveRequestId(request),
        parseMutationInput(request),
      ),
  );

  app.get('/groups/:groupId/leave-reflow-strategy', { preHandler: app.authenticate }, (request) =>
    leaveService.getGroupStrategy(getAuthenticatedIdentity(request), parseGroupId(request)),
  );

  app.put('/groups/:groupId/leave-reflow-strategy', { preHandler: app.authenticate }, (request) =>
    leaveService.updateGroupStrategy(
      getAuthenticatedIdentity(request),
      parseGroupId(request),
      parseUpdateStrategyInput(request.body),
    ),
  );
}

function getAuthenticatedIdentity(request: FastifyRequest) {
  if (request.authenticatedIdentity === null) {
    throw new ApiError({
      code: 'AUTHENTICATION_REQUIRED',
      statusCode: 401,
      userMessage: '需要先登录后才能继续。',
    });
  }

  return request.authenticatedIdentity;
}

function parseGroupId(request: FastifyRequest): string {
  return parseOrThrow(groupIdSchema, (request.params as { groupId?: unknown }).groupId);
}

function parseLeaveRequestId(request: FastifyRequest): string {
  return parseOrThrow(
    leaveRequestIdSchema,
    (request.params as { leaveRequestId?: unknown }).leaveRequestId,
  );
}

function parseCreateInput(request: FastifyRequest): CreateLeaveRequestInput {
  const input = parseOrThrow(createLeaveInputSchema, request.body);
  return {
    endsAt: input.endsAt,
    ...(input.isAllDay === undefined ? {} : { isAllDay: input.isAllDay }),
    leaveType: input.leaveType,
    operationId: resolveDangerousOperationId(request.headers['idempotency-key'], input.operationId),
    ...(input.reason === undefined ? {} : { reason: input.reason }),
    ...(input.resolutionMode === undefined ? {} : { resolutionMode: input.resolutionMode }),
    startsAt: input.startsAt,
  };
}

function parseAffectedShiftsInput(value: unknown): LeaveAffectedShiftsInput {
  const input = parseOrThrow(affectedShiftsInputSchema, value);
  return {
    endsAt: input.endsAt,
    ...(input.isAllDay === undefined ? {} : { isAllDay: input.isAllDay }),
    startsAt: input.startsAt,
  };
}

function parsePreviewInput(value: unknown): PreviewLeaveRequestInput {
  const input = parseOrThrow(previewInputSchema, value);
  return {
    ...(input.strategy === undefined ? {} : { strategy: input.strategy }),
  };
}

function parseApproveInput(request: FastifyRequest): ApproveLeaveRequestInput {
  const input = parseOrThrow(approveInputSchema, request.body);
  return {
    ...(input.acknowledgeBlockers === undefined
      ? {}
      : { acknowledgeBlockers: input.acknowledgeBlockers }),
    expectedPeriodVersions: input.expectedPeriodVersions,
    expectedRulesVersion: input.expectedRulesVersion,
    expectedVersion: input.expectedVersion,
    operationId: resolveDangerousOperationId(request.headers['idempotency-key'], input.operationId),
    ...(input.strategy === undefined ? {} : { strategy: input.strategy }),
  };
}

function parseRejectInput(request: FastifyRequest): RejectLeaveRequestInput {
  const input = parseOrThrow(rejectInputSchema, request.body);
  return {
    ...input,
    operationId: resolveDangerousOperationId(request.headers['idempotency-key'], input.operationId),
  };
}

function parseMutationInput(request: FastifyRequest): LeaveRequestMutationInput {
  const input = parseOrThrow(mutationInputSchema, request.body);
  return {
    ...input,
    operationId: resolveDangerousOperationId(request.headers['idempotency-key'], input.operationId),
  };
}

function parseUpdateStrategyInput(value: unknown): UpdateGroupLeaveReflowStrategyInput {
  return parseOrThrow(updateStrategyInputSchema, value);
}

function parseOrThrow<Output>(schema: z.ZodType<Output>, value: unknown): Output {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ApiError({
      code: 'VALIDATION_FAILED',
      statusCode: 400,
      userMessage: '请求数据不符合要求。',
    });
  }

  return result.data;
}
