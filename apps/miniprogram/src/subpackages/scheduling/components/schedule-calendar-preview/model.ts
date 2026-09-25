import {
  addWeeks,
  buildMonthDisplayGrid,
  getCurrentBusinessDate,
  getWeekDays,
  getWeekLabel,
  getWeekOfMonthLabel,
  getWeekStartDate,
} from '@schedule/presentation-core';
import type { ConfirmedHolidayDate } from '@schedule/contracts';
import { calendarShiftBadge } from '../../../../components/calendar/calendar-duty-view.js';
import {
  calendarWeekPanelHeight,
  createCalendarWeekGroups,
  sortCalendarWeekAssignments,
} from '../../../../components/calendar/calendar-week-model.js';
import {
  mapCalendarPeriodRing,
  type CalendarPeriodSlot,
} from '../../../../components/calendar/calendar-period-pager.js';

export interface PreviewDuty {
  readonly businessDate: string;
  readonly plannedMemberName?: string | undefined;
  readonly actualMemberName?: string | undefined;
  readonly shiftTypeAbbreviation: string;
  readonly shiftTypeName: string;
  readonly shiftTypeColor?: string;
  readonly shiftTypeTextColor?: string;
  readonly state?: 'normal' | 'removed' | 'added';
  readonly slotPosition: number;
  readonly shiftTypeId?: string;
}

export interface PreviewWeekOptions {
  readonly nursePreset?: boolean;
  readonly shiftTypeOrder?: readonly string[];
  readonly compact?: boolean;
  readonly viewportWidth?: number;
}

export function mergePreviewAssignments(
  proposed: readonly PreviewDuty[],
  existing: readonly PreviewDuty[],
): readonly PreviewDuty[] {
  const replacing = new Set(proposed.map((item) => item.businessDate));
  return [
    ...existing.map((item) => ({
      ...item,
      state: replacing.has(item.businessDate) ? ('removed' as const) : ('normal' as const),
    })),
    ...proposed.map((item) => ({ ...item, state: 'added' as const })),
  ];
}

export function previewCalendarModel(
  assignments: readonly PreviewDuty[],
  month: string,
  selectedDate: string,
  slot: CalendarPeriodSlot = 1,
  restrictToProposed = false,
  holidays: readonly ConfirmedHolidayDate[] = [],
) {
  const holidayByDate = new Map(holidays.map((holiday) => [holiday.date, holiday]));
  const [year, monthNumber] = month.split('-').map(Number);
  const today = getCurrentBusinessDate();
  const panels = mapCalendarPeriodRing(
    ([-1, 0, 1] as const).map((relative) => {
      const target = new Date(Date.UTC(year!, monthNumber! - 1 + relative, 1))
        .toISOString()
        .slice(0, 7);
      const grid = buildMonthDisplayGrid(target).flat();
      const cells = grid.map((cell, index) => {
        const holiday = holidayByDate.get(cell.businessDate);
        const duties = assignments
          .filter((item) => item.businessDate === cell.businessDate)
          .sort((a, b) => a.slotPosition - b.slotPosition)
          .map((item, i) => {
            const badge = calendarShiftBadge(
              item.shiftTypeAbbreviation,
              item.shiftTypeName,
              item.shiftTypeColor,
              item.shiftTypeTextColor,
            );
            const isExistingComparison = item.state === 'normal' || item.state === 'removed';
            return {
              key: `${cell.businessDate}:${item.slotPosition}:${i}`,
              name: item.actualMemberName ?? item.plannedMemberName ?? '待安排',
              ...badge,
              ...(isExistingComparison
                ? {
                    badgeStyle: 'background-color:#eef1f4;border-color:#d5dbe3;color:#6b7280;',
                  }
                : {}),
              comparisonClass: isExistingComparison
                ? 'is-existing-comparison'
                : item.state === 'added'
                  ? 'is-current-draft'
                  : '',
              state: item.state ?? 'normal',
            };
          });
        return {
          businessDate: cell.businessDate,
          day: cell.businessDate.slice(8),
          holiday: holiday?.isOffDay === true ? holiday.holidayName.slice(0, 2) : '',
          isHoliday: !cell.isOutsideMonth && holiday?.isOffDay === true,
          isWorkday: !cell.isOutsideMonth && holiday?.isWorkday === true,
          duties,
          ariaLabel: `${cell.businessDate}，${duties.map((item) => `${item.name}${item.abbreviation}`).join('，') || '无排班'}`,
          disabled: restrictToProposed
            ? !duties.some((duty) => duty.state === 'added')
            : duties.length === 0,
          isCurrentMonth: !cell.isOutsideMonth,
          isWeekend: index % 7 >= 5,
          isToday: cell.businessDate === today,
          isSelected: cell.businessDate === selectedDate,
          isBottomRow: index >= grid.length - 7,
          isBottomLeft: index === grid.length - 7,
          isBottomRight: index === grid.length - 1,
        };
      });
      return {
        key: target,
        month: target,
        relative,
        slot: 1 as CalendarPeriodSlot,
        rowHeight: Math.max(54, 26 + Math.max(1, ...cells.map((cell) => cell.duties.length)) * 17),
        cells,
      };
    }),
    slot,
  );
  const panelHeights = panels.map((panel) => (panel.cells.length / 7) * panel.rowHeight);
  const details = assignments
    .filter((item) => item.businessDate === selectedDate)
    .map((item, index) => ({
      key: String(index),
      label: `${item.actualMemberName ?? item.plannedMemberName ?? '待安排'} · ${item.shiftTypeName}`,
    }));
  return {
    panels,
    panelHeights,
    gridHeight: panelHeights[slot] ?? 270,
    monthLabel: `${year}年${monthNumber}月`,
    periodSubtitle: '',
    details,
  };
}

