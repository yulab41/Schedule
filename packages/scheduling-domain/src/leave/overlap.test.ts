import { describe, expect, it } from 'vitest';

import {
  findLeaveOverlappingAssignments,
  intervalsOverlap,
  leaveOverlapsInterval,
} from './overlap.js';

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

  it('compares all-day leaves by China business date instead of raw UTC timestamps', () => {
    const allDayLeaveStoredAsUtcMidnight = {
      endsAt: new Date('2026-09-02T00:00:00.000Z'),
      isAllDay: 1 as const,
      startsAt: new Date('2026-09-01T00:00:00.000Z'),
    };
    const sep1ChinaShift = {
      businessDate: '2026-09-01',
      endsAt: new Date('2026-09-01T16:00:00.000Z'),
      startsAt: new Date('2026-08-31T16:00:00.000Z'),
    };
    const sep2ChinaShift = {
      businessDate: '2026-09-02',
      endsAt: new Date('2026-09-02T16:00:00.000Z'),
      startsAt: new Date('2026-09-01T16:00:00.000Z'),
    };

    expect(leaveOverlapsInterval(allDayLeaveStoredAsUtcMidnight, sep1ChinaShift)).toBe(true);
    expect(leaveOverlapsInterval(allDayLeaveStoredAsUtcMidnight, sep2ChinaShift)).toBe(false);
  });

  it('keeps raw interval comparison for partial-day leaves', () => {
    const partialLeave = {
      endsAt: new Date('2026-09-01T12:00:00.000Z'),
      isAllDay: false as const,
      startsAt: new Date('2026-09-01T08:00:00.000Z'),
    };
    expect(
      leaveOverlapsInterval(partialLeave, {
        endsAt: new Date('2026-09-01T16:00:00.000Z'),
        startsAt: new Date('2026-09-01T09:00:00.000Z'),
      }),
    ).toBe(true);
    expect(
      leaveOverlapsInterval(partialLeave, {
        endsAt: new Date('2026-09-02T16:00:00.000Z'),
        startsAt: new Date('2026-09-02T00:00:00.000Z'),
      }),
    ).toBe(false);
  });
});
