import type {
  PastScheduleBackfillBatchItem,
  PastScheduleBackfillBatchRequest,
  PastScheduleBackfillBatchResult,
  PastScheduleBackfillRecord,
  PastSchedulePeriod,
} from '@schedule/contracts';

import {
  pastScheduleBackfillBatchResultJsonSchema,
  pastScheduleBackfillRecordListJsonSchema,
  pastSchedulePeriodListJsonSchema,
} from './generated/calendar-schemas.js';
import { defineClientEndpoint, type ClientTransport } from './endpoint.js';
import { createCompactDecoder } from './json-decoder.js';

interface GroupInput {
  readonly groupId: string;
}

export type PastScheduleBackfillBatchSubmission = Readonly<
  Omit<PastScheduleBackfillBatchRequest, 'items' | 'operationId'>
> & {
  readonly items: readonly PastScheduleBackfillBatchItem[];
  readonly operationId: string;
};

interface SubmitBackfillBatchInput extends GroupInput {
  readonly request: PastScheduleBackfillBatchSubmission;
}

export const pastSchedulePeriodListDecoder = createCompactDecoder<readonly PastSchedulePeriod[]>(
  pastSchedulePeriodListJsonSchema,
);
export const pastScheduleBackfillRecordListDecoder = createCompactDecoder<
  readonly PastScheduleBackfillRecord[]
>(pastScheduleBackfillRecordListJsonSchema);
export const pastScheduleBackfillBatchResultDecoder =
  createCompactDecoder<PastScheduleBackfillBatchResult>(pastScheduleBackfillBatchResultJsonSchema);

export const pastScheduleEndpoints = {
  backfillRecords: defineClientEndpoint<GroupInput, readonly PastScheduleBackfillRecord[]>({
    auth: 'bearer',
    decoder: pastScheduleBackfillRecordListDecoder,
    id: 'past-schedule.backfill-records',
    method: 'GET',
    path: ({ groupId }) => `/groups/${encodeURIComponent(groupId)}/past-schedules/backfill-records`,
  }),
  periods: defineClientEndpoint<GroupInput, readonly PastSchedulePeriod[]>({
    auth: 'bearer',
    decoder: pastSchedulePeriodListDecoder,
    id: 'past-schedule.periods',
    method: 'GET',
    path: ({ groupId }) => `/groups/${encodeURIComponent(groupId)}/past-schedules`,
  }),
  submitBackfillBatch: defineClientEndpoint<
    SubmitBackfillBatchInput,
    PastScheduleBackfillBatchResult
  >({
    auth: 'bearer',
    body: ({ request }) => request,
    decoder: pastScheduleBackfillBatchResultDecoder,
    id: 'past-schedule.submit-backfill-batch',
    idempotencyKey: ({ request }) => request.operationId,
    method: 'POST',
    path: ({ groupId }) => `/groups/${encodeURIComponent(groupId)}/past-schedules/backfill-batches`,
  }),
} as const;

export interface PastScheduleClient {
  listBackfillRecords(groupId: string): Promise<readonly PastScheduleBackfillRecord[]>;
  listPeriods(groupId: string): Promise<readonly PastSchedulePeriod[]>;
  submitBackfillBatch(
    groupId: string,
    request: PastScheduleBackfillBatchSubmission,
  ): Promise<PastScheduleBackfillBatchResult>;
}

export function createPastScheduleClient(transport: ClientTransport): PastScheduleClient {
  return {
    listBackfillRecords(groupId) {
      return transport.request(pastScheduleEndpoints.backfillRecords, { groupId });
    },
    listPeriods(groupId) {
      return transport.request(pastScheduleEndpoints.periods, { groupId });
    },
    submitBackfillBatch(groupId, request) {
      return transport.request(pastScheduleEndpoints.submitBackfillBatch, { groupId, request });
    },
  };
}
