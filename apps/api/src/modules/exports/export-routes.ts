import type { CreateScheduleExportInput } from '@schedule/contracts';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { ApiError } from '../../plugins/error-handler.js';
import { ExportService } from './export-service.js';

const groupIdSchema = z.string().uuid();
const exportJobIdSchema = z.string().uuid();
const uuidSchema = z.string().uuid();
const periodSchema = z.string().regex(/^(19|20)\d{2}(-(0[1-9]|1[0-2]))?$/u);

const createExportSchema = z
  .object({
    exportType: z.enum(['schedule', 'statistics']),
    membershipId: uuidSchema.optional(),
    period: periodSchema,
    roleId: uuidSchema.optional(),
  })
  .strict();

export function registerExportRoutes(app: FastifyInstance, exportService: ExportService): void {
  app.post('/groups/:groupId/exports', { preHandler: app.authenticate }, (request, reply) =>
    exportService
      .create(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseCreateExportInput(request.body),
      )
      .then((job) => reply.code(201).send(job)),
  );

  app.get('/groups/:groupId/exports/:exportJobId', { preHandler: app.authenticate }, (request) =>
    exportService.getJob(
      getAuthenticatedIdentity(request),
      parseGroupId(request),
      parseExportJobId(request),
    ),
  );

  app.get(
    '/groups/:groupId/exports/:exportJobId/download',
    { preHandler: app.authenticate },
    (request, reply) =>
      exportService
        .download(
          getAuthenticatedIdentity(request),
          parseGroupId(request),
          parseExportJobId(request),
        )
        .then((result) => sendCsv(reply, result.fileName, result.content)),
  );
}

function sendCsv(reply: FastifyReply, fileName: string, content: string): FastifyReply {
  return reply
    .header('Content-Type', 'text/csv; charset=utf-8')
    .header('Content-Disposition', `attachment; filename="${fileName.replaceAll('"', '')}"`)
    .send(content);
}

function getAuthenticatedIdentity(request: FastifyRequest) {
  if (request.authenticatedIdentity === null) {
    throw new ApiError({
      code: 'AUTHENTICATION_REQUIRED',
      statusCode: 401,
      userMessage: '需要先登录后才能继续。',
    });
  }
  return request.authenticatedIdentity;
}

function parseGroupId(request: FastifyRequest): string {
  return parseOrThrow(groupIdSchema, (request.params as { groupId?: unknown }).groupId);
}

function parseExportJobId(request: FastifyRequest): string {
  return parseOrThrow(exportJobIdSchema, (request.params as { exportJobId?: unknown }).exportJobId);
}

function parseCreateExportInput(value: unknown): CreateScheduleExportInput {
  const parsed = parseOrThrow(createExportSchema, value);
  return {
    ...(parsed.membershipId === undefined ? {} : { membershipId: parsed.membershipId }),
    exportType: parsed.exportType,
    period: parsed.period,
    ...(parsed.roleId === undefined ? {} : { roleId: parsed.roleId }),
  };
}

function parseOrThrow<Output>(schema: z.ZodType<Output>, value: unknown): Output {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ApiError({
      code: 'VALIDATION_FAILED',
      statusCode: 400,
      userMessage: '请求数据不符合要求。',
    });
  }
  return result.data;
}
