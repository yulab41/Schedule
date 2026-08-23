import {
  createManualScheduleTemplateRequestSchema,
  updateManualScheduleTemplateRequestSchema,
  type CreateManualScheduleTemplateRequest,
  type UpdateManualScheduleTemplateRequest,
} from '@schedule/contracts';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { ApiError } from '../../plugins/error-handler.js';
import { ManualScheduleTemplateService } from './template-service.js';

const groupIdSchema = z.string().uuid();
const templateIdSchema = z.string().uuid();

export function registerManualScheduleTemplateRoutes(
  app: FastifyInstance,
  templateService: ManualScheduleTemplateService,
): void {
  app.get(
    '/groups/:groupId/manual-schedule-templates',
    { preHandler: app.authenticate },
    (request) => templateService.list(getAuthenticatedIdentity(request), parseGroupId(request)),
  );

  app.post(
    '/groups/:groupId/manual-schedule-templates',
    { preHandler: app.authenticate },
    (request, reply) =>
      templateService
        .create(
          getAuthenticatedIdentity(request),
          parseGroupId(request),
          parseCreateInput(request.body),
        )
        .then((template) => reply.code(201).send(template)),
  );

  app.put(
    '/groups/:groupId/manual-schedule-templates/:templateId',
    { preHandler: app.authenticate },
    (request) =>
      templateService.update(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseTemplateId(request),
        parseUpdateInput(request.body),
      ),
  );

  app.delete(
    '/groups/:groupId/manual-schedule-templates/:templateId',
    { preHandler: app.authenticate },
    (request) =>
      templateService.delete(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseTemplateId(request),
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

function parseTemplateId(request: FastifyRequest): string {
  return parseOrThrow(templateIdSchema, (request.params as { templateId?: unknown }).templateId);
}

function parseCreateInput(value: unknown): CreateManualScheduleTemplateRequest {
  return parseOrThrow(createManualScheduleTemplateRequestSchema, value);
}

function parseUpdateInput(value: unknown): UpdateManualScheduleTemplateRequest {
  return parseOrThrow(updateManualScheduleTemplateRequestSchema, value);
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
