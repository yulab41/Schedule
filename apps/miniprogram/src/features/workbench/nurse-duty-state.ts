import type { CalendarDutyAssignment } from '@schedule/contracts';

export type DutyState = '' | 'before' | 'working' | 'rest' | 'done';
export interface DutyStateView {
  readonly dutyState: DutyState;
  readonly dutyStateLabel: string;
  readonly defaultCollapsed: boolean;
  readonly nextBoundary: number;
}
export const nurseShiftOrder = ['电脑', 'D', 'A', 'P', 'N', 'NP'] as const;
type NurseShift = (typeof nurseShiftOrder)[number];
const segments: Readonly<Record<NurseShift, readonly (readonly [number, number])[]>> = {
  电脑: [
    [480, 720],
    [870, 1050],
  ],
  D: [
    [480, 720],
    [870, 1050],
  ],
  A: [[480, 930]],
  P: [[930, 1320]],
  N: [[1320, 1920]],
  NP: [
    [1050, 1320],
    [1860, 2100],
  ],
};
const labels: Readonly<Record<DutyState, string>> = {
  '': '',
  before: '未上班',
  working: '正在上班',
  rest: '休息中',
  done: '已下班',
};
export function nurseShiftCode(name: string): NurseShift | undefined {
  const normalized = name.replace(/\s|班/gu, '').toUpperCase();
  return nurseShiftOrder.find((code) => code === normalized);
}
export function isNurseCalendarGroup(groupName: string): boolean {
  // This approved preset belongs to this group, not every group containing an A/N shift.
  return groupName.trim() === '头颈外科护士';
}
export function getNurseDutyState(
  assignment: CalendarDutyAssignment,
  enabled: boolean,
  now: Date,
): DutyStateView {
  const code =
    nurseShiftCode(assignment.shiftTypeName) ?? nurseShiftCode(assignment.shiftTypeAbbreviation);
  const start = Date.parse(`${assignment.businessDate}T00:00:00+08:00`);
  const current = now.getTime();
  if (!enabled || code === undefined || !Number.isFinite(start) || !Number.isFinite(current)) {
    return { dutyState: '', dutyStateLabel: '', defaultCollapsed: false, nextBoundary: 0 };
  }
  const intervals = segments[code].map(
    ([from, to]) => [start + from * 60000, start + to * 60000] as const,
  );
  const first = intervals[0]!;
  const last = intervals[intervals.length - 1]!;
  const dutyState: DutyState =
    current < first[0]
      ? 'before'
      : current >= last[1]
        ? 'done'
        : intervals.some(([from, to]) => current >= from && current < to)
          ? 'working'
          : 'rest';
  return {
    dutyState,
    dutyStateLabel: labels[dutyState],
    defaultCollapsed: dutyState === 'rest' || dutyState === 'done',
    nextBoundary: intervals.flat().find((boundary) => boundary > current) ?? 0,
  };
}
