export const DUTY_PROCESSING_LEASE_MS = 10 * 60_000;
export const DUTY_EXECUTION_BUDGET_MS = 5 * 60_000;

// observedAt is fixed at claim time for a processing row. Scanner observations
// must not renew it: an interrupted request can then recover after ten minutes.
export function activeDutyLease(
  row: { readonly status: string; readonly observedAt: Date } | undefined,
  now = Date.now(),
): boolean {
  return (
    row?.status === 'processing' &&
    now - row.observedAt.valueOf() >= 0 &&
    now - row.observedAt.valueOf() < DUTY_PROCESSING_LEASE_MS
  );
}
