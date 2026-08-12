import type { ManualScheduleTemplateCellInput } from '@schedule/contracts';

export interface ManualCellSelection {
  readonly cycleDay: number;
  readonly membershipId: string;
}

export interface ManualShiftChoice {
  readonly id: string;
  readonly isEnabled: boolean;
}

export interface ManualScheduleDraft {
  readonly cells: Readonly<Record<string, ManualScheduleTemplateCellInput>>;
  readonly cycleDays: number;
  readonly membershipIds: readonly string[];
  readonly lockedShiftTypeId?: string;
  readonly scheduleRoleId: string;
  readonly selectedCell?: ManualCellSelection;
  readonly startDate: string;
  readonly undo: readonly Readonly<Record<string, ManualScheduleTemplateCellInput>>[];
}

export interface ManualDateColumn {
  readonly cycleDay: number;
  readonly date: string;
  readonly weekday: string;
}

const weekdays = ['日', '一', '二', '三', '四', '五', '六'] as const;
const undoLimit = 20;

function assertCycleDays(cycleDays: number): void {
  if (!Number.isInteger(cycleDays) || cycleDays < 1 || cycleDays > 31)
    throw new Error('周期天数必须在 1 到 31 天之间。');
}

function asUtcDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) throw new Error('开始日期无效。');
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value)
    throw new Error('开始日期无效。');
  return date;
}

function cloneCells(cells: Readonly<Record<string, ManualScheduleTemplateCellInput>>) {
  return { ...cells } as Readonly<Record<string, ManualScheduleTemplateCellInput>>;
}

