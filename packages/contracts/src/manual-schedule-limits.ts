export const MAX_MANUAL_MEMBERS = 20;
export const MAX_MANUAL_DAYS = 30;
export const MAX_MANUAL_CELLS = 600;

const manualScheduleDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/u;
const millisecondsPerDay = 24 * 60 * 60 * 1_000;

export function isValidManualScheduleDate(value: string): boolean {
  return getManualScheduleEpochDay(value) !== undefined;
}

export function getManualScheduleInclusiveDayCount(startDate: string, endDate: string): number {
  const startEpochDay = getManualScheduleEpochDay(startDate);
  const endEpochDay = getManualScheduleEpochDay(endDate);
  if (startEpochDay === undefined || endEpochDay === undefined) {
    throw new RangeError('Manual schedule dates must use valid YYYY-MM-DD values.');
  }
  if (endEpochDay < startEpochDay) {
    throw new RangeError('The manual schedule end date must not precede the start date.');
  }
  return endEpochDay - startEpochDay + 1;
}

export function isManualScheduleDateRangeWithinLimit(startDate: string, endDate: string): boolean {
  const startEpochDay = getManualScheduleEpochDay(startDate);
  const endEpochDay = getManualScheduleEpochDay(endDate);
  if (startEpochDay === undefined || endEpochDay === undefined || endEpochDay < startEpochDay) {
    return false;
  }
  return endEpochDay - startEpochDay + 1 <= MAX_MANUAL_DAYS;
}

function getManualScheduleEpochDay(value: string): number | undefined {
  const match = manualScheduleDatePattern.exec(value);
  if (match === null) return undefined;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  // MySQL DATE and the existing Web/domain date arithmetic both support 1000-9999 here.
  if (year < 1_000) return undefined;

  const candidate = new Date(0);
  candidate.setUTCHours(0, 0, 0, 0);
  candidate.setUTCFullYear(year, month - 1, day);
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return undefined;
  }
  return Math.floor(candidate.getTime() / millisecondsPerDay);
}
