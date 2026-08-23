import { describe, expect, it, vi } from 'vitest';

import { resolvePastScheduleBackfillAttempt } from './past-schedule-batch.js';

describe('past schedule backfill attempt', () => {
  it('reuses an operation id only while the frozen payload fingerprint is unchanged', () => {
    const createOperationId = vi
      .fn()
      .mockReturnValueOnce('11111111-1111-4111-8111-111111111111')
      .mockReturnValueOnce('22222222-2222-4222-8222-222222222222');

    const first = resolvePastScheduleBackfillAttempt(undefined, 'payload-a', createOperationId);
    const retry = resolvePastScheduleBackfillAttempt(first, 'payload-a', createOperationId);
    const changed = resolvePastScheduleBackfillAttempt(retry, 'payload-b', createOperationId);

    expect(retry).toBe(first);
    expect(changed).toEqual({
      fingerprint: 'payload-b',
      operationId: '22222222-2222-4222-8222-222222222222',
    });
    expect(createOperationId).toHaveBeenCalledTimes(2);
  });
});
