import { buildMonthDisplayGrid, getCurrentBusinessDate } from '@schedule/presentation-core';
import { calendarShiftBadge } from '../../../../components/calendar/calendar-duty-view.js';
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
}

export function mergePreviewAssignments(
  proposed: readonly PreviewDuty[],
  existing: readonly PreviewDuty[],
): readonly PreviewDuty[] {
  const replacing = new Set(proposed.map((item) => `${item.businessDate}:${item.slotPosition}`));
  return [
    ...existing.map((item) => ({
      ...item,
      state: replacing.has(`${item.businessDate}:${item.slotPosition}`)
        ? ('removed' as const)
        : ('normal' as const),
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
) {
  const [year, monthNumber] = month.split('-').map(Number);
  const today = getCurrentBusinessDate();
  const panels = mapCalendarPeriodRing(
    ([-1, 0, 1] as const).map((relative) => {
      const target = new Date(Date.UTC(year!, monthNumber! - 1 + relative, 1))
        .toISOString()
        .slice(0, 7);
      const grid = buildMonthDisplayGrid(target).flat();
      const cells = grid.map((cell, index) => {
        const duties = assignments
          .filter((item) => item.businessDate === cell.businessDate)
          .sort((a, b) => a.slotPosition - b.slotPosition)
          .map((item, i) => ({
            key: `${cell.businessDate}:${item.slotPosition}:${i}`,
            name: item.actualMemberName ?? item.plannedMemberName ?? '待安排',
            ...calendarShiftBadge(
              item.shiftTypeAbbreviation,
              item.shiftTypeName,
              item.shiftTypeColor,
              item.shiftTypeTextColor,
            ),
            state: item.state ?? 'normal',
          }));
        return {
          businessDate: cell.businessDate,
          day: cell.businessDate.slice(8),
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
    details,
  };
}
