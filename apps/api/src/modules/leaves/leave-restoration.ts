interface MemberSnapshot {
  readonly id: string;
  readonly schedulePeriodId: string;
  readonly plannedMembershipId: string | null;
  readonly plannedMemberName: string | null;
  readonly actualMembershipId: string | null;
  readonly actualMemberName: string | null;
  readonly version: number;
}

export interface ClearedAssignmentSnapshot extends MemberSnapshot {
  readonly clearedVersion: number;
}

export function isEmptyClearedAssignmentSnapshot(before: unknown, after: unknown): boolean {
  return (
    isRecord(before) &&
    before.snapshotSchemaVersion === 1 &&
    Array.isArray(before.assignments) &&
    before.assignments.length === 0 &&
    isRecord(after) &&
    isRecord(after.clearedVersions) &&
    Object.keys(after.clearedVersions).length === 0
  );
}

export function readClearedAssignmentSnapshots(
  before: unknown,
  after: unknown,
): readonly ClearedAssignmentSnapshot[] {
  if (
    !isRecord(before) ||
    !isRecord(after) ||
    before.snapshotSchemaVersion !== 1 ||
    !Array.isArray(before.assignments) ||
    !isRecord(after.clearedVersions)
  )
    return [];
  const result: ClearedAssignmentSnapshot[] = [];
  const ids = new Set<string>();
  for (const item of before.assignments) {
    if (
      !isRecord(item) ||
      typeof item.id !== 'string' ||
      typeof item.schedulePeriodId !== 'string' ||
      typeof item.version !== 'number' ||
      !Number.isSafeInteger(item.version) ||
      item.version < 1 ||
      ids.has(item.id)
    )
      return [];
    const { plannedMembershipId, plannedMemberName, actualMembershipId, actualMemberName } = item;
    if (
      !isNullableString(plannedMembershipId) ||
      !isNullableString(plannedMemberName) ||
      !isNullableString(actualMembershipId) ||
      !isNullableString(actualMemberName)
    )
      return [];
    const clearedVersion = after.clearedVersions[item.id];
    if (clearedVersion !== item.version + 1) return [];
    ids.add(item.id);
    result.push({
      id: item.id,
      schedulePeriodId: item.schedulePeriodId,
      version: item.version,
      plannedMembershipId,
      plannedMemberName,
      actualMembershipId,
      actualMemberName,
      clearedVersion,
    });
  }
  return result;
}

export function restorationSkipReason(
  snapshot: ClearedAssignmentSnapshot,
  current:
    (MemberSnapshot & { readonly startsAt: Date; readonly deletedAt?: Date | null }) | undefined,
  period:
    { readonly id: string; readonly status: string; readonly deletedAt: Date | null } | undefined,
  now: Date,
): string | undefined {
  if (current === undefined || current.deletedAt != null) return 'assignment_missing';
  if (
    period === undefined ||
    period.id !== snapshot.schedulePeriodId ||
    current.schedulePeriodId !== snapshot.schedulePeriodId ||
    period.status !== 'published' ||
    period.deletedAt !== null
  )
    return 'period_changed';
  if (current.startsAt.valueOf() <= now.valueOf()) return 'already_started';
  if (
    current.id !== snapshot.id ||
    current.version !== snapshot.clearedVersion ||
    current.plannedMembershipId !== null ||
    current.actualMembershipId !== null ||
    current.plannedMemberName !== null ||
    current.actualMemberName !== null
  )
    return 'assignment_changed';
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}
