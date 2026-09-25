import { describe, expect, it } from 'vitest';
import { overlappingBusinessDates } from './publication-overlap.js';

describe('publication date overlap', () => {
  it('does not flag December 31 through February when only December 1-30 is published', () => {
    const existing = Array.from({ length: 30 }, (_, index) => ({
      businessDate: `2026-12-${String(index + 1).padStart(2, '0')}`,
    }));
    const incoming = ['2026-12-31', '2027-01-01', '2027-02-01'].map((businessDate) => ({
      businessDate,
    }));
    expect(overlappingBusinessDates(existing, incoming)).toEqual([]);
  });

  it('flags every overlapping date once even when the number of shifts differs', () => {
    expect(
      overlappingBusinessDates(
        [
          { businessDate: '2026-12-30' },
          { businessDate: '2026-12-30' },
          { businessDate: '2026-12-31' },
        ],
        [{ businessDate: '2026-12-31' }, { businessDate: '2026-12-31' }],
      ),
    ).toEqual(['2026-12-31']);
  });
});
