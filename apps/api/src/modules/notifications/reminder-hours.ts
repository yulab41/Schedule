const maximumReminderCount = 5;
const maximumReminderHours = 720;

export function normalizeReminderHours(value: unknown, fallback: readonly number[]): number[] {
  if (!Array.isArray(value)) {
    return [...fallback];
  }

  const hours = [...new Set(value.filter(isReminderHour))].sort((first, second) => second - first);
  return hours.length === 0 ? [] : hours;
}

export function validateReminderHours(value: unknown): number[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > maximumReminderCount) {
    throw new Error('Reminder hours must contain 1 to 5 distinct values.');
  }

  const hours = [...new Set(value)];
  if (hours.length !== value.length || !hours.every(isReminderHour)) {
    throw new Error('Reminder hours must be distinct integers from 1 to 720.');
  }

  return hours.sort((first, second) => second - first);
}

export function isReminderHour(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= maximumReminderHours
  );
}
