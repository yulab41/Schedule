import { describe, expect, it } from 'vitest';

import {
  createCalendarDevFixtureDependencies,
  isCalendarDevFixtureEnabled,
} from './calendar-dev-fixture.js';
import {
  calendarFixtureGroupId,
  calendarFixtureGroupName,
  getGoldenCalendar,
  goldenBusinessMonth,
  goldenHolidays,
} from './calendar-golden-data.js';

describe('calendar development fixture', () => {
  it('is enabled only for explicitly configured DevTools builds', () => {
    expect(isCalendarDevFixtureEnabled('develop')).toBe(true);
    expect(isCalendarDevFixtureEnabled('trial')).toBe(false);
    expect(isCalendarDevFixtureEnabled('release')).toBe(false);
    expect(isCalendarDevFixtureEnabled(undefined)).toBe(false);
  });

  it('serves the permanent 2026 calendar sample through every calendar endpoint', async () => {
    const dependencies = createCalendarDevFixtureDependencies();

    await expect(
      dependencies.getCalendar(calendarFixtureGroupId, goldenBusinessMonth),
    ).resolves.toBe(getGoldenCalendar(goldenBusinessMonth));
    await expect(
      dependencies.getCalendar(calendarFixtureGroupId, '2026-09'),
    ).resolves.toMatchObject({
      assignments: expect.arrayContaining([
        expect.objectContaining({ businessDate: '2026-09-16' }),
      ]),
      businessMonth: '2026-09',
    });
    await expect(dependencies.getHolidays(2026)).resolves.toBe(goldenHolidays);
    await expect(dependencies.getGuestHolidays(2025)).resolves.toEqual({
      confirmed: false,
      dates: [],
      year: 2025,
    });
    await expect(
      dependencies.getLoggedInGuestCalendar(calendarFixtureGroupId, goldenBusinessMonth),
    ).resolves.toEqual({
      calendar: getGoldenCalendar(goldenBusinessMonth),
      groupName: calendarFixtureGroupName,
    });
  });
});
