export type CalendarChangeMarker = 'leave-cover' | 'overtime' | 'swap';

export interface CalendarDutyAssignment {
  readonly actualMemberName?: string | undefined;
  readonly actualMembershipId?: string | undefined;
  readonly businessDate: string;
  readonly changeMarkers: readonly CalendarChangeMarker[];
  readonly endsAt: string;
  readonly id: string;
  readonly plannedMemberName?: string | undefined;
  readonly plannedMembershipId?: string | undefined;
  readonly schedulePeriodId: string;
  readonly scheduleRoleId: string;
  readonly scheduleRoleName: string;
  readonly shiftTypeAbbreviation: string;
  readonly shiftTypeColor: string;
  readonly shiftTypeId: string;
  readonly shiftTypeName: string;
  readonly shiftTypeTextColor: string;
  readonly slotPosition: number;
  readonly startsAt: string;
}

export interface CalendarDutyMember {
  readonly isConfirmed: boolean;
  readonly membershipId: string;
  readonly mobilePhone?: string | undefined;
  readonly realName: string;
  readonly shortPhone?: string | undefined;
}

export interface CalendarRoleSummary {
  readonly id: string;
  readonly name: string;
}

export interface CalendarShiftTypeSummary {
  readonly abbreviation: string;
  readonly color: string;
  readonly crossesMidnight: boolean;
  readonly endTime?: string | undefined;
  readonly id: string;
  readonly isAllDay: boolean;
  readonly name: string;
  readonly startTime?: string | undefined;
  readonly textColor: string;
}

export interface CalendarReadModel {
  readonly assignments: readonly CalendarDutyAssignment[];
  readonly businessMonth: string;
  readonly groupId: string;
  readonly members: readonly CalendarDutyMember[];
  readonly roles: readonly CalendarRoleSummary[];
  readonly shiftTypes: readonly CalendarShiftTypeSummary[];
}

export interface ConfirmedHolidayDate {
  readonly date: string;
  readonly holidayName: string;
  readonly isOffDay: boolean;
  readonly isWorkday: boolean;
}

export interface HolidayReadModel {
  readonly confirmed: boolean;
  readonly dates: readonly ConfirmedHolidayDate[];
  readonly year: number;
}
