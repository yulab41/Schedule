import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { schedulePublicationEndpoints } from '../../../../../packages/client-core/src/schedule-publication-client.js';
import { resolveDangerousOperationId } from '../../plugins/operation-id.js';

describe('native JSON DELETE wire compatibility', () => {
  it('accepts the endpoint body and header, where an empty JSON body is rejected before the route', async () => {
    const app = Fastify();
    const received: string[] = [];
    app.delete('/groups/:groupId/schedules/:id', async (request, reply) => {
      received.push(resolveDangerousOperationId(request.headers['idempotency-key']));
      return reply.code(204).send();
    });
    const input = {
      groupId: 'group',
      schedulePeriodId: 'period',
      operationId: '11111111-1111-4111-8111-111111111111',
    };
    const endpoint = schedulePublicationEndpoints.deleteDraft;
    try {
      const headers = {
        'content-type': 'application/json',
        'idempotency-key': endpoint.idempotencyKey!(input)!,
      };
      expect(
        (await app.inject({ method: 'DELETE', url: endpoint.path(input), headers })).statusCode,
      ).toBe(400);
      expect(received).toEqual([]);
      const response = await app.inject({
        method: 'DELETE',
        url: endpoint.path(input),
        headers,
        payload: JSON.stringify(endpoint.body!(input)),
      });
      expect(response.statusCode).toBe(204);
      expect(received).toEqual([input.operationId]);
      expect(endpoint.decoder.safeDecode(response.body).success).toBe(true);
    } finally {
      await app.close();
    }
  });
});
