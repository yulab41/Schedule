import { getChinaStandardTimeBusinessDate } from '../time.js';

export interface TimeIntervalInput {
  readonly endsAt: Date;
  readonly startsAt: Date;
}

export interface MemberTimeInterval extends TimeIntervalInput {
  readonly isAllDay?: boolean | number;
  readonly membershipId: string;
}

export function intervalsOverlap(left: TimeIntervalInput, right: TimeIntervalInput): boolean {
  return (
    left.startsAt.valueOf() < right.endsAt.valueOf() &&
    left.endsAt.valueOf() > right.startsAt.valueOf()
  );
}

export interface LeaveIntervalInput extends TimeIntervalInput {
  readonly isAllDay?: boolean | number;
}

export interface BusinessDateIntervalInput extends TimeIntervalInput {
  readonly businessDate?: string;
}

export function leaveOverlapsInterval(
  leave: LeaveIntervalInput,
  interval: BusinessDateIntervalInput,
): boolean {
  if (leave.isAllDay !== true && leave.isAllDay !== 1) {
    return intervalsOverlap(leave, interval);
  }

  const leaveStartDate = getChinaStandardTimeBusinessDate(leave.startsAt);
  const leaveEndDate = getChinaStandardTimeBusinessDate(leave.endsAt);
  const intervalDate = interval.businessDate ?? getChinaStandardTimeBusinessDate(interval.startsAt);
  return intervalDate >= leaveStartDate && intervalDate < leaveEndDate;
}

export function findLeaveOverlappingAssignments<
  Assignment extends TimeIntervalInput & {
    readonly plannedMembershipId: string | null;
  },
>(assignments: readonly Assignment[], leave: MemberTimeInterval): Assignment[] {
  return assignments.filter(
    (assignment) =>
      assignment.plannedMembershipId === leave.membershipId &&
      leaveOverlapsInterval(leave, assignment),
  );
}
