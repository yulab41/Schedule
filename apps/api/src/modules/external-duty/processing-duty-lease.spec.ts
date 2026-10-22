import { describe, expect, it } from 'vitest';
import { activeDutyLease, DUTY_PROCESSING_LEASE_MS } from './processing-duty-lease.js';
describe('external duty processing lease', () => {
  it('keeps a fresh claim and recovers abandoned claims without scanner renewal', () => {
    const row = { status: 'processing', observedAt: new Date(0) };
    expect(activeDutyLease(row, 0)).toBe(true);
    expect(activeDutyLease(row, DUTY_PROCESSING_LEASE_MS - 1)).toBe(true);
    expect(activeDutyLease(row, DUTY_PROCESSING_LEASE_MS)).toBe(false);
    expect(activeDutyLease({ ...row, status: 'pending' }, 0)).toBe(false);
    expect(activeDutyLease(row, -1)).toBe(false);
  });
});
