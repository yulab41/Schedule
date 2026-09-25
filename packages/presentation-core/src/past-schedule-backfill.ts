/**
 * Past-schedule backfill staging.
 *
 * A staged change is either an addition (assign a member to a shift on a date) or a
 * removal (drop an existing assignment of that date). Both kinds stay local until the
 * operator confirms the batch; only then do they reach the API.
 */

export type PastScheduleBackfillStageKind = 'add' | 'remove';

export interface PastScheduleBackfillStage {
  /** Membership to add; empty for removals. */
  readonly actualMembershipId: string;
  /** Assignment to remove; empty for additions. */
  readonly assignmentId: string;
  readonly businessDate: string;
  readonly kind: PastScheduleBackfillStageKind;
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
  readonly kind: PastScheduleBackfillStageKind;
  readonly memberName: string;
  readonly scheduleRoleId: string;
  readonly shiftTypeName: string;
}

export interface PastScheduleBackfillBatchSnapshot {
  readonly items: readonly PastScheduleBackfillStage[];
  readonly operationId: string;
  readonly reason?: string | undefined;
  readonly removals: readonly PastScheduleBackfillStage[];
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

export function createBackfillStageKey(
  stage: Pick<
    PastScheduleBackfillStage,
    'actualMembershipId' | 'assignmentId' | 'businessDate' | 'kind' | 'scheduleRoleId'
  >,
): string {
  const target = stage.kind === 'remove' ? stage.assignmentId : stage.actualMembershipId;
  return `${stage.scheduleRoleId}:${stage.businessDate}:${stage.kind}:${target}`;
}

export function toggleBackfillStage(
  staged: PastScheduleBackfillStageMap,
  item: PastScheduleBackfillStage,
  context: BackfillStageContext,
): PastScheduleBackfillStageTransition {
  const key = createBackfillStageKey(item);
  if (staged.has(key)) {
    const next = new Map(staged);
    next.delete(key);
    return { outcome: 'removed', stages: next };
  }

  const target = item.kind === 'remove' ? item.assignmentId : item.actualMembershipId;
  if (target.length === 0 || item.scheduleRoleId.length === 0 || item.shiftTypeId.length === 0) {
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

export function listBackfillStagesForDate(
  staged: PastScheduleBackfillStageMap,
  context: { readonly businessDate: string; readonly scheduleRoleId: string },
): readonly PastScheduleBackfillStage[] {
  return [...staged.values()].filter(
    (item) =>
      item.scheduleRoleId === context.scheduleRoleId &&
      item.businessDate === context.businessDate,
  );
}

export function isAssignmentStagedForRemoval(
  staged: PastScheduleBackfillStageMap,
  context: {
    readonly assignmentId: string;
    readonly businessDate: string;
    readonly scheduleRoleId: string;
  },
): boolean {
  return staged.has(
    createBackfillStageKey({
      actualMembershipId: '',
      assignmentId: context.assignmentId,
      businessDate: context.businessDate,
      kind: 'remove',
      scheduleRoleId: context.scheduleRoleId,
    }),
  );
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
    kind: item.kind,
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
  const entries = sortBackfillStages(staged).map((item) => Object.freeze({ ...item }));
  const normalizedReason = reason.trim();
  return Object.freeze({
    items: Object.freeze(entries.filter((item) => item.kind === 'add')),
    operationId,
    ...(normalizedReason.length === 0 ? {} : { reason: normalizedReason }),
    removals: Object.freeze(entries.filter((item) => item.kind === 'remove')),
  });
}

export function getPastScheduleBackfillBatchFingerprint(
  items: readonly PastScheduleBackfillStage[],
  removals: readonly PastScheduleBackfillStage[],
  reason: string | undefined,
): string {
  const serialize = (entry: PastScheduleBackfillStage) => ({
    actualMembershipId: entry.actualMembershipId,
    assignmentId: entry.assignmentId,
    businessDate: entry.businessDate,
    kind: entry.kind,
    scheduleRoleId: entry.scheduleRoleId,
    shiftTypeId: entry.shiftTypeId,
  });
  return JSON.stringify({
    items: [...items].sort(compareBackfillStages).map(serialize),
    ...(reason === undefined || reason.trim().length === 0 ? {} : { reason: reason.trim() }),
    removals: [...removals].sort(compareBackfillStages).map(serialize),
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
    left.kind.localeCompare(right.kind) ||
    left.actualMembershipId.localeCompare(right.actualMembershipId) ||
    left.assignmentId.localeCompare(right.assignmentId) ||
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
