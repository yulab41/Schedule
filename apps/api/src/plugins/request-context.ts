import type { FastifyInstance } from 'fastify';

export const requestIdHeader = 'x-request-id';

export function registerRequestContext(app: FastifyInstance): void {
  app.addHook('onRequest', (request, reply, done) => {
    reply.header(requestIdHeader, request.id);
    done();
  });
}
