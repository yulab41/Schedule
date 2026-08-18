import { describe, expect, it } from 'vitest';

import { getBusinessHandoverRefreshDelay } from './manual-schedule-refresh.js';

describe('manual schedule business-date refresh', () => {
  it('waits for the 08:00 CST handover instead of looping after midnight', () => {
    const now = new Date('2026-08-17T23:45:00.000Z');

    expect(getBusinessHandoverRefreshDelay(now)).toBe(15 * 60 * 1000 + 5000);
  });

  it('schedules the following handover after the current business day has begun', () => {
    const now = new Date('2026-08-18T01:30:00.000Z');

    expect(getBusinessHandoverRefreshDelay(now)).toBe(22.5 * 60 * 60 * 1000 + 5000);
  });
});
