import type {
  CreateScheduleExportInput,
  NotificationPage,
  NotificationRecord,
  ScheduleExportJob,
} from '@schedule/contracts';

import {
  notificationPageJsonSchema,
  notificationRecordJsonSchema,
  readAllResultJsonSchema,
  scheduleExportJobJsonSchema,
  unreadCountResultJsonSchema,
} from './generated/calendar-schemas.js';
import { defineClientEndpoint, type ClientTransport } from './endpoint.js';
import { createCompactDecoder } from './json-decoder.js';

interface NotificationListInput {
  readonly cursor?: string;
  readonly groupId?: string;
  readonly pageSize?: number;
  readonly unreadOnly?: boolean;
}

interface ReadAllResult {
  readonly count: number;
}

interface UnreadCountResult {
  readonly unreadCount: number;
}

interface NotificationIdInput {
  readonly notificationId: string;
}

interface MarkAllReadInput {
  readonly groupId?: string;
}

interface NotificationScopeInput {
  readonly groupId?: string;
}

interface ExportGroupInput {
  readonly groupId: string;
}

interface ExportJobInput extends ExportGroupInput {
  readonly input: CreateScheduleExportInput;
}

interface ExportJobIdInput extends ExportGroupInput {
  readonly exportJobId: string;
}

export const notificationPageDecoder = /* @__PURE__ */ createCompactDecoder<NotificationPage>(
  notificationPageJsonSchema,
);
export const notificationRecordDecoder = /* @__PURE__ */ createCompactDecoder<NotificationRecord>(
  notificationRecordJsonSchema,
);
export const unreadCountDecoder = /* @__PURE__ */ createCompactDecoder<UnreadCountResult>(
  unreadCountResultJsonSchema,
);
export const readAllResultDecoder =
  /* @__PURE__ */ createCompactDecoder<ReadAllResult>(readAllResultJsonSchema);
export const scheduleExportJobDecoder = /* @__PURE__ */ createCompactDecoder<ScheduleExportJob>(
  scheduleExportJobJsonSchema,
);

export const p9InsightsActionsEndpoints = {
  createExportJob: /* @__PURE__ */ defineClientEndpoint<ExportJobInput, ScheduleExportJob>({
    auth: 'bearer',
    body: ({ input }) => input,
    decoder: scheduleExportJobDecoder,
    id: 'insights.export-create',
    method: 'POST',
    path: ({ groupId }) => `/groups/${encodeURIComponent(groupId)}/exports`,
  }),
  getExportJob: /* @__PURE__ */ defineClientEndpoint<ExportJobIdInput, ScheduleExportJob>({
    auth: 'bearer',
    decoder: scheduleExportJobDecoder,
    id: 'insights.export-status',
    method: 'GET',
    path: ({ exportJobId, groupId }) =>
      `/groups/${encodeURIComponent(groupId)}/exports/${encodeURIComponent(exportJobId)}`,
  }),
  listNotifications: /* @__PURE__ */ defineClientEndpoint<NotificationListInput, NotificationPage>({
    auth: 'bearer',
    decoder: notificationPageDecoder,
    id: 'insights.notifications-list',
    method: 'GET',
    path: ({ cursor, groupId, pageSize, unreadOnly }) =>
      appendQuery('/notifications', [
        ['cursor', cursor],
        ['groupId', groupId],
        ['pageSize', pageSize === undefined ? undefined : String(pageSize)],
        ['unreadOnly', unreadOnly === true ? 'true' : undefined],
      ]),
  }),
  markAllNotificationsRead: /* @__PURE__ */ defineClientEndpoint<MarkAllReadInput, ReadAllResult>({
    auth: 'bearer',
    body: ({ groupId }) => (groupId === undefined ? {} : { groupId }),
    decoder: readAllResultDecoder,
    id: 'insights.notifications-read-all',
    method: 'POST',
    path: () => '/notifications/read-all',
  }),
  markNotificationRead: /* @__PURE__ */ defineClientEndpoint<
    NotificationIdInput,
    NotificationRecord
  >({
    auth: 'bearer',
    body: () => ({}),
    decoder: notificationRecordDecoder,
    id: 'insights.notification-read',
    method: 'POST',
    path: ({ notificationId }) => `/notifications/${encodeURIComponent(notificationId)}/read`,
  }),
  unreadCount: /* @__PURE__ */ defineClientEndpoint<NotificationScopeInput, UnreadCountResult>({
    auth: 'bearer',
    decoder: unreadCountDecoder,
    id: 'insights.notifications-unread-count',
    method: 'GET',
    path: ({ groupId }) => appendQuery('/notifications/unread-count', [['groupId', groupId]]),
  }),
} as const;

export interface P9InsightsActionsClient {
  createExportJob(groupId: string, input: CreateScheduleExportInput): Promise<ScheduleExportJob>;
  getExportJob(groupId: string, exportJobId: string): Promise<ScheduleExportJob>;
  listNotifications(options?: NotificationListInput): Promise<NotificationPage>;
  markAllNotificationsRead(groupId?: string): Promise<ReadAllResult>;
  markNotificationRead(notificationId: string): Promise<NotificationRecord>;
  unreadCount(groupId?: string): Promise<UnreadCountResult>;
}

export function createP9InsightsActionsClient(transport: ClientTransport): P9InsightsActionsClient {
  return {
    createExportJob(groupId, input) {
      return transport.request(p9InsightsActionsEndpoints.createExportJob, { groupId, input });
    },
    getExportJob(groupId, exportJobId) {
      return transport.request(p9InsightsActionsEndpoints.getExportJob, { exportJobId, groupId });
    },
    listNotifications(options = {}) {
      return transport.request(p9InsightsActionsEndpoints.listNotifications, options);
    },
    markAllNotificationsRead(groupId) {
      return transport.request(
        p9InsightsActionsEndpoints.markAllNotificationsRead,
        groupId === undefined ? {} : { groupId },
      );
    },
    markNotificationRead(notificationId) {
      return transport.request(p9InsightsActionsEndpoints.markNotificationRead, { notificationId });
    },
    unreadCount(groupId) {
      return transport.request(
        p9InsightsActionsEndpoints.unreadCount,
        groupId === undefined ? {} : { groupId },
      );
    },
  };
}

function appendQuery(
  path: string,
  entries: readonly (readonly [string, string | undefined])[],
): string {
  const query = entries
    .filter((entry): entry is readonly [string, string] => entry[1] !== undefined)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`);
  return query.length === 0 ? path : `${path}?${query.join('&')}`;
}
