const millisecondsPerDay = 24 * 60 * 60 * 1000;
const chinaStandardTimeOffsetMilliseconds = 8 * 60 * 60 * 1000;
const businessDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/u;
const timePattern = /^\d{2}:\d{2}$/u;
const weekdayLabels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const;

export type WorkflowRequestStatus =
  'cancelled' | 'completed' | 'pending_approval' | 'pending_target' | 'rejected' | 'revoked';
export type WorkflowStatusTone = 'danger' | 'neutral' | 'success' | 'warning';
export type LeaveRequestStatus = 'approved' | 'pending' | 'rejected';
export type LeaveRequestType = 'maternity' | 'other' | 'rotation' | 'sick' | 'training';
export type LeaveReflowStrategy = 'keep-original-order' | 'shift-forward';
export type LeaveStatusTone = 'danger' | 'success' | 'warning';

export interface WorkflowAssignmentLike {
  readonly actualMemberName?: string | null | undefined;
  readonly actualMembershipId?: string | null | undefined;
  readonly businessDate: string;
  readonly id: string;
  readonly plannedMemberName?: string | null | undefined;
  readonly plannedMembershipId?: string | null | undefined;
  readonly shiftTypeName: string;
}

export interface WorkflowMemberLike {
  readonly membershipId: string;
  readonly realName: string;
}

export interface WorkflowCalendarLike<
  Assignment extends WorkflowAssignmentLike = WorkflowAssignmentLike,
  Member extends WorkflowMemberLike = WorkflowMemberLike,
> {
  readonly assignments: readonly Assignment[];
  readonly members: readonly Member[];
}

export interface OperableCandidateAssignments<
  Assignment extends WorkflowAssignmentLike = WorkflowAssignmentLike,
> {
  readonly operableAssignments: readonly Assignment[];
  readonly myAssignments: readonly Assignment[];
}

export interface SwapCandidateOptions<
  Assignment extends WorkflowAssignmentLike = WorkflowAssignmentLike,
  Member extends WorkflowMemberLike = WorkflowMemberLike,
> {
  readonly assignmentsByTarget: ReadonlyMap<string, readonly Assignment[]>;
  readonly myAssignments: readonly Assignment[];
  readonly targetOptions: readonly Member[];
}

export interface DutyAdjustmentCandidateOptions<
  Assignment extends WorkflowAssignmentLike = WorkflowAssignmentLike,
  Member extends WorkflowMemberLike = WorkflowMemberLike,
> {
  readonly adminShiftOptions: readonly Assignment[];
  readonly myAssignments: readonly Assignment[];
  readonly overtimeOptions: readonly Member[];
}

export interface LeaveFormInterval {
  readonly endsAt: string;
  readonly startsAt: string;
}

export interface LeaveAffectedAssignmentLike {
  readonly businessDate: string;
  readonly nextMemberName?: string | null | undefined;
  readonly previousMemberName?: string | null | undefined;
  readonly shiftTypeAbbreviation: string;
  readonly shiftTypeName: string;
}

export interface LeaveStatisticsDeltaLike {
  readonly byMember: readonly {
    readonly assignmentDelta: number;
    readonly realName: string;
  }[];
}

export interface AssignmentSummaryOptionLike {
  readonly actualMemberName?: string | null | undefined;
  readonly businessDate: string;
  readonly plannedMemberName?: string | null | undefined;
  readonly shiftTypeName: string;
}

export interface SwapRequestAssignmentPairLike {
  readonly initiatorAssignment: Pick<WorkflowAssignmentLike, 'businessDate'>;
  readonly targetAssignment: Pick<WorkflowAssignmentLike, 'businessDate'>;
}

const workflowStatusLabels: Readonly<
  Record<Exclude<WorkflowRequestStatus, 'pending_target'>, string>
> = {
  cancelled: '已取消',
  completed: '已生效',
  pending_approval: '待管理员审批',
  rejected: '已驳回',
  revoked: '已撤销',
};

