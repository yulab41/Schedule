import {
  calendarReadEndpoints,
  calendarReadModelDecoder,
  holidayReadModelDecoder,
} from '@schedule/client-core';

export function decodeCalendarReadPayload(value: unknown): unknown | undefined {
  const decoded = calendarReadModelDecoder.safeDecode(value);
  return decoded.success ? decoded.data : undefined;
}

export function decodeHolidayReadPayload(value: unknown): unknown | undefined {
  const decoded = holidayReadModelDecoder.safeDecode(value);
  return decoded.success ? decoded.data : undefined;
}

export function getCalendarReadPath(groupId: string, businessMonth: string): string {
  return calendarReadEndpoints.calendar.path({ businessMonth, groupId });
}
