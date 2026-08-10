import type {
  CalendarReadModel,
  GuestCalendarReadModel,
  HolidayReadModel,
  ScheduleEventPage,
} from '@schedule/contracts';

import { appConfig } from '../../config/index.js';
import {
  calendarFixtureGroupName,
  getGoldenCalendar,
  goldenEvents,
  goldenHolidays,
} from './calendar-golden-data.js';

export interface CalendarDevFixtureDependencies {
  getCalendar(groupId: string, businessMonth: string): Promise<CalendarReadModel>;
  getGuestHolidays(year: number): Promise<HolidayReadModel>;
  getHolidays(year: number): Promise<HolidayReadModel>;
  getLoggedInGuestCalendar(groupId: string, businessMonth: string): Promise<GuestCalendarReadModel>;
  listEvents(groupId: string, cursor?: string, pageSize?: number): Promise<ScheduleEventPage>;
}

export function isCalendarDevFixtureEnabled(envVersion: string | undefined): boolean {
  return appConfig.calendarFixtureInDevtools && envVersion === 'develop';
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

export function createCalendarDevFixtureDependencies(): CalendarDevFixtureDependencies {
  return {
    getCalendar: async (_groupId, businessMonth) => getGoldenCalendar(businessMonth),
    getGuestHolidays: async (year) => getFixtureHolidays(year),
    getHolidays: async (year) => getFixtureHolidays(year),
    getLoggedInGuestCalendar: async (_groupId, businessMonth) => ({
      calendar: getGoldenCalendar(businessMonth),
      groupName: calendarFixtureGroupName,
    }),
    listEvents: async (_groupId, _cursor, pageSize = 100) => ({
      events: goldenEvents.slice(0, pageSize),
    }),
  };
}
