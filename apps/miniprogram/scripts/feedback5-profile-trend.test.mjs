import { describe, expect, it } from 'vitest';
import { buildProfileYearTrend, profileTrendYears } from '../src/components/profile-panel/trend.ts';

describe('rolling twelve month Mini profile trend', () => {
  it('requests only the years covered by the inclusive window', () => {
    expect(profileTrendYears('2026-09')).toEqual([2025, 2026]);
    expect(profileTrendYears('2026-12')).toEqual([2026]);
  });
  it('keeps unavailable months distinct from real zero and overrides the current month', () => {
    const points = buildProfileYearTrend(
      '2026-09',
      'm',
      [
        {
          months: [
            {
              businessMonth: '2025-10',
              summary: { members: [{ membershipId: 'm', actualCount: 4 }] },
            },
            { businessMonth: '2026-08', summary: { members: [] } },
          ],
        },
      ],
      8,
    );
    expect(points).toHaveLength(12);
    expect(points[0]).toMatchObject({ businessMonth: '2025-10', count: 4 });
    expect(points[1].count).toBeUndefined();
    expect(points[10].count).toBe(0);
    expect(points[11]).toMatchObject({ businessMonth: '2026-09', count: 8 });
  });
});
