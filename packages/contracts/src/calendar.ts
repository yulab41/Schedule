export type CalendarChangeMarker = 'swap' | 'leave-cover' | 'manual-adjustment' | 'overtime';

export interface CalendarDutyAssignment {
  readonly actualMemberName?: string;
  readonly actualMembershipId?: string;
  readonly businessDate: string;
  readonly changeMarkers: readonly CalendarChangeMarker[];
  readonly endsAt: string;
  readonly id: string;
  readonly plannedMemberName?: string;
  readonly plannedMembershipId?: string;
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
  readonly mobilePhone?: string;
  readonly realName: string;
  readonly shortPhone?: string;
}

export interface CalendarRoleSummary {
  readonly id: string;
  readonly name: string;
}

export interface CalendarShiftTypeSummary {
  readonly abbreviation: string;
  readonly color: string;
  readonly crossesMidnight: boolean;
  readonly endTime?: string;
  readonly id: string;
  readonly isAllDay: boolean;
  readonly name: string;
  readonly startTime?: string;
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

export interface GuestCalendarReadModel {
  readonly calendar: CalendarReadModel;
  readonly groupName: string;
}

export interface GuestGroupSummary {
  readonly id: string;
  readonly name: string;
}

export interface ReadGuestCalendarRequest {
  readonly businessMonth: string;
  readonly groupCode: string;
}
