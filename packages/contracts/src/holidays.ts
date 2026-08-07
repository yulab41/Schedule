import { z } from 'zod';

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

export const confirmedHolidayDateSchema = z
  .object({
    date: z.string(),
    holidayName: z.string(),
    isOffDay: z.boolean(),
    isWorkday: z.boolean(),
  })
  .strict();
export type ConfirmedHolidayDate = z.infer<typeof confirmedHolidayDateSchema>;

export const holidayReadModelSchema = z
  .object({
    confirmed: z.boolean(),
    dates: z.readonly(z.array(confirmedHolidayDateSchema)),
    year: z.number().int(),
  })
  .strict();
export type HolidayReadModel = z.infer<typeof holidayReadModelSchema>;

export interface HolidayCoverage {
  readonly confirmedYears: readonly number[];
  readonly missingNextYear: boolean;
  readonly nextYear: number;
}
