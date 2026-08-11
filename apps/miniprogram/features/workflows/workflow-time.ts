import type { CalendarDutyAssignment } from '@schedule/contracts';

const cstOffsetMilliseconds = 8 * 60 * 60 * 1000;
const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const;
const businessDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/u;

export interface AllDayLeaveInterval {
  readonly dayCount: number;
  readonly endsAt: string;
  readonly startsAt: string;
}

export interface WorkflowCandidate {
  readonly assignment: CalendarDutyAssignment;
  readonly dutyMembershipId: string | undefined;
  readonly isWeekend: boolean;
  readonly label: string;
  readonly memberName: string;
  readonly weekday: (typeof weekdays)[number];
}

export interface WorkflowCandidates {
  readonly mine: readonly WorkflowCandidate[];
  readonly operable: readonly WorkflowCandidate[];
}

function parseBusinessDate(value: string): Date {
  const match = businessDatePattern.exec(value);
  if (match === null) throw new Error('业务日期必须使用 YYYY-MM-DD。');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error('业务日期无效。');
  }
  return date;
}

function formatBusinessDate(value: Date): string {
  return `${String(value.getUTCFullYear()).padStart(4, '0')}-${String(
    value.getUTCMonth() + 1,
  ).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`;
}

function getWeekday(value: string): (typeof weekdays)[number] {
  return weekdays[parseBusinessDate(value).getUTCDay()]!;
}

export function getChinaBusinessDate(now = new Date()): string {
  if (Number.isNaN(now.getTime())) throw new Error('当前时间无效。');
  return formatBusinessDate(new Date(now.getTime() + cstOffsetMilliseconds));
}

export function buildAllDayLeaveInterval(startDate: string, endDate: string): AllDayLeaveInterval {
  const start = parseBusinessDate(startDate);
  const end = parseBusinessDate(endDate);
  if (start.getTime() > end.getTime()) throw new Error('结束日期不能早于开始日期。');
  const exclusiveEnd = new Date(end.getTime());
  exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);
  return {
    dayCount: Math.floor((exclusiveEnd.getTime() - start.getTime()) / 86_400_000),
    endsAt: `${formatBusinessDate(exclusiveEnd)}T00:00:00.000+08:00`,
    startsAt: `${formatBusinessDate(start)}T00:00:00.000+08:00`,
  };
}

export function getWorkflowDutyMembershipId(
  assignment: CalendarDutyAssignment,
): string | undefined {
  return assignment.actualMembershipId ?? assignment.plannedMembershipId;
}

export function isWorkflowCandidateAssignment(
  assignment: CalendarDutyAssignment,
  now = new Date(),
): boolean {
  return assignment.businessDate >= getChinaBusinessDate(now);
}

export function createWorkflowCandidate(assignment: CalendarDutyAssignment): WorkflowCandidate {
  const weekday = getWeekday(assignment.businessDate);
  const isWeekend = weekday === '周六' || weekday === '周日';
  const memberName = assignment.actualMemberName ?? assignment.plannedMemberName ?? '未安排成员';
  return {
    assignment,
    dutyMembershipId: getWorkflowDutyMembershipId(assignment),
    isWeekend,
    label: `${assignment.businessDate} ${assignment.shiftTypeName}（${weekday}）· ${memberName}`,
    memberName,
    weekday,
  };
}

export function buildWorkflowCandidates(
  assignments: readonly CalendarDutyAssignment[],
  currentMembershipId: string,
  now = new Date(),
): WorkflowCandidates {
  const operable = assignments
    .filter((assignment) => isWorkflowCandidateAssignment(assignment, now))
    .map(createWorkflowCandidate);
  return {
    mine: operable.filter(({ dutyMembershipId }) => dutyMembershipId === currentMembershipId),
    operable,
  };
}
