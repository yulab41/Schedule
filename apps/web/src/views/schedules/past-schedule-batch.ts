export interface PastScheduleBackfillAttempt {
  readonly fingerprint: string;
  readonly operationId: string;
}

export function resolvePastScheduleBackfillAttempt(
  current: PastScheduleBackfillAttempt | undefined,
  fingerprint: string,
  createOperationId: () => string,
): PastScheduleBackfillAttempt {
  if (current?.fingerprint === fingerprint) {
    return current;
  }
  return Object.freeze({ fingerprint, operationId: createOperationId() });
}
