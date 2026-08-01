import type {
  LeaveAffectedAssignment,
  LeaveReflowStrategy,
  LeaveRequestStatus,
  LeaveRequestType,
  LeaveStatisticsDelta,
} from '@schedule/contracts';

const chinaStandardTimeOffsetMilliseconds = 8 * 60 * 60 * 1000;
const millisecondsPerDay = 24 * 60 * 60 * 1000;
const timePattern = /^\d{2}:\d{2}$/u;

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

export interface LeaveFormInterval {
  readonly endsAt: string;
  readonly startsAt: string;
}

export function buildLeaveFormInterval(input: {
  readonly allDay: boolean;
  readonly endDate: string;
  readonly endTime: string;
  readonly startDate: string;
  readonly startTime: string;
}): LeaveFormInterval {
  if (input.startDate.length === 0 || input.endDate.length === 0) {
    throw new Error('请选择请假开始和结束日期。');
  }
  if (input.endDate < input.startDate) {
    throw new Error('结束日期不能早于开始日期。');
  }

  if (input.allDay) {
    const start = parseLocalDateStart(input.startDate);
    const end = parseLocalDateStart(input.endDate);
    return {
      endsAt: new Date(end.valueOf() + millisecondsPerDay).toISOString(),
      startsAt: start.toISOString(),
    };
  }

  if (!timePattern.test(input.startTime) || !timePattern.test(input.endTime)) {
    throw new Error('请选择开始和结束时间（HH:mm）。');
  }
  const start = parseLocalDateTime(input.startDate, input.startTime);
  const end = parseLocalDateTime(input.endDate, input.endTime);
  if (end.valueOf() <= start.valueOf()) {
    throw new Error('结束时间必须晚于开始时间。');
  }

  return {
    endsAt: end.toISOString(),
    startsAt: start.toISOString(),
  };
}

export function formatLeaveRange(startsAt: string, endsAt: string): string {
  return `${formatCstDateTime(startsAt)} 至 ${formatCstDateTime(endsAt)}`;
}

export function formatAffectedAssignment(assignment: LeaveAffectedAssignment): string {
  const previousMemberName = assignment.previousMemberName ?? '空缺';
  const nextMemberName = assignment.nextMemberName ?? '空缺';
  return `${formatBusinessDate(assignment.businessDate)} ${assignment.shiftTypeName}（${assignment.shiftTypeAbbreviation}）：${previousMemberName} → ${nextMemberName}`;
}

export function summarizeStatisticsDelta(delta: LeaveStatisticsDelta): string {
  if (delta.byMember.length === 0) {
    return '无值班统计变化';
  }

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

export function getReflowStrategyLabel(strategy: LeaveReflowStrategy): string {
  return reflowStrategyLabels[strategy];
}

export function getTodayBusinessDate(): string {
  return new Date(Date.now() + chinaStandardTimeOffsetMilliseconds).toISOString().slice(0, 10);
}

function parseLocalDateStart(date: string): Date {
  const value = new Date(`${date}T00:00:00+08:00`);
  if (Number.isNaN(value.valueOf())) {
    throw new Error('请假日期格式无效。');
  }
  return value;
}

function parseLocalDateTime(date: string, time: string): Date {
  const value = new Date(`${date}T${time}`);
  if (Number.isNaN(value.valueOf())) {
    throw new Error('请假时间格式无效。');
  }
  return value;
}

function formatCstDateTime(value: string): string {
  return new Date(new Date(value).valueOf() + chinaStandardTimeOffsetMilliseconds)
    .toISOString()
    .slice(5, 16)
    .replace('T', ' ');
}

function formatBusinessDate(value: string): string {
  const [, , month = '', day = ''] = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value) ?? [];
  return `${Number(month)}月${Number(day)}日`;
}
