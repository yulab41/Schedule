import type {
  NotificationQuery,
  UpdateGroupNotificationSettingsInput,
  UpdateMemberNotificationPreferencesInput,
  WebPushSubscriptionInput,
} from '@schedule/contracts';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { ApiError } from '../../plugins/error-handler.js';
import { NotificationQueryService } from './notification-query.js';
import { NotificationService } from './notification-service.js';

const groupIdSchema = z.string().uuid();
const notificationIdSchema = z.string().uuid();
const uuidSchema = z.string().uuid();
const pageSizeSchema = z.coerce.number().int().min(1).max(100);
const booleanSchema = z.enum(['true', 'false']).transform((value) => value === 'true');
const reminderHoursSchema = z.array(z.number().int().min(1).max(720)).min(1).max(5);
const nullableReminderHoursSchema = z.array(z.number().int().min(1).max(720)).max(5).nullable();

const updateGroupSettingsSchema = z
  .object({
    dutyReminderHours: reminderHoursSchema,
  })
  .strict();

const updateMyPreferencesSchema = z
  .object({
    browserNotificationsEnabled: z.boolean().optional(),
    dutyReminderHours: nullableReminderHoursSchema.optional(),
  })
  .strict();

const pushSubscriptionSchema = z
  .object({
    endpoint: z.string().min(1).max(1000),
    keys: z
      .object({
        auth: z.string().min(1).max(128),
        p256dh: z.string().min(1).max(256),
      })
      .strict(),
  })
  .strict();

const readAllSchema = z
  .object({
    groupId: uuidSchema.optional(),
  })
  .strict();

export function registerNotificationRoutes(
  app: FastifyInstance,
  notificationQuery: NotificationQueryService,
  notificationService: NotificationService,
): void {
  app.get('/notifications', { preHandler: app.authenticate }, (request) =>
    notificationQuery.listMine(getAuthenticatedIdentity(request), parseListQuery(request)),
  );

  app.get('/notifications/unread-count', { preHandler: app.authenticate }, (request) =>
    notificationQuery
      .unreadCount(getAuthenticatedIdentity(request))
      .then((unreadCount) => ({ unreadCount })),
  );

  app.post('/notifications/:notificationId/read', { preHandler: app.authenticate }, (request) =>
    notificationQuery.markRead(getAuthenticatedIdentity(request), parseNotificationId(request)),
  );

  app.post('/notifications/read-all', { preHandler: app.authenticate }, (request) =>
    notificationQuery.markAllRead(
      getAuthenticatedIdentity(request),
      parseReadAllGroupId(request.body),
    ),
  );

  app.get('/groups/:groupId/notification-settings', { preHandler: app.authenticate }, (request) =>
    notificationService.getGroupSettings(getAuthenticatedIdentity(request), parseGroupId(request)),
  );

  app.put('/groups/:groupId/notification-settings', { preHandler: app.authenticate }, (request) =>
    notificationService.updateGroupSettings(
      getAuthenticatedIdentity(request),
      parseGroupId(request),
      parseUpdateGroupSettings(request.body),
    ),
  );

  app.get(
    '/groups/:groupId/notification-preferences/mine',
    { preHandler: app.authenticate },
    (request) =>
      notificationService.getMyPreferences(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
      ),
  );

  app.put(
    '/groups/:groupId/notification-preferences/mine',
    { preHandler: app.authenticate },
    (request) =>
      notificationService.updateMyPreferences(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseUpdateMyPreferences(request.body),
      ),
  );

  app.get('/notifications/push-config', { preHandler: app.authenticate }, () =>
    notificationService.getPushConfiguration(),
  );

  app.put('/notifications/push-subscription', { preHandler: app.authenticate }, (request) =>
    notificationService
      .savePushSubscription(getAuthenticatedIdentity(request), parsePushSubscription(request.body))
      .then(() => ({ saved: true })),
  );

  app.delete('/notifications/push-subscription', { preHandler: app.authenticate }, (request) =>
    notificationService
      .deletePushSubscriptions(getAuthenticatedIdentity(request))
      .then(() => ({ deleted: true })),
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

function parseNotificationId(request: FastifyRequest): string {
  return parseOrThrow(
    notificationIdSchema,
    (request.params as { notificationId?: unknown }).notificationId,
  );
}

function parseListQuery(request: FastifyRequest): NotificationQuery {
  const query = request.query as {
    cursor?: unknown;
    groupId?: unknown;
    pageSize?: unknown;
    unreadOnly?: unknown;
  };
  const pageSize =
    query.pageSize === undefined ? undefined : parseOrThrow(pageSizeSchema, query.pageSize);
  const groupId = query.groupId === undefined ? undefined : parseOrThrow(uuidSchema, query.groupId);
  const unreadOnly =
    query.unreadOnly === undefined ? undefined : parseOrThrow(booleanSchema, query.unreadOnly);

  return {
    ...(query.cursor === undefined ? {} : { cursor: parseOrThrow(cursorSchema, query.cursor) }),
    ...(groupId === undefined ? {} : { groupId }),
    ...(pageSize === undefined ? {} : { pageSize }),
    ...(unreadOnly === undefined ? {} : { unreadOnly }),
  };
}

const cursorSchema = z.string().min(1);

function parseReadAllGroupId(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parsed = parseOrThrow(readAllSchema, value);
  return parsed.groupId;
}

function parseUpdateGroupSettings(value: unknown): UpdateGroupNotificationSettingsInput {
  return parseOrThrow(updateGroupSettingsSchema, value);
}

function parseUpdateMyPreferences(value: unknown): UpdateMemberNotificationPreferencesInput {
  const parsed = parseOrThrow(updateMyPreferencesSchema, value);

  return {
    ...(parsed.browserNotificationsEnabled === undefined
      ? {}
      : { browserNotificationsEnabled: parsed.browserNotificationsEnabled }),
    ...(parsed.dutyReminderHours === undefined
      ? {}
      : { dutyReminderHours: parsed.dutyReminderHours }),
  };
}

function parsePushSubscription(value: unknown): WebPushSubscriptionInput {
  return parseOrThrow(pushSubscriptionSchema, value);
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
