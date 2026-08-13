import { describe, expect, it } from 'vitest';

import { createCalendarTestFixtureDependencies } from './calendar-dev-fixture.js';
import {
  calendarFixtureGroupId,
  calendarFixtureGroupName,
  getGoldenCalendar,
  goldenBusinessMonth,
  goldenEvents,
  goldenHolidays,
} from './calendar-golden-data.js';

describe('calendar test fixture adapter', () => {
  it('serves the synthetic calendar sample only through explicit dependency injection', async () => {
    const dependencies = createCalendarTestFixtureDependencies();

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
    await expect(dependencies.listEvents(calendarFixtureGroupId, undefined, 1)).resolves.toEqual({
      events: goldenEvents.slice(0, 1),
    });
  });
});
