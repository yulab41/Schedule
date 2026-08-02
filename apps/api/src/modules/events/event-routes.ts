import type { ScheduleEventQuery } from '@schedule/contracts';
import type { DatabaseClient } from '@schedule/database';
import { withTransaction } from '@schedule/database';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { ApiError } from '../../plugins/error-handler.js';
import { GroupPermissionService } from '../groups/permission-service.js';
import { EventQuery } from './event-query.js';

const groupIdSchema = z.string().uuid();
const eventIdSchema = z.string().uuid();
const uuidSchema = z.string().uuid();
const timestampSchema = z.string().min(1);
const cursorSchema = z.string().min(1);

const eventListQuerySchema = z
  .object({
    cursor: cursorSchema.optional(),
    eventTypes: z
      .string()
      .transform((value) =>
        value
          .split(',')
          .map((item) => item.trim())
          .filter((item) => item.length > 0),
      )
      .optional(),
    from: timestampSchema.optional(),
    membershipId: uuidSchema.optional(),
    operatorUserId: uuidSchema.optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
    scheduleRoleId: uuidSchema.optional(),
    shiftId: uuidSchema.optional(),
    to: timestampSchema.optional(),
  })
  .strict();

export function registerEventRoutes(
  app: FastifyInstance,
  eventQuery: EventQuery,
  databaseClient: DatabaseClient,
): void {
  const permissionService = new GroupPermissionService();

  app.get('/groups/:groupId/events', { preHandler: app.authenticate }, (request) =>
    withTransaction(databaseClient, async (transaction) => {
      const identity = getAuthenticatedIdentity(request);
      const groupId = parseGroupId(request);
      const authorization = await permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'viewScheduleConfiguration',
      );
      const query = parseEventListQuery(request.query);

      return eventQuery.listInTransaction(transaction, {
        ...query,
        groupId: authorization.group.id,
      });
    }),
  );

  app.get('/groups/:groupId/events/:eventId', { preHandler: app.authenticate }, (request) =>
    withTransaction(databaseClient, async (transaction) => {
      const identity = getAuthenticatedIdentity(request);
      const groupId = parseGroupId(request);
      const authorization = await permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'viewScheduleConfiguration',
      );

      return eventQuery.getDetailInTransaction(
        transaction,
        authorization.group.id,
        parseEventId(request),
      );
    }),
  );
}

function getAuthenticatedIdentity(request: FastifyRequest): AuthenticatedIdentity {
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

function parseEventId(request: FastifyRequest): string {
  return parseOrThrow(eventIdSchema, (request.params as { eventId?: unknown }).eventId);
}

function parseEventListQuery(query: unknown): Omit<ScheduleEventQuery, 'groupId'> {
  const parsed = parseOrThrow(eventListQuerySchema, query);
  return {
    ...(parsed.cursor === undefined ? {} : { cursor: parsed.cursor }),
    ...(parsed.eventTypes === undefined ? {} : { eventTypes: parsed.eventTypes }),
    ...(parsed.from === undefined ? {} : { from: parsed.from }),
    ...(parsed.membershipId === undefined ? {} : { membershipId: parsed.membershipId }),
    ...(parsed.operatorUserId === undefined ? {} : { operatorUserId: parsed.operatorUserId }),
    ...(parsed.pageSize === undefined ? {} : { pageSize: parsed.pageSize }),
    ...(parsed.scheduleRoleId === undefined ? {} : { scheduleRoleId: parsed.scheduleRoleId }),
    ...(parsed.shiftId === undefined ? {} : { shiftId: parsed.shiftId }),
    ...(parsed.to === undefined ? {} : { to: parsed.to }),
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
