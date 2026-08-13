import {
  decodeReadonlyArray,
  decodeResult,
  hasOnlyEnumerableKeys,
  isObjectRecord,
} from './decode-helpers.js';
import type { DecodeResult, JsonEndpointDescriptor } from './types.js';

export interface ConfirmedHolidayDate {
  readonly date: string;
  readonly holidayName: string;
  readonly isOffDay: boolean;
  readonly isWorkday: boolean;
}

export interface HolidayReadModel {
  readonly confirmed: boolean;
  readonly dates: readonly ConfirmedHolidayDate[];
  readonly year: number;
}

const dateKeys = new Set(['date', 'holidayName', 'isOffDay', 'isWorkday']);
const holidayKeys = new Set(['confirmed', 'dates', 'year']);

function decodeHolidayDate(value: unknown): ConfirmedHolidayDate | undefined {
  if (!isObjectRecord(value) || !hasOnlyEnumerableKeys(value, dateKeys)) return undefined;
  const date = value.date;
  const holidayName = value.holidayName;
  const isOffDay = value.isOffDay;
  const isWorkday = value.isWorkday;
  return typeof date === 'string' &&
    typeof holidayName === 'string' &&
    typeof isOffDay === 'boolean' &&
    typeof isWorkday === 'boolean'
    ? { date, holidayName, isOffDay, isWorkday }
    : undefined;
}

function decodeHolidayValue(value: unknown): HolidayReadModel | undefined {
  if (!isObjectRecord(value) || !hasOnlyEnumerableKeys(value, holidayKeys)) return undefined;
  const confirmed = value.confirmed;
  const datesValue = value.dates;
  const year = value.year;
  const dates = decodeReadonlyArray(datesValue, decodeHolidayDate);
  return typeof confirmed === 'boolean' &&
    dates !== undefined &&
    typeof year === 'number' &&
    Number.isSafeInteger(year)
    ? { confirmed, dates, year }
    : undefined;
}

export function decodeHolidayReadModel(value: unknown): DecodeResult<HolidayReadModel> {
  return decodeResult(() => decodeHolidayValue(value));
}

function decodeBoundHoliday(value: unknown, expectedYear: number): DecodeResult<HolidayReadModel> {
  return decodeResult(() => {
    const decoded = decodeHolidayValue(value);
    return decoded?.year === expectedYear ? decoded : undefined;
  });
}

export function buildHolidayReadEndpoint(year: number): JsonEndpointDescriptor<HolidayReadModel> {
  return {
    auth: true,
    decodeResponse: (value) => decodeBoundHoliday(value, year),
    method: 'GET',
    path: '/holidays',
    query: { year },
  };
}

export function buildGuestHolidayReadEndpoint(
  year: number,
): JsonEndpointDescriptor<HolidayReadModel> {
  return {
    auth: false,
    decodeResponse: (value) => decodeBoundHoliday(value, year),
    method: 'GET',
    path: '/guest/holidays',
    query: { year },
  };
}
