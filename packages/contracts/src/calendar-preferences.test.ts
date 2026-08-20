import { describe, expect, it } from 'vitest';

import {
  calendarPreferencesSchema,
  updateGroupCalendarDefaultsSchema,
  updateMemberCalendarPreferencesSchema,
} from './calendar-preferences.js';

describe('calendar preferences contracts', () => {
  it('describes group defaults, nullable member overrides, and effective values', () => {
    const groupId = '00000000-0000-4000-8000-000000000001';
    const membershipId = '00000000-0000-4000-8000-000000000002';
    const shiftTypeId = '00000000-0000-4000-8000-000000000003';
    expect(
      calendarPreferencesSchema.parse({
        canManageGroupDefaults: true,
        effectiveMonthShiftTypeId: shiftTypeId,
        effectiveView: 'week',
        groupDefaultMonthShiftTypeId: shiftTypeId,
        groupDefaultView: 'week',
        groupId,
        memberDefaultMonthShiftTypeId: null,
        memberDefaultView: null,
        membershipId,
      }),
    ).toMatchObject({ effectiveView: 'week', memberDefaultView: null });
  });

  it('requires explicit group defaults and accepts follow-group member nulls', () => {
    expect(
      updateGroupCalendarDefaultsSchema.parse({
        defaultMonthShiftTypeId: null,
        defaultView: 'month',
      }),
    ).toEqual({ defaultMonthShiftTypeId: null, defaultView: 'month' });
    expect(
      updateMemberCalendarPreferencesSchema.parse({
        defaultMonthShiftTypeId: null,
        defaultView: null,
      }),
    ).toEqual({ defaultMonthShiftTypeId: null, defaultView: null });
  });
});