export const leaveTypeLabels: Readonly<Record<LeaveRequestType, string>> = {
  maternity: '产假',
  other: '其他',
  rotation: '轮科',
  sick: '病假',
  training: '进修',
};

export const leaveStatusLabels: Readonly<Record<LeaveRequestStatus, string>> = {
  approved: '已批准',
  pending: '待审批',
  rejected: '已驳回',
};

export const reflowStrategyLabels: Readonly<Record<LeaveReflowStrategy, string>> = {
  'keep-original-order': '原轮值不变',
  'shift-forward': '整体顺延',
};

export function isOperableAssignment<
  Assignment extends Pick<WorkflowAssignmentLike, 'businessDate'>,
>(assignment: Assignment, now: Date = new Date()): boolean {
  return assignment.businessDate >= getTodayBusinessDate(now);
}

export function filterOperableAssignments<
  Assignment extends Pick<WorkflowAssignmentLike, 'businessDate'>,
>(assignments: readonly Assignment[], now: Date = new Date()): readonly Assignment[] {
  return assignments.filter((assignment) => isOperableAssignment(assignment, now));
}

export function buildOperableCandidateAssignments<Assignment extends WorkflowAssignmentLike>(
  calendar: Pick<WorkflowCalendarLike<Assignment>, 'assignments'>,
  myMembershipId: string,
  now: Date = new Date(),
): OperableCandidateAssignments<Assignment> {
  const operableAssignments = filterOperableAssignments(calendar.assignments, now);
  const myAssignments = operableAssignments.filter(
    (assignment) => getWorkflowDutyMembershipId(assignment) === myMembershipId,
  );
  return { operableAssignments, myAssignments };
}

export function groupAssignmentsByDutyMember<Assignment extends WorkflowAssignmentLike>(
  assignments: readonly Assignment[],
): ReadonlyMap<string, readonly Assignment[]> {
  const assignmentsByDutyMember = new Map<string, Assignment[]>();
  for (const assignment of assignments) {
    const dutyMemberId = getWorkflowDutyMembershipId(assignment);
    if (dutyMemberId === undefined) continue;
    const memberAssignments = assignmentsByDutyMember.get(dutyMemberId) ?? [];
    memberAssignments.push(assignment);
    assignmentsByDutyMember.set(dutyMemberId, memberAssignments);
  }
  return assignmentsByDutyMember;
}

export function buildSwapCandidates<
  Assignment extends WorkflowAssignmentLike,
  Member extends WorkflowMemberLike,
>(
  calendar: WorkflowCalendarLike<Assignment, Member>,
  myMembershipId: string,
  now: Date = new Date(),
): SwapCandidateOptions<Assignment, Member> {
  const { operableAssignments, myAssignments } = buildOperableCandidateAssignments(
    calendar,
    myMembershipId,
    now,
  );
  const assignmentsByTarget = groupAssignmentsByDutyMember(operableAssignments);
  const targetOptions = calendar.members.filter(
    (member) =>
      member.membershipId !== myMembershipId && assignmentsByTarget.has(member.membershipId),
  );
  return { assignmentsByTarget, myAssignments, targetOptions };
}

export function buildDutyAdjustmentCandidates<
  Assignment extends WorkflowAssignmentLike,
  Member extends WorkflowMemberLike,
>(
  calendar: WorkflowCalendarLike<Assignment, Member>,
  myMembershipId: string,
  now: Date = new Date(),
): DutyAdjustmentCandidateOptions<Assignment, Member> {
  const { operableAssignments, myAssignments } = buildOperableCandidateAssignments(
    calendar,
    myMembershipId,
    now,
  );
  const adminShiftOptions = operableAssignments.filter(
    (assignment) => getWorkflowDutyMembershipId(assignment) !== undefined,
  );
  const overtimeOptions = calendar.members.filter(
    (member) => member.membershipId !== myMembershipId,
  );
  return { adminShiftOptions, myAssignments, overtimeOptions };
}

