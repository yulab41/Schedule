import { nurseShiftCode, nurseShiftOrder } from '../../features/workbench/nurse-duty-state.js';

export interface CalendarWeekShiftLike {
  readonly shiftTypeId: string;
  readonly shiftTypeName: string;
  readonly shiftTypeAbbreviation: string;
  readonly shiftTypeColor?: string;
  readonly shiftTypeTextColor?: string;
  readonly slotPosition: number;
}

export function sortCalendarWeekAssignments<T extends CalendarWeekShiftLike>(
  assignments: readonly T[],
  shiftTypeOrder: readonly string[],
  nursePreset: boolean,
): T[] {
  const order = new Map(shiftTypeOrder.map((id, index) => [id, index]));
  const rank = (item: T) => {
    const code = nurseShiftCode(item.shiftTypeName) ?? nurseShiftCode(item.shiftTypeAbbreviation);
    const nurseIndex = code === undefined ? -1 : nurseShiftOrder.indexOf(code);
    return nursePreset && nurseIndex >= 0
      ? nurseIndex
      : 6 + (order.get(item.shiftTypeId) ?? order.size);
  };
  return [...assignments].sort((a, b) => rank(a) - rank(b) || a.slotPosition - b.slotPosition);
}

export function createCalendarWeekGroups<T extends CalendarWeekShiftLike, D>(
  assignments: readonly T[],
  createDuty: (assignment: T) => D,
) {
  const groups = new Map<string, T[]>();
  for (const assignment of assignments) {
    const rows = groups.get(assignment.shiftTypeId) ?? [];
    rows.push(assignment);
    groups.set(assignment.shiftTypeId, rows);
  }
  return [...groups.entries()].map(([key, rows]) => {
    const first = rows[0]!;
    const color = first.shiftTypeColor ?? '#2563a4';
    const red = Number.parseInt(color.slice(1, 3), 16);
    const green = Number.parseInt(color.slice(3, 5), 16);
    const blue = Number.parseInt(color.slice(5, 7), 16);
    return {
      key,
      abbreviation: first.shiftTypeAbbreviation,
      color,
      textColor: first.shiftTypeTextColor ?? '#ffffff',
      tint: `rgba(${red}, ${green}, ${blue}, 0.094)`,
      duties: rows.map(createDuty),
    };
  });
}

export function calendarWeekPanelHeight(
  days: readonly {
    readonly shiftGroups: readonly {
      readonly duties: readonly { readonly name: string; readonly markers?: readonly string[] }[];
    }[];
  }[],
  charsPerLine = 3,
): number {
  return Math.max(
    112,
    ...days.map(
      (day) =>
        32 +
        day.shiftGroups.reduce(
          (sum, group) =>
            sum +
            28 +
            group.duties.reduce(
              (size, row) =>
                size +
                Math.max(1, Math.ceil(Array.from(row.name).length / charsPerLine)) * 16 +
                (row.markers?.length ? 16 : 0),
              0,
            ),
          0,
        ),
    ),
  );
}
