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

interface ExportGroupInput {
  readonly groupId: string;
}

interface ExportJobInput extends ExportGroupInput {
  readonly input: CreateScheduleExportInput;
}

interface ExportJobIdInput extends ExportGroupInput {
  readonly exportJobId: string;
}

export const notificationPageDecoder = createCompactDecoder<NotificationPage>(
  notificationPageJsonSchema,
);
export const notificationRecordDecoder = createCompactDecoder<NotificationRecord>(
  notificationRecordJsonSchema,
);
export const unreadCountDecoder = createCompactDecoder<UnreadCountResult>(unreadCountResultJsonSchema);
export const readAllResultDecoder = createCompactDecoder<ReadAllResult>(readAllResultJsonSchema);
export const scheduleExportJobDecoder = createCompactDecoder<ScheduleExportJob>(
  scheduleExportJobJsonSchema,
);

export const p9InsightsActionsEndpoints = {
  createExportJob: defineClientEndpoint<ExportJobInput, ScheduleExportJob>({
    auth: 'bearer',
    body: ({ input }) => input,
    decoder: scheduleExportJobDecoder,
    id: 'insights.export-create',
    method: 'POST',
    path: ({ groupId }) => `/groups/${encodeURIComponent(groupId)}/exports`,
  }),
  getExportJob: defineClientEndpoint<ExportJobIdInput, ScheduleExportJob>({
    auth: 'bearer',
    decoder: scheduleExportJobDecoder,
    id: 'insights.export-status',
    method: 'GET',
    path: ({ exportJobId, groupId }) =>
      `/groups/${encodeURIComponent(groupId)}/exports/${encodeURIComponent(exportJobId)}`,
  }),
  listNotifications: defineClientEndpoint<NotificationListInput, NotificationPage>({
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
  markAllNotificationsRead: defineClientEndpoint<MarkAllReadInput, ReadAllResult>({
    auth: 'bearer',
    body: ({ groupId }) => (groupId === undefined ? {} : { groupId }),
    decoder: readAllResultDecoder,
    id: 'insights.notifications-read-all',
    method: 'POST',
    path: () => '/notifications/read-all',
  }),
  markNotificationRead: defineClientEndpoint<NotificationIdInput, NotificationRecord>({
    auth: 'bearer',
    decoder: notificationRecordDecoder,
    id: 'insights.notification-read',
    method: 'POST',
    path: ({ notificationId }) => `/notifications/${encodeURIComponent(notificationId)}/read`,
  }),
  unreadCount: defineClientEndpoint<Record<string, never>, UnreadCountResult>({
    auth: 'bearer',
    decoder: unreadCountDecoder,
    id: 'insights.notifications-unread-count',
    method: 'GET',
    path: () => '/notifications/unread-count',
  }),
} as const;

export interface P9InsightsActionsClient {
  createExportJob(groupId: string, input: CreateScheduleExportInput): Promise<ScheduleExportJob>;
  getExportJob(groupId: string, exportJobId: string): Promise<ScheduleExportJob>;
  listNotifications(options?: NotificationListInput): Promise<NotificationPage>;
  markAllNotificationsRead(groupId?: string): Promise<ReadAllResult>;
  markNotificationRead(notificationId: string): Promise<NotificationRecord>;
  unreadCount(): Promise<UnreadCountResult>;
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
    unreadCount() {
      return transport.request(p9InsightsActionsEndpoints.unreadCount, {});
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