export function getWorkflowDutyMembershipId(
  assignment: Pick<WorkflowAssignmentLike, 'actualMembershipId' | 'plannedMembershipId'>,
): string | undefined {
  return assignment.actualMembershipId ?? assignment.plannedMembershipId ?? undefined;
}

export function getWorkflowStatusLabel(
  status: WorkflowRequestStatus,
  pendingTargetLabel: string,
): string {
  return status === 'pending_target' ? `待${pendingTargetLabel}接受` : workflowStatusLabels[status];
}

export function getWorkflowStatusTone(status: WorkflowRequestStatus): WorkflowStatusTone {
  switch (status) {
    case 'pending_target':
    case 'pending_approval':
      return 'warning';
    case 'completed':
      return 'success';
    case 'rejected':
      return 'danger';
    case 'cancelled':
    case 'revoked':
      return 'neutral';
  }
}

export function resolveNextWorkflowStatus(
  requiresApproval: boolean,
  targetAutoAccepts: boolean,
): WorkflowRequestStatus {
  if (!targetAutoAccepts) return 'pending_target';
  return requiresApproval ? 'pending_approval' : 'completed';
}

export function getWorkflowNextStatusDescription(
  status: WorkflowRequestStatus,
  targetMemberLabel: string,
): string {
  switch (status) {
    case 'pending_target':
      return `提交后将等待${targetMemberLabel}接受。`;
    case 'pending_approval':
      return `${targetMemberLabel}将自动接受，提交后进入管理员审批。`;
    case 'completed':
      return `${targetMemberLabel}已开启自动接受且群组无需审批，提交后将立即生效。`;
    default:
      return '';
  }
}

export function getSwapStatusLabel(status: WorkflowRequestStatus): string {
  return getWorkflowStatusLabel(status, '对方');
}

export function getDutyAdjustmentStatusLabel(status: WorkflowRequestStatus): string {
  return getWorkflowStatusLabel(status, '加班成员');
}

export function getSwapNextStatusDescription(status: WorkflowRequestStatus): string {
  return getWorkflowNextStatusDescription(status, '目标成员');
}

export function getDutyAdjustmentNextStatusDescription(status: WorkflowRequestStatus): string {
  return getWorkflowNextStatusDescription(status, '加班成员');
}

export function resolveNextSwapStatus(
  requiresApproval: boolean,
  targetAutoAccepts: boolean,
): WorkflowRequestStatus {
  return resolveNextWorkflowStatus(requiresApproval, targetAutoAccepts);
}

export function resolveNextDutyAdjustmentStatus(
  requiresApproval: boolean,
  overtimeAutoAccepts: boolean,
): WorkflowRequestStatus {
  return resolveNextWorkflowStatus(requiresApproval, overtimeAutoAccepts);
}

export function getSwapConflictMessage<Conflict extends { readonly message: string }>(
  conflict: Conflict,
): string {
  return conflict.message;
}

export function getDutyAdjustmentConflictMessage<Conflict extends { readonly message: string }>(
  conflict: Conflict,
): string {
  return conflict.message;
}

export function isSwapRequestStillFuture(
  request: SwapRequestAssignmentPairLike,
  now: Date = new Date(),
): boolean {
  return (
    isOperableAssignment(request.initiatorAssignment, now) &&
    isOperableAssignment(request.targetAssignment, now)
  );
}

export function getWorkflowWeekdayLabel(value: string): string {
  return weekdayLabels[new Date(`${value}T00:00:00.000Z`).getUTCDay()] ?? '';
}

export function isWorkflowWeekendDate(value: string): boolean {
  const day = new Date(`${value}T00:00:00.000Z`).getUTCDay();
  return day === 0 || day === 6;
}

export function formatAssignmentSummaryOption<Assignment extends AssignmentSummaryOptionLike>(
  assignment: Assignment,
): string {
  const dutyName = assignment.actualMemberName ?? assignment.plannedMemberName ?? '待定';
  return `${assignment.businessDate} ${assignment.shiftTypeName}（${getWorkflowWeekdayLabel(
    assignment.businessDate,
  )}）· ${dutyName}`;
}

