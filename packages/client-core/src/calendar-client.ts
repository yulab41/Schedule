import type {
  ScheduleEventPage,
  CalendarReadModel,
  GuestCalendarReadModel,
  VisitorResolveResponse,
  HolidayReadModel,
} from '@schedule/contracts';

import {
  scheduleEventPageJsonSchema,
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

export interface GuestShiftEventOptions {
  readonly cursor?: string;
  readonly pageSize?: number;
}
const guestShiftEventDecoder = /* @__PURE__ */ createCompactDecoder<ScheduleEventPage>(
  scheduleEventPageJsonSchema,
);
function eventQuery(options: GuestShiftEventOptions, visitorKey?: string): string {
  const parts: string[] = [];
  if (visitorKey !== undefined) parts.push(`visitorKey=${encodeURIComponent(visitorKey)}`);
  if (options.pageSize !== undefined) parts.push(`pageSize=${options.pageSize}`);
  if (options.cursor !== undefined) parts.push(`cursor=${encodeURIComponent(options.cursor)}`);
  return parts.length ? `?${parts.join('&')}` : '';
}
export const calendarReadEndpoints = {
  groupGuestShiftEvents: /* @__PURE__ */ defineClientEndpoint<
    GuestShiftEventOptions & { readonly groupId: string; readonly shiftId: string },
    ScheduleEventPage
  >({
    auth: 'bearer',
    decoder: guestShiftEventDecoder,
    id: 'calendar.group-guest-shift-events',
    method: 'GET',
    path: (input) =>
      `/groups/${encodeURIComponent(input.groupId)}/guest-calendar/shifts/${encodeURIComponent(input.shiftId)}/events${eventQuery(input)}`,
  }),
  guestShiftEvents: /* @__PURE__ */ defineClientEndpoint<
    GuestShiftEventOptions & {
      readonly groupId: string;
      readonly shiftId: string;
      readonly visitorKey: string;
    },
    ScheduleEventPage
  >({
    auth: 'public',
    decoder: guestShiftEventDecoder,
    id: 'calendar.guest-shift-events',
    method: 'GET',
    path: (input) =>
      `/guest/groups/${encodeURIComponent(input.groupId)}/calendar/shifts/${encodeURIComponent(input.shiftId)}/events${eventQuery(input, input.visitorKey)}`,
  }),
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
  getGroupGuestShiftEvents(
    groupId: string,
    shiftId: string,
    options?: GuestShiftEventOptions,
  ): Promise<ScheduleEventPage>;
  getGuestShiftEvents(
    groupId: string,
    shiftId: string,
    visitorKey: string,
    options?: GuestShiftEventOptions,
  ): Promise<ScheduleEventPage>;
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
    getGroupGuestShiftEvents(groupId, shiftId, options = {}) {
      return transport.request(calendarReadEndpoints.groupGuestShiftEvents, {
        groupId,
        shiftId,
        ...options,
      });
    },
    getGuestShiftEvents(groupId, shiftId, visitorKey, options = {}) {
      return transport.request(calendarReadEndpoints.guestShiftEvents, {
        groupId,
        shiftId,
        visitorKey,
        ...options,
      });
    },
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
