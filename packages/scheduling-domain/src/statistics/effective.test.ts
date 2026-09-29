import { describe, expect, it } from 'vitest';
import { calculateEffectiveStatistics, mergeEffectiveStatistics } from './effective.js';
import type { StatisticsAssignmentInput } from './calculate.js';

const assignment = (
  id: string,
  planned: string,
  actual = planned,
  shift = 'A',
  counted = true,
): StatisticsAssignmentInput => ({
  id,
  plannedMemberId: planned,
  actualMemberId: actual,
  plannedMemberName: planned,
  actualMemberName: actual,
  businessDate: '2026-10-10',
  countsTowardStatistics: counted,
  scheduleRoleId: 'r',
  scheduleRoleName: '岗位',
  shiftTypeId: shift,
  shiftTypeName: shift,
});
describe('effective statistics', () => {
  it('keeps exactly six doctors without adding a seventh nameless historical member', () => {
    const result = calculateEffectiveStatistics({
      assignments: Array.from({ length: 6 }, (_, i) => assignment(`shift-${i}`, `doctor-${i}`)),
      holidays: [],
      memberNames: [{ membershipId: 'old-empty-member', realName: '' }],
      contributions: [
        {
          id: 'removed-request',
          kind: 'swap',
          assignmentId: 'removed-shift',
          membershipId: 'old-empty-member',
        },
      ],
    });
    expect(result.summary.members).toHaveLength(6);
    expect(result.summary.members.every((row) => row.realName && row.actualCount === 1)).toBe(true);
  });

  it('counts each swap once for the group, each receiver once, and only that receiver in the shift detail', () => {
    const result = calculateEffectiveStatistics({
      assignments: [assignment('1', 'a', 'b'), assignment('2', 'b', 'a', 'N')],
      holidays: [],
      memberNames: [],
      contributions: [
        { id: 'swap1', kind: 'swap', assignmentId: '1', membershipId: 'b' },
        { id: 'swap1', kind: 'swap', assignmentId: '2', membershipId: 'a' },
        { id: 'swap1', kind: 'swap', assignmentId: '1', membershipId: 'b' },
      ],
    });
    expect(result.summary).toMatchObject({ plannedCount: 2, actualCount: 2, swapCount: 1 });
    const a = result.summary.members.find((row) => row.membershipId === 'a');
    expect(a).toMatchObject({ plannedCount: 1, actualCount: 1, swapCount: 1 });
    expect(a?.byShiftType).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          shiftTypeId: 'A',
          plannedCount: 1,
          actualCount: 0,
          swapCount: 0,
        }),
        expect.objectContaining({
          shiftTypeId: 'N',
          plannedCount: 0,
          actualCount: 1,
          swapCount: 1,
        }),
      ]),
    );
  });
  it('preserves rest detail without adding it to any duty totals', () => {
    const result = calculateEffectiveStatistics({
      assignments: [assignment('1', 'a'), assignment('2', 'a', 'a', '休', false)],
      holidays: [],
      memberNames: [],
      contributions: [],
    });
    expect(result.summary).toMatchObject({ plannedCount: 1, actualCount: 1, weekendCount: 1 });
    expect(result.summary.members[0]?.byShiftType).toContainEqual(
      expect.objectContaining({
        shiftTypeName: '休',
        plannedCount: 1,
        actualCount: 1,
        countsTowardStatistics: false,
        weekendCount: 1,
      }),
    );
  });
  it('keeps rest changes in shift detail only and never duplicates a mixed counted/rest swap', () => {
    const month = calculateEffectiveStatistics({
      assignments: [assignment('a', 'a', 'b', 'A'), assignment('r', 'b', 'a', '休', false)],
      holidays: [],
      memberNames: [],
      contributions: [
        { id: 's', kind: 'swap', assignmentId: 'a', membershipId: 'b' },
        { id: 's', kind: 'swap', assignmentId: 'r', membershipId: 'a' },
        { id: 'd', kind: 'deduction', assignmentId: 'r', membershipId: 'b' },
      ],
    });
    expect(month.summary).toMatchObject({ swapCount: 1, deductionCount: 0 });
    expect(month.summary.members.find((row) => row.membershipId === 'a')).toMatchObject({
      swapCount: 0,
    });
    expect(
      month.summary.members
        .find((row) => row.membershipId === 'a')
        ?.byShiftType.find((row) => row.shiftTypeId === '休'),
    ).toMatchObject({ swapCount: 1 });
    expect(
      mergeEffectiveStatistics([month]).summary.byShiftType.find((row) => row.shiftTypeId === '休'),
    ).toMatchObject({ deductionCount: 1, swapCount: 1 });
  });
  it('deduplicates cross-month requests annually without losing per-month and member attribution', () => {
    const months = ['a', 'b'].map((member, i) =>
      calculateEffectiveStatistics({
        assignments: [assignment(String(i), 'original', member)],
        holidays: [],
        memberNames: [],
        contributions: [
          { id: 'same-swap', kind: 'swap', assignmentId: String(i), membershipId: member },
        ],
      }),
    );
    expect(months.map((month) => month.summary.swapCount)).toEqual([1, 1]);
    expect(mergeEffectiveStatistics(months).summary).toMatchObject({
      swapCount: 1,
      actualCount: 2,
    });
  });
  it('ignores contributions for removed assignments and never creates a phantom member', () => {
    const result = calculateEffectiveStatistics({
      assignments: [assignment('1', 'a')],
      holidays: [],
      memberNames: [],
      contributions: [
        { id: 'gone', kind: 'overtime', assignmentId: 'deleted', membershipId: 'ghost' },
      ],
    });
    expect(result.summary.members.map((row) => row.membershipId)).toEqual(['a']);
  });
});
