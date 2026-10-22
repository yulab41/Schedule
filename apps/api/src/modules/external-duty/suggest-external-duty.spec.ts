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

  it('plans a repeated swap after an explicit choice of the webpage', () => {
    const rows = [
      { ...row('2026-10-22', '甲', '乙'), changeSource: 'both' as const },
      row('2026-10-23', '乙', '甲'),
    ];
    expect(suggestExternalDuty(rows, 'manual').get('2026-10-22')).toMatchObject({
      kind: 'swap',
      dates: ['2026-10-22', '2026-10-23'],
      steps: [{ date: '2026-10-22', targetDate: '2026-10-23' }],
    });
    expect(suggestExternalDuty(rows).get('2026-10-23')?.kind).toBe('blocked');
  });

  it('does not let an unrelated conflict block a complete swap', () => {
    const plans = suggestExternalDuty([
      row('2026-10-22', '甲', '乙'),
      row('2026-10-23', '乙', '甲'),
      { ...row('2026-10-24', '丙', '丁'), changeSource: 'both' as const },
    ]);
    expect(plans.get('2026-10-22')?.kind).toBe('swap');
  });

  it('includes every connected date when counts change', () => {
    const plans = suggestExternalDuty(
      [
        { ...row('2026-10-22', '甲', '乙'), changeSource: 'both' as const },
        row('2026-10-23', '乙', '丙'),
        row('2026-10-24', '丁', '戊'),
      ],
      'manual',
    );
    expect(plans.get('2026-10-22')).toMatchObject({
      kind: 'duty',
      dates: ['2026-10-22', '2026-10-23'],
    });
  });

  it('never bypasses a processing or blocked related row in manual mode', () => {
    for (const status of ['processing', 'blocked'] as const) {
      expect(
        suggestExternalDuty(
          [row('2026-10-22', '甲', '乙'), { ...row('2026-10-23', '乙', '甲'), status }],
          'manual',
        ).get('2026-10-22')?.kind,
      ).toBe('blocked');
    }
  });
});
