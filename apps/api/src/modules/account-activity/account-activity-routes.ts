import { accountOpenRequestSchema } from '@schedule/contracts';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ApiError } from '../../plugins/error-handler.js';
import type { AccountActivityService } from './account-activity-service.js';
export function registerAccountActivityRoutes(
  app: FastifyInstance,
  service: Pick<AccountActivityService, 'summary' | 'recordOpen'>,
): void {
  app.get(
    '/platform-admin/users/:userId/activity',
    { preHandler: app.authenticate },
    async (request, reply) => {
      reply.header('Cache-Control', 'no-store');
      const parsed = z
        .string()
        .uuid()
        .safeParse((request.params as { userId?: unknown }).userId);
      if (!parsed.success) throw invalidRequest();
      if (request.authenticatedIdentity === null) throw invalidRequest();
      try {
        return await service.summary(request.authenticatedIdentity, parsed.data);
      } catch (error) {
        if (error instanceof ApiError) throw error;
        request.log.warn(
          { code: 'ACCOUNT_ACTIVITY_SUMMARY_FAILED' },
          'Account statistics unavailable',
        );
        throw statisticsUnavailable();
      }
    },
  );
  app.post('/me/activity/opens', { preHandler: app.authenticate }, async (request) => {
    const parsed = accountOpenRequestSchema.safeParse(request.body);
    if (!parsed.success) throw invalidRequest();
    if (request.authenticatedIdentity === null) throw invalidRequest();
    try {
      return await service.recordOpen(request.authenticatedIdentity, parsed.data);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      request.log.warn({ code: 'ACCOUNT_ACTIVITY_OPEN_FAILED' }, 'Account statistics unavailable');
      throw statisticsUnavailable();
    }
  });
}
function statisticsUnavailable(): ApiError {
  return new ApiError({
    code: 'INTERNAL_ERROR',
    statusCode: 503,
    userMessage: '统计暂时不可用，请稍后重试。',
  });
}
function invalidRequest(): ApiError {
  return new ApiError({
    code: 'VALIDATION_FAILED',
    statusCode: 400,
    userMessage: '请求数据不符合要求。',
  });
}
