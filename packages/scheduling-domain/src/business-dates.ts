const millisecondsPerDay = 24 * 60 * 60 * 1000;

export function assertBusinessDate(value: string, fieldName: string): void {
  toBusinessDateTimestamp(value, fieldName);
}

export function getBusinessDates(startDate: string, endDate: string): readonly string[] {
  const startTimestamp = toBusinessDateTimestamp(startDate, 'The generation start date');
  const endTimestamp = toBusinessDateTimestamp(endDate, 'The generation end date');
  if (endTimestamp < startTimestamp) {
    throw new Error('The generation end date cannot precede the start date.');
  }

  const businessDates: string[] = [];
  for (let timestamp = startTimestamp; timestamp <= endTimestamp; timestamp += millisecondsPerDay) {
    businessDates.push(new Date(timestamp).toISOString().slice(0, 10));
  }

  return businessDates;
}

function toBusinessDateTimestamp(value: string, fieldName = 'The business date'): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (match === null) {
    throw new Error(`${fieldName} must use a valid YYYY-MM-DD format.`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const candidate = new Date(timestamp);
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    throw new Error(`${fieldName} must use a valid YYYY-MM-DD format.`);
  }

  return timestamp;
}
