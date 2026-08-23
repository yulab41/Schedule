import { clientCapabilityQuerySchema } from '@schedule/contracts';
import type { FastifyInstance } from 'fastify';

import { ApiError } from '../../plugins/error-handler.js';
import type { ClientCapabilityPolicy } from './client-capability-policy.js';
import { unsupportedClientVersionError } from './client-version-headers.js';

export function registerClientCapabilityRoutes(
  app: FastifyInstance,
  policy: ClientCapabilityPolicy,
): void {
  app.get('/client-capabilities', async (request, reply) => {
    reply.header('cache-control', 'no-store');
    const result = clientCapabilityQuerySchema.safeParse(request.query);
    if (!result.success) {
      throw new ApiError({
        code: 'VALIDATION_FAILED',
        statusCode: 400,
        userMessage: '客户端能力查询参数不符合要求。',
      });
    }
    const capabilities = policy.resolve(result.data.platform, result.data.version);
    if (capabilities === undefined) {
      throw unsupportedClientVersionError();
    }
    return capabilities;
  });
}
