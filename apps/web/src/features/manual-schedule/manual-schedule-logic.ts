import type { ManualScheduleTemplate, SchedulePeriodHistoryItem } from '@schedule/contracts';
import {
  MAX_MANUAL_CELLS,
  MAX_MANUAL_DAYS,
  MAX_MANUAL_MEMBERS,
  getManualScheduleInclusiveDayCount,
  isValidManualScheduleDate,
} from '@schedule/contracts/manual-schedule-limits';
import {
  applyManualCellMutation,
  clearManualCell,
  clearManualColumn,
  clearManualRow,
  createManualCellKey,
  createManualSnapshotUndoStack,
  getManualCellValue,
  type ManualCellMap,
  type ManualSnapshotUndoStack,
} from '@schedule/presentation-core';
import { formatChinaDateTime } from '@schedule/scheduling-domain';

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

export type TemplateCellMap = ManualCellMap<string>;
export type TemplateUndoStack = ManualSnapshotUndoStack<string>;

export function createCellKey(cycleDay: number, membershipId: string): string {
  return createManualCellKey(cycleDay, membershipId);
}

export function getTemplateDateColumns(
  startDate: string,
  cycleDays: number,
): readonly TemplateDateColumn[] {
  if (
    !isValidManualScheduleDate(startDate) ||
    !Number.isInteger(cycleDays) ||
    cycleDays < 1 ||
    cycleDays > MAX_MANUAL_DAYS
  ) {
    throw new Error('The template start date and cycle days are invalid.');
  }

  const columns: TemplateDateColumn[] = [];
  for (let cycleDay = 1; cycleDay <= cycleDays; cycleDay += 1) {
    const date = addDays(startDate, cycleDay - 1);
    columns.push({ cycleDay, date, weekday: getWeekdayLabel(date) });
  }

  return columns;
}

export function getManualTemplateLimitError(input: {
  readonly cellCount: number;
  readonly cycleDays: number;
  readonly memberCount: number;
}): string | undefined {
  if (!Number.isInteger(input.cycleDays) || input.cycleDays < 1) {
    return `周期天数必须是 1 到 ${MAX_MANUAL_DAYS} 之间的整数。`;
  }
  if (input.cycleDays > MAX_MANUAL_DAYS) {
    return `单个模板最多包含 ${MAX_MANUAL_DAYS} 天。`;
  }
  if (input.memberCount > MAX_MANUAL_MEMBERS) {
    return `单个模板最多选择 ${MAX_MANUAL_MEMBERS} 位值班人员。`;
  }
  if (input.cellCount > MAX_MANUAL_CELLS) {
    return `单个模板最多包含 ${MAX_MANUAL_CELLS} 个排班格。`;
  }

  return undefined;
}

export function getManualApplyRangeError(startDate: string, endDate: string): string | undefined {
  if (!isValidManualScheduleDate(startDate) || !isValidManualScheduleDate(endDate)) {
    return '应用开始日期和结束日期必须是有效日期。';
  }
  if (endDate < startDate) {
    return '结束日期不能早于应用开始日期。';
  }
  if (getManualScheduleInclusiveDayCount(startDate, endDate) > MAX_MANUAL_DAYS) {
    return `单次预览或应用的总区间不能超过 ${MAX_MANUAL_DAYS} 天。`;
  }

  return undefined;
}

export function applyShiftToCell(
  cells: TemplateCellMap,
  cycleDay: number,
  membershipId: string,
  shiftTypeId: string,
): TemplateCellMap {
  const key = createCellKey(cycleDay, membershipId);
  return applyManualCellMutation(cells, {
    after: shiftTypeId,
    before: cells.get(key),
    key,
  });
}

export function clearCell(
  cells: TemplateCellMap,
  cycleDay: number,
  membershipId: string,
): TemplateCellMap {
  return clearManualCell(cells, createCellKey(cycleDay, membershipId));
}

export function clearRow(cells: TemplateCellMap, membershipId: string): TemplateCellMap {
  return clearManualRow(cells, membershipId);
}

export function clearColumn(cells: TemplateCellMap, cycleDay: number): TemplateCellMap {
  return clearManualColumn(cells, cycleDay);
}

export function isShiftTypeFillable(shiftType: { readonly isEnabled: boolean }): boolean {
  return shiftType.isEnabled;
}

export function getTemplateCellShiftTypeId(
  cells: TemplateCellMap,
  cycleDay: number,
  membershipId: string,
): string | undefined {
  return getManualCellValue(cells, createCellKey(cycleDay, membershipId));
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
  return createManualSnapshotUndoStack<string>();
}

export function formatScheduleDraftCode(createdAt: string): string {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) {
    return 'D时间未知';
  }

  const formatted = formatChinaDateTime(created, { includeSeconds: true });
  return `D${formatted.slice(0, 10).replaceAll('-', '')}-${formatted.slice(11).replaceAll(':', '')}`;
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

export function getNextAvailableStartDate(
  history: readonly SchedulePeriodHistoryItem[],
  scheduleRoleId: string,
  fallbackDate: string,
): string {
  const latestEnd = history
    .filter((item) => item.scheduleRoleId === scheduleRoleId && item.status === 'published')
    .map((item) => item.applyEndDate ?? `${item.businessMonth.slice(0, 7)}-01`)
    .filter((value) => isValidDate(value))
    .sort()
    .at(-1);
  return latestEnd === undefined ? fallbackDate : addDays(latestEnd, 1);
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
  return isValidManualScheduleDate(value);
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
