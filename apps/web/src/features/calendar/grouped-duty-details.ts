import type { CalendarDutyAssignment, CalendarDutyMember } from '@schedule/contracts';

import { buildSelectedDateDutyRows, type SelectedDateDutyRow } from './selected-date-duty.js';

export interface GroupedDutyDetail {
  readonly endsAt: string;
  readonly rows: readonly SelectedDateDutyRow[];
  readonly shiftTypeAbbreviation: string;
  readonly shiftTypeColor: string;
  readonly shiftTypeId: string;
  readonly shiftTypeName: string;
  readonly shiftTypeTextColor: string;
  readonly startsAt: string;
}

export function buildGroupedDutyDetails(
  selectedDate: string,
  assignments: readonly CalendarDutyAssignment[],
  members: readonly CalendarDutyMember[],
  shiftTypeOrder: readonly string[] = [],
): readonly GroupedDutyDetail[] {
  const rows = buildSelectedDateDutyRows(selectedDate, assignments, members);
  const grouped = new Map<string, SelectedDateDutyRow[]>();

  for (const row of rows) {
    const current = grouped.get(row.assignment.shiftTypeId);
    if (current === undefined) grouped.set(row.assignment.shiftTypeId, [row]);
    else current.push(row);
  }

  const orderByShiftTypeId = new Map(
    shiftTypeOrder.map((shiftTypeId, index) => [shiftTypeId, index] as const),
  );

  return [...grouped.entries()]
    .map(([shiftTypeId, groupedRows]) => {
      const first = groupedRows[0];
      if (first === undefined) return undefined;
      return {
        endsAt: first.assignment.endsAt,
        rows: groupedRows,
        shiftTypeAbbreviation: first.assignment.shiftTypeAbbreviation,
        shiftTypeColor: first.assignment.shiftTypeColor,
        shiftTypeId,
        shiftTypeName: first.assignment.shiftTypeName,
        shiftTypeTextColor: first.assignment.shiftTypeTextColor,
        startsAt: first.assignment.startsAt,
      } satisfies GroupedDutyDetail;
    })
    .filter((group) => group !== undefined)
    .sort((left, right) => {
      const timeComparison = left.startsAt.localeCompare(right.startsAt);
      if (timeComparison !== 0) return timeComparison;
      return (
        (orderByShiftTypeId.get(left.shiftTypeId) ?? Number.MAX_SAFE_INTEGER) -
        (orderByShiftTypeId.get(right.shiftTypeId) ?? Number.MAX_SAFE_INTEGER)
      );
    });
}
