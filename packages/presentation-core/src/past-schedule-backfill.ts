export interface PastScheduleBackfillStage {
  readonly actualMembershipId: string;
  readonly businessDate: string;
  readonly scheduleRoleId: string;
  readonly shiftTypeId: string;
}

export type PastScheduleBackfillStageMap = ReadonlyMap<string, PastScheduleBackfillStage>;

export type PastScheduleBackfillStageOutcome =
  | 'added'
  | 'invalid-date'
  | 'limit-reached'
  | 'not-past'
  | 'outside-month'
  | 'removed'
  | 'selection-required';

export interface PastScheduleBackfillStageTransition {
  readonly outcome: PastScheduleBackfillStageOutcome;
  readonly stages: PastScheduleBackfillStageMap;
}

export interface PastScheduleBackfillSummary {
  readonly businessDate: string;
  readonly memberName: string;
  readonly scheduleRoleId: string;
  readonly shiftTypeName: string;
}

export interface PastScheduleBackfillBatchSnapshot {
  readonly items: readonly PastScheduleBackfillStage[];
  readonly operationId: string;
  readonly reason?: string | undefined;
}

interface BackfillStageContext {
  readonly businessMonth: string;
  readonly maximumItems?: number | undefined;
  readonly today: string;
}

interface BackfillSummaryLookups {
  readonly memberNames: ReadonlyMap<string, string>;
  readonly shiftTypeNames: ReadonlyMap<string, string>;
}

const defaultMaximumItems = 31;
const businessDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/u;

export function toggleBackfillSelection(currentId: string, targetId: string): string {
  return currentId === targetId ? '' : targetId;
}

export function createBackfillStageKey(scheduleRoleId: string, businessDate: string): string {
  return `${scheduleRoleId}:${businessDate}`;
}

export function toggleBackfillStage(
  staged: PastScheduleBackfillStageMap,
  item: PastScheduleBackfillStage,
  context: BackfillStageContext,
): PastScheduleBackfillStageTransition {
  const key = createBackfillStageKey(item.scheduleRoleId, item.businessDate);
  if (staged.has(key)) {
    const next = new Map(staged);
    next.delete(key);
    return { outcome: 'removed', stages: next };
  }

  if (
    item.actualMembershipId.length === 0 ||
    item.scheduleRoleId.length === 0 ||
    item.shiftTypeId.length === 0
  ) {
    return { outcome: 'selection-required', stages: staged };
  }
  if (!isValidBusinessDate(item.businessDate) || !isValidBusinessDate(context.today)) {
    return { outcome: 'invalid-date', stages: staged };
  }
  if (!/^\d{4}-\d{2}$/u.test(context.businessMonth)) {
    return { outcome: 'outside-month', stages: staged };
  }
  if (item.businessDate.slice(0, 7) !== context.businessMonth) {
    return { outcome: 'outside-month', stages: staged };
  }
  if (item.businessDate >= context.today) {
    return { outcome: 'not-past', stages: staged };
  }

  const maximumItems = context.maximumItems ?? defaultMaximumItems;
  if (!Number.isInteger(maximumItems) || maximumItems < 1 || staged.size >= maximumItems) {
    return { outcome: 'limit-reached', stages: staged };
  }

  const next = new Map(staged);
  next.set(key, Object.freeze({ ...item }));
  return { outcome: 'added', stages: next };
}

export function filterPastScheduleBackfillStages(
  staged: PastScheduleBackfillStageMap,
  context: Pick<BackfillStageContext, 'businessMonth'> & {
    readonly scheduleRoleId: string;
  },
): PastScheduleBackfillStageMap {
  return new Map(
    [...staged].filter(
      ([, item]) =>
        item.scheduleRoleId === context.scheduleRoleId &&
        item.businessDate.slice(0, 7) === context.businessMonth,
    ),
  );
}

export function summarizePastScheduleBackfillStages(
  staged: PastScheduleBackfillStageMap,
  lookups: BackfillSummaryLookups,
): readonly PastScheduleBackfillSummary[] {
  return sortBackfillStages(staged).map((item) => ({
    businessDate: item.businessDate,
    memberName: lookups.memberNames.get(item.actualMembershipId) ?? '',
    scheduleRoleId: item.scheduleRoleId,
    shiftTypeName: lookups.shiftTypeNames.get(item.shiftTypeId) ?? '',
  }));
}

export function createPastScheduleBackfillBatchSnapshot(
  staged: PastScheduleBackfillStageMap,
  reason: string,
  operationId: string,
): PastScheduleBackfillBatchSnapshot {
  const items = Object.freeze(sortBackfillStages(staged).map((item) => Object.freeze({ ...item })));
  const normalizedReason = reason.trim();
  return Object.freeze({
    items,
    operationId,
    ...(normalizedReason.length === 0 ? {} : { reason: normalizedReason }),
  });
}

export function getPastScheduleBackfillBatchFingerprint(
  items: readonly PastScheduleBackfillStage[],
  reason: string | undefined,
): string {
  return JSON.stringify({
    items: [...items].sort(compareBackfillStages).map((item) => ({ ...item })),
    ...(reason === undefined || reason.trim().length === 0 ? {} : { reason: reason.trim() }),
  });
}

function sortBackfillStages(
  staged: PastScheduleBackfillStageMap,
): readonly PastScheduleBackfillStage[] {
  return [...staged.values()].sort(compareBackfillStages);
}

function compareBackfillStages(
  left: PastScheduleBackfillStage,
  right: PastScheduleBackfillStage,
): number {
  return (
    left.businessDate.localeCompare(right.businessDate) ||
    left.scheduleRoleId.localeCompare(right.scheduleRoleId) ||
    left.actualMembershipId.localeCompare(right.actualMembershipId) ||
    left.shiftTypeId.localeCompare(right.shiftTypeId)
  );
}

function isValidBusinessDate(value: string): boolean {
  const match = businessDatePattern.exec(value);
  if (match === null) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1_000) return false;
  const candidate = new Date(0);
  candidate.setUTCHours(0, 0, 0, 0);
  candidate.setUTCFullYear(year, month - 1, day);
  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}
