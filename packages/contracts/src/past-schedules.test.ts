import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  MAX_PAST_SCHEDULE_BACKFILL_BATCH_ITEMS,
  pastScheduleBackfillBatchRequestSchema,
} from './past-schedules.js';

function item(day: number, scheduleRoleId = randomUUID()) {
  return {
    actualMembershipId: randomUUID(),
    businessDate: `2026-07-${String(day).padStart(2, '0')}`,
    scheduleRoleId,
    shiftTypeId: randomUUID(),
  };
}

describe('past schedule backfill batch contracts', () => {
  it('accepts one and thirty-one strictly dated items and trims the shared reason', () => {
    const one = pastScheduleBackfillBatchRequestSchema.safeParse({ items: [item(1)] });
    const maximum = pastScheduleBackfillBatchRequestSchema.safeParse({
      items: Array.from({ length: MAX_PAST_SCHEDULE_BACKFILL_BATCH_ITEMS }, (_, index) =>
        item(index + 1),
      ),
      operationId: randomUUID(),
      reason: '  月度集中补录  ',
    });

    expect(one.success).toBe(true);
    expect(maximum.success).toBe(true);
    if (maximum.success) expect(maximum.data.reason).toBe('月度集中补录');
  });

  it('rejects thirty-two items, duplicate role/date keys, and invalid calendar dates', () => {
    const roleId = randomUUID();
    const duplicate = item(1, roleId);

    expect(
      pastScheduleBackfillBatchRequestSchema.safeParse({
        items: Array.from({ length: MAX_PAST_SCHEDULE_BACKFILL_BATCH_ITEMS + 1 }, (_, index) =>
          item((index % 31) + 1),
        ),
      }).success,
    ).toBe(false);
    expect(
      pastScheduleBackfillBatchRequestSchema.safeParse({
        items: [duplicate, { ...duplicate, actualMembershipId: randomUUID() }],
      }).success,
    ).toBe(false);
    expect(
      pastScheduleBackfillBatchRequestSchema.safeParse({
        items: [{ ...item(1), businessDate: '2026-02-31' }],
      }).success,
    ).toBe(false);
  });
});
