import { createHash } from 'node:crypto';

import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { ApiError } from '../../plugins/error-handler.js';
import { CalendarQuery } from './calendar-query.js';

const groupIdSchema = z.string().uuid();
const calendarQuerySchema = z
  .object({
    businessMonth: z.string().regex(/^\d{4}-\d{2}$/),
  })
  .strict();
const schedulePeriodIdSchema = z.string().uuid();
const guestCalendarInputSchema = z
  .object({
    businessMonth: z.string().regex(/^\d{4}-\d{2}$/),
    groupCode: z.string().regex(/^\d{4}$/),
  })
  .strict();

export function registerCalendarRoutes(app: FastifyInstance, calendarQuery: CalendarQuery): void {
  app.get('/groups/:groupId/calendar', { preHandler: app.authenticate }, (request) =>
    calendarQuery.readMonth(
      getAuthenticatedIdentity(request),
      parseGroupId(request),
      parseBusinessMonth(request.query),
    ),
  );

  app.get(
    '/groups/:groupId/calendar/periods/:schedulePeriodId',
    { preHandler: app.authenticate },
    (request) =>
      calendarQuery.readPeriod(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseSchedulePeriodId(request),
      ),
  );

  app.get('/guest/groups', () => calendarQuery.listGuestGroups());

  app.get('/guest/groups/:groupId/calendar', (request) =>
    calendarQuery.readGuestMonthByGroupId(parseGroupId(request), parseBusinessMonth(request.query)),
  );

  app.post('/guest/calendar', (request) => {
    const input = parseOrThrow(guestCalendarInputSchema, request.body);
    return calendarQuery.readGuestMonth(
      createGuestAccessKey(request),
      input.groupCode,
      input.businessMonth,
    );
  });
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

function parseBusinessMonth(query: unknown): string {
  return parseOrThrow(calendarQuerySchema, query).businessMonth;
}

function parseSchedulePeriodId(request: FastifyRequest): string {
  return parseOrThrow(
    schedulePeriodIdSchema,
    (request.params as { schedulePeriodId?: unknown }).schedulePeriodId,
  );
}

function createGuestAccessKey(request: FastifyRequest): string {
  return createHash('sha256')
    .update(`${request.ip}|${request.headers['user-agent'] ?? ''}`)
    .digest('hex');
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
