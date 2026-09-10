import type {
  CalendarReadModel,
  GuestCalendarReadModel,
  VisitorResolveResponse,
  HolidayReadModel,
} from '@schedule/contracts';

import {
  calendarReadModelJsonSchema,
  guestCalendarReadModelJsonSchema,
  visitorResolveResponseJsonSchema,
  holidayReadModelJsonSchema,
} from './generated/calendar-schemas.js';
import { defineClientEndpoint, type ClientTransport } from './endpoint.js';
import { createCompactDecoder } from './json-decoder.js';

export const calendarReadModelDecoder = /* @__PURE__ */ createCompactDecoder<CalendarReadModel>(
  calendarReadModelJsonSchema,
);
export const holidayReadModelDecoder = /* @__PURE__ */ createCompactDecoder<HolidayReadModel>(
  holidayReadModelJsonSchema,
);

export const guestCalendarReadModelDecoder =
  /* @__PURE__ */ createCompactDecoder<GuestCalendarReadModel>(guestCalendarReadModelJsonSchema);
export const visitorResolveResponseDecoder =
  /* @__PURE__ */ createCompactDecoder<VisitorResolveResponse>(visitorResolveResponseJsonSchema);

export const calendarReadEndpoints = {
  groupGuestCalendar: /* @__PURE__ */ defineClientEndpoint<
    { readonly groupId: string; readonly businessMonth: string },
    GuestCalendarReadModel
  >({
    auth: 'bearer',
    decoder: guestCalendarReadModelDecoder,
    id: 'calendar.group-guest-read',
    method: 'GET',
    path: ({ groupId, businessMonth }) =>
      `/groups/${encodeURIComponent(groupId)}/guest-calendar?businessMonth=${encodeURIComponent(businessMonth)}`,
  }),
  resolveVisitor: /* @__PURE__ */ defineClientEndpoint<
    { readonly visitorKey: string },
    VisitorResolveResponse
  >({
    auth: 'public',
    decoder: visitorResolveResponseDecoder,
    id: 'calendar.resolve-visitor',
    method: 'POST',
    body: ({ visitorKey }) => ({ visitorKey }),
    path: () => '/guest/groups/resolve',
  }),
  guestCalendar: /* @__PURE__ */ defineClientEndpoint<
    { readonly groupId: string; readonly businessMonth: string; readonly visitorKey: string },
    GuestCalendarReadModel
  >({
    auth: 'public',
    decoder: guestCalendarReadModelDecoder,
    id: 'calendar.guest-read',
    method: 'GET',
    path: ({ groupId, businessMonth, visitorKey }) =>
      `/guest/groups/${encodeURIComponent(groupId)}/calendar?businessMonth=${encodeURIComponent(businessMonth)}&visitorKey=${encodeURIComponent(visitorKey)}`,
  }),
  calendar: /* @__PURE__ */ defineClientEndpoint<
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
  guestHolidays: /* @__PURE__ */ defineClientEndpoint<{ readonly year: number }, HolidayReadModel>({
    auth: 'public',
    decoder: holidayReadModelDecoder,
    id: 'holidays.guest-read',
    method: 'GET',
    path: ({ year }) => `/guest/holidays?year=${encodeURIComponent(String(year))}`,
  }),
  holidays: /* @__PURE__ */ defineClientEndpoint<{ readonly year: number }, HolidayReadModel>({
    auth: 'bearer',
    decoder: holidayReadModelDecoder,
    id: 'holidays.read',
    method: 'GET',
    path: ({ year }) => `/holidays?year=${encodeURIComponent(String(year))}`,
  }),
} as const;

export interface CalendarReadClient {
  getGroupGuestCalendar(groupId: string, businessMonth: string): Promise<GuestCalendarReadModel>;
  resolveVisitor(visitorKey: string): Promise<VisitorResolveResponse>;
  getGuestCalendar(
    groupId: string,
    businessMonth: string,
    visitorKey: string,
  ): Promise<GuestCalendarReadModel>;
  getCalendar(groupId: string, businessMonth: string): Promise<CalendarReadModel>;
  getGuestHolidays(year: number): Promise<HolidayReadModel>;
  getHolidays(year: number): Promise<HolidayReadModel>;
}

export function createCalendarReadClient(transport: ClientTransport): CalendarReadClient {
  return {
    getGroupGuestCalendar(groupId, businessMonth) {
      return transport.request(calendarReadEndpoints.groupGuestCalendar, {
        groupId,
        businessMonth,
      });
    },
    resolveVisitor(visitorKey) {
      return transport.request(calendarReadEndpoints.resolveVisitor, { visitorKey });
    },
    getGuestCalendar(groupId, businessMonth, visitorKey) {
      return transport.request(calendarReadEndpoints.guestCalendar, {
        groupId,
        businessMonth,
        visitorKey,
      });
    },
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
