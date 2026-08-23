import {
  wechatAdminBindingConfirmRequestSchema,
  wechatAdminBindingPreviewRequestSchema,
} from '@schedule/contracts';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { ApiError } from '../../plugins/error-handler.js';
import { ClientCapabilityPolicy } from '../client-capabilities/client-capability-policy.js';
import { resolveMiniClientVersion } from '../client-capabilities/client-version-headers.js';
import type { WechatAdminBindingService } from './wechat-admin-binding-service.js';

const userIdSchema = z.string().uuid();

export function registerWechatAdminBindingRoutes(
  app: FastifyInstance,
  service: WechatAdminBindingService,
  clientCapabilityPolicy: ClientCapabilityPolicy = ClientCapabilityPolicy.disabled(),
): void {
  app.post(
    '/platform-admin/users/:userId/wechat-miniprogram-binding-links',
    { preHandler: app.authenticate },
    async (request) =>
      service.createLink(getAuthenticatedIdentity(request), parseUserId(request), request.id),
  );

  app.post('/auth/wechat/admin-bind/preview', async (request) =>
    service.preview(parsePreviewInput(request.body).ticket),
  );

  app.post('/auth/wechat/admin-bind/confirm', async (request) =>
    service.confirm(
      parseConfirmInput(request.body),
      request.id,
      resolveMiniClientVersion(request, clientCapabilityPolicy),
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

function parsePreviewInput(value: unknown) {
  const result = wechatAdminBindingPreviewRequestSchema.safeParse(value);
  if (!result.success) throw validationError();
  return result.data;
}

function parseConfirmInput(value: unknown) {
  const result = wechatAdminBindingConfirmRequestSchema.safeParse(value);
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
