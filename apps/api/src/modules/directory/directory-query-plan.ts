import type { DirectoryQuery } from '@schedule/contracts';
import { directoryCandidateMigrationIdentity } from '@schedule/database';

export const directoryCandidateIndexName = 'directory_search_aliases_entry_type_normalized_idx';
export const directoryCandidateReadinessTtlMs = 60_000;

export type DirectoryQueryPlan = 'candidate' | 'legacy';

export interface DirectoryIndexDefinitionRow {
  readonly columnName: string;
  readonly indexName: string;
  readonly indexType: string;
  readonly isVisible: string;
  readonly nonUnique: number;
  readonly sequence: number;
}

export interface DirectoryCandidateReadiness {
  readonly indexRows: readonly DirectoryIndexDefinitionRow[];
  readonly migrationRows: readonly DirectoryMigrationJournalRow[];
}

export interface DirectoryMigrationJournalRow {
  readonly createdAt: number;
  readonly hash: string;
  readonly id: number;
}

export type DirectoryCandidateIndexUnavailableReason =
  | 'index-missing-or-invalid'
  | 'migration-index-inconsistent'
  | 'migration-missing-or-invalid'
  | 'readiness-inspection-failed';

interface DirectoryCandidateIndexGuardOptions {
  readonly now?: (() => number) | undefined;
  readonly ttlMs?: number | undefined;
}

export class DirectoryCandidateIndexGuard {
  private cached: { readonly available: boolean; readonly expiresAt: number } | undefined;
  private refreshInFlight: Promise<boolean> | undefined;
  private readonly now: () => number;
  private readonly ttlMs: number;

  public constructor(
    private readonly inspect: () => Promise<DirectoryCandidateReadiness>,
    private readonly onUnavailable: (
      reason: DirectoryCandidateIndexUnavailableReason,
    ) => void = () => undefined,
    options: DirectoryCandidateIndexGuardOptions = {},
  ) {
    this.now = options.now ?? Date.now;
    this.ttlMs = options.ttlMs ?? directoryCandidateReadinessTtlMs;
  }

  public isAvailable(): Promise<boolean> {
    if (this.cached !== undefined && this.now() < this.cached.expiresAt) {
      return Promise.resolve(this.cached.available);
    }
    return this.refresh();
  }

  public refresh(): Promise<boolean> {
    this.refreshInFlight ??= this.inspectOnce()
      .then((available) => {
        this.cached = { available, expiresAt: this.now() + this.ttlMs };
        return available;
      })
      .finally(() => {
        this.refreshInFlight = undefined;
      });
    return this.refreshInFlight;
  }

  private async inspectOnce(): Promise<boolean> {
    try {
      const readiness = await this.inspect();
      const migrationReady = hasDirectoryCandidateMigrationIdentity(readiness.migrationRows);
      const indexReady = hasCandidateDirectoryIndexDefinition(readiness.indexRows);
      if (!migrationReady) {
        this.onUnavailable(
          readiness.indexRows.length > 0
            ? 'migration-index-inconsistent'
            : 'migration-missing-or-invalid',
        );
        return false;
      }
      if (!indexReady) this.onUnavailable('index-missing-or-invalid');
      return indexReady;
    } catch {
      this.onUnavailable('readiness-inspection-failed');
      return false;
    }
  }
}

interface DirectoryQueryPlanSelection {
  readonly candidateIndexAvailable: boolean;
  readonly configuredPlan: DirectoryQueryPlan;
  readonly query: DirectoryQuery;
}

const candidateIndexColumns = ['entry_id', 'type', 'normalized_value'] as const;
const directoryFilterKeys = [
  'building',
  'campusCode',
  'department',
  'entryKind',
  'floor',
  'section',
  'subunit',
] as const;

export function selectDirectoryQueryPlan({
  candidateIndexAvailable,
  configuredPlan,
  query,
}: DirectoryQueryPlanSelection): DirectoryQueryPlan {
  if (
    configuredPlan !== 'candidate' ||
    !candidateIndexAvailable ||
    !isCandidateDirectoryQueryShape(query)
  ) {
    return 'legacy';
  }
  return 'candidate';
}

export function isCandidateDirectoryQueryShape(query: DirectoryQuery): boolean {
  const search = query.q?.trim();
  return search !== undefined && [...search].length > 1 && !hasEffectiveDirectoryFilters(query);
}

export function hasEffectiveDirectoryFilters(query: DirectoryQuery): boolean {
  return directoryFilterKeys.some((key) => {
    const value = query[key];
    return typeof value === 'string' ? value.trim().length > 0 : value !== undefined;
  });
}

export function hasCandidateDirectoryIndexDefinition(
  rows: readonly DirectoryIndexDefinitionRow[],
): boolean {
  if (rows.length !== candidateIndexColumns.length) return false;
  return rows.every(
    (row, index) =>
      row.indexName === directoryCandidateIndexName &&
      row.indexType === 'BTREE' &&
      row.isVisible === 'YES' &&
      row.nonUnique === 1 &&
      row.sequence === index + 1 &&
      row.columnName === candidateIndexColumns[index],
  );
}

export function hasDirectoryCandidateMigrationIdentity(
  rows: readonly DirectoryMigrationJournalRow[],
): boolean {
  return (
    rows.length === 1 &&
    Number.isSafeInteger(rows[0]?.id) &&
    (rows[0]?.id ?? 0) > 0 &&
    rows[0]?.createdAt === directoryCandidateMigrationIdentity.createdAt &&
    rows[0]?.hash === directoryCandidateMigrationIdentity.hash
  );
}
