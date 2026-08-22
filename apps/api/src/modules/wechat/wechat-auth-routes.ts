import {
  wechatLinkPasswordRequestSchema,
  wechatLoginRequestSchema,
  wechatRegisterRequestSchema,
} from '@schedule/contracts';
import type { FastifyInstance } from 'fastify';

import { ApiError } from '../../plugins/error-handler.js';
import type { WechatAuthService } from './wechat-auth-service.js';

export function registerWechatAuthRoutes(
  app: FastifyInstance,
  wechatAuthService: WechatAuthService,
): void {
  app.post('/auth/wechat/login', async (request, reply) => {
    const input = parseWechatLoginRequest(request.body);
    return reply.code(200).send(await wechatAuthService.login(input.code));
  });

  app.post('/auth/wechat/link-password', async (request, reply) => {
    const input = parseWechatLinkPasswordRequest(request.body);
    return reply.code(200).send(await wechatAuthService.linkPassword(input, request.id));
  });

  app.post('/auth/wechat/register', async (request, reply) => {
    const input = parseWechatRegisterRequest(request.body);
    return reply.code(201).send(await wechatAuthService.register(input, request.id));
  });
}

function parseWechatLinkPasswordRequest(value: unknown) {
  const result = wechatLinkPasswordRequestSchema.safeParse(value);
  if (!result.success) throw invalidRequestError();
  return result.data;
}

function parseWechatLoginRequest(value: unknown): { readonly code: string } {
  const result = wechatLoginRequestSchema.safeParse(value);

  if (!result.success) {
    throw invalidRequestError();
  }

  return result.data;
}

function parseWechatRegisterRequest(value: unknown) {
  const result = wechatRegisterRequestSchema.safeParse(value);
  if (!result.success) throw invalidRequestError();
  return result.data;
}

function invalidRequestError(): ApiError {
  return new ApiError({
    code: 'VALIDATION_FAILED',
    statusCode: 400,
    userMessage: '请求数据不符合要求。',
  });
}
