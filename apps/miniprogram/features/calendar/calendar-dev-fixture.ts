import type {
  CalendarReadModel,
  GuestCalendarReadModel,
  HolidayReadModel,
} from '@schedule/contracts';

import { appConfig } from '../../config/index.js';
import {
  calendarFixtureGroupName,
  getGoldenCalendar,
  goldenHolidays,
} from './calendar-golden-data.js';

export interface CalendarDevFixtureDependencies {
  getCalendar(groupId: string, businessMonth: string): Promise<CalendarReadModel>;
  getGuestHolidays(year: number): Promise<HolidayReadModel>;
  getHolidays(year: number): Promise<HolidayReadModel>;
  getLoggedInGuestCalendar(groupId: string, businessMonth: string): Promise<GuestCalendarReadModel>;
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
  };
}
