export type CalendarPocMarker = '加' | '换';
export type CalendarPocRelativePanel = -1 | 0 | 1;

export interface CalendarPocCell {
  readonly ariaLabel: string;
  readonly businessDate: string;
  readonly day: string;
  readonly holiday: string;
  readonly isCurrentMonth: boolean;
  readonly isBottomLeft: boolean;
  readonly isBottomRight: boolean;
  readonly isHoliday: boolean;
  readonly isSelected: boolean;
  readonly isToday: boolean;
  readonly isWeekend: boolean;
  readonly marker: CalendarPocMarker | '';
  readonly person: string;
}

export interface CalendarPocPanel {
  readonly cells: readonly CalendarPocCell[];
  readonly key: string;
  readonly relative: CalendarPocRelativePanel;
}

export interface CalendarPocViewModel {
  readonly gridHeight: number;
  readonly monthLabel: string;
  readonly monthOffset: number;
  readonly panels: readonly CalendarPocPanel[];
  readonly selectedBusinessDate: string;
  readonly selectedLabel: string;
  readonly summary: {
    readonly countLabel: string;
    readonly meta: string;
    readonly person: string;
  };
}

const BASE_YEAR = 2026;
const BASE_MONTH_INDEX = 9;
const TODAY = '2026-10-14';
const weekdayLabels = ['日', '一', '二', '三', '四', '五', '六'] as const;
const monthPeople = ['林恩宇', '陈护士', '王护士', '周医生'] as const;
const panelOffsets: readonly CalendarPocRelativePanel[] = [-1, 0, 1];

function getMonthStart(offset: number): Date {
  return new Date(Date.UTC(BASE_YEAR, BASE_MONTH_INDEX + offset, 1));
}

function formatDateKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(
    date.getUTCDate(),
  ).padStart(2, '0')}`;
}

function getDefaultSelectedDate(offset: number): string {
  const date = getMonthStart(offset);
  date.setUTCDate(14);
  return formatDateKey(date);
}

function createAriaLabel(
  businessDate: string,
  holiday: string,
  person: string,
  marker: CalendarPocMarker | '',
): string {
  const state = [holiday, person, marker === '加' ? '加班' : marker === '换' ? '换班' : '']
    .filter((value) => value.length > 0)
    .join('，');
  return state.length > 0 ? `${businessDate}，${state}` : businessDate;
}

function createMonthCells(
  offset: number,
  selectedBusinessDate: string,
): readonly CalendarPocCell[] {
  const monthStart = getMonthStart(offset);
  const firstMondayOffset = (monthStart.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(
    Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const cellCount = Math.ceil((firstMondayOffset + daysInMonth) / 7) * 7;
  const gridStart = new Date(monthStart);
  gridStart.setUTCDate(1 - firstMondayOffset);

  return Array.from({ length: cellCount }, (_, index) => {
    const date = new Date(gridStart);
    date.setUTCDate(gridStart.getUTCDate() + index);
    const businessDate = formatDateKey(date);
    const isCurrentMonth = date.getUTCMonth() === monthStart.getUTCMonth();
    const day = date.getUTCDate();
    const personSeed = day + date.getUTCMonth() * 3;
    const markerSeed = day + date.getUTCMonth();
    const person =
      isCurrentMonth && personSeed % 3 !== 0
        ? (monthPeople[personSeed % monthPeople.length] ?? '')
        : '';
    const marker: CalendarPocMarker | '' =
      isCurrentMonth && markerSeed % 11 === 0
        ? '换'
        : isCurrentMonth && markerSeed % 8 === 0
          ? '加'
          : '';
    const holiday =
      date.getUTCFullYear() === 2026 && date.getUTCMonth() === 9 && day <= 7 ? '国庆' : '';

    return {
      ariaLabel: createAriaLabel(businessDate, holiday, person, marker),
      businessDate,
      day: String(day),
      holiday,
      isBottomLeft: index === cellCount - 7,
      isBottomRight: index === cellCount - 1,
      isCurrentMonth,
      isHoliday: holiday.length > 0,
      isSelected: isCurrentMonth && businessDate === selectedBusinessDate,
      isToday: businessDate === TODAY,
      isWeekend: index % 7 >= 5,
      marker,
      person,
    } satisfies CalendarPocCell;
  });
}

export function createCalendarPocViewModel(
  monthOffset: number,
  requestedSelectedDate?: string,
): CalendarPocViewModel {
  const monthStart = getMonthStart(monthOffset);
  const monthKey = `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, '0')}`;
  const selectedBusinessDate =
    requestedSelectedDate?.startsWith(`${monthKey}-`) === true
      ? requestedSelectedDate
      : getDefaultSelectedDate(monthOffset);
  const selectedDate = new Date(`${selectedBusinessDate}T00:00:00.000Z`);
  const panels = panelOffsets.map((relative) => {
    const panelMonth = getMonthStart(monthOffset + relative);
    return {
      cells: createMonthCells(monthOffset + relative, selectedBusinessDate),
      key: `${panelMonth.getUTCFullYear()}-${String(panelMonth.getUTCMonth() + 1).padStart(2, '0')}`,
      relative,
    } satisfies CalendarPocPanel;
  });
  const currentPanel = panels.find((panel) => panel.relative === 0);

  return {
    gridHeight: Math.ceil((currentPanel?.cells.length ?? 35) / 7) * 54,
    monthLabel: `${monthStart.getUTCFullYear()}年${monthStart.getUTCMonth() + 1}月`,
    monthOffset,
    panels,
    selectedBusinessDate,
    selectedLabel: `${selectedDate.getUTCMonth() + 1}月${selectedDate.getUTCDate()}日 · 周${
      weekdayLabels[selectedDate.getUTCDay()]
    }`,
    summary: {
      countLabel: '2 个班次',
      meta: '夜班 · 18:00–次日08:00 · 换班',
      person: '王护士',
    },
  };
}
