import { describe, expect, it } from 'vitest';

import { findLeaveOverlappingAssignments, intervalsOverlap } from './overlap.js';

describe('leave overlap', () => {
  it('reports any partial overlap as a conflict', () => {
    const allDayShift = {
      endsAt: new Date('2026-08-02T00:00:00.000Z'),
      plannedMembershipId: 'member-a',
      startsAt: new Date('2026-08-01T00:00:00.000Z'),
    };
    const partialLeave = {
      endsAt: new Date('2026-08-01T22:00:00.000Z'),
      startsAt: new Date('2026-08-01T20:00:00.000Z'),
    };

    expect(intervalsOverlap(allDayShift, partialLeave)).toBe(true);
    expect(intervalsOverlap(partialLeave, allDayShift)).toBe(true);
  });

  it('treats a leave ending exactly at the next shift start as non-overlapping', () => {
    expect(
      intervalsOverlap(
        {
          endsAt: new Date('2026-08-03T00:00:00.000Z'),
          startsAt: new Date('2026-08-02T00:00:00.000Z'),
        },
        {
          endsAt: new Date('2026-08-02T00:00:00.000Z'),
          startsAt: new Date('2026-08-01T12:00:00.000Z'),
        },
      ),
    ).toBe(false);
  });

  it('keeps shifts of other members outside the leave', () => {
    const assignments = [
      {
        endsAt: new Date('2026-08-02T00:00:00.000Z'),
        plannedMembershipId: 'member-a',
        startsAt: new Date('2026-08-01T00:00:00.000Z'),
      },
      {
        endsAt: new Date('2026-08-03T00:00:00.000Z'),
        plannedMembershipId: 'member-b',
        startsAt: new Date('2026-08-02T00:00:00.000Z'),
      },
    ];

    expect(
      findLeaveOverlappingAssignments(assignments, {
        endsAt: new Date('2026-08-01T22:00:00.000Z'),
        membershipId: 'member-a',
        startsAt: new Date('2026-08-01T20:00:00.000Z'),
      }),
    ).toEqual([assignments[0]]);
  });
});
