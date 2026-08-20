import type {
  UpdateGroupCalendarDefaults,
  UpdateMemberCalendarPreferences,
} from '@schedule/contracts';
import {
  updateGroupCalendarDefaultsSchema,
  updateMemberCalendarPreferencesSchema,
} from '@schedule/contracts';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { ApiError } from '../../plugins/error-handler.js';
import { CalendarPreferencesService } from './calendar-preferences-service.js';

const groupIdSchema = z.string().uuid();

export function registerCalendarPreferencesRoutes(
  app: FastifyInstance,
  service: CalendarPreferencesService,
): void {
  app.get('/groups/:groupId/calendar-preferences', { preHandler: app.authenticate }, (request) =>
    service.get(getAuthenticatedIdentity(request), parseGroupId(request)),
  );

  app.put('/groups/:groupId/calendar-settings', { preHandler: app.authenticate }, (request) =>
    service.updateGroupDefaults(
      getAuthenticatedIdentity(request),
      parseGroupId(request),
      parseGroupDefaults(request.body),
    ),
  );

  app.put(
    '/groups/:groupId/calendar-preferences/mine',
    { preHandler: app.authenticate },
    (request) =>
      service.updateMine(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseMemberPreferences(request.body),
      ),
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

function parseGroupId(request: FastifyRequest): string {
  return parseOrThrow(groupIdSchema, (request.params as { groupId?: unknown }).groupId);
}

function parseGroupDefaults(value: unknown): UpdateGroupCalendarDefaults {
  return parseOrThrow(updateGroupCalendarDefaultsSchema, value);
}

function parseMemberPreferences(value: unknown): UpdateMemberCalendarPreferences {
  return parseOrThrow(updateMemberCalendarPreferencesSchema, value);
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
