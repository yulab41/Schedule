import type { FastifyInstance, FastifyRequest } from 'fastify';

import type { AuthPort, AuthenticatedIdentity } from '../adapters/auth/auth-port.js';
import { ClientCapabilityPolicy } from '../modules/client-capabilities/client-capability-policy.js';
import { assertClientCapability } from './client-capability-guard.js';
import { ApiError } from './error-handler.js';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate(request: FastifyRequest): Promise<void>;
  }

  interface FastifyRequest {
    authenticatedIdentity: AuthenticatedIdentity | null;
  }
}

export function registerAuthentication(
  app: FastifyInstance,
  authPort: AuthPort,
  clientCapabilityPolicy: ClientCapabilityPolicy = ClientCapabilityPolicy.disabled(),
): void {
  app.decorateRequest('authenticatedIdentity', null);
  app.decorate('authenticate', async (request: FastifyRequest) => {
    const identity = await authPort.authenticate({
      authorization: request.headers.authorization,
    });

    if (identity === undefined) {
      throw new ApiError({
        code: 'AUTHENTICATION_REQUIRED',
        statusCode: 401,
        userMessage: '需要先登录后才能继续。',
      });
    }

    request.authenticatedIdentity = identity;
    assertClientCapability(request, identity, clientCapabilityPolicy);
  });
}
