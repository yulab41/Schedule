import {
  pastScheduleBackfillBatchRequestSchema,
  type CreatePastScheduleAssignmentInput,
  type PastScheduleBackfillBatchRequest,
  type UpdatePastScheduleAssignmentInput,
} from '@schedule/contracts';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { ApiError } from '../../plugins/error-handler.js';
import { resolveDangerousOperationId } from '../../plugins/operation-id.js';
import { PastScheduleService } from './past-schedule-service.js';

const uuidSchema = z.string().uuid();
const businessDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const updateAssignmentInputSchema = z
  .object({
    actualMembershipId: uuidSchema.optional(),
    reason: z.string().trim().min(1).max(1000).optional(),
    shiftTypeId: uuidSchema.optional(),
  })
  .strict()
  .refine(
    (value) => value.actualMembershipId !== undefined || value.shiftTypeId !== undefined,
    '至少选择一项修改内容（值班成员或班种）。',
  );
const createAssignmentInputSchema = z
  .object({
    actualMembershipId: uuidSchema,
    businessDate: businessDateSchema,
    reason: z.string().trim().min(1).max(1000).optional(),
    scheduleRoleId: uuidSchema,
    shiftTypeId: uuidSchema,
  })
  .strict();

export function registerPastScheduleRoutes(
  app: FastifyInstance,
  service: PastScheduleService,
): void {
  app.get('/groups/:groupId/past-schedules', { preHandler: app.authenticate }, (request) =>
    service.listPeriods(getAuthenticatedIdentity(request), parseGroupId(request)),
  );

  app.get(
    '/groups/:groupId/past-schedules/:schedulePeriodId/assignments',
    { preHandler: app.authenticate },
    (request) =>
      service.listAssignments(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseSchedulePeriodId(request),
      ),
  );

  app.get(
    '/groups/:groupId/past-schedules/backfill-records',
    { preHandler: app.authenticate },
    (request) =>
      service.listBackfillRecords(getAuthenticatedIdentity(request), parseGroupId(request)),
  );

  app.post(
    '/groups/:groupId/past-schedules/backfill-batches',
    { preHandler: app.authenticate },
    (request) => {
      const input = parseBackfillBatchInput(request.body);
      return service.backfillBatch(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        input,
        resolveDangerousOperationId(request.headers['idempotency-key'], input.operationId),
      );
    },
  );

  app.post(
    '/groups/:groupId/past-schedules/assignments',
    { preHandler: app.authenticate },
    (request) =>
      service.createAssignment(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseCreateAssignmentInput(request.body),
      ),
  );

  app.put(
    '/groups/:groupId/past-schedules/:schedulePeriodId/assignments/:assignmentId',
    { preHandler: app.authenticate },
    (request) =>
      service.updateAssignment(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseSchedulePeriodId(request),
        parseAssignmentId(request),
        parseUpdateAssignmentInput(request.body),
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
  return parseOrThrow(uuidSchema, (request.params as { groupId?: unknown }).groupId);
}

function parseSchedulePeriodId(request: FastifyRequest): string {
  return parseOrThrow(
    uuidSchema,
    (request.params as { schedulePeriodId?: unknown }).schedulePeriodId,
  );
}

function parseAssignmentId(request: FastifyRequest): string {
  return parseOrThrow(uuidSchema, (request.params as { assignmentId?: unknown }).assignmentId);
}

function parseUpdateAssignmentInput(value: unknown): UpdatePastScheduleAssignmentInput {
  const input = parseOrThrow(updateAssignmentInputSchema, value);
  return {
    ...(input.actualMembershipId === undefined
      ? {}
      : { actualMembershipId: input.actualMembershipId }),
    ...(input.reason === undefined ? {} : { reason: input.reason }),
    ...(input.shiftTypeId === undefined ? {} : { shiftTypeId: input.shiftTypeId }),
  };
}

function parseCreateAssignmentInput(value: unknown): CreatePastScheduleAssignmentInput {
  const input = parseOrThrow(createAssignmentInputSchema, value);
  return {
    actualMembershipId: input.actualMembershipId,
    businessDate: input.businessDate,
    ...(input.reason === undefined ? {} : { reason: input.reason }),
    scheduleRoleId: input.scheduleRoleId,
    shiftTypeId: input.shiftTypeId,
  };
}

function parseBackfillBatchInput(value: unknown): PastScheduleBackfillBatchRequest {
  return parseOrThrow(pastScheduleBackfillBatchRequestSchema, value);
}

function parseOrThrow<Output>(schema: z.ZodType<Output>, value: unknown): Output {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ApiError({
      code: 'VALIDATION_FAILED',
      statusCode: 400,
      userMessage: result.error.issues[0]?.message ?? '请求数据不符合要求。',
    });
  }

  return result.data;
}
