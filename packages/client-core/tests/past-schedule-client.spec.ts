import {
  pastScheduleBackfillBatchRequestSchema,
  pastScheduleBackfillBatchResultSchema,
  pastScheduleBackfillRecordListSchema,
  pastSchedulePeriodListSchema,
} from '@schedule/contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  createPastScheduleClient,
  pastScheduleBackfillBatchResultDecoder,
  pastScheduleBackfillRecordListDecoder,
  pastScheduleEndpoints,
  pastSchedulePeriodListDecoder,
  type ClientEndpoint,
  type ClientTransport,
} from '../src/index.js';
import {
  pastScheduleBackfillBatchGoldenResult,
  pastScheduleBackfillRecordsGoldenResponse,
  pastSchedulePeriodsGoldenResponse,
} from '../src/testing/index.js';

const groupId = '11111111-1111-4111-8111-111111111111';
const operationId = '22222222-2222-4222-8222-222222222222';
const batchRequest = {
  items: [
    {
      actualMembershipId: '33333333-3333-4333-8333-333333333333',
      businessDate: '2026-07-02',
      scheduleRoleId: '44444444-4444-4444-8444-444444444444',
      shiftTypeId: '55555555-5555-4555-8555-555555555555',
    },
  ],
  operationId,
  reason: '实际值班人员更正',
} as const;

describe('past schedule client', () => {
  it('defines the periods, records, and idempotent atomic batch endpoints', () => {
    expect(pastScheduleEndpoints.periods).toMatchObject({
      auth: 'bearer',
      id: 'past-schedule.periods',
      method: 'GET',
    });
    expect(pastScheduleEndpoints.periods.path({ groupId })).toBe(
      `/groups/${groupId}/past-schedules`,
    );
    expect(pastScheduleEndpoints.backfillRecords.path({ groupId })).toBe(
      `/groups/${groupId}/past-schedules/backfill-records`,
    );
    const input = { groupId, request: batchRequest };
    expect(pastScheduleEndpoints.submitBackfillBatch).toMatchObject({
      auth: 'bearer',
      id: 'past-schedule.submit-backfill-batch',
      method: 'POST',
    });
    expect(pastScheduleEndpoints.submitBackfillBatch.path(input)).toBe(
      `/groups/${groupId}/past-schedules/backfill-batches`,
    );
    expect(pastScheduleEndpoints.submitBackfillBatch.body?.(input)).toEqual(batchRequest);
    expect(pastScheduleEndpoints.submitBackfillBatch.idempotencyKey?.(input)).toBe(operationId);
    expect(pastScheduleBackfillBatchRequestSchema.parse(batchRequest)).toEqual(batchRequest);
  });

  it('delegates each method exactly once without catching or cloning', async () => {
    const responses = new Map<string, unknown>([
      ['past-schedule.periods', pastSchedulePeriodsGoldenResponse],
      ['past-schedule.backfill-records', pastScheduleBackfillRecordsGoldenResponse],
      ['past-schedule.submit-backfill-batch', pastScheduleBackfillBatchGoldenResult],
    ]);
    const request = vi.fn(
      async <Input, Output>(endpoint: ClientEndpoint<Input, Output>): Promise<Output> =>
        responses.get(endpoint.id) as Output,
    );
    const client = createPastScheduleClient({ request } satisfies ClientTransport);

    await expect(client.listPeriods(groupId)).resolves.toBe(pastSchedulePeriodsGoldenResponse);
    await expect(client.listBackfillRecords(groupId)).resolves.toBe(
      pastScheduleBackfillRecordsGoldenResponse,
    );
    await expect(client.submitBackfillBatch(groupId, batchRequest)).resolves.toBe(
      pastScheduleBackfillBatchGoldenResult,
    );
    expect(request).toHaveBeenCalledTimes(3);
    expect(request.mock.calls.map(([endpoint]) => endpoint.id)).toEqual([
      'past-schedule.periods',
      'past-schedule.backfill-records',
      'past-schedule.submit-backfill-batch',
    ]);
    expect(request.mock.calls[2]?.[1]).toEqual({ groupId, request: batchRequest });
  });

  it('matches Web Zod decoding for the shared golden responses', () => {
    const cases = [
      [
        pastSchedulePeriodListDecoder,
        pastSchedulePeriodListSchema,
        pastSchedulePeriodsGoldenResponse,
      ],
      [
        pastScheduleBackfillRecordListDecoder,
        pastScheduleBackfillRecordListSchema,
        pastScheduleBackfillRecordsGoldenResponse,
      ],
      [
        pastScheduleBackfillBatchResultDecoder,
        pastScheduleBackfillBatchResultSchema,
        pastScheduleBackfillBatchGoldenResult,
      ],
    ] as const;

    for (const [decoder, schema, golden] of cases) {
      const decoded = decoder.safeDecode(golden);
      expect(decoded.success).toBe(true);
      if (decoded.success) expect(decoded.data).toBe(golden);
      expect(schema.parse(golden)).toEqual(golden);
    }
  });

  it('fails closed on malformed periods, records, and batch results', () => {
    expect(
      pastSchedulePeriodListDecoder.safeDecode([
        { ...pastSchedulePeriodsGoldenResponse[0], businessMonth: '2026-7' },
      ]).success,
    ).toBe(false);
    expect(
      pastScheduleBackfillRecordListDecoder.safeDecode([
        { ...pastScheduleBackfillRecordsGoldenResponse[0], businessDate: '2026-7-2' },
      ]).success,
    ).toBe(false);
    expect(
      pastScheduleBackfillBatchResultDecoder.safeDecode({
        ...pastScheduleBackfillBatchGoldenResult,
        assignments: [
          { ...pastScheduleBackfillBatchGoldenResult.assignments[0], slotPosition: 1.5 },
        ],
      }).success,
    ).toBe(false);
  });
});
