import {
  platformAdminWechatMiniProgramUnbindRequestSchema,
  wechatMiniProgramUnbindRequestSchema,
} from '@schedule/contracts';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { ApiError } from '../../plugins/error-handler.js';
import type { WechatIdentityUnbindService } from './wechat-identity-unbind-service.js';

const userIdSchema = z.string().uuid();
const operationIdSchema = z.string().uuid();

export function registerWechatIdentityUnbindRoutes(
  app: FastifyInstance,
  service: WechatIdentityUnbindService,
): void {
  app.post('/me/wechat/miniprogram/unbind', { preHandler: app.authenticate }, async (request) => {
    return service.unbindSelf(
      getAuthenticatedIdentity(request),
      parseSelfInput(request.body),
      parseOperationId(request),
      request.id,
    );
  });

  app.post(
    '/platform-admin/users/:userId/wechat/miniprogram/unbind',
    { preHandler: app.authenticate },
    async (request) => {
      return service.unbindAsPlatformAdmin(
        getAuthenticatedIdentity(request),
        parseUserId(request),
        parseAdminInput(request.body),
        parseOperationId(request),
        request.id,
      );
    },
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

function parseSelfInput(value: unknown) {
  const result = wechatMiniProgramUnbindRequestSchema.safeParse(value);
  if (!result.success) throw validationError();
  return result.data;
}

function parseAdminInput(value: unknown) {
  const result = platformAdminWechatMiniProgramUnbindRequestSchema.safeParse(value);
  if (!result.success) throw validationError();
  return result.data;
}

function parseOperationId(request: FastifyRequest): string {
  const result = operationIdSchema.safeParse(request.headers['idempotency-key']);
  if (!result.success) throw validationError();
  return result.data;
}

function parseUserId(request: FastifyRequest): string {
  const result = userIdSchema.safeParse((request.params as { userId?: unknown }).userId);
  if (!result.success) throw validationError();
  return result.data;
}

function validationError(): ApiError {
  return new ApiError({
    code: 'VALIDATION_FAILED',
    statusCode: 400,
    userMessage: '请求数据不符合要求。',
  });
}
