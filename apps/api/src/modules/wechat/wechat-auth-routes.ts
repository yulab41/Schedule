import { wechatLoginRequestSchema } from '@schedule/contracts';
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
}

function parseWechatLoginRequest(value: unknown): { readonly code: string } {
  const result = wechatLoginRequestSchema.safeParse(value);

  if (!result.success) {
    throw new ApiError({
      code: 'VALIDATION_FAILED',
      statusCode: 400,
      userMessage: '请求数据不符合要求。',
    });
  }

  return result.data;
}
