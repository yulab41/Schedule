import { z } from 'zod';

export const calendarPreferenceViewSchema = z.enum(['month', 'week', 'list']);
export type CalendarPreferenceView = z.infer<typeof calendarPreferenceViewSchema>;

const nullableShiftTypeIdSchema = z.string().uuid().nullable();

export const calendarPreferencesSchema = z
  .object({
    canManageGroupDefaults: z.boolean(),
    effectiveMonthShiftTypeId: nullableShiftTypeIdSchema,
    effectiveView: calendarPreferenceViewSchema,
    groupDefaultMonthShiftTypeId: nullableShiftTypeIdSchema,
    groupDefaultView: calendarPreferenceViewSchema,
    groupId: z.string().uuid(),
    memberDefaultMonthShiftTypeId: nullableShiftTypeIdSchema,
    memberDefaultView: calendarPreferenceViewSchema.nullable(),
    membershipId: z.string().uuid(),
  })
  .strict();
export type CalendarPreferences = z.infer<typeof calendarPreferencesSchema>;

export const updateGroupCalendarDefaultsSchema = z
  .object({
    defaultMonthShiftTypeId: nullableShiftTypeIdSchema,
    defaultView: calendarPreferenceViewSchema,
  })
  .strict();
export type UpdateGroupCalendarDefaults = z.infer<typeof updateGroupCalendarDefaultsSchema>;

export const updateMemberCalendarPreferencesSchema = z
  .object({
    defaultMonthShiftTypeId: nullableShiftTypeIdSchema,
    defaultView: calendarPreferenceViewSchema.nullable(),
  })
  .strict();
export type UpdateMemberCalendarPreferences = z.infer<typeof updateMemberCalendarPreferencesSchema>;
