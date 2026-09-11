import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ApiError } from '../../plugins/error-handler.js';
import { resolveDangerousOperationId } from '../../plugins/operation-id.js';
import type { WechatDiagnosticsService } from './wechat-diagnostics-service.js';

const groupInput = z.object({ groupId: z.string().uuid() }).strict();
const sendInput = groupInput.extend({
  issuedAt: z.number().int().nonnegative(),
  targetVersion: z.enum(['trial', 'formal']).optional(),
});
export function registerWechatDiagnosticsRoutes(
  app: FastifyInstance,
  service: WechatDiagnosticsService,
): void {
  app.get('/notifications/wechat-subscription-config', { preHandler: app.authenticate }, () =>
    service.configuration(),
  );
  app.get('/me/wechat-notification-diagnostics', { preHandler: app.authenticate }, (request) =>
    service.inspect(identity(request), parseGroup(request.query)),
  );
  app.post('/me/wechat-notification-test', { preHandler: app.authenticate }, (request) => {
    const result = sendInput.safeParse(request.body);
    if (!result.success)
      throw new ApiError({
        code: 'VALIDATION_FAILED',
        statusCode: 400,
        userMessage: '请求数据不符合要求。',
      });
    return service.sendTest(
      identity(request),
      result.data.groupId,
      resolveDangerousOperationId(request.headers['idempotency-key']),
      result.data.issuedAt,
      result.data.targetVersion,
    );
  });
}
function identity(request: FastifyRequest) {
  if (!request.authenticatedIdentity)
    throw new ApiError({
      code: 'AUTHENTICATION_REQUIRED',
      statusCode: 401,
      userMessage: '请先登录。',
    });
  return request.authenticatedIdentity;
}
function parseGroup(value: unknown): string {
  const result = groupInput.safeParse(value);
  if (!result.success)
    throw new ApiError({
      code: 'VALIDATION_FAILED',
      statusCode: 400,
      userMessage: '请求数据不符合要求。',
    });
  return result.data.groupId;
}
