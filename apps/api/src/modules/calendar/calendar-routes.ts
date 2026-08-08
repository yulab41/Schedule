import { visitorResolveRequestSchema } from '@schedule/contracts';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { ApiError } from '../../plugins/error-handler.js';
import { CalendarQuery } from './calendar-query.js';
import type { VisitorAccessLogService } from './visitor-access-log.js';

const groupIdSchema = z.string().uuid();
const calendarQuerySchema = z
  .object({
    businessMonth: z.string().regex(/^\d{4}-\d{2}$/),
  })
  .strict();
const schedulePeriodIdSchema = z.string().uuid();
const guestCalendarQuerySchema = z
  .object({
    businessMonth: z.string().regex(/^\d{4}-\d{2}$/),
    visitorKey: z.string().regex(/^[0-9a-f]{32}$/i),
  })
  .strict();

export function registerCalendarRoutes(
  app: FastifyInstance,
  calendarQuery: CalendarQuery,
  visitorAccessLogService: VisitorAccessLogService,
): void {
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

  app.get('/groups/:groupId/guest-calendar', { preHandler: app.authenticate }, (request) =>
    calendarQuery.readLoggedInGuestMonth(
      getAuthenticatedIdentity(request),
      parseGroupId(request),
      parseBusinessMonth(request.query),
    ),
  );

  app.post('/guest/groups/resolve', async (request, reply) => {
    const input = parseOrThrow(visitorResolveRequestSchema, request.body);
    return reply.code(200).send(await visitorAccessLogService.resolveGroup(input.visitorKey));
  });

  app.get('/guest/groups/:groupId/calendar', async (request) => {
    const groupId = parseGroupId(request);
    const input = parseGuestCalendarQuery(request.query);
    const resolved = await visitorAccessLogService.resolveGroup(input.visitorKey, groupId);
    const calendar = await calendarQuery.readGuestMonthByGroupId(
      resolved.groupId,
      input.businessMonth,
    );
    await visitorAccessLogService.recordAccess(
      resolved.groupId,
      input.businessMonth,
      request.ip,
      request.id,
    );
    return calendar;
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

function parseGuestCalendarQuery(query: unknown): {
  readonly businessMonth: string;
  readonly visitorKey: string;
} {
  return parseOrThrow(guestCalendarQuerySchema, query);
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