export function previewWeekModel(
  assignments: readonly PreviewDuty[],
  weekDate: string,
  selectedDate: string,
  restrictToProposed = false,
  holidays: readonly ConfirmedHolidayDate[] = [],
  options: PreviewWeekOptions = {},
) {
  const dates = getWeekDays(getWeekStartDate(weekDate));
  const monthModels = new Map(
    [...new Set(dates.map((date) => date.slice(0, 7)))].map((month) => [
      month,
      previewCalendarModel(assignments, month, selectedDate, 1, restrictToProposed, holidays),
    ]),
  );
  const days = dates.map((date, index) => {
    const panel = monthModels.get(date.slice(0, 7))?.panels.find((item) => item.relative === 0);
    const cell = panel?.cells.find((item) => item.businessDate === date);
    if (cell === undefined) return undefined;
    const dayAssignments = sortCalendarWeekAssignments(
      assignments
        .filter((item) => item.businessDate === date)
        .map((item) => ({
          ...item,
          shiftTypeId: item.shiftTypeId ?? item.shiftTypeName,
        })),
      options.shiftTypeOrder ?? [],
      options.nursePreset === true,
    );
    const shiftGroups = createCalendarWeekGroups(dayAssignments, (item) => ({
      key: `${date}:${item.shiftTypeId}:${item.slotPosition}:${item.actualMemberName ?? item.plannedMemberName}`,
      name: item.actualMemberName ?? item.plannedMemberName ?? '待安排',
      markers: [] as string[],
      comparisonClass:
        item.state === 'normal' || item.state === 'removed' ? 'is-existing-comparison' : '',
    })).map((group) =>
      group.duties.every((duty) => duty.comparisonClass === 'is-existing-comparison')
        ? { ...group, color: '#94a3b8', tint: 'rgba(148, 163, 184, 0.094)' }
        : group,
    );
    return {
      ...cell,
      shiftGroups,
      isPast: false,
      weekday: '一二三四五六日'[index],
    };
  });
  const details = assignments
    .filter((item) => item.businessDate === selectedDate)
    .map((item, index) => ({
      key: String(index),
      label: `${item.actualMemberName ?? item.plannedMemberName ?? '待安排'} · ${item.shiftTypeName}`,
    }));
  return {
    days: days.filter((day): day is NonNullable<typeof day> => day !== undefined),
    details,
    label: getWeekLabel(weekDate),
    height: calendarWeekPanelHeight(
      days.filter((day) => day !== undefined),
      (options.viewportWidth ?? (options.compact ? 320 : 390)) <= 340 ? 2 : 3,
    ),
  };
}

export function previewWeekPanels(
  assignments: readonly PreviewDuty[],
  weekStart: string,
  selectedDate: string,
  slot: CalendarPeriodSlot = 1,
  restrictToProposed = false,
  holidays: readonly ConfirmedHolidayDate[] = [],
  options: PreviewWeekOptions = {},
) {
  const panels = mapCalendarPeriodRing(
    ([-1, 0, 1] as const).map((relative) => {
      const start = addWeeks(weekStart, relative);
      const week = previewWeekModel(
        assignments,
        start,
        selectedDate,
        restrictToProposed,
        holidays,
        options,
      );
      return {
        key: start,
        relative,
        slot: 1 as CalendarPeriodSlot,
        rowHeight: week.height,
        days: week.days,
        cells: week.days.map((day, index) => ({
          ...day,
          isBottomRow: true,
          isBottomLeft: index === 0,
          isBottomRight: index === 6,
        })),
      };
    }),
    slot,
  );
  const panelHeights = panels.map((panel) => panel.rowHeight);
  return {
    panels,
    panelHeights,
    gridHeight: panelHeights[slot] ?? 132,
    monthLabel: getWeekOfMonthLabel(weekStart),
    periodSubtitle: getWeekLabel(weekStart),
    details: previewWeekModel(
      assignments,
      weekStart,
      selectedDate,
      restrictToProposed,
      holidays,
      options,
    ).details,
  };
}
