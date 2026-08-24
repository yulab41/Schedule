import { describe, expect, it } from 'vitest';

import {
  createVisitorAccessCutoff,
  toChinaAccessMonth,
  visitorAccessRetentionDays,
} from './privacy-retention.js';

describe('visitor access privacy retention', () => {
  it('keeps the exact 90-day boundary and expires only earlier instants', () => {
    const now = new Date('2026-08-24T00:00:00.000Z');
    const cutoff = createVisitorAccessCutoff(now);

    expect(visitorAccessRetentionDays).toBe(90);
    expect(cutoff.toISOString()).toBe('2026-05-26T00:00:00.000Z');
    expect(new Date(cutoff.valueOf() - 1).valueOf()).toBeLessThan(cutoff.valueOf());
    expect(new Date(cutoff.valueOf()).valueOf()).toBe(cutoff.valueOf());
  });

  it('buckets access months at the fixed China-standard boundary', () => {
    expect(toChinaAccessMonth(new Date('2026-01-31T15:59:59.999Z'))).toBe('2026-01');
    expect(toChinaAccessMonth(new Date('2026-01-31T16:00:00.000Z'))).toBe('2026-02');
  });
});
