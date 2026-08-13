import type {
  CalendarReadModel,
  GuestCalendarReadModel,
  HolidayReadModel,
  ScheduleEventPage,
  ScheduleEventQuery,
} from '@schedule/contracts';

import {
  calendarFixtureGroupName,
  getGoldenCalendar,
  goldenEvents,
  goldenHolidays,
} from './calendar-golden-data.js';

// Test-only adapter. Production pages must use the real session and endpoint dependencies.
export interface CalendarTestFixtureDependencies {
  getCalendar(groupId: string, businessMonth: string): Promise<CalendarReadModel>;
  getGuestHolidays(year: number): Promise<HolidayReadModel>;
  getHolidays(year: number): Promise<HolidayReadModel>;
  getLoggedInGuestCalendar(groupId: string, businessMonth: string): Promise<GuestCalendarReadModel>;
  listEvents(
    groupId: string,
    query: Omit<ScheduleEventQuery, 'groupId'>,
  ): Promise<ScheduleEventPage>;
}

function getFixtureHolidays(year: number): HolidayReadModel {
  return year === goldenHolidays.year
    ? goldenHolidays
    : {
        confirmed: false,
        dates: [],
        year,
      };
}

export function createCalendarTestFixtureDependencies(): CalendarTestFixtureDependencies {
  return {
    getCalendar: async (_groupId, businessMonth) => getGoldenCalendar(businessMonth),
    getGuestHolidays: async (year) => getFixtureHolidays(year),
    getHolidays: async (year) => getFixtureHolidays(year),
    getLoggedInGuestCalendar: async (_groupId, businessMonth) => ({
      calendar: getGoldenCalendar(businessMonth),
      groupName: calendarFixtureGroupName,
    }),
    listEvents: async (_groupId, query) => {
      const { shiftId } = query;
      const matchingEvents =
        shiftId === undefined
          ? goldenEvents
          : goldenEvents.filter((event) => event.affectedShiftIds.includes(shiftId));
      return { events: matchingEvents.slice(0, query.pageSize ?? 50) };
    },
  };
}
