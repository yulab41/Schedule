import { describe, expect, it, vi } from 'vitest';

import { getWorkflowOperationFingerprint, resolveWorkflowOperationAttempt } from '../src/index.js';

describe('workflow operation attempt', () => {
  it('reuses one detached frozen snapshot and changes ids only with payload semantics', () => {
    const createOperationId = vi
      .fn()
      .mockReturnValueOnce('11111111-1111-4111-8111-111111111111')
      .mockReturnValueOnce('22222222-2222-4222-8222-222222222222');
    const payload = {
      expectedPeriodVersions: { b: 2, a: 1 },
      expectedVersion: 3,
      reason: '病假',
    };
    const first = resolveWorkflowOperationAttempt(undefined, payload, createOperationId);
    payload.expectedPeriodVersions.a = 99;
    const replay = resolveWorkflowOperationAttempt(
      first.attempt,
      { expectedPeriodVersions: { a: 1, b: 2 }, expectedVersion: 3, reason: '病假' },
      createOperationId,
    );
    const changed = resolveWorkflowOperationAttempt(
      replay.attempt,
      { expectedPeriodVersions: { a: 1, b: 2 }, expectedVersion: 3, reason: '进修' },
      createOperationId,
    );

    expect(replay.snapshot).toBe(first.snapshot);
    expect(replay.snapshot).toEqual({
      expectedPeriodVersions: { a: 1, b: 2 },
      expectedVersion: 3,
      operationId: '11111111-1111-4111-8111-111111111111',
      reason: '病假',
    });
    expect(Object.isFrozen(replay.snapshot)).toBe(true);
    expect(Object.isFrozen(replay.snapshot.expectedPeriodVersions)).toBe(true);
    expect(changed.snapshot.operationId).toBe('22222222-2222-4222-8222-222222222222');
    expect(createOperationId).toHaveBeenCalledTimes(2);
  });

  it('uses a canonical fingerprint independent of object key order', () => {
    expect(getWorkflowOperationFingerprint({ b: 2, a: { d: 4, c: 3 } })).toBe(
      getWorkflowOperationFingerprint({ a: { c: 3, d: 4 }, b: 2 }),
    );
  });
});
