export interface HeadNeckRotationAssignment {
  readonly businessDate: string;
  readonly membershipId: string;
}

export interface HeadNeckRotationRow {
  readonly membershipId: string;
  readonly tokens: readonly (number | '-' | undefined)[];
}

export function resolveHeadNeckDutyMembershipId(
  assignment: {
    readonly actualMembershipId: string | null;
    readonly plannedMembershipId: string | null;
  },
  canonicalByMembershipId: ReadonlyMap<string, string>,
): string | undefined {
  const membershipId = assignment.actualMembershipId ?? assignment.plannedMembershipId;
  return membershipId === null ? undefined : canonicalByMembershipId.get(membershipId);
}

export function buildHeadNeckRotationGrid(
  orderedMembershipIds: readonly string[],
  assignments: readonly HeadNeckRotationAssignment[],
): readonly HeadNeckRotationRow[] {
  if (orderedMembershipIds.length === 0) return [];
  const rowByMembershipId = new Map(
    orderedMembershipIds.map((membershipId, index) => [membershipId, index]),
  );
  const rows: (number | '-' | undefined)[][] = orderedMembershipIds.map(() => []);
  const sorted = [...assignments].sort((a, b) => a.businessDate.localeCompare(b.businessDate));
  if (sorted.length === 0)
    return orderedMembershipIds.map((membershipId) => ({ membershipId, tokens: [] }));

  const firstRow = rowByMembershipId.get(sorted[0]!.membershipId);
  if (firstRow === undefined) throw new Error('Word 排班包含未配置的一值人员。');
  let rowIndex = firstRow;
  let columnIndex = 0;

  for (const assignment of sorted) {
    const assignedRow = rowByMembershipId.get(assignment.membershipId);
    if (assignedRow === undefined) throw new Error('Word 排班包含未配置的一值人员。');
    while (rowIndex !== assignedRow) {
      rows[rowIndex]![columnIndex] = '-';
      ({ rowIndex, columnIndex } = advance(rowIndex, columnIndex, rows.length));
    }
    rows[rowIndex]![columnIndex] = Number(assignment.businessDate.slice(-2));
    ({ rowIndex, columnIndex } = advance(rowIndex, columnIndex, rows.length));
  }

  const columnCount = Math.max(...rows.map((row) => row.length));
  return orderedMembershipIds.map((membershipId, index) => ({
    membershipId,
    tokens: Array.from({ length: columnCount }, (_, column) => rows[index]![column]),
  }));
}

function advance(rowIndex: number, columnIndex: number, rowCount: number) {
  const nextRow = rowIndex + 1;
  return nextRow === rowCount
    ? { rowIndex: 0, columnIndex: columnIndex + 1 }
    : { rowIndex: nextRow, columnIndex };
}
