import type {
  CalendarReadModel,
  PublishSchedulePeriodBatchRequest,
  PublishSchedulePeriodBatchResult,
  PublishSchedulePeriodRequest,
  PublishSchedulePeriodResult,
  ScheduleChangeImpactPreview,
  ScheduleGenerationPreview,
  SchedulePeriodHistoryItem,
  SchedulePeriodMutationRequest,
  SchedulePeriodMutationResult,
} from '@schedule/contracts';

import {
  calendarReadModelJsonSchema,
  publishSchedulePeriodBatchResultJsonSchema,
  publishSchedulePeriodResultJsonSchema,
  scheduleChangeImpactPreviewJsonSchema,
  scheduleGenerationPreviewJsonSchema,
  schedulePeriodHistoryItemListJsonSchema,
  schedulePeriodMutationResultJsonSchema,
} from './generated/calendar-schemas.js';
import { defineClientEndpoint, type ClientTransport } from './endpoint.js';
import { createCompactDecoder, type CompactDecoder } from './json-decoder.js';

interface GroupInput {
  readonly groupId: string;
}

interface PeriodInput extends GroupInput {
  readonly schedulePeriodId: string;
}

interface ChangeImpactInput extends PeriodInput {
  readonly action: 'publish' | 'withdraw';
}

interface PublishInput extends PeriodInput {
  readonly request: PublishSchedulePeriodRequest;
}

interface PublishBatchInput extends GroupInput {
  readonly request: PublishSchedulePeriodBatchRequest;
}

interface WithdrawInput extends PeriodInput {
  readonly request: SchedulePeriodMutationRequest;
}

interface DeleteDraftInput extends PeriodInput {
  readonly operationId: string;
}

export const schedulePeriodHistoryListDecoder = createCompactDecoder<
  readonly SchedulePeriodHistoryItem[]
>(schedulePeriodHistoryItemListJsonSchema);
export const scheduleGenerationPreviewDecoder = createCompactDecoder<ScheduleGenerationPreview>(
  scheduleGenerationPreviewJsonSchema,
);
export const scheduleChangeImpactPreviewDecoder = createCompactDecoder<ScheduleChangeImpactPreview>(
  scheduleChangeImpactPreviewJsonSchema,
);
export const schedulePeriodMutationResultDecoder =
  createCompactDecoder<SchedulePeriodMutationResult>(schedulePeriodMutationResultJsonSchema);
export const publishSchedulePeriodBatchResultDecoder =
  createCompactDecoder<PublishSchedulePeriodBatchResult>(
    publishSchedulePeriodBatchResultJsonSchema,
  );
export const publishSchedulePeriodResultDecoder = createCompactDecoder<PublishSchedulePeriodResult>(
  publishSchedulePeriodResultJsonSchema,
);
const periodCalendarDecoder = createCompactDecoder<CalendarReadModel>(calendarReadModelJsonSchema);
const emptyResponseDecoder: CompactDecoder<void> = {
  safeDecode(value) {
    return value === undefined || value === null || value === ''
      ? { data: undefined, success: true }
      : { success: false };
  },
};

