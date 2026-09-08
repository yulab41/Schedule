import type {
  PublishSchedulePeriodBatchRequest,
  PublishSchedulePeriodRequest,
  SchedulePeriodMutationRequest,
  UpdateGroupSchedulePublishModeRequest,
} from '@schedule/contracts';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { ApiError } from '../../plugins/error-handler.js';
import { resolveDangerousOperationId } from '../../plugins/operation-id.js';
import { SchedulePublishModeService } from './publish-mode-service.js';
import { SchedulePublishService } from './publish-service.js';

const groupIdSchema = z.string().uuid();
const schedulePeriodIdSchema = z.string().uuid();
const operationIdSchema = z.string().uuid();
const publishModeSchema = z.enum(['draft', 'published']);

const publishPeriodInputSchema = z
  .object({
    acknowledgeBlockers: z.boolean().optional(),
    acknowledgeWorkflowRevocations: z.boolean().optional(),
    expectedVersion: z.number().int().min(1),
    operationId: operationIdSchema.optional(),
    replacePublished: z.boolean().optional(),
  })
  .strict();

const publishBatchInputSchema = z
  .object({
    acknowledgeBlockers: z.boolean().optional(),
    acknowledgeWorkflowRevocations: z.boolean().optional(),
    operationId: operationIdSchema.optional(),
    replacePublished: z.boolean().optional(),
    schedulePeriodIds: z.array(schedulePeriodIdSchema).min(1).max(100),
  })
  .strict();

const updatePublishModeInputSchema = z
  .object({
    publishMode: publishModeSchema,
  })
  .strict();

export function registerScheduleRoutes(
  app: FastifyInstance,
  publishModeService: SchedulePublishModeService,
  publishService: SchedulePublishService,
): void {
  app.get('/groups/:groupId/schedule-periods', { preHandler: app.authenticate }, (request) =>
    publishService.listDrafts(getAuthenticatedIdentity(request), parseGroupId(request)),
  );

  app.get(
    '/groups/:groupId/schedule-periods/history',
    { preHandler: app.authenticate },
    (request) =>
      publishService.listHistory(getAuthenticatedIdentity(request), parseGroupId(request)),
  );

  app.get('/groups/:groupId/schedule-publish-mode', { preHandler: app.authenticate }, (request) =>
    publishModeService.getPublishMode(getAuthenticatedIdentity(request), parseGroupId(request)),
  );

  app.put('/groups/:groupId/schedule-publish-mode', { preHandler: app.authenticate }, (request) =>
    publishModeService.updatePublishMode(
      getAuthenticatedIdentity(request),
      parseGroupId(request),
      parseUpdatePublishModeInput(request.body),
    ),
  );

  app.get(
    '/groups/:groupId/schedules/:schedulePeriodId/change-impact',
    { preHandler: app.authenticate },
    (request) =>
      publishService.previewChangeImpact(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseSchedulePeriodId(request),
        parseChangeImpactAction(request.query),
      ),
  );

  app.post(
    '/groups/:groupId/schedules/:schedulePeriodId/withdraw',
    { preHandler: app.authenticate },
    (request) =>
      publishService.withdrawPeriod(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseSchedulePeriodId(request),
        parsePeriodMutationInput(request),
      ),
  );

  app.get(
    '/groups/:groupId/schedules/:schedulePeriodId/preview',
    { preHandler: app.authenticate },
    (request) =>
      publishService.previewDraft(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseSchedulePeriodId(request),
      ),
  );

  app.post(
    '/groups/:groupId/schedules/:schedulePeriodId/publish',
    { preHandler: app.authenticate },
    (request) =>
      publishService.publishDraft(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseSchedulePeriodId(request),
        parsePublishPeriodInput(request),
      ),
  );

  app.post(
    '/groups/:groupId/schedules/publish-batch',
    { preHandler: app.authenticate },
    (request) =>
      publishService.publishDraftBatch(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parsePublishBatchInput(request),
      ),
  );

  app.delete(
    '/groups/:groupId/schedules/:schedulePeriodId',
    { preHandler: app.authenticate },
    (request) =>
      publishService.deleteDraft(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseSchedulePeriodId(request),
        resolveOperationId(request),
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

function parseSchedulePeriodId(request: FastifyRequest): string {
  return parseOrThrow(
    schedulePeriodIdSchema,
    (request.params as { schedulePeriodId?: unknown }).schedulePeriodId,
  );
}

function parsePublishPeriodInput(request: FastifyRequest): PublishSchedulePeriodRequest {
  const input = parseOrThrow(publishPeriodInputSchema, request.body);
  return {
    ...(input.acknowledgeBlockers === undefined
      ? {}
      : { acknowledgeBlockers: input.acknowledgeBlockers }),
    ...(input.acknowledgeWorkflowRevocations === undefined
      ? {}
      : { acknowledgeWorkflowRevocations: input.acknowledgeWorkflowRevocations }),
    expectedVersion: input.expectedVersion,
    operationId: resolveOperationId(request, input.operationId),
    ...(input.replacePublished === undefined ? {} : { replacePublished: input.replacePublished }),
  };
}

function parsePublishBatchInput(request: FastifyRequest): PublishSchedulePeriodBatchRequest {
  const input = parseOrThrow(publishBatchInputSchema, request.body);
  return {
    ...(input.acknowledgeBlockers === undefined
      ? {}
      : { acknowledgeBlockers: input.acknowledgeBlockers }),
    ...(input.acknowledgeWorkflowRevocations === undefined
      ? {}
      : { acknowledgeWorkflowRevocations: input.acknowledgeWorkflowRevocations }),
    operationId: resolveOperationId(request, input.operationId),
    ...(input.replacePublished === undefined ? {} : { replacePublished: input.replacePublished }),
    schedulePeriodIds: input.schedulePeriodIds,
  };
}

const periodMutationInputSchema = z
  .object({
    acknowledgeWorkflowRevocations: z.boolean().optional(),
    expectedVersion: z.number().int().min(1),
    operationId: operationIdSchema.optional(),
  })
  .strict();

function parsePeriodMutationInput(request: FastifyRequest): SchedulePeriodMutationRequest {
  const input = parseOrThrow(periodMutationInputSchema, request.body);
  return {
    ...(input.acknowledgeWorkflowRevocations === undefined
      ? {}
      : { acknowledgeWorkflowRevocations: input.acknowledgeWorkflowRevocations }),
    expectedVersion: input.expectedVersion,
    operationId: resolveOperationId(request, input.operationId),
  };
}

function resolveOperationId(request: FastifyRequest, bodyOperationId?: string): string {
  return resolveScheduleOperationId(request.headers['idempotency-key'], bodyOperationId);
}

export function resolveScheduleOperationId(
  rawHeader: string | readonly string[] | undefined,
  bodyOperationId?: string,
): string {
  return resolveDangerousOperationId(rawHeader, bodyOperationId);
}

function parseChangeImpactAction(query: unknown): 'publish' | 'withdraw' {
  return parseOrThrow(z.object({ action: z.enum(['publish', 'withdraw']) }).strict(), query).action;
}

function parseUpdatePublishModeInput(value: unknown): UpdateGroupSchedulePublishModeRequest {
  return parseOrThrow(updatePublishModeInputSchema, value);
}

function parseOrThrow<Output>(schema: z.ZodType<Output>, value: unknown): Output {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw validationError('请求数据不符合要求。');
  }

  return result.data;
}

function validationError(userMessage: string): ApiError {
  return new ApiError({ code: 'VALIDATION_FAILED', statusCode: 400, userMessage });
}
