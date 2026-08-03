import type { ManualScheduleTemplate, SchedulePeriodHistoryItem } from '@schedule/contracts';

const weekdays = ['日', '一', '二', '三', '四', '五', '六'] as const;

export interface TemplateDateColumn {
  readonly cycleDay: number;
  readonly date: string;
  readonly weekday: string;
}

export interface ManualGridRow {
  readonly isStale: boolean;
  readonly membershipId: string;
  readonly realName: string;
}

export interface ManualGridSelection {
  readonly cycleDay: number;
  readonly membershipId: string;
}

export type TemplateCellMap = ReadonlyMap<string, string>;

export interface TemplateUndoStack {
  canUndo(): boolean;
  clear(): void;
  pop(): TemplateCellMap | undefined;
  push(snapshot: TemplateCellMap): void;
}

export function createCellKey(cycleDay: number, membershipId: string): string {
  return `${cycleDay}:${membershipId}`;
}

export function getTemplateDateColumns(
  startDate: string,
  cycleDays: number,
): readonly TemplateDateColumn[] {
  if (!isValidDate(startDate) || !Number.isInteger(cycleDays) || cycleDays < 1 || cycleDays > 31) {
    throw new Error('The template start date and cycle days are invalid.');
  }

  const columns: TemplateDateColumn[] = [];
  for (let cycleDay = 1; cycleDay <= cycleDays; cycleDay += 1) {
    const date = addDays(startDate, cycleDay - 1);
    columns.push({ cycleDay, date, weekday: getWeekdayLabel(date) });
  }

  return columns;
}

export function applyShiftToCell(
  cells: TemplateCellMap,
  cycleDay: number,
  membershipId: string,
  shiftTypeId: string,
): TemplateCellMap {
  const next = new Map(cells);
  next.set(createCellKey(cycleDay, membershipId), shiftTypeId);
  return next;
}

export function clearCell(
  cells: TemplateCellMap,
  cycleDay: number,
  membershipId: string,
): TemplateCellMap {
  const next = new Map(cells);
  next.delete(createCellKey(cycleDay, membershipId));
  return next;
}

export function clearRow(cells: TemplateCellMap, membershipId: string): TemplateCellMap {
  const next = new Map(cells);
  const suffix = `:${membershipId}`;
  for (const key of next.keys()) {
    if (key.endsWith(suffix)) {
      next.delete(key);
    }
  }

  return next;
}

export function clearColumn(cells: TemplateCellMap, cycleDay: number): TemplateCellMap {
  const next = new Map(cells);
  const prefix = `${cycleDay}:`;
  for (const key of next.keys()) {
    if (key.startsWith(prefix)) {
      next.delete(key);
    }
  }

  return next;
}

export function isShiftTypeFillable(shiftType: { readonly isEnabled: boolean }): boolean {
  return shiftType.isEnabled;
}

export function getTemplateCellShiftTypeId(
  cells: TemplateCellMap,
  cycleDay: number,
  membershipId: string,
): string | undefined {
  return cells.get(createCellKey(cycleDay, membershipId));
}

export function templateToCellMap(template: ManualScheduleTemplate): TemplateCellMap {
  return new Map(
    template.cells.map((cell) => [
      createCellKey(cell.cycleDay, cell.membershipId),
      cell.shiftTypeId,
    ]),
  );
}

export function createTemplateUndoStack(): TemplateUndoStack {
  const stack: TemplateCellMap[] = [];

  return {
    canUndo() {
      return stack.length > 0;
    },
    clear() {
      stack.length = 0;
    },
    pop() {
      return stack.pop();
    },
    push(snapshot) {
      stack.push(new Map(snapshot));
    },
  };
}

export function formatScheduleDraftCode(createdAt: string): string {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) {
    return 'D时间未知';
  }

  const chinaTime = new Date(created.getTime() + 8 * 60 * 60 * 1000);
  const date = [
    chinaTime.getUTCFullYear(),
    String(chinaTime.getUTCMonth() + 1).padStart(2, '0'),
    String(chinaTime.getUTCDate()).padStart(2, '0'),
  ].join('');
  const time = [
    String(chinaTime.getUTCHours()).padStart(2, '0'),
    String(chinaTime.getUTCMinutes()).padStart(2, '0'),
    String(chinaTime.getUTCSeconds()).padStart(2, '0'),
  ].join('');

  return `D${date}-${time}`;
}

export function findPublishedOverlapMonths(
  drafts: readonly SchedulePeriodHistoryItem[],
  history: readonly SchedulePeriodHistoryItem[],
): readonly string[] {
  const publishedKeys = new Set(
    history
      .filter((item) => item.status === 'published')
      .map((item) => `${item.scheduleRoleId}|${item.businessMonth.slice(0, 7)}`),
  );

  return [
    ...new Set(
      drafts
        .filter((draft) =>
          publishedKeys.has(`${draft.scheduleRoleId}|${draft.businessMonth.slice(0, 7)}`),
        )
        .map((draft) => draft.businessMonth.slice(0, 7)),
    ),
  ].sort();
}

function addDays(value: string, days: number): string {
  const { day, month, year } = parseDate(value);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return `${String(date.getUTCFullYear()).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function getWeekdayLabel(value: string): string {
  const { day, month, year } = parseDate(value);
  return weekdays[new Date(Date.UTC(year, month - 1, day)).getUTCDay()] ?? '日';
}

function isValidDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (match === null) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

function parseDate(value: string): {
  readonly day: number;
  readonly month: number;
  readonly year: number;
} {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (match === null) {
    throw new Error('The date must use the YYYY-MM-DD format.');
  }

  return {
    day: Number(match[3]),
    month: Number(match[2]),
    year: Number(match[1]),
  };
}
