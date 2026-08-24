import { describe, expect, it } from 'vitest';

import { isSwapRequestDateRevocable } from './swap-service.js';

describe('swap revocation date presentation', () => {
  it('hides revoke when either exchanged business date is already past', () => {
    const now = new Date('2026-08-24T08:00:00+08:00');
    expect(isSwapRequestDateRevocable('2026-08-24', '2026-08-25', now)).toBe(true);
    expect(isSwapRequestDateRevocable('2026-08-23', '2026-08-25', now)).toBe(false);
    expect(isSwapRequestDateRevocable('2026-08-24', '2026-08-23', now)).toBe(false);
  });
});
