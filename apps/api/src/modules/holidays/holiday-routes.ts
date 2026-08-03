import type { HolidayImportInput } from '@schedule/contracts';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { ApiError } from '../../plugins/error-handler.js';
import { HolidayService } from './holiday-service.js';

const yearSchema = z.coerce.number().int().min(1900).max(2100);
const calendarVersionIdSchema = z.string().uuid();

const holidayDateInputSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
    holidayName: z.string().trim().min(1).max(100),
    isOffDay: z.boolean(),
    isWorkday: z.boolean(),
  })
  .strict()
  .refine((entry) => entry.isOffDay !== entry.isWorkday, {
    message: '必须且只能标记为放假或调休工作日之一。',
  });

const holidayImportInputSchema = z
  .object({
    dates: z.array(holidayDateInputSchema).min(1).max(400),
    year: z.number().int().min(1900).max(2100),
  })
  .strict();

export function registerHolidayRoutes(app: FastifyInstance, holidayService: HolidayService): void {
  app.get('/holidays', { preHandler: app.authenticate }, (request) =>
    holidayService.getConfirmed(getAuthenticatedIdentity(request), parseYearQuery(request)),
  );

  app.get('/guest/holidays', (request) =>
    holidayService.getConfirmedPublic(parseYearQuery(request)),
  );

  app.post('/holidays/import-preview', { preHandler: app.authenticate }, (request) =>
    holidayService.previewImport(getAuthenticatedIdentity(request), parseImportInput(request.body)),
  );

  app.post('/holidays/import', { preHandler: app.authenticate }, (request, reply) =>
    holidayService
      .importCalendar(getAuthenticatedIdentity(request), parseImportInput(request.body))
      .then((result) => reply.code(201).send(result)),
  );

  app.get('/holidays/versions', { preHandler: app.authenticate }, (request) =>
    holidayService.listVersions(getAuthenticatedIdentity(request), parseOptionalYearQuery(request)),
  );

  app.post(
    '/holidays/versions/:calendarVersionId/confirm',
    { preHandler: app.authenticate },
    (request) =>
      holidayService.confirmVersion(
        getAuthenticatedIdentity(request),
        parseCalendarVersionId(request),
      ),
  );

  app.get('/holidays/coverage', { preHandler: app.authenticate }, (request) =>
    holidayService.getCoverage(getAuthenticatedIdentity(request)),
  );
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

function parseImportInput(value: unknown): HolidayImportInput {
  const result = holidayImportInputSchema.safeParse(value);
  if (!result.success) {
    throw new ApiError({
      code: 'VALIDATION_FAILED',
      statusCode: 400,
      userMessage: '请求数据不符合要求。',
    });
  }

  return result.data;
}

function parseYearQuery(request: FastifyRequest): number {
  const result = yearSchema.safeParse((request.query as { year?: unknown }).year);
  if (!result.success) {
    throw new ApiError({
      code: 'VALIDATION_FAILED',
      statusCode: 400,
      userMessage: '年份参数无效。',
    });
  }
  return result.data;
}

function parseOptionalYearQuery(request: FastifyRequest): number | undefined {
  const raw = (request.query as { year?: unknown }).year;
  if (raw === undefined) {
    return undefined;
  }
  return parseYearQuery(request);
}

function parseCalendarVersionId(request: FastifyRequest): string {
  const result = calendarVersionIdSchema.safeParse(
    (request.params as { calendarVersionId?: unknown }).calendarVersionId,
  );
  if (!result.success) {
    throw new ApiError({
      code: 'VALIDATION_FAILED',
      statusCode: 400,
      userMessage: '节假日版本标识无效。',
    });
  }
  return result.data;
}
