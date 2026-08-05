const chinaStandardTimeOffsetMilliseconds = 8 * 60 * 60 * 1000;

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
  if (Number.isNaN(timestamp.valueOf())) {
    throw new Error('The timestamp must be valid.');
  }

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
  const start = toUtcTimestamp(input.businessDate, input.startTime);
  const end = toUtcTimestamp(input.businessDate, input.endTime);
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

export function assertBusinessMonthContainsDate(businessMonth: string, businessDate: string): void {
  if (!/^\d{4}-\d{2}$/u.test(businessMonth)) {
    throw new Error('The business month must use the YYYY-MM format.');
  }

  assertValidDate(businessDate);
  if (!businessDate.startsWith(`${businessMonth}-`)) {
    throw new Error('The shift business date must belong to the schedule period month.');
  }
}

function toUtcTimestamp(date: string, time: string): Date {
  const { day, month, year } = assertValidDate(date);
  const { hour, minute } = parseTime(time);
  return new Date(Date.UTC(year, month - 1, day, hour - 8, minute));
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
