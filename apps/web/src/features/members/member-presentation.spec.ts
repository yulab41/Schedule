import { describe, expect, it } from 'vitest';

import { getClaimRequestTone, getMemberClaimTone } from './member-presentation.js';

describe('member mobile card presentation', () => {
  it('distinguishes member identity states without changing claim semantics', () => {
    expect(getMemberClaimTone({ isPendingRoster: true })).toBe('warning');
    expect(getMemberClaimTone({ isUnclaimed: true })).toBe('warning');
    expect(getMemberClaimTone({ claimRequestStatus: 'pending' })).toBe('warning');
    expect(getMemberClaimTone({ isClaimedByCurrentUser: true })).toBe('success');
    expect(getMemberClaimTone({})).toBe('success');
  });

  it('maps claim review states to accessible semantic tones', () => {
    expect(getClaimRequestTone('pending')).toBe('warning');
    expect(getClaimRequestTone('approved')).toBe('success');
    expect(getClaimRequestTone('rejected')).toBe('danger');
    expect(getClaimRequestTone('cancelled')).toBe('neutral');
  });
});
