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

  it('blocks an overnight shift carried from the previous business date into an all-day leave', () => {
    const leave = {
      startsAt: new Date('2026-10-01T00:00:00Z'),
      endsAt: new Date('2026-10-02T00:00:00Z'),
      isAllDay: true,
    };
    expect(
      leaveOverlapsInterval(leave, {
        businessDate: '2026-09-30',
        startsAt: new Date('2026-09-30T12:00:00Z'),
        endsAt: new Date('2026-10-01T01:00:00Z'),
      }),
    ).toBe(true);
    expect(
      leaveOverlapsInterval(leave, {
        businessDate: '2026-09-30',
        startsAt: new Date('2026-09-30T08:00:00Z'),
        endsAt: new Date('2026-09-30T16:00:00Z'),
      }),
    ).toBe(false);
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

  it('finds all-day leave overlap by business date even when assignment timestamps are stored as UTC midnight', () => {
    const assignments = [
      {
        businessDate: '2026-09-02',
        endsAt: new Date('2026-09-03T00:00:00.000Z'),
        plannedMembershipId: 'member-a',
        startsAt: new Date('2026-09-02T00:00:00.000Z'),
      },
      {
        businessDate: '2026-09-01',
        endsAt: new Date('2026-09-02T00:00:00.000Z'),
        plannedMembershipId: 'member-a',
        startsAt: new Date('2026-09-01T00:00:00.000Z'),
      },
    ];
    const leave = {
      endsAt: new Date('2026-09-02T00:00:00.000Z'),
      isAllDay: 1 as const,
      membershipId: 'member-a',
      startsAt: new Date('2026-09-01T00:00:00.000Z'),
    };

    expect(findLeaveOverlappingAssignments(assignments, leave)).toEqual([assignments[1]]);
  });

  it('reads an all-day leave boundary as a China calendar date instead of a handover business date', () => {
    // 请假 2027-05-01 ~ 2027-05-06 按中国日历日 00:00 存储（结束时间排他）。
    const leave = {
      endsAt: new Date('2027-05-06T16:00:00.000Z'),
      isAllDay: true as const,
      startsAt: new Date('2027-04-30T16:00:00.000Z'),
    };
    const previousDayAllDay = {
      businessDate: '2027-04-29',
      endsAt: new Date('2027-04-30T00:00:00.000Z'),
      startsAt: new Date('2027-04-29T00:00:00.000Z'),
    };
    const carryingOvernight = {
      businessDate: '2027-04-30',
      endsAt: new Date('2027-05-01T00:00:00.000Z'),
      startsAt: new Date('2027-04-30T00:00:00.000Z'),
    };
    const firstLeaveDay = {
      businessDate: '2027-05-01',
      endsAt: new Date('2027-05-02T00:00:00.000Z'),
      startsAt: new Date('2027-05-01T00:00:00.000Z'),
    };
    const lastLeaveDay = {
      businessDate: '2027-05-06',
      endsAt: new Date('2027-05-07T00:00:00.000Z'),
      startsAt: new Date('2027-05-06T00:00:00.000Z'),
    };
    const dayAfterLeave = {
      businessDate: '2027-05-07',
      endsAt: new Date('2027-05-08T00:00:00.000Z'),
      startsAt: new Date('2027-05-07T00:00:00.000Z'),
    };

    expect(leaveOverlapsInterval(leave, previousDayAllDay)).toBe(false);
    expect(leaveOverlapsInterval(leave, carryingOvernight)).toBe(true);
    expect(leaveOverlapsInterval(leave, firstLeaveDay)).toBe(true);
    expect(leaveOverlapsInterval(leave, lastLeaveDay)).toBe(true);
    expect(leaveOverlapsInterval(leave, dayAfterLeave)).toBe(false);
  });
});
