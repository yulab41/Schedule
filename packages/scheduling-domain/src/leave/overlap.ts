export interface TimeIntervalInput {
  readonly endsAt: Date;
  readonly startsAt: Date;
}

export interface MemberTimeInterval extends TimeIntervalInput {
  readonly membershipId: string;
}

export function intervalsOverlap(left: TimeIntervalInput, right: TimeIntervalInput): boolean {
  return (
    left.startsAt.valueOf() < right.endsAt.valueOf() &&
    left.endsAt.valueOf() > right.startsAt.valueOf()
  );
}

export function findLeaveOverlappingAssignments<
  Assignment extends TimeIntervalInput & {
    readonly plannedMembershipId: string | null;
  },
>(assignments: readonly Assignment[], leave: MemberTimeInterval): Assignment[] {
  return assignments.filter(
    (assignment) =>
      assignment.plannedMembershipId === leave.membershipId && intervalsOverlap(assignment, leave),
  );
}
