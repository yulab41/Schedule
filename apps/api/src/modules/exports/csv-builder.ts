import type { StatisticsSummary } from '@schedule/contracts';

export interface ScheduleCsvRowInput {
  readonly actualMemberName: string | null;
  readonly businessDate: string;
  readonly crossesMidnight: boolean;
  readonly plannedMemberName: string | null;
  readonly scheduleRoleName: string;
  readonly shiftEndTime: string;
  readonly shiftStartTime: string;
  readonly shiftTypeAbbreviation: string;
  readonly shiftTypeName: string;
  readonly slotPosition: number;
}

export function buildScheduleCsv(rows: readonly ScheduleCsvRowInput[]): string {
  const header = [
    '日期',
    '星期',
    '角色',
    '班种',
    '班种简称',
    '开始时间',
    '结束时间',
    '跨日',
    '计划成员',
    '实际成员',
    '空缺',
  ];
  const data = rows.map((row) => [
    row.businessDate,
    getWeekdayLabel(row.businessDate),
    row.scheduleRoleName,
    row.shiftTypeName,
    row.shiftTypeAbbreviation,
    row.shiftStartTime,
    row.shiftEndTime,
    row.crossesMidnight ? '是' : '否',
    row.plannedMemberName,
    row.actualMemberName ?? row.plannedMemberName,
    row.plannedMemberName === null ? '是' : '否',
  ]);

  return toCsv([header, ...data]);
}

export function buildStatisticsCsv(summary: StatisticsSummary): string {
  const header = [
    '成员',
    '计划班次',
    '实际值班',
    '计值班次',
    '周末',
    '法定节假日',
    '换班',
    '加班',
    '扣班',
    '加扣班净值',
    '增减',
    '请假补位',
    '人工调整',
  ];
  const rows = summary.members.map((member) => [
    member.realName,
    member.plannedCount,
    member.actualCount,
    member.countedActualCount,
    member.weekendCount,
    member.holidayCount,
    member.swapCount,
    member.overtimeCount,
    member.deductionCount,
    member.netDutyAdjustment,
    member.deltaCount,
    member.leaveCoverCount,
    member.manualAdjustmentCount,
  ]);
  const totals = [
    '合计',
    summary.plannedCount,
    summary.actualCount,
    summary.countedActualCount,
    summary.weekendCount,
    summary.holidayCount,
    summary.swapCount,
    summary.overtimeCount,
    summary.deductionCount,
    summary.netDutyAdjustment,
    0,
    summary.leaveCoverCount,
    summary.manualAdjustmentCount,
  ];

  return toCsv([header, ...rows, totals]);
}

export function toCsv(rows: readonly (readonly (number | string | null)[])[]): string {
  return `${rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n')}\r\n`;
}

function escapeCsvCell(value: number | string | null): string {
  const text = value === null ? '' : String(value);
  return /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function getWeekdayLabel(businessDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(businessDate);
  if (match === null) {
    return '';
  }
  const day = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  ).getUTCDay();
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][day] ?? '';
}
