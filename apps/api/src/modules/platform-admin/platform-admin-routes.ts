import type { UpdatePlatformUserStatusInput } from '@schedule/contracts';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { ApiError } from '../../plugins/error-handler.js';
import { PlatformAdminService } from './platform-admin-service.js';

const userIdSchema = z.string().uuid();
const groupIdSchema = z.string().uuid();
const userStatusInputSchema = z
  .object({
    status: z.enum(['active', 'suspended']),
  })
  .strict();

export function registerPlatformAdminRoutes(
  app: FastifyInstance,
  platformAdminService: PlatformAdminService,
): void {
  app.get('/platform/me', { preHandler: app.authenticate }, async (request) =>
    platformAdminService.me(getAuthenticatedIdentity(request)),
  );

  app.get('/platform/jobs', { preHandler: app.authenticate }, async (request) =>
    platformAdminService.listJobRuns(getAuthenticatedIdentity(request)),
  );

  app.get('/platform/backups', { preHandler: app.authenticate }, async (request) =>
    platformAdminService.listBackups(getAuthenticatedIdentity(request)),
  );

  app.post(
    '/platform/groups/:groupId/restore',
    { preHandler: app.authenticate },
    async (request) => {
      await platformAdminService.restoreGroup(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
      );
      return { restored: true };
    },
  );

  app.put('/platform/users/:userId/status', { preHandler: app.authenticate }, async (request) =>
    platformAdminService.setUserStatus(
      getAuthenticatedIdentity(request),
      parseUserId(request),
      parseUserStatusInput(request.body),
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
  const result = groupIdSchema.safeParse((request.params as { groupId?: unknown }).groupId);
  if (!result.success) {
    throwValidationError();
  }

  return result.data;
}

function parseUserId(request: FastifyRequest): string {
  const result = userIdSchema.safeParse((request.params as { userId?: unknown }).userId);
  if (!result.success) {
    throwValidationError();
  }

  return result.data;
}

function parseUserStatusInput(value: unknown): UpdatePlatformUserStatusInput {
  const result = userStatusInputSchema.safeParse(value);
  if (!result.success) {
    throwValidationError();
  }

  return result.data;
}

function throwValidationError(): never {
  throw new ApiError({
    code: 'VALIDATION_FAILED',
    statusCode: 400,
    userMessage: '请求数据不符合要求。',
  });
}