export const schedulePublicationEndpoints = {
  changeImpact: defineClientEndpoint<ChangeImpactInput, ScheduleChangeImpactPreview>({
    auth: 'bearer',
    decoder: scheduleChangeImpactPreviewDecoder,
    id: 'schedule-publication.change-impact',
    method: 'GET',
    path: ({ action, groupId, schedulePeriodId }) =>
      `${schedulePath(groupId, schedulePeriodId)}/change-impact?action=${encodeURIComponent(action)}`,
  }),
  deleteDraft: defineClientEndpoint<DeleteDraftInput, void>({
    auth: 'bearer',
    decoder: emptyResponseDecoder,
    id: 'schedule-publication.delete-draft',
    idempotencyKey: ({ operationId }) => operationId,
    method: 'DELETE',
    path: ({ groupId, schedulePeriodId }) => schedulePath(groupId, schedulePeriodId),
  }),
  draftPreview: defineClientEndpoint<PeriodInput, ScheduleGenerationPreview>({
    auth: 'bearer',
    decoder: scheduleGenerationPreviewDecoder,
    id: 'schedule-publication.draft-preview',
    method: 'GET',
    path: ({ groupId, schedulePeriodId }) => `${schedulePath(groupId, schedulePeriodId)}/preview`,
  }),
  history: defineClientEndpoint<GroupInput, readonly SchedulePeriodHistoryItem[]>({
    auth: 'bearer',
    decoder: schedulePeriodHistoryListDecoder,
    id: 'schedule-publication.history',
    method: 'GET',
    path: ({ groupId }) => `/groups/${encodeURIComponent(groupId)}/schedule-periods/history`,
  }),
  periodCalendar: defineClientEndpoint<PeriodInput, CalendarReadModel>({
    auth: 'bearer',
    decoder: periodCalendarDecoder,
    id: 'schedule-publication.period-calendar',
    method: 'GET',
    path: ({ groupId, schedulePeriodId }) =>
      `/groups/${encodeURIComponent(groupId)}/calendar/periods/${encodeURIComponent(schedulePeriodId)}`,
  }),
  publish: defineClientEndpoint<PublishInput, PublishSchedulePeriodResult>({
    auth: 'bearer',
    body: ({ request }) => request,
    decoder: publishSchedulePeriodResultDecoder,
    id: 'schedule-publication.publish',
    idempotencyKey: ({ request }) => request.operationId,
    method: 'POST',
    path: ({ groupId, schedulePeriodId }) => `${schedulePath(groupId, schedulePeriodId)}/publish`,
  }),
  publishBatch: defineClientEndpoint<PublishBatchInput, PublishSchedulePeriodBatchResult>({
    auth: 'bearer',
    body: ({ request }) => request,
    decoder: publishSchedulePeriodBatchResultDecoder,
    id: 'schedule-publication.publish-batch',
    idempotencyKey: ({ request }) => request.operationId,
    method: 'POST',
    path: ({ groupId }) => `/groups/${encodeURIComponent(groupId)}/schedules/publish-batch`,
  }),
  withdraw: defineClientEndpoint<WithdrawInput, SchedulePeriodMutationResult>({
    auth: 'bearer',
    body: ({ request }) => request,
    decoder: schedulePeriodMutationResultDecoder,
    id: 'schedule-publication.withdraw',
    idempotencyKey: ({ request }) => request.operationId,
    method: 'POST',
    path: ({ groupId, schedulePeriodId }) => `${schedulePath(groupId, schedulePeriodId)}/withdraw`,
  }),
} as const;

export interface SchedulePublicationClient {
  deleteDraft(groupId: string, schedulePeriodId: string, operationId: string): Promise<void>;
  getDraftPreview(groupId: string, schedulePeriodId: string): Promise<ScheduleGenerationPreview>;
  getPeriodCalendar(groupId: string, schedulePeriodId: string): Promise<CalendarReadModel>;
  listHistory(groupId: string): Promise<readonly SchedulePeriodHistoryItem[]>;
  previewChangeImpact(
    groupId: string,
    schedulePeriodId: string,
    action: 'publish' | 'withdraw',
  ): Promise<ScheduleChangeImpactPreview>;
  publish(
    groupId: string,
    schedulePeriodId: string,
    request: PublishSchedulePeriodRequest,
  ): Promise<PublishSchedulePeriodResult>;
  publishBatch(
    groupId: string,
    request: PublishSchedulePeriodBatchRequest,
  ): Promise<PublishSchedulePeriodBatchResult>;
  withdraw(
    groupId: string,
    schedulePeriodId: string,
    request: SchedulePeriodMutationRequest,
  ): Promise<SchedulePeriodMutationResult>;
}

export function createSchedulePublicationClient(
  transport: ClientTransport,
): SchedulePublicationClient {
  return {
    deleteDraft(groupId, schedulePeriodId, operationId) {
      return transport.request(schedulePublicationEndpoints.deleteDraft, {
        groupId,
        operationId,
        schedulePeriodId,
      });
    },
    getDraftPreview(groupId, schedulePeriodId) {
      return transport.request(schedulePublicationEndpoints.draftPreview, {
        groupId,
        schedulePeriodId,
      });
    },
    getPeriodCalendar(groupId, schedulePeriodId) {
      return transport.request(schedulePublicationEndpoints.periodCalendar, {
        groupId,
        schedulePeriodId,
      });
    },
    listHistory(groupId) {
      return transport.request(schedulePublicationEndpoints.history, { groupId });
    },
    previewChangeImpact(groupId, schedulePeriodId, action) {
      return transport.request(schedulePublicationEndpoints.changeImpact, {
        action,
        groupId,
        schedulePeriodId,
      });
    },
    publish(groupId, schedulePeriodId, request) {
      return transport.request(schedulePublicationEndpoints.publish, {
        groupId,
        request,
        schedulePeriodId,
      });
    },
    publishBatch(groupId, request) {
      return transport.request(schedulePublicationEndpoints.publishBatch, { groupId, request });
    },
    withdraw(groupId, schedulePeriodId, request) {
      return transport.request(schedulePublicationEndpoints.withdraw, {
        groupId,
        request,
        schedulePeriodId,
      });
    },
  };
}

function schedulePath(groupId: string, schedulePeriodId: string): string {
  return `/groups/${encodeURIComponent(groupId)}/schedules/${encodeURIComponent(schedulePeriodId)}`;
}
