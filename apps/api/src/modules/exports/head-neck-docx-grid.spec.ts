import { describe, expect, it } from 'vitest';

import {
  buildHeadNeckRotationGrid,
  resolveHeadNeckDutyMembershipId,
} from './head-neck-docx-grid.js';

const members = ['xu', 'xu-man', 'huang', 'hong', 'feng', 'lin'] as const;

describe('head-neck DOCX column-major rotation grid', () => {
  it('keeps leading and trailing cells empty while filling top-to-bottom then left-to-right', () => {
    const assignments = Array.from({ length: 30 }, (_, index) => ({
      businessDate: `2026-09-${String(index + 1).padStart(2, '0')}`,
      membershipId: members[(index + 5) % members.length]!,
    }));

    expect(buildHeadNeckRotationGrid(members, assignments)).toEqual([
      { membershipId: 'xu', tokens: [undefined, 2, 8, 14, 20, 26] },
      { membershipId: 'xu-man', tokens: [undefined, 3, 9, 15, 21, 27] },
      { membershipId: 'huang', tokens: [undefined, 4, 10, 16, 22, 28] },
      { membershipId: 'hong', tokens: [undefined, 5, 11, 17, 23, 29] },
      { membershipId: 'feng', tokens: [undefined, 6, 12, 18, 24, 30] },
      { membershipId: 'lin', tokens: [1, 7, 13, 19, 25, undefined] },
    ]);
  });

  it('uses a dash for a skipped rotation slot and continues the following date on that row', () => {
    expect(
      buildHeadNeckRotationGrid(members, [
        { businessDate: '2026-09-01', membershipId: 'lin' },
        { businessDate: '2026-09-02', membershipId: 'xu-man' },
        { businessDate: '2026-09-03', membershipId: 'huang' },
      ]),
    ).toEqual([
      { membershipId: 'xu', tokens: [undefined, '-'] },
      { membershipId: 'xu-man', tokens: [undefined, 2] },
      { membershipId: 'huang', tokens: [undefined, 3] },
      { membershipId: 'hong', tokens: [undefined, undefined] },
      { membershipId: 'feng', tokens: [undefined, undefined] },
      { membershipId: 'lin', tokens: [1, undefined] },
    ]);
  });

  it('fails closed when an actual duty member is outside the configured roster', () => {
    expect(() =>
      buildHeadNeckRotationGrid(members, [{ businessDate: '2026-09-01', membershipId: 'unknown' }]),
    ).toThrow('Word 排班包含未配置的一值人员');
  });

  it('normalizes historical membership IDs by user and falls back to planned duty', () => {
    const aliases = new Map([
      ['old-lin', 'lin'],
      ['lin', 'lin'],
      ['old-feng', 'feng'],
    ]);
    expect(
      resolveHeadNeckDutyMembershipId(
        { actualMembershipId: 'old-lin', plannedMembershipId: 'old-feng' },
        aliases,
      ),
    ).toBe('lin');
    expect(
      resolveHeadNeckDutyMembershipId(
        { actualMembershipId: null, plannedMembershipId: 'old-feng' },
        aliases,
      ),
    ).toBe('feng');
    expect(
      resolveHeadNeckDutyMembershipId(
        { actualMembershipId: 'outside', plannedMembershipId: null },
        aliases,
      ),
    ).toBeUndefined();
  });
});
