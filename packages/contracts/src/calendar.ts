import { z } from 'zod';

export const calendarChangeMarkerSchema = z.enum([
  'swap',
  'leave-cover',
  'manual-adjustment',
  'overtime',
]);
export type CalendarChangeMarker = z.infer<typeof calendarChangeMarkerSchema>;

export const calendarDutyAssignmentSchema = z
  .object({
    actualMemberName: z.string().optional(),
    actualMembershipId: z.string().optional(),
    businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
    changeMarkers: z.readonly(z.array(calendarChangeMarkerSchema)),
    endsAt: z.string(),
    id: z.string().min(1),
    plannedMemberName: z.string().optional(),
    plannedMembershipId: z.string().optional(),
    schedulePeriodId: z.string().min(1),
    scheduleRoleId: z.string().min(1),
    scheduleRoleName: z.string().min(1),
    shiftTypeAbbreviation: z.string().min(1),
    shiftTypeColor: z.string().regex(/^#[\dA-F]{6}$/iu),
    shiftTypeId: z.string().min(1),
    shiftTypeName: z.string().min(1),
    shiftTypeTextColor: z.string().regex(/^#[\dA-F]{6}$/iu),
    slotPosition: z.number().int().min(1),
    startsAt: z.string(),
  })
  .passthrough();
export type CalendarDutyAssignment = z.infer<typeof calendarDutyAssignmentSchema>;

export const calendarDutyMemberSchema = z
  .object({
    isConfirmed: z.boolean(),
    membershipId: z.string().min(1),
    mobilePhone: z.string().optional(),
    realName: z.string().min(1),
    shortPhone: z.string().optional(),
  })
  .passthrough();
export type CalendarDutyMember = z.infer<typeof calendarDutyMemberSchema>;

export const calendarRoleSummarySchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
  })
  .passthrough();
export type CalendarRoleSummary = z.infer<typeof calendarRoleSummarySchema>;

export const calendarShiftTypeSummarySchema = z
  .object({
    abbreviation: z.string().min(1),
    color: z.string().regex(/^#[\dA-F]{6}$/iu),
    crossesMidnight: z.boolean(),
    endTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/u)
      .optional(),
    id: z.string().min(1),
    isAllDay: z.boolean(),
    name: z.string().min(1),
    startTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/u)
      .optional(),
    textColor: z.string().regex(/^#[\dA-F]{6}$/iu),
  })
  .passthrough();
export type CalendarShiftTypeSummary = z.infer<typeof calendarShiftTypeSummarySchema>;

export const calendarReadModelSchema = z
  .object({
    assignments: z.readonly(z.array(calendarDutyAssignmentSchema)),
    businessMonth: z.string().regex(/^\d{4}-\d{2}$/u),
    groupId: z.string(),
    members: z.readonly(z.array(calendarDutyMemberSchema)),
    roles: z.readonly(z.array(calendarRoleSummarySchema)),
    shiftTypes: z.readonly(z.array(calendarShiftTypeSummarySchema)),
  })
  .passthrough();
export type CalendarReadModel = z.infer<typeof calendarReadModelSchema>;

export const guestCalendarReadModelSchema = z
  .object({
    calendar: calendarReadModelSchema,
    groupName: z.string(),
  })
  .passthrough();
export type GuestCalendarReadModel = z.infer<typeof guestCalendarReadModelSchema>;

export const guestGroupSummarySchema = z
  .object({
    id: z.string(),
    name: z.string(),
  })
  .passthrough();
export type GuestGroupSummary = z.infer<typeof guestGroupSummarySchema>;

export const guestGroupSummaryListSchema = z.readonly(z.array(guestGroupSummarySchema));

export interface ReadGuestCalendarRequest {
  readonly businessMonth: string;
  readonly groupCode: string;
}
