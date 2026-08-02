import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { ApiError } from '../../plugins/error-handler.js';
import { StatisticsService } from './statistics-service.js';

const groupIdSchema = z.string().uuid();
const businessMonthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/u)
  .transform((value) => `${value}-01`);
const yearSchema = z.coerce.number().int().min(2000).max(2100);

export function registerStatisticsRoutes(
  app: FastifyInstance,
  statisticsService: StatisticsService,
): void {
  app.get('/groups/:groupId/statistics', { preHandler: app.authenticate }, (request) =>
    statisticsService.getMonth(
      getAuthenticatedIdentity(request),
      parseGroupId(request),
      parseBusinessMonthQuery(request),
    ),
  );

  app.get('/groups/:groupId/statistics/year', { preHandler: app.authenticate }, (request) =>
    statisticsService.getYear(
      getAuthenticatedIdentity(request),
      parseGroupId(request),
      parseYearQuery(request),
    ),
  );

  app.post('/groups/:groupId/statistics/refresh', { preHandler: app.authenticate }, (request) =>
    statisticsService.refresh(
      getAuthenticatedIdentity(request),
      parseGroupId(request),
      parseBusinessMonthBody(request),
    ),
  );

  app.post(
    '/groups/:groupId/statistics/recalculate-check',
    { preHandler: app.authenticate },
    (request) =>
      statisticsService.recalculateCheck(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseBusinessMonthBody(request),
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

function parseBusinessMonthQuery(request: FastifyRequest): string {
  return parseOrThrow(
    businessMonthSchema,
    (request.query as { businessMonth?: unknown }).businessMonth,
  );
}

function parseYearQuery(request: FastifyRequest): number {
  return parseOrThrow(yearSchema, (request.query as { year?: unknown }).year);
}

function parseBusinessMonthBody(request: FastifyRequest): string {
  return parseOrThrow(
    businessMonthSchema,
    (request.body as { businessMonth?: unknown }).businessMonth,
  );
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
