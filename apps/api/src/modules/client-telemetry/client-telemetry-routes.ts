import { clientTelemetryRequestSchema } from '@schedule/contracts';
import type { FastifyInstance } from 'fastify';

import { createPublicMiniCoreCapabilityGuard } from '../../plugins/client-capability-guard.js';
import { ApiError } from '../../plugins/error-handler.js';
import type { ClientCapabilityPolicy } from '../client-capabilities/client-capability-policy.js';
import { resolveRequiredMiniClientVersion } from '../client-capabilities/client-version-headers.js';
import type { ClientTelemetryService } from './client-telemetry-service.js';

export function registerClientTelemetryRoutes(
  app: FastifyInstance,
  service: ClientTelemetryService,
  policy: ClientCapabilityPolicy,
): void {
  app.post(
    '/client-telemetry',
    {
      bodyLimit: 16 * 1024,
      preHandler: createPublicMiniCoreCapabilityGuard(policy),
    },
    async (request, reply) => {
      const parsed = clientTelemetryRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ApiError({
          code: 'VALIDATION_FAILED',
          statusCode: 400,
          userMessage: '客户端遥测数据不符合要求。',
        });
      }
      await service.ingest(resolveRequiredMiniClientVersion(request, policy), parsed.data);
      return reply.code(204).send();
    },
  );
}
