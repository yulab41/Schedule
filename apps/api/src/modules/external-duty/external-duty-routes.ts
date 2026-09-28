import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { ApiError } from '../../plugins/error-handler.js';
import { ExternalDutyService } from './external-duty-service.js';

const mutation = z
  .object({
    date: z.iso.date(),
    expectedFingerprint: z.string().regex(/^[0-9a-f]{64}$/u),
  })
  .strict();
const inbound = mutation
  .extend({
    kind: z.enum(['duty', 'swap']),
    targetAssignmentId: z.string().uuid().optional(),
  })
  .strict();
const undo = z
  .object({ actionId: z.string().uuid(), expectedFingerprint: z.string().regex(/^[0-9a-f]{64}$/u) })
  .strict();

export function registerExternalDutyRoutes(
  app: FastifyInstance,
  service: ExternalDutyService,
): void {
  app.get('/platform/external-duty', { preHandler: app.authenticate }, (request) =>
    service.list(identity(request)),
  );
  app.get('/platform/external-duty/status', { preHandler: app.authenticate }, (request) =>
    service.status(identity(request)),
  );
  app.get('/platform/external-duty/history', { preHandler: app.authenticate }, (request) =>
    service.history(identity(request)),
  );
  app.post('/platform/external-duty/scan', { preHandler: app.authenticate }, async (request) => {
    await service.list(identity(request));
    return service.scan();
  });
  app.post('/platform/external-duty/push', { preHandler: app.authenticate }, (request) => {
    const parsed = mutation.safeParse(request.body);
    if (!parsed.success)
      throw new ApiError({
        code: 'VALIDATION_FAILED',
        statusCode: 400,
        userMessage: '校对请求无效。',
      });
    return service.pushToExternal(
      identity(request),
      parsed.data.date,
      parsed.data.expectedFingerprint,
    );
  });
  app.post('/platform/external-duty/candidates', { preHandler: app.authenticate }, (request) => {
    const input = parse(mutation, request.body);
    return service.inboundCandidates(identity(request), input.date, input.expectedFingerprint);
  });
  app.post('/platform/external-duty/preview', { preHandler: app.authenticate }, (request) => {
    const input = parse(inbound, request.body);
    return service.previewInbound(
      identity(request),
      input.date,
      input.expectedFingerprint,
      input.kind,
      input.targetAssignmentId,
    );
  });
  app.post('/platform/external-duty/apply', { preHandler: app.authenticate }, (request) => {
    const input = parse(inbound, request.body);
    return service.applyInbound(
      identity(request),
      input.date,
      input.expectedFingerprint,
      input.kind,
      input.targetAssignmentId,
    );
  });
  app.post('/platform/external-duty/undo-preview', { preHandler: app.authenticate }, (request) => {
    const input = parse(z.object({ actionId: z.string().uuid() }).strict(), request.body);
    return service.previewUndo(identity(request), input.actionId);
  });
  app.post('/platform/external-duty/undo', { preHandler: app.authenticate }, (request) => {
    const input = parse(undo, request.body);
    return service.undo(identity(request), input.actionId, input.expectedFingerprint);
  });
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    throw new ApiError({
      code: 'VALIDATION_FAILED',
      statusCode: 400,
      userMessage: '校对请求无效。',
    });
  return parsed.data;
}

function identity(request: FastifyRequest): AuthenticatedIdentity {
  if (!request.authenticatedIdentity)
    throw new ApiError({
      code: 'AUTHENTICATION_REQUIRED',
      statusCode: 401,
      userMessage: '请先登录。',
    });
  return request.authenticatedIdentity;
}
