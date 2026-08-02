export type HolidayImportChange = 'added' | 'changed' | 'removed' | 'unchanged';

export interface HolidayDateInput {
  readonly date: string;
  readonly holidayName: string;
  readonly isOffDay: boolean;
  readonly isWorkday: boolean;
}

export interface HolidayImportDiffEntry {
  readonly change: HolidayImportChange;
  readonly date: string;
  readonly holidayName: string;
  readonly isOffDay: boolean;
  readonly isWorkday: boolean;
}

export interface HolidayImportPreview {
  readonly addedCount: number;
  readonly changedCount: number;
  readonly entries: readonly HolidayImportDiffEntry[];
  readonly latestConfirmedVersion?: number;
  readonly removedCount: number;
  readonly unchangedCount: number;
  readonly year: number;
}

export interface HolidayImportInput {
  readonly dates: readonly HolidayDateInput[];
  readonly year: number;
}

export interface HolidayCalendarVersion {
  readonly confirmedAt?: string;
  readonly createdAt: string;
  readonly dateCount: number;
  readonly id: string;
  readonly status: 'draft' | 'confirmed';
  readonly version: number;
  readonly year: number;
}

export interface HolidayImportResult {
  readonly calendarVersionId: string;
  readonly dateCount: number;
  readonly status: 'draft';
  readonly version: number;
  readonly year: number;
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

export interface HolidayCoverage {
  readonly confirmedYears: readonly number[];
  readonly missingNextYear: boolean;
  readonly nextYear: number;
}
