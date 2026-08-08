import { addDays } from './calendar.js';

const chinaOffsetHours = 8;

export function chinaDateToIso(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(date);
  if (match === null) {
    throw new Error('日期格式无效。');
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(Date.UTC(year, month - 1, day, 0 - chinaOffsetHours, 0, 0)).toISOString();
}

export function allDayLeaveInterval(
  startDate: string,
  endDate: string,
): {
  readonly endsAt: string;
  readonly startsAt: string;
} {
  if (endDate < startDate) {
    throw new Error('结束日期不能早于开始日期。');
  }
  return {
    endsAt: chinaDateToIso(addDays(endDate, 1)),
    startsAt: chinaDateToIso(startDate),
  };
}

export function toChinaDate(isoValue: string): string {
  const date = new Date(isoValue);
  if (Number.isNaN(date.valueOf())) {
    return '';
  }
  date.setUTCHours(date.getUTCHours() + chinaOffsetHours);
  return date.toISOString().slice(0, 10);
}

export function formatChinaTime(isoValue: string): string {
  const date = new Date(isoValue);
  if (Number.isNaN(date.valueOf())) {
    return '';
  }
  date.setUTCHours(date.getUTCHours() + chinaOffsetHours);
  const time = date.toISOString().slice(11, 16);
  return time;
}

export function formatChinaDateShort(isoValue: string): string {
  const date = toChinaDate(isoValue);
  return date.length === 0 ? '' : date.slice(5);
}

export function formatChinaDateTimeShort(isoValue: string): string {
  return `${formatChinaDateShort(isoValue)} ${formatChinaTime(isoValue)}`;
}

export function getLeaveDayCount(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf()) || end < start) {
    return 0;
  }
  return Math.round((end.valueOf() - start.valueOf()) / (24 * 60 * 60 * 1000)) + 1;
}

export function formatLeaveRange(startsAt: string, endsAt: string): string {
  const startDate = toChinaDate(startsAt);
  const endInclusiveDate = toChinaDate(addDays(endsAt, -1));
  const dayCount = getLeaveDayCount(startDate, endInclusiveDate);
  return `${startDate.slice(5)} 至 ${endInclusiveDate.slice(5)}（共 ${dayCount} 天）`;
}