function withUndo(
  draft: ManualScheduleDraft,
  cells: Readonly<Record<string, ManualScheduleTemplateCellInput>>,
): ManualScheduleDraft {
  const undo = [...draft.undo, cloneCells(draft.cells)].slice(-undoLimit);
  return { ...draft, cells, undo };
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameCells(
  left: Readonly<Record<string, ManualScheduleTemplateCellInput>>,
  right: Readonly<Record<string, ManualScheduleTemplateCellInput>>,
): boolean {
  const leftEntries = Object.entries(left);
  if (leftEntries.length !== Object.keys(right).length) return false;
  return leftEntries.every(([key, cell]) => {
    const candidate = right[key];
    return (
      candidate?.cycleDay === cell.cycleDay &&
      candidate.membershipId === cell.membershipId &&
      candidate.shiftTypeId === cell.shiftTypeId
    );
  });
}

function addUtcDays(value: string, days: number): string {
  const date = asUtcDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function filterCells(
  cells: Readonly<Record<string, ManualScheduleTemplateCellInput>>,
  predicate: (cell: ManualScheduleTemplateCellInput) => boolean,
): Readonly<Record<string, ManualScheduleTemplateCellInput>> {
  return Object.fromEntries(
    Object.entries(cells).filter(([, cell]) => predicate(cell)),
  ) as Readonly<Record<string, ManualScheduleTemplateCellInput>>;
}

function filterUndoSnapshots(
  undo: ManualScheduleDraft['undo'],
  currentCells: ManualScheduleDraft['cells'],
  predicate: (cell: ManualScheduleTemplateCellInput) => boolean,
): ManualScheduleDraft['undo'] {
  const compact = undo
    .map((snapshot) => filterCells(snapshot, predicate))
    .reduce<ManualScheduleDraft['undo']>(
      (snapshots, snapshot) =>
        snapshots.at(-1) !== undefined && sameCells(snapshots.at(-1) ?? {}, snapshot)
          ? snapshots
          : [...snapshots, snapshot],
      [],
    );
  let keep = compact.length;
  while (keep > 0 && sameCells(compact[keep - 1] ?? {}, currentCells)) keep -= 1;
  return compact.slice(0, keep);
}

export function createManualCellKey(cycleDay: number, membershipId: string): string {
  if (!Number.isInteger(cycleDay) || cycleDay < 1 || membershipId.length === 0)
    throw new Error('单元格无效。');
  return `${cycleDay}:${membershipId}`;
}

export function isManualTemplateCellSnapshotCurrent(
  cell: Pick<ManualScheduleTemplateCellInput, 'shiftTypeId'> | undefined,
  savedCell: Pick<ManualScheduleTemplateCellInput, 'shiftTypeId'> | undefined,
): boolean {
  return (
    cell !== undefined && savedCell !== undefined && cell.shiftTypeId === savedCell.shiftTypeId
  );
}

export function createManualScheduleDraft(input: {
  readonly cycleDays: number;
  readonly membershipIds: readonly string[];
  readonly scheduleRoleId: string;
  readonly startDate: string;
}): ManualScheduleDraft {
  assertCycleDays(input.cycleDays);
  asUtcDate(input.startDate);
  if (input.scheduleRoleId.length === 0 || input.membershipIds.some((id) => id.length === 0))
    throw new Error('岗位或成员无效。');
  return { ...input, cells: {}, undo: [] };
}

export function getCycleDateColumns(
  startDate: string,
  cycleDays: number,
): readonly ManualDateColumn[] {
  assertCycleDays(cycleDays);
  const start = asUtcDate(startDate);
  return Array.from({ length: cycleDays }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    return {
      cycleDay: index + 1,
      date: date.toISOString().slice(0, 10),
      weekday: weekdays[date.getUTCDay()],
    };
  });
}

export function getManualHolidayYears(startDate: string, cycleDays: number): readonly number[] {
  return [
    ...new Set(
      getCycleDateColumns(startDate, cycleDays).map(({ date }) => Number(date.slice(0, 4))),
    ),
  ].sort((left, right) => left - right);
}

export function getNextAvailableManualStartDate(
  history: readonly {
    readonly applyEndDate?: string;
    readonly businessMonth: string;
    readonly scheduleRoleId: string;
    readonly status: string;
  }[],
  scheduleRoleId: string,
  fallbackDate: string,
): string {
  asUtcDate(fallbackDate);
  const latestEndDate = history
    .filter((item) => item.scheduleRoleId === scheduleRoleId && item.status === 'published')
    .map((item) => item.applyEndDate ?? `${item.businessMonth.slice(0, 7)}-01`)
    .filter((value) => {
      try {
        asUtcDate(value);
        return true;
      } catch {
        return false;
      }
    })
    .sort()
    .at(-1);
  return latestEndDate === undefined ? fallbackDate : addUtcDays(latestEndDate, 1);
}

export function changeManualScheduleRole(
  draft: ManualScheduleDraft,
  scheduleRoleId: string,
): ManualScheduleDraft {
  if (scheduleRoleId.length === 0) throw new Error('岗位无效。');
  if (draft.scheduleRoleId === scheduleRoleId) return draft;
  return createManualScheduleDraft({
    cycleDays: draft.cycleDays,
    membershipIds: [],
    scheduleRoleId,
    startDate: draft.startDate,
  });
}

export function setManualMembershipIds(
  draft: ManualScheduleDraft,
  membershipIds: readonly string[],
): ManualScheduleDraft {
  if (
    membershipIds.some((id) => id.length === 0) ||
    new Set(membershipIds).size !== membershipIds.length
  )
    throw new Error('成员无效。');
  if (sameStrings(draft.membershipIds, membershipIds)) return draft;
  const selectedIds = new Set(membershipIds);
  const cells = filterCells(draft.cells, (cell) => selectedIds.has(cell.membershipId));
  return {
    ...draft,
    cells,
    membershipIds: [...membershipIds],
    selectedCell:
      draft.selectedCell !== undefined && selectedIds.has(draft.selectedCell.membershipId)
        ? draft.selectedCell
        : undefined,
    undo: filterUndoSnapshots(draft.undo, cells, (cell) => selectedIds.has(cell.membershipId)),
  };
}

export function setManualStartDate(
  draft: ManualScheduleDraft,
  startDate: string,
): ManualScheduleDraft {
  asUtcDate(startDate);
  return draft.startDate === startDate ? draft : { ...draft, startDate };
}

export function setManualCycleDays(
  draft: ManualScheduleDraft,
  cycleDays: number,
): ManualScheduleDraft {
  assertCycleDays(cycleDays);
  if (draft.cycleDays === cycleDays) return draft;
  const cells = filterCells(draft.cells, (cell) => cell.cycleDay <= cycleDays);
  return {
    ...draft,
    cells,
    cycleDays,
    selectedCell:
      draft.selectedCell !== undefined && draft.selectedCell.cycleDay <= cycleDays
        ? draft.selectedCell
        : undefined,
    undo: filterUndoSnapshots(draft.undo, cells, (cell) => cell.cycleDay <= cycleDays),
  };
}

export function selectManualCell(
  draft: ManualScheduleDraft,
  selection: ManualCellSelection,
): ManualScheduleDraft {
  if (
    selection.cycleDay < 1 ||
    selection.cycleDay > draft.cycleDays ||
    !draft.membershipIds.includes(selection.membershipId)
  )
    return draft;
  if (
    draft.selectedCell?.cycleDay === selection.cycleDay &&
    draft.selectedCell.membershipId === selection.membershipId
  )
    return { ...draft, selectedCell: undefined };
  return { ...draft, selectedCell: selection };
}

export function applySelectedShift(
  draft: ManualScheduleDraft,
  shift: ManualShiftChoice,
): ManualScheduleDraft {
  const selection = draft.selectedCell;
  if (selection === undefined || !shift.isEnabled || shift.id.length === 0) return draft;
  const key = createManualCellKey(selection.cycleDay, selection.membershipId);
  const existing = draft.cells[key];
  const cells = { ...draft.cells } as Record<string, ManualScheduleTemplateCellInput>;
  if (existing?.shiftTypeId === shift.id) delete cells[key];
  else
    cells[key] = {
      cycleDay: selection.cycleDay,
      membershipId: selection.membershipId,
      shiftTypeId: shift.id,
    };
  return withUndo(draft, cells);
}

export function lockManualShift(
  draft: ManualScheduleDraft,
  shift: ManualShiftChoice,
): ManualScheduleDraft {
  if (!shift.isEnabled || shift.id.length === 0) return draft;
  return { ...draft, lockedShiftTypeId: shift.id, selectedCell: undefined };
}

export function unlockManualShift(draft: ManualScheduleDraft): ManualScheduleDraft {
  return draft.lockedShiftTypeId === undefined ? draft : { ...draft, lockedShiftTypeId: undefined };
}

export function applyLockedShift(
  draft: ManualScheduleDraft,
  selection: ManualCellSelection,
): ManualScheduleDraft {
  const shiftTypeId = draft.lockedShiftTypeId;
  if (shiftTypeId === undefined) return draft;
  const selected = selectManualCell({ ...draft, selectedCell: undefined }, selection);
  return selected.selectedCell === undefined
    ? draft
    : applySelectedShift(selected, { id: shiftTypeId, isEnabled: true });
}

export function clearManualCell(
  draft: ManualScheduleDraft,
  selection: ManualCellSelection,
): ManualScheduleDraft {
  const key = createManualCellKey(selection.cycleDay, selection.membershipId);
  if (draft.cells[key] === undefined) return draft;
  const cells = { ...draft.cells } as Record<string, ManualScheduleTemplateCellInput>;
  delete cells[key];
  return withUndo(draft, cells);
}

export function clearManualRow(
  draft: ManualScheduleDraft,
  membershipId: string,
): ManualScheduleDraft {
  if (!draft.membershipIds.includes(membershipId)) return draft;
  const cells = Object.fromEntries(
    Object.entries(draft.cells).filter(([, cell]) => cell.membershipId !== membershipId),
  ) as Record<string, ManualScheduleTemplateCellInput>;
  return Object.keys(cells).length === Object.keys(draft.cells).length
    ? draft
    : withUndo(draft, cells);
}

export function clearManualColumn(
  draft: ManualScheduleDraft,
  cycleDay: number,
): ManualScheduleDraft {
  if (cycleDay < 1 || cycleDay > draft.cycleDays) return draft;
  const cells = Object.fromEntries(
    Object.entries(draft.cells).filter(([, cell]) => cell.cycleDay !== cycleDay),
  ) as Record<string, ManualScheduleTemplateCellInput>;
  return Object.keys(cells).length === Object.keys(draft.cells).length
    ? draft
    : withUndo(draft, cells);
}

export function undoManualDraft(draft: ManualScheduleDraft): ManualScheduleDraft {
  const previous = draft.undo.at(-1);
  return previous === undefined
    ? draft
    : { ...draft, cells: cloneCells(previous), undo: draft.undo.slice(0, -1) };
}

export function isManualGridLongPress(input: {
  readonly durationMs: number;
  readonly horizontalDistancePx: number;
}): boolean {
  return input.durationMs >= 500 && Math.abs(input.horizontalDistancePx) < 12;
}

export function manualDraftCells(
  draft: ManualScheduleDraft,
): readonly ManualScheduleTemplateCellInput[] {
  return Object.values(draft.cells).sort(
    (left, right) =>
      left.cycleDay - right.cycleDay || left.membershipId.localeCompare(right.membershipId),
  );
}
