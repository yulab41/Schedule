export interface HolidayFixtureEntry {
  readonly date: string;
  readonly holidayName: string;
  readonly isOffDay: boolean;
  readonly isWorkday: boolean;
}

// Synthetic fixture data for tests and offline imports. It is deliberately not
// official State Council data; the production import flow must use a reviewed
// dataset produced from each year's official notice.
export const holidays2025Fixture: readonly HolidayFixtureEntry[] = [
  { date: '2025-01-01', holidayName: '元旦', isOffDay: true, isWorkday: false },
  { date: '2025-01-26', holidayName: '春节调休', isOffDay: false, isWorkday: true },
  { date: '2025-01-28', holidayName: '春节', isOffDay: true, isWorkday: false },
  { date: '2025-01-29', holidayName: '春节', isOffDay: true, isWorkday: false },
  { date: '2025-01-30', holidayName: '春节', isOffDay: true, isWorkday: false },
  { date: '2025-01-31', holidayName: '春节', isOffDay: true, isWorkday: false },
  { date: '2025-02-04', holidayName: '春节', isOffDay: true, isWorkday: false },
  { date: '2025-05-01', holidayName: '劳动节', isOffDay: true, isWorkday: false },
  { date: '2025-10-01', holidayName: '国庆节', isOffDay: true, isWorkday: false },
];

export const holidays2026Fixture: readonly HolidayFixtureEntry[] = [
  { date: '2026-01-01', holidayName: '元旦', isOffDay: true, isWorkday: false },
  { date: '2026-02-15', holidayName: '春节调休', isOffDay: false, isWorkday: true },
  { date: '2026-02-17', holidayName: '春节', isOffDay: true, isWorkday: false },
  { date: '2026-02-18', holidayName: '春节', isOffDay: true, isWorkday: false },
  { date: '2026-05-01', holidayName: '劳动节', isOffDay: true, isWorkday: false },
  { date: '2026-10-01', holidayName: '国庆节', isOffDay: true, isWorkday: false },
];

export const holidays2027Fixture: readonly HolidayFixtureEntry[] = [
  { date: '2027-01-01', holidayName: '元旦', isOffDay: true, isWorkday: false },
  { date: '2027-02-05', holidayName: '春节调休', isOffDay: false, isWorkday: true },
  { date: '2027-02-07', holidayName: '春节', isOffDay: true, isWorkday: false },
  { date: '2027-05-01', holidayName: '劳动节', isOffDay: true, isWorkday: false },
  { date: '2027-10-01', holidayName: '国庆节', isOffDay: true, isWorkday: false },
];
