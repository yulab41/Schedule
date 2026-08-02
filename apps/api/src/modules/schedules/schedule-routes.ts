import type {
  GenerateSchedulePreviewRequest,
  PublishSchedulePeriodRequest,
  SaveGeneratedScheduleRequest,
  UpdateGroupSchedulePublishModeRequest,
} from '@schedule/contracts';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { ApiError } from '../../plugins/error-handler.js';
import { ScheduleGenerateService } from './generate-service.js';
import { SchedulePublishService } from './publish-service.js';

const groupIdSchema = z.string().uuid();
const schedulePeriodIdSchema = z.string().uuid();
const operationIdSchema = z.string().uuid();
const businessMonthSchema = z.string().regex(/^\d{4}-\d{2}$/);
const rulesVersionSchema = z.number().int().min(1);
const scheduleRoleIdsSchema = z.array(z.string().uuid()).min(1).max(50);
const publishModeSchema = z.enum(['draft', 'published']);

const generatePreviewInputSchema = z
  .object({
    businessMonth: businessMonthSchema,
    publishMode: publishModeSchema.optional(),
    rulesVersion: rulesVersionSchema,
    scheduleRoleIds: scheduleRoleIdsSchema,
  })
  .strict();

const saveGeneratedInputSchema = z
  .object({
    acknowledgeBlockers: z.boolean().optional(),
    businessMonth: businessMonthSchema,
    operationId: operationIdSchema,
    publishMode: publishModeSchema.optional(),
    rulesVersion: rulesVersionSchema,
    scheduleRoleIds: scheduleRoleIdsSchema,
  })
  .strict();

const publishPeriodInputSchema = z
  .object({
    acknowledgeBlockers: z.boolean().optional(),
    expectedVersion: z.number().int().min(1),
    operationId: operationIdSchema,
  })
  .strict();

const updatePublishModeInputSchema = z
  .object({
    publishMode: publishModeSchema,
  })
  .strict();

export function registerScheduleRoutes(
  app: FastifyInstance,
  generateService: ScheduleGenerateService,
  publishService: SchedulePublishService,
): void {
  app.get('/groups/:groupId/schedule-periods', { preHandler: app.authenticate }, (request) =>
    publishService.listDrafts(getAuthenticatedIdentity(request), parseGroupId(request)),
  );

  app.get('/groups/:groupId/schedule-publish-mode', { preHandler: app.authenticate }, (request) =>
    generateService.getPublishMode(getAuthenticatedIdentity(request), parseGroupId(request)),
  );

  app.put('/groups/:groupId/schedule-publish-mode', { preHandler: app.authenticate }, (request) =>
    generateService.updatePublishMode(
      getAuthenticatedIdentity(request),
      parseGroupId(request),
      parseUpdatePublishModeInput(request.body),
    ),
  );

  app.post(
    '/groups/:groupId/schedules/generate-preview',
    { preHandler: app.authenticate },
    (request) =>
      generateService.preview(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseGeneratePreviewInput(request.body),
      ),
  );

  app.post('/groups/:groupId/schedules/generate', { preHandler: app.authenticate }, (request) =>
    generateService.save(
      getAuthenticatedIdentity(request),
      parseGroupId(request),
      parseSaveGeneratedInput(request.body),
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
        parsePublishPeriodInput(request.body),
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

function parseGeneratePreviewInput(value: unknown): GenerateSchedulePreviewRequest {
  const input = parseOrThrow(generatePreviewInputSchema, value);
  return {
    businessMonth: input.businessMonth,
    rulesVersion: input.rulesVersion,
    scheduleRoleIds: input.scheduleRoleIds,
    ...(input.publishMode === undefined ? {} : { publishMode: input.publishMode }),
  };
}

function parseSaveGeneratedInput(value: unknown): SaveGeneratedScheduleRequest {
  const input = parseOrThrow(saveGeneratedInputSchema, value);
  return {
    ...(input.acknowledgeBlockers === undefined
      ? {}
      : { acknowledgeBlockers: input.acknowledgeBlockers }),
    businessMonth: input.businessMonth,
    operationId: input.operationId,
    ...(input.publishMode === undefined ? {} : { publishMode: input.publishMode }),
    rulesVersion: input.rulesVersion,
    scheduleRoleIds: input.scheduleRoleIds,
  };
}

function parsePublishPeriodInput(value: unknown): PublishSchedulePeriodRequest {
  const input = parseOrThrow(publishPeriodInputSchema, value);
  return {
    ...(input.acknowledgeBlockers === undefined
      ? {}
      : { acknowledgeBlockers: input.acknowledgeBlockers }),
    expectedVersion: input.expectedVersion,
    operationId: input.operationId,
  };
}

function parseUpdatePublishModeInput(value: unknown): UpdateGroupSchedulePublishModeRequest {
  return parseOrThrow(updatePublishModeInputSchema, value);
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
