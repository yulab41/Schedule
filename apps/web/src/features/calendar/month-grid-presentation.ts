const businessMonthPattern = /^\d{4}-\d{2}$/u;

export interface MonthDisplayCell {
  readonly businessDate: string;
  readonly isOutsideMonth: boolean;
}

export type MonthDisplayWeek = readonly MonthDisplayCell[];

function formatUtcBusinessDate(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

export function buildMonthDisplayGrid(businessMonth: string): readonly MonthDisplayWeek[] {
  if (!businessMonthPattern.test(businessMonth)) {
    throw new Error('The business month must use the YYYY-MM format.');
  }

  const [yearText = '', monthText = ''] = businessMonth.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('The calendar month must be a valid year and 1-12 month.');
  }

  const firstDay = Date.UTC(year, month - 1, 1);
  const mondayFirstOffset = (new Date(firstDay).getUTCDay() + 6) % 7;
  const gridStart = firstDay - mondayFirstOffset * 86_400_000;
  const cells = Array.from({ length: 42 }, (_, index): MonthDisplayCell => {
    const businessDate = formatUtcBusinessDate(gridStart + index * 86_400_000);
    return {
      businessDate,
      isOutsideMonth: !businessDate.startsWith(`${businessMonth}-`),
    };
  });

  return Array.from({ length: 6 }, (_, weekIndex) => cells.slice(weekIndex * 7, weekIndex * 7 + 7));
}
