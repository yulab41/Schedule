import {
  wechatWebLoginExchangeRequestSchema,
  wechatWebLoginStartQuerySchema,
} from '@schedule/contracts';
import type { FastifyInstance } from 'fastify';

import { ApiError } from '../../plugins/error-handler.js';
import type { WechatWebAuthService } from './wechat-web-auth-service.js';

export function registerWechatWebAuthRoutes(
  app: FastifyInstance,
  service: WechatWebAuthService,
): void {
  app.get('/auth/wechat/web/start', async (request, reply) => {
    const input = wechatWebLoginStartQuerySchema.safeParse(request.query);
    if (!input.success) {
      throw new ApiError({
        code: 'VALIDATION_FAILED',
        statusCode: 400,
        userMessage: '请求数据不符合要求。',
      });
    }
    return reply.code(200).send(service.start(input.data.state));
  });

  app.post('/auth/wechat/web/exchange', async (request, reply) => {
    const input = wechatWebLoginExchangeRequestSchema.safeParse(request.body);
    if (!input.success) {
      throw new ApiError({
        code: 'VALIDATION_FAILED',
        statusCode: 400,
        userMessage: '请求数据不符合要求。',
      });
    }
    return reply.code(200).send(await service.exchange(input.data.code, input.data.state));
  });
}
