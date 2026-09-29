import { getChinaStandardTimeBusinessDate, getChinaStandardTimeCalendarDate } from '../time.js';

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

  // 请假区间是日历日边界（中国标准时间 00:00 起算），不能用带 08:00 交接的业务日换算，
  // 否则 5 月 1 日开始的请假会被读成 4 月 30 日，误报前一日班次冲突并漏掉最后一天。
  const leaveStartDate = getChinaStandardTimeCalendarDate(leave.startsAt);
  const leaveEndDate = getChinaStandardTimeCalendarDate(leave.endsAt);
  const intervalDate = interval.businessDate ?? getChinaStandardTimeBusinessDate(interval.startsAt);
  return (
    (intervalDate >= leaveStartDate && intervalDate < leaveEndDate) ||
    intervalsOverlap(
      {
        startsAt: new Date(`${leaveStartDate}T00:00:00+08:00`),
        endsAt: new Date(`${leaveEndDate}T00:00:00+08:00`),
      },
      interval,
    )
  );
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
