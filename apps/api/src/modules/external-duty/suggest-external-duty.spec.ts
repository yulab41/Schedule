import { describe, expect, it } from 'vitest';
import { suggestExternalDuty, type DutySuggestionRow } from './suggest-external-duty.js';

const row = (date: string, localName: string, remoteName: string): DutySuggestionRow => ({
  businessDate: date,
  schedulePeriodId: 'period',
  assignmentId: date,
  localName,
  remoteName,
  changeSource: localName === remoteName ? 'initial' : 'remote',
  status: localName === remoteName ? 'aligned' : 'pending',
});

describe('external duty suggestion', () => {
  it('finds two swaps for a three-person cycle', () => {
    const plan = suggestExternalDuty([
      row('2026-10-01', '甲', '乙'),
      row('2026-10-02', '乙', '丙'),
      row('2026-10-03', '丙', '甲'),
    ]).get('2026-10-01');
    expect(plan).toMatchObject({
      kind: 'swap',
      steps: [
        { date: '2026-10-01', targetDate: '2026-10-02' },
        { date: '2026-10-02', targetDate: '2026-10-03' },
      ],
    });
  });

  it('chooses duty adjustment when any person count changes', () => {
    expect(suggestExternalDuty([row('2026-10-01', '甲', '乙')]).get('2026-10-01')?.kind).toBe(
      'duty',
    );
  });

  it('does not claim an automatic plan while the period has a conflict', () => {
    const conflict = { ...row('2026-10-02', '乙', '丙'), changeSource: 'both' as const };
    expect(
      suggestExternalDuty([row('2026-10-01', '甲', '乙'), conflict]).get('2026-10-01')?.kind,
    ).toBe('blocked');
  });
});
