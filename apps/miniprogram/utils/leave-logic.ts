import type {
  LeaveAffectedAssignment,
  LeaveReflowStrategy,
  LeaveRequestStatus,
  LeaveRequestType,
  LeaveStatisticsDelta,
} from '@schedule/contracts';

import {
  formatChinaDateTime,
  getChinaStandardTimeBusinessDate,
  toChinaStandardTimeUtcTimestamp,
} from './china-time.js';

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
    const start = parseLocalDateStart(input.startDate);
    const end = parseLocalDateStart(input.endDate);
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

  return {
    endsAt: end.toISOString(),
    startsAt: start.toISOString(),
  };
}

export function getLeaveDayCount(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf()) || end < start) {
    return 0;
  }
  return Math.round((end.valueOf() - start.valueOf()) / millisecondsPerDay) + 1;
}

export function formatLeaveRange(startsAt: string, endsAt: string, isAllDay = true): string {
  if (isAllDay) {
    const startDate = toChinaDate(startsAt);
    const endInclusiveDate = addDays(toChinaDate(endsAt), -1);
    const dayCount = getLeaveDayCount(startDate, endInclusiveDate);
    return `${formatMonthDay(startDate)} 至 ${formatMonthDay(endInclusiveDate)}（共 ${dayCount} 天）`;
  }
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
  return getChinaStandardTimeBusinessDate(new Date());
}

function parseLocalDateStart(date: string): Date {
  try {
    return toChinaStandardTimeUtcTimestamp(date, '00:00');
  } catch {
    throw new Error('请假日期格式无效。');
  }
}

function parseLocalDateTime(date: string, time: string): Date {
  const value = new Date(`${date}T${time}`);
  if (Number.isNaN(value.valueOf())) {
    throw new Error('请假时间格式无效。');
  }
  return value;
}

function toChinaDate(value: string): string {
  return formatChinaDateTime(value).slice(0, 10);
}

function addDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatMonthDay(value: string): string {
  return value.slice(5);
}

function formatCstDateTime(value: string): string {
  return formatChinaDateTime(value, { includeYear: false });
}

function formatBusinessDate(value: string): string {
  const [, , month = '', day = ''] = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value) ?? [];
  return `${Number(month)}月${Number(day)}日`;
}
