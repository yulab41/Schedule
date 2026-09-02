import type { DirectoryQuery } from '@schedule/contracts';

export const directoryCandidateIndexName = 'directory_search_aliases_entry_type_normalized_idx';

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
  readonly migrationCount: number;
}

export type DirectoryCandidateIndexUnavailableReason =
  'index-inspection-failed' | 'index-missing-or-invalid' | 'migration-incomplete';

export class DirectoryCandidateIndexGuard {
  private availability: Promise<boolean> | undefined;

  public constructor(
    private readonly inspect: () => Promise<DirectoryCandidateReadiness>,
    private readonly onUnavailable: (
      reason: DirectoryCandidateIndexUnavailableReason,
    ) => void = () => undefined,
  ) {}

  public isAvailable(): Promise<boolean> {
    this.availability ??= this.inspectOnce();
    return this.availability;
  }

  private async inspectOnce(): Promise<boolean> {
    try {
      const readiness = await this.inspect();
      if (readiness.migrationCount < 53) {
        this.onUnavailable('migration-incomplete');
        return false;
      }
      const available = hasCandidateDirectoryIndexDefinition(readiness.indexRows);
      if (!available) this.onUnavailable('index-missing-or-invalid');
      return available;
    } catch {
      this.onUnavailable('index-inspection-failed');
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