export function formatWorkflowCompactAssignment(
  assignment: Pick<WorkflowAssignmentLike, 'businessDate' | 'shiftTypeName'>,
): string {
  return `${assignment.businessDate.slice(5)} ${assignment.shiftTypeName}`;
}

export function formatWorkflowShiftTime(startsAt: string, endsAt: string): string {
  const start = formatChinaDateTime(startsAt, false);
  const end = formatChinaDateTime(endsAt, false);
  return `${start.slice(0, 5)} ${start.slice(5)}–${end.slice(5)}`;
}

export const formatSwapShiftTime = formatWorkflowShiftTime;
export const formatDutyAdjustmentShiftTime = formatWorkflowShiftTime;

export async function loadSwapMonthCalendars<Calendar>(
  businessMonths: readonly string[],
  loadCalendar: (businessMonth: string) => Promise<Calendar>,
): Promise<ReadonlyMap<string, Calendar>> {
  const uniqueMonths = [...new Set(businessMonths)];
  const entries = await Promise.all(
    uniqueMonths.map(
      async (businessMonth) => [businessMonth, await loadCalendar(businessMonth)] as const,
    ),
  );
  return new Map(entries);
}

export function buildLeaveFormInterval(input: {
  readonly allDay?: boolean;
  readonly endDate: string;
  readonly endTime?: string;
  readonly startDate: string;
  readonly startTime?: string;
}): LeaveFormInterval {
  if (input.startDate.length === 0 || input.endDate.length === 0) {
    throw new Error('请选择请假开始和结束日期。');
  }
  if (input.endDate < input.startDate) {
    throw new Error('结束日期不能早于开始日期。');
  }

  if (input.allDay !== false) {
    const start = parseChinaDateStart(input.startDate);
    const end = parseChinaDateStart(input.endDate);
    return {
      endsAt: new Date(end.valueOf() + millisecondsPerDay).toISOString(),
      startsAt: start.toISOString(),
    };
  }

  if (input.startTime === undefined || input.endTime === undefined) {
    throw new Error('请选择开始和结束时间（HH:mm）。');
  }
  if (!timePattern.test(input.startTime) || !timePattern.test(input.endTime)) {
    throw new Error('请选择开始和结束时间（HH:mm）。');
  }
  const start = parseLocalDateTime(input.startDate, input.startTime);
  const end = parseLocalDateTime(input.endDate, input.endTime);
  if (end.valueOf() <= start.valueOf()) {
    throw new Error('结束时间必须晚于开始时间。');
  }
  return { endsAt: end.toISOString(), startsAt: start.toISOString() };
}

export function getLeaveDayCount(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf()) || end < start) return 0;
  return Math.round((end.valueOf() - start.valueOf()) / millisecondsPerDay) + 1;
}

export function formatLeaveRange(startsAt: string, endsAt: string, isAllDay = true): string {
  if (isAllDay) {
    const startDate = toChinaDate(startsAt);
    const endInclusiveDate = addDays(toChinaDate(endsAt), -1);
    const dayCount = getLeaveDayCount(startDate, endInclusiveDate);
    return `${formatMonthDay(startDate)} 至 ${formatMonthDay(endInclusiveDate)}（共 ${dayCount} 天）`;
  }
  return `${formatChinaDateTime(startsAt, false)} 至 ${formatChinaDateTime(endsAt, false)}`;
}

export function formatAffectedAssignment<Assignment extends LeaveAffectedAssignmentLike>(
  assignment: Assignment,
): string {
  const previousMemberName = assignment.previousMemberName ?? '空缺';
  const nextMemberName = assignment.nextMemberName ?? '空缺';
  return `${formatWorkflowBusinessDate(assignment.businessDate)} ${assignment.shiftTypeName}（${assignment.shiftTypeAbbreviation}）：${previousMemberName} → ${nextMemberName}`;
}

