// 中国标准时间固定偏移的唯一来源：数据库存 UTC，页面与领域统一按 +08:00 换算。
export const chinaStandardTimeOffsetMilliseconds = 8 * 60 * 60 * 1000;

export interface ChinaDateTimeFormatOptions {
  readonly includeSeconds?: boolean;
  readonly includeYear?: boolean;
}

export function formatChinaStandardTime(value: Date | string | number): string {
  return new Date(toChinaTimestamp(value).valueOf() + chinaStandardTimeOffsetMilliseconds)
    .toISOString()
    .slice(11, 16);
}

export function formatChinaDateTime(
  value: Date | string | number,
  options: ChinaDateTimeFormatOptions = {},
): string {
  const shifted = new Date(
    toChinaTimestamp(value).valueOf() + chinaStandardTimeOffsetMilliseconds,
  ).toISOString();
  const date = options.includeYear === false ? shifted.slice(5, 10) : shifted.slice(0, 10);
  const time = options.includeSeconds === true ? shifted.slice(11, 19) : shifted.slice(11, 16);
  return `${date} ${time}`;
}

export interface ChinaStandardTimeShiftRangeInput {
  readonly businessDate: string;
  readonly crossesMidnight: boolean;
  readonly endTime: string;
  readonly startTime: string;
}

export interface ChinaStandardTimeShiftRange {
  readonly businessDate: string;
  readonly endsAt: Date;
  readonly startsAt: Date;
}

export function getChinaStandardTimeBusinessDate(timestamp: Date): string {
  // 全天班以中国标准时间 08:00 交接，因此午夜后的未结束班次仍属于上一业务日。
  const shifted = new Date(
    toChinaTimestamp(timestamp).valueOf() + chinaStandardTimeOffsetMilliseconds,
  );
  if (shifted.getUTCHours() < 8) {
    shifted.setUTCDate(shifted.getUTCDate() - 1);
  }
  return shifted.toISOString().slice(0, 10);
}

export function getChinaStandardTimeCalendarDate(timestamp: Date): string {
  return new Date(timestamp.valueOf() + chinaStandardTimeOffsetMilliseconds)
    .toISOString()
    .slice(0, 10);
}

export function getCurrentBusinessMonth(now = new Date()): string {
  return getChinaStandardTimeBusinessDate(now).slice(0, 7);
}

export function isPastBusinessDate(businessDate: string, now = new Date()): boolean {
  return businessDate < getChinaStandardTimeBusinessDate(now);
}

export function isPastBusinessMonth(businessMonth: string, now = new Date()): boolean {
  return businessMonth < getCurrentBusinessMonth(now);
}

export function toChinaStandardTimeShiftRange(
  input: ChinaStandardTimeShiftRangeInput,
): ChinaStandardTimeShiftRange {
  const start = toChinaStandardTimeUtcTimestamp(input.businessDate, input.startTime);
  const end = toChinaStandardTimeUtcTimestamp(input.businessDate, input.endTime);
  const endsAt = input.crossesMidnight ? new Date(end.valueOf() + 24 * 60 * 60 * 1000) : end;

  if (endsAt <= start) {
    throw new Error('A shift must end after its start unless it crosses midnight.');
  }

  return {
    businessDate: input.businessDate,
    endsAt,
    startsAt: start,
  };
}

export function toChinaStandardTimeUtcTimestamp(businessDate: string, time: string): Date {
  const { day, month, year } = assertValidDate(businessDate);
  const { hour, minute } = parseTime(time);
  return new Date(
    Date.UTC(year, month - 1, day, hour, minute) - chinaStandardTimeOffsetMilliseconds,
  );
}

export function assertBusinessMonthContainsDate(businessMonth: string, businessDate: string): void {
  if (!/^\d{4}-\d{2}$/u.test(businessMonth)) {
    throw new Error('The business month must use the YYYY-MM format.');
  }

  assertValidDate(businessDate);
  if (!businessDate.startsWith(`${businessMonth}-`)) {
    throw new Error('The shift business date must belong to the schedule period month.');
  }
}

function assertValidDate(value: string): {
  readonly day: number;
  readonly month: number;
  readonly year: number;
} {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (match === null) {
    throw new Error('The business date must use a valid YYYY-MM-DD format.');
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    throw new Error('The business date must use a valid YYYY-MM-DD format.');
  }

  return { day, month, year };
}

function parseTime(value: string): { readonly hour: number; readonly minute: number } {
  const match = /^(\d{2}):(\d{2})$/u.exec(value);
  if (match === null) {
    throw new Error('The shift time must use the HH:mm format.');
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) {
    throw new Error('The shift time must use the HH:mm format.');
  }

  return { hour, minute };
}

function toChinaTimestamp(value: Date | string | number): Date {
  const timestamp = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(timestamp.valueOf())) {
    throw new Error('The timestamp must be valid.');
  }
  return timestamp;
}
