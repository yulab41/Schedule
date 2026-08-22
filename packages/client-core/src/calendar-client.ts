import type { CalendarReadModel, HolidayReadModel } from '@schedule/contracts';

import {
  calendarReadModelJsonSchema,
  holidayReadModelJsonSchema,
} from './generated/calendar-schemas.js';
import { defineClientEndpoint, type ClientTransport } from './endpoint.js';
import { createCompactDecoder } from './json-decoder.js';

export const calendarReadModelDecoder = createCompactDecoder<CalendarReadModel>(
  calendarReadModelJsonSchema,
);
export const holidayReadModelDecoder = createCompactDecoder<HolidayReadModel>(
  holidayReadModelJsonSchema,
);

export const calendarReadEndpoints = {
  calendar: defineClientEndpoint<
    { readonly businessMonth: string; readonly groupId: string },
    CalendarReadModel
  >({
    auth: 'bearer',
    decoder: calendarReadModelDecoder,
    id: 'calendar.read',
    method: 'GET',
    path: ({ businessMonth, groupId }) =>
      `/groups/${encodeURIComponent(groupId)}/calendar?businessMonth=${encodeURIComponent(businessMonth)}`,
  }),
  guestHolidays: defineClientEndpoint<{ readonly year: number }, HolidayReadModel>({
    auth: 'public',
    decoder: holidayReadModelDecoder,
    id: 'holidays.guest-read',
    method: 'GET',
    path: ({ year }) => `/guest/holidays?year=${encodeURIComponent(String(year))}`,
  }),
  holidays: defineClientEndpoint<{ readonly year: number }, HolidayReadModel>({
    auth: 'bearer',
    decoder: holidayReadModelDecoder,
    id: 'holidays.read',
    method: 'GET',
    path: ({ year }) => `/holidays?year=${encodeURIComponent(String(year))}`,
  }),
} as const;

export interface CalendarReadClient {
  getCalendar(groupId: string, businessMonth: string): Promise<CalendarReadModel>;
  getGuestHolidays(year: number): Promise<HolidayReadModel>;
  getHolidays(year: number): Promise<HolidayReadModel>;
}

export function createCalendarReadClient(transport: ClientTransport): CalendarReadClient {
  return {
    getCalendar(groupId, businessMonth) {
      return transport.request(calendarReadEndpoints.calendar, { businessMonth, groupId });
    },
    getGuestHolidays(year) {
      return transport.request(calendarReadEndpoints.guestHolidays, { year });
    },
    getHolidays(year) {
      return transport.request(calendarReadEndpoints.holidays, { year });
    },
  };
}
