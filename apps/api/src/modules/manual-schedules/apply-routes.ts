import {
  applyManualScheduleTemplateRequestSchema,
  previewManualTemplateApplyRequestSchema,
  type ApplyManualScheduleTemplateRequest,
  type PreviewManualTemplateApplyRequest,
} from '@schedule/contracts';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { ApiError } from '../../plugins/error-handler.js';
import { ManualScheduleApplyService } from './apply-service.js';

const groupIdSchema = z.string().uuid();
const templateIdSchema = z.string().uuid();

export function registerManualScheduleApplyRoutes(
  app: FastifyInstance,
  applyService: ManualScheduleApplyService,
): void {
  app.post(
    '/groups/:groupId/manual-schedule-templates/:templateId/apply-preview',
    { preHandler: app.authenticate },
    (request) =>
      applyService.preview(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseTemplateId(request),
        parsePreviewInput(request.body),
      ),
  );

  app.post(
    '/groups/:groupId/manual-schedule-templates/:templateId/apply',
    { preHandler: app.authenticate },
    (request) =>
      applyService.apply(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseTemplateId(request),
        parseApplyInput(request.body),
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

function parsePreviewInput(value: unknown): PreviewManualTemplateApplyRequest {
  const input = parseOrThrow(previewManualTemplateApplyRequestSchema, value);
  return {
    expectedRulesVersion: input.expectedRulesVersion,
    ...(input.endDate === undefined ? {} : { endDate: input.endDate }),
    ...(input.startDate === undefined ? {} : { startDate: input.startDate }),
  };
}

function parseApplyInput(value: unknown): ApplyManualScheduleTemplateRequest {
  const input = parseOrThrow(applyManualScheduleTemplateRequestSchema, value);
  return {
    ...(input.acknowledgeBlockers === undefined
      ? {}
      : { acknowledgeBlockers: input.acknowledgeBlockers }),
    ...(input.acknowledgeWorkflowRevocations === undefined
      ? {}
      : { acknowledgeWorkflowRevocations: input.acknowledgeWorkflowRevocations }),
    ...(input.endDate === undefined ? {} : { endDate: input.endDate }),
    expectedRulesVersion: input.expectedRulesVersion,
    operationId: input.operationId,
    ...(input.publishMode === undefined ? {} : { publishMode: input.publishMode }),
    ...(input.replacePublished === undefined ? {} : { replacePublished: input.replacePublished }),
    ...(input.replaceExistingDrafts === undefined
      ? {}
      : { replaceExistingDrafts: input.replaceExistingDrafts }),
    ...(input.startDate === undefined ? {} : { startDate: input.startDate }),
  };
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