export function summarizeStatisticsDelta<Delta extends LeaveStatisticsDeltaLike>(
  delta: Delta,
): string {
  if (delta.byMember.length === 0) return '无值班统计变化';
  return delta.byMember
    .map((member) => {
      const sign = member.assignmentDelta > 0 ? '+' : '';
      return `${member.realName} ${sign}${member.assignmentDelta} 班`;
    })
    .join('、');
}

export function getLeaveTypeLabel(leaveType: LeaveRequestType): string {
  return leaveTypeLabels[leaveType];
}

export function getLeaveStatusLabel(status: LeaveRequestStatus): string {
  return leaveStatusLabels[status];
}

export function getLeaveStatusTone(status: LeaveRequestStatus): LeaveStatusTone {
  switch (status) {
    case 'approved':
      return 'success';
    case 'rejected':
      return 'danger';
    case 'pending':
      return 'warning';
  }
}

export function getLeaveRejectionConfirmation(memberName?: string): string {
  return `确定驳回${memberName ?? '该成员'}的请假申请吗？`;
}

export function getReflowStrategyLabel(strategy: LeaveReflowStrategy): string {
  return reflowStrategyLabels[strategy];
}

export function getTodayCalendarDate(now: Date = new Date()): string {
  return new Date(now.valueOf() + chinaStandardTimeOffsetMilliseconds).toISOString().slice(0, 10);
}

export function getTodayBusinessDate(now: Date = new Date()): string {
  const shifted = new Date(now.valueOf() + chinaStandardTimeOffsetMilliseconds);
  if (shifted.getUTCHours() < 8) shifted.setUTCDate(shifted.getUTCDate() - 1);
  return shifted.toISOString().slice(0, 10);
}

export function getCurrentWorkflowBusinessMonth(now: Date = new Date()): string {
  return getTodayBusinessDate(now).slice(0, 7);
}

export function isWorkflowBusinessMonth(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/u.test(value);
}

export function formatWorkflowBusinessDate(value: string): string {
  const match = businessDatePattern.exec(value);
  return `${Number(match?.[2] ?? '')}月${Number(match?.[3] ?? '')}日`;
}

export function formatWorkflowDateWithWeekday(value: string): string {
  if (!isWorkflowDateValue(value)) return value;
  return `${value} ${getWorkflowWeekdayLabel(value)}`;
}

export function isWorkflowDateValue(value: string): boolean {
  if (!businessDatePattern.test(value)) return false;
  return new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
}

function parseChinaDateStart(value: string): Date {
  try {
    const match = businessDatePattern.exec(value);
    if (match === null) throw new Error('invalid');
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const candidate = new Date(Date.UTC(year, month - 1, day));
    if (
      candidate.getUTCFullYear() !== year ||
      candidate.getUTCMonth() !== month - 1 ||
      candidate.getUTCDate() !== day
    ) {
      throw new Error('invalid');
    }
    return new Date(candidate.valueOf() - chinaStandardTimeOffsetMilliseconds);
  } catch {
    throw new Error('请假日期格式无效。');
  }
}

function parseLocalDateTime(date: string, time: string): Date {
  const value = new Date(`${date}T${time}`);
  if (Number.isNaN(value.valueOf())) throw new Error('请假时间格式无效。');
  return value;
}

function formatChinaDateTime(value: string, includeYear: boolean): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.valueOf())) throw new Error('The timestamp must be valid.');
  const shifted = new Date(timestamp.valueOf() + chinaStandardTimeOffsetMilliseconds).toISOString();
  const date = includeYear ? shifted.slice(0, 10) : shifted.slice(5, 10);
  return `${date} ${shifted.slice(11, 16)}`;
}

function toChinaDate(value: string): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.valueOf())) throw new Error('The timestamp must be valid.');
  return new Date(timestamp.valueOf() + chinaStandardTimeOffsetMilliseconds)
    .toISOString()
    .slice(0, 10);
}

function addDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatMonthDay(value: string): string {
  return value.slice(5);
}
