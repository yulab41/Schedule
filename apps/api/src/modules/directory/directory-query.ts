import type {
  DirectoryContactMethod,
  DirectoryEntry,
  DirectoryEntryLookupResponse,
  DirectoryEntryKind,
  DirectoryFacetOption,
  DirectoryFacetPath,
  DirectoryFacetSnapshot,
  DirectoryKind,
  DirectoryPage,
  DirectoryQuery as DirectoryQueryInput,
} from '@schedule/contracts';
import { directoryEntryKindLabels } from '@schedule/contracts';
import {
  directoryCampuses,
  directoryCandidateMigrationIdentity,
  directoryContactMethods,
  directoryEntries,
  directoryImportBatches,
  directorySearchAliases,
  type DatabaseClient,
  type DatabaseTransaction,
  withTransaction,
} from '@schedule/database';
import { and, asc, desc, eq, gt, inArray, lt, or, sql, type SQL } from 'drizzle-orm';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { ApiError } from '../../plugins/error-handler.js';
import { GroupPermissionService } from '../groups/permission-service.js';
import { DirectoryFacetCache } from './directory-facet-cache.js';
import {
  measureDirectoryPhase,
  type DirectoryServerTimingTrace,
} from './directory-server-timing.js';
import {
  DirectoryCandidateIndexGuard,
  directoryCandidateIndexName,
  hasEffectiveDirectoryFilters,
  isCandidateDirectoryQueryShape,
  selectDirectoryQueryPlan,
  type DirectoryCandidateReadiness,
  type DirectoryCandidateIndexUnavailableReason,
  type DirectoryQueryPlan,
} from './directory-query-plan.js';

const defaultPageSize = 30;
const entryKindOrder: readonly DirectoryEntryKind[] = [
  'department',
  'service',
  'person',
  'facility',
  'emergency',
  'switchboard',
  'vendor',
  'other',
];

interface DirectoryCursor {
  readonly campusDisplayOrder: number;
  readonly entryDisplayOrder: number;
  readonly id: string;
  readonly rank: number;
}

interface PublishedDirectoryBatch {
  readonly effectiveOn: string;
  readonly id: string;
  readonly importVersion: string;
}

interface DirectoryFacetRow {
  readonly building: string | null;
  readonly campusCode: string;
  readonly campusDisplayOrder: number;
  readonly campusName: string;
  readonly department: string | null;
  readonly entryKind: DirectoryEntryKind;
  readonly floor: string | null;
  readonly section: string | null;
  readonly subunit: string | null;
}

interface CandidateDirectoryRow {
  readonly building: string | null;
  readonly campusCode: string;
  readonly campusDialingNote: string | null;
  readonly campusDisplayOrder: number;
  readonly campusName: string;
  readonly contactName: string | null;
  readonly jobTitle: string | null;
  readonly department: string | null;
  readonly displayOrder: number;
  readonly employeeCode: string | null;
  readonly entryKind: DirectoryEntryKind;
  readonly floor: string | null;
  readonly id: string;
  readonly notes: string | null;
  readonly searchRank: number;
  readonly room: string | null;
  readonly section: string | null;
  readonly subunit: string | null;
}

export interface DirectoryQueryOptions {
  readonly candidateReadinessInspector?: (() => Promise<DirectoryCandidateReadiness>) | undefined;
  readonly configuredPlan?: DirectoryQueryPlan | undefined;
  readonly onCandidateUnavailable?:
    ((reason: DirectoryCandidateIndexUnavailableReason) => void) | undefined;
}

export type DirectoryQueryPlanObserver = (plan: DirectoryQueryPlan) => void;

export class DirectoryQuery {
  private readonly permissionService = new GroupPermissionService();
  private readonly facetCache = new DirectoryFacetCache<DirectoryFacetSnapshot>();
  private readonly candidateIndexGuard: DirectoryCandidateIndexGuard;
  private readonly configuredPlan: DirectoryQueryPlan;

  public constructor(
    private readonly databaseClient: DatabaseClient,
    options: DirectoryQueryOptions = {},
  ) {
    this.configuredPlan = options.configuredPlan ?? 'legacy';
    this.candidateIndexGuard = new DirectoryCandidateIndexGuard(
      options.candidateReadinessInspector ??
        (() => inspectCandidateDirectoryReadiness(databaseClient)),
      options.onCandidateUnavailable,
    );
  }

  public async list(
    identity: AuthenticatedIdentity,
    groupId: string,
    query: DirectoryQueryInput,
    directoryKind: DirectoryKind = 'internal',
    timing?: DirectoryServerTimingTrace,
    observePlan?: DirectoryQueryPlanObserver,
  ): Promise<DirectoryPage> {
    const candidateIndexAvailable =
      this.configuredPlan === 'candidate' && isCandidateDirectoryQueryShape(query)
        ? await this.candidateIndexGuard.isAvailable()
        : false;
    const effectivePlan = selectDirectoryQueryPlan({
      candidateIndexAvailable,
      configuredPlan: this.configuredPlan,
      query,
    });
    if (timing !== undefined) timing.directoryQueryPlan = effectivePlan;
    observePlan?.(effectivePlan);
    const transactionStartedAt = performance.now();
    return withTransaction(this.databaseClient, async (transaction) => {
      if (timing !== undefined) {
        timing.databaseWaitMs = Math.max(
          0,
          Math.round((performance.now() - transactionStartedAt) * 10) / 10,
        );
      }
      const authorization = await measureDirectoryPhase(timing, 'permissionMs', () =>
        this.permissionService.requirePermission(transaction, identity, groupId, 'viewDirectory'),
      );
      const batch = await measureDirectoryPhase(timing, 'batchMs', () =>
        getPublishedBatch(transaction, directoryKind),
      );
      const canViewAdministratorEntries =
        authorization.user.isDeveloperAdmin ||
        authorization.membership.role === 'owner' ||
        authorization.membership.role === 'administrator';
      const listEntries =
        effectivePlan === 'candidate' ? listDirectoryEntriesCandidate : listDirectoryEntries;
      return listEntries(transaction, batch.id, query, canViewAdministratorEntries, timing);
    });
  }

  public async facets(
    identity: AuthenticatedIdentity,
    groupId: string,
    directoryKind: DirectoryKind = 'internal',
  ): Promise<DirectoryFacetSnapshot> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'viewDirectory',
      );
      const batch = await getPublishedBatch(transaction, directoryKind);
      const canViewAdministratorEntries =
        authorization.user.isDeveloperAdmin ||
        authorization.membership.role === 'owner' ||
        authorization.membership.role === 'administrator';
      const visibilityConditions = canViewAdministratorEntries
        ? []
        : [eq(directoryEntries.visibility, 'member')];
      const visibilityKey = canViewAdministratorEntries ? 'administrator' : 'member';
      return this.facetCache.getOrLoad(
        `${groupId}:${directoryKind}:${batch.id}:${visibilityKey}`,
        async () => {
          const rows = await transaction
            .select({
              building: directoryEntries.buildingName,
              campusCode: directoryCampuses.code,
              campusDisplayOrder: directoryCampuses.displayOrder,
              campusName: directoryCampuses.name,
              department: directoryEntries.departmentName,
              entryKind: directoryEntries.entryKind,
              floor: directoryEntries.floorName,
              section: directoryEntries.sectionName,
              subunit: directoryEntries.subunitName,
            })
            .from(directoryEntries)
            .innerJoin(directoryCampuses, eq(directoryCampuses.id, directoryEntries.campusId))
            .where(and(eq(directoryEntries.batchId, batch.id), ...visibilityConditions))
            .orderBy(asc(directoryCampuses.displayOrder), asc(directoryEntries.displayOrder));

          return buildFacetSnapshot(batch, rows);
        },
      );
    });
  }

  public async lookup(
    identity: AuthenticatedIdentity,
    groupId: string,
    entryIds: readonly string[],
    directoryKind: DirectoryKind = 'internal',
  ): Promise<DirectoryEntryLookupResponse> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'viewDirectory',
      );
      const batch = await getPublishedBatch(transaction, directoryKind);
      const canViewAdministratorEntries =
        authorization.user.isDeveloperAdmin ||
        authorization.membership.role === 'owner' ||
        authorization.membership.role === 'administrator';
      return {
        entries: await lookupDirectoryEntries(
          transaction,
          batch.id,
          entryIds,
          canViewAdministratorEntries,
        ),
      };
    });
  }
}

async function inspectCandidateDirectoryReadiness(
  databaseClient: DatabaseClient,
): Promise<DirectoryCandidateReadiness> {
  const [migrationRows] = (await databaseClient.database.execute(sql`
    SELECT
      id,
      hash,
      created_at AS createdAt
    FROM __drizzle_migrations
    WHERE created_at = ${directoryCandidateMigrationIdentity.createdAt}
      OR hash = ${directoryCandidateMigrationIdentity.hash}
    ORDER BY id
  `)) as unknown as [
    Array<{ createdAt: number | string; hash: string; id: number | string }>,
    unknown,
  ];
  const [rows] = (await databaseClient.database.execute(sql`
    SELECT
      COLUMN_NAME AS columnName,
      INDEX_NAME AS indexName,
      INDEX_TYPE AS indexType,
      IS_VISIBLE AS isVisible,
      NON_UNIQUE AS nonUnique,
      SEQ_IN_INDEX AS sequence
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'directory_search_aliases'
      AND INDEX_NAME = ${directoryCandidateIndexName}
    ORDER BY SEQ_IN_INDEX
  `)) as unknown as [
    Array<{
      columnName: string;
      indexName: string;
      indexType: string;
      isVisible: string;
      nonUnique: number | string;
      sequence: number | string;
    }>,
    unknown,
  ];
  return {
    indexRows: rows.map((row) => ({
      columnName: row.columnName,
      indexName: row.indexName,
      indexType: row.indexType,
      isVisible: row.isVisible,
      nonUnique: Number(row.nonUnique),
      sequence: Number(row.sequence),
    })),
    migrationRows: migrationRows.map((row) => ({
      createdAt: Number(row.createdAt),
      hash: row.hash,
      id: Number(row.id),
    })),
  };
}

async function lookupDirectoryEntries(
  transaction: DatabaseTransaction,
  batchId: string,
  entryIds: readonly string[],
  canViewAdministratorEntries: boolean,
): Promise<readonly DirectoryEntry[]> {
  const visibilityConditions = canViewAdministratorEntries
    ? []
    : [eq(directoryEntries.visibility, 'member')];
  const rows = await transaction
    .select({
      building: directoryEntries.buildingName,
      campusCode: directoryCampuses.code,
      campusDialingNote: directoryCampuses.dialingNote,
      campusDisplayOrder: directoryCampuses.displayOrder,
      campusName: directoryCampuses.name,
      contactName: directoryEntries.contactName,
      jobTitle: directoryEntries.jobTitle,
      department: directoryEntries.departmentName,
      displayOrder: directoryEntries.displayOrder,
      employeeCode: directoryEntries.employeeCode,
      entryKind: directoryEntries.entryKind,
      floor: directoryEntries.floorName,
      id: directoryEntries.id,
      notes: directoryEntries.notes,
      room: directoryEntries.roomName,
      section: directoryEntries.sectionName,
      subunit: directoryEntries.subunitName,
    })
    .from(directoryEntries)
    .innerJoin(directoryCampuses, eq(directoryCampuses.id, directoryEntries.campusId))
    .where(
      and(
        eq(directoryEntries.batchId, batchId),
        inArray(directoryEntries.id, [...entryIds]),
        ...visibilityConditions,
      ),
    )
    .orderBy(
      asc(directoryCampuses.displayOrder),
      asc(directoryEntries.displayOrder),
      asc(directoryEntries.id),
    );
  const contactMethods = await loadContactMethods(
    transaction,
    rows.map((row) => row.id),
  );
  return rows.map((row) => toDirectoryEntry(row, contactMethods.get(row.id) ?? []));
}

async function listDirectoryEntries(
  transaction: DatabaseTransaction,
  batchId: string,
  query: DirectoryQueryInput,
  canViewAdministratorEntries: boolean,
  timing?: DirectoryServerTimingTrace,
): Promise<DirectoryPage> {
  const pageSize = query.pageSize ?? defaultPageSize;
  const cursor = query.cursor === undefined ? undefined : decodeDirectoryCursor(query.cursor);
  const employeeCodeEntryIds = await measureDirectoryPhase(timing, 'aliasMs', () =>
    resolveEmployeeCodeEntryIds(transaction, batchId, query.q),
  );
  const rank = buildSearchRank(query.q, employeeCodeEntryIds);
  const conditions = buildDirectoryConditions(batchId, query, rank, canViewAdministratorEntries);
  if (cursor !== undefined) conditions.push(buildCursorCondition(rank, cursor));
  const stableOrder = [
    asc(directoryCampuses.displayOrder),
    asc(directoryEntries.displayOrder),
    asc(directoryEntries.id),
  ];
  const orderBy = query.q === undefined ? stableOrder : [desc(rank), ...stableOrder];

  const rows = await measureDirectoryPhase(timing, 'rowsMs', () =>
    transaction
      .select({
        building: directoryEntries.buildingName,
        campusCode: directoryCampuses.code,
        campusDialingNote: directoryCampuses.dialingNote,
        campusDisplayOrder: directoryCampuses.displayOrder,
        campusName: directoryCampuses.name,
        contactName: directoryEntries.contactName,
        jobTitle: directoryEntries.jobTitle,
        department: directoryEntries.departmentName,
        displayOrder: directoryEntries.displayOrder,
        employeeCode: directoryEntries.employeeCode,
        entryKind: directoryEntries.entryKind,
        floor: directoryEntries.floorName,
        id: directoryEntries.id,
        notes: directoryEntries.notes,
        rank,
        room: directoryEntries.roomName,
        section: directoryEntries.sectionName,
        subunit: directoryEntries.subunitName,
      })
      .from(directoryEntries)
      .innerJoin(directoryCampuses, eq(directoryCampuses.id, directoryEntries.campusId))
      .where(and(...conditions))
      .orderBy(...orderBy)
      .limit(pageSize + 1),
  );
  const pageRows = rows.slice(0, pageSize);
  const contactMethods = await measureDirectoryPhase(timing, 'contactsMs', () =>
    loadContactMethods(
      transaction,
      pageRows.map((row) => row.id),
    ),
  );
  const countConditions = buildDirectoryConditions(
    batchId,
    query,
    rank,
    canViewAdministratorEntries,
  );
  const [countRow] = await measureDirectoryPhase(timing, 'countMs', () =>
    transaction
      .select({ count: sql<number>`count(*)` })
      .from(directoryEntries)
      .innerJoin(directoryCampuses, eq(directoryCampuses.id, directoryEntries.campusId))
      .where(and(...countConditions)),
  );
  const last = pageRows.at(-1);

  if (timing !== undefined) {
    timing.queryMs =
      (timing.aliasMs ?? 0) +
      (timing.rowsMs ?? 0) +
      (timing.contactsMs ?? 0) +
      (timing.countMs ?? 0);
  }
  return measureDirectoryPhase(timing, 'transformMs', () => ({
    entries: pageRows.map((row) => toDirectoryEntry(row, contactMethods.get(row.id) ?? [])),
    ...(rows.length > pageSize && last !== undefined
      ? {
          nextCursor: encodeDirectoryCursor({
            campusDisplayOrder: last.campusDisplayOrder,
            entryDisplayOrder: last.displayOrder,
            id: last.id,
            rank: Number(last.rank),
          }),
        }
      : {}),
    totalCount: Number(countRow?.count ?? 0),
  }));
}

async function listDirectoryEntriesCandidate(
  transaction: DatabaseTransaction,
  batchId: string,
  query: DirectoryQueryInput,
  canViewAdministratorEntries: boolean,
  timing?: DirectoryServerTimingTrace,
): Promise<DirectoryPage> {
  if (query.q === undefined || hasEffectiveDirectoryFilters(query)) {
    return listDirectoryEntries(transaction, batchId, query, canViewAdministratorEntries, timing);
  }

  const pageSize = query.pageSize ?? defaultPageSize;
  const cursor = query.cursor === undefined ? undefined : decodeDirectoryCursor(query.cursor);
  const employeeCodeEntryIds = await measureDirectoryPhase(timing, 'aliasMs', () =>
    resolveEmployeeCodeEntryIds(transaction, batchId, query.q),
  );
  const candidates = buildCandidateSearch(
    batchId,
    query.q,
    canViewAdministratorEntries,
    employeeCodeEntryIds,
  );
  const rank = sql<number>`directory_candidates.search_rank`;
  const conditions = buildDirectoryConditions(batchId, query, rank, canViewAdministratorEntries);
  if (cursor !== undefined) conditions.push(buildCursorCondition(rank, cursor));

  const [rowsResult] = (await measureDirectoryPhase(timing, 'rowsMs', () =>
    transaction.execute(sql`
      SELECT
        ${directoryEntries.buildingName} AS building,
        ${directoryCampuses.code} AS campusCode,
        ${directoryCampuses.dialingNote} AS campusDialingNote,
        ${directoryCampuses.displayOrder} AS campusDisplayOrder,
        ${directoryCampuses.name} AS campusName,
        ${directoryEntries.contactName} AS contactName,
        ${directoryEntries.jobTitle} AS jobTitle,
        ${directoryEntries.departmentName} AS department,
        ${directoryEntries.displayOrder} AS displayOrder,
        ${directoryEntries.employeeCode} AS employeeCode,
        ${directoryEntries.entryKind} AS entryKind,
        ${directoryEntries.floorName} AS floor,
        ${directoryEntries.id} AS id,
        ${directoryEntries.notes} AS notes,
        directory_candidates.search_rank AS searchRank,
        ${directoryEntries.roomName} AS room,
        ${directoryEntries.sectionName} AS section,
        ${directoryEntries.subunitName} AS subunit
      FROM (${candidates}) AS directory_candidates
      INNER JOIN ${directoryEntries}
        ON ${directoryEntries.id} = directory_candidates.entry_id
      INNER JOIN ${directoryCampuses}
        ON ${directoryCampuses.id} = ${directoryEntries.campusId}
      WHERE ${and(...conditions)}
      ORDER BY directory_candidates.search_rank DESC,
               ${directoryCampuses.displayOrder} ASC,
               ${directoryEntries.displayOrder} ASC,
               ${directoryEntries.id} ASC
      LIMIT ${pageSize + 1}
    `),
  )) as unknown as [CandidateDirectoryRow[], unknown];
  const pageRows = rowsResult.slice(0, pageSize);
  const contactMethods = await measureDirectoryPhase(timing, 'contactsMs', () =>
    loadContactMethods(
      transaction,
      pageRows.map((row) => row.id),
    ),
  );
  const countConditions = buildDirectoryConditions(
    batchId,
    query,
    rank,
    canViewAdministratorEntries,
  );
  const [countRows] = (await measureDirectoryPhase(timing, 'countMs', () =>
    transaction.execute(sql`
      SELECT COUNT(*) AS count
      FROM (${candidates}) AS directory_candidates
      INNER JOIN ${directoryEntries}
        ON ${directoryEntries.id} = directory_candidates.entry_id
      INNER JOIN ${directoryCampuses}
        ON ${directoryCampuses.id} = ${directoryEntries.campusId}
      WHERE ${and(...countConditions)}
    `),
  )) as unknown as [{ count: number | string }[], unknown];
  const last = pageRows.at(-1);

  if (timing !== undefined) {
    timing.queryMs =
      (timing.aliasMs ?? 0) +
      (timing.rowsMs ?? 0) +
      (timing.contactsMs ?? 0) +
      (timing.countMs ?? 0);
  }
  return measureDirectoryPhase(timing, 'transformMs', () => ({
    entries: pageRows.map((row) => toDirectoryEntry(row, contactMethods.get(row.id) ?? [])),
    ...(rowsResult.length > pageSize && last !== undefined
      ? {
          nextCursor: encodeDirectoryCursor({
            campusDisplayOrder: last.campusDisplayOrder,
            entryDisplayOrder: last.displayOrder,
            id: last.id,
            rank: Number(last.searchRank),
          }),
        }
      : {}),
    totalCount: Number(countRows[0]?.count ?? 0),
  }));
}

/** @internal Exported for strict legacy/candidate differential tests. */
export function buildCandidateSearch(
  batchId: string,
  value: string,
  canViewAdministratorEntries: boolean,
  employeeCodeEntryIds: readonly string[],
): SQL {
  const normalized = normalizeDirectorySearch(value);
  const scopeConditions = buildCandidateScopeConditions(batchId, canViewAdministratorEntries);
  const branches: SQL[] = [];
  if (/^[\d\s()+\-.]+$/u.test(normalized)) {
    const digits = normalized.replaceAll(/\D/gu, '');
    if (digits.length === 0) {
      return sql`
        SELECT ${directoryEntries.id} AS entry_id, 0 AS search_rank
        FROM ${directoryEntries}
        WHERE 1 = 0
      `;
    }
    if (employeeCodeEntryIds.length > 0) {
      branches.push(sql`
        SELECT ${directoryEntries.id} AS entry_id, 750 AS search_rank
        FROM ${directoryEntries}
        WHERE ${and(...scopeConditions)}
          AND ${inArray(directoryEntries.id, [...employeeCodeEntryIds])}
      `);
    }
    branches.push(
      sql`
        SELECT ${directoryContactMethods.entryId} AS entry_id, 700 AS search_rank
        FROM ${directoryContactMethods}
        INNER JOIN ${directoryEntries}
          ON ${directoryEntries.id} = ${directoryContactMethods.entryId}
        WHERE ${and(...scopeConditions)}
          AND (
            ${directoryContactMethods.normalizedFullNumber} = ${digits}
            OR ${directoryContactMethods.normalizedInternalExtension} = ${digits}
          )
      `,
      sql`
        SELECT ${directoryContactMethods.entryId} AS entry_id, 650 AS search_rank
        FROM ${directoryContactMethods}
        INNER JOIN ${directoryEntries}
          ON ${directoryEntries.id} = ${directoryContactMethods.entryId}
        WHERE ${and(...scopeConditions)}
          AND (
            ${directoryContactMethods.normalizedFullNumber} LIKE CONCAT(${digits}, '%')
            OR ${directoryContactMethods.normalizedInternalExtension} LIKE CONCAT(${digits}, '%')
          )
      `,
    );
  } else {
    const fulltextQuery = toBooleanFulltextQuery(normalized);
    branches.push(
      sql`
        SELECT ${directoryEntries.id} AS entry_id, 700 AS search_rank
        FROM ${directoryEntries}
        WHERE ${and(...scopeConditions)}
          AND LOWER(${directoryEntries.employeeCode}) = ${normalized}
      `,
      sql`
        SELECT ${directoryEntries.id} AS entry_id, 650 AS search_rank
        FROM ${directoryEntries}
        WHERE ${and(...scopeConditions)}
          AND LOWER(${directoryEntries.employeeCode}) LIKE CONCAT(${normalized}, '%')
      `,
      sql`
        SELECT ${directorySearchAliases.entryId} AS entry_id, 600 AS search_rank
        FROM ${directorySearchAliases}
        INNER JOIN ${directoryEntries}
          ON ${directoryEntries.id} = ${directorySearchAliases.entryId}
        WHERE ${and(...scopeConditions)}
          AND ${directorySearchAliases.normalizedValue} = ${normalized}
      `,
      sql`
        SELECT ${directorySearchAliases.entryId} AS entry_id, 550 AS search_rank
        FROM ${directorySearchAliases}
        INNER JOIN ${directoryEntries}
          ON ${directoryEntries.id} = ${directorySearchAliases.entryId}
        WHERE ${and(...scopeConditions)}
          AND ${inArray(directorySearchAliases.type, ['source', 'manual'])}
          AND ${directorySearchAliases.normalizedValue} LIKE CONCAT(${normalized}, '%')
      `,
      sql`
        SELECT ${directorySearchAliases.entryId} AS entry_id, 525 AS search_rank
        FROM ${directorySearchAliases}
        INNER JOIN ${directoryEntries}
          ON ${directoryEntries.id} = ${directorySearchAliases.entryId}
        WHERE ${and(...scopeConditions)}
          AND ${inArray(directorySearchAliases.type, [
            'pinyin_full',
            'pinyin_compact',
            'pinyin_initials',
          ])}
          AND ${directorySearchAliases.normalizedValue} LIKE CONCAT(${normalized}, '%')
      `,
      sql`
        SELECT ${directorySearchAliases.entryId} AS entry_id, 450 AS search_rank
        FROM ${directorySearchAliases}
        INNER JOIN ${directoryEntries}
          ON ${directoryEntries.id} = ${directorySearchAliases.entryId}
        WHERE ${and(...scopeConditions)}
          AND INSTR(${directorySearchAliases.normalizedValue}, ${normalized}) > 0
      `,
    );
    if (fulltextQuery.length > 0) {
      const fulltextScore = sql<number>`MATCH(${directoryEntries.searchText}) AGAINST (${fulltextQuery} IN BOOLEAN MODE)`;
      branches.push(sql`
        SELECT ${directoryEntries.id} AS entry_id,
               100 + LEAST(99, ROUND(${fulltextScore} * 10)) AS search_rank
        FROM ${directoryEntries}
        WHERE ${and(...scopeConditions)}
          AND ${fulltextScore} > 0
      `);
    }
  }

  return sql`
    SELECT directory_candidate_rows.entry_id,
           MAX(directory_candidate_rows.search_rank) AS search_rank
    FROM (${sql.join(branches, sql` UNION ALL `)}) AS directory_candidate_rows
    GROUP BY directory_candidate_rows.entry_id
  `;
}

function buildCandidateScopeConditions(
  batchId: string,
  canViewAdministratorEntries: boolean,
): SQL[] {
  const conditions: SQL[] = [eq(directoryEntries.batchId, batchId)];
  if (!canViewAdministratorEntries) conditions.push(eq(directoryEntries.visibility, 'member'));
  return conditions;
}

function buildDirectoryConditions(
  batchId: string,
  query: DirectoryQueryInput,
  rank: SQL<number>,
  canViewAdministratorEntries: boolean,
): SQL[] {
  const conditions: SQL[] = [eq(directoryEntries.batchId, batchId)];
  if (!canViewAdministratorEntries) conditions.push(eq(directoryEntries.visibility, 'member'));
  if (query.campusCode !== undefined) conditions.push(eq(directoryCampuses.code, query.campusCode));
  if (query.section !== undefined) conditions.push(eq(directoryEntries.sectionName, query.section));
  if (query.department !== undefined)
    conditions.push(eq(directoryEntries.departmentName, query.department));
  if (query.subunit !== undefined) conditions.push(eq(directoryEntries.subunitName, query.subunit));
  if (query.building !== undefined)
    conditions.push(eq(directoryEntries.buildingName, query.building));
  if (query.floor !== undefined) conditions.push(eq(directoryEntries.floorName, query.floor));
  if (query.entryKind !== undefined)
    conditions.push(eq(directoryEntries.entryKind, query.entryKind));
  if (query.q !== undefined) conditions.push(gt(rank, 0));
  return conditions;
}

export function buildSearchRank(
  value: string | undefined,
  employeeCodeEntryIds: readonly string[] = [],
): SQL<number> {
  if (value === undefined) return sql<number>`0`;
  const normalized = normalizeDirectorySearch(value);
  const digitsOnly = /^[\d\s()+\-.]+$/u.test(normalized);
  if (digitsOnly) {
    const digits = normalized.replaceAll(/\D/gu, '');
    if (digits.length === 0) return sql<number>`0`;
    const employeeCodeAliasRank =
      employeeCodeEntryIds.length === 0
        ? sql``
        : sql`WHEN ${inArray(directoryEntries.id, [...employeeCodeEntryIds])} THEN 750`;
    return sql<number>`CASE
      ${employeeCodeAliasRank}
      WHEN EXISTS (
        SELECT 1 FROM directory_contact_methods AS directory_phone_exact
        WHERE directory_phone_exact.entry_id = ${directoryEntries.id}
          AND (
            directory_phone_exact.normalized_full_number = ${digits}
            OR directory_phone_exact.normalized_internal_extension = ${digits}
          )
      ) THEN 700
      WHEN EXISTS (
        SELECT 1 FROM directory_contact_methods AS directory_phone_prefix
        WHERE directory_phone_prefix.entry_id = ${directoryEntries.id}
          AND (
            directory_phone_prefix.normalized_full_number LIKE CONCAT(${digits}, '%')
            OR directory_phone_prefix.normalized_internal_extension LIKE CONCAT(${digits}, '%')
          )
      ) THEN 650
      ELSE 0
    END`;
  }

  const fulltextQuery = toBooleanFulltextQuery(normalized);
  const fulltextScore =
    fulltextQuery.length === 0
      ? sql<number>`0`
      : sql<number>`MATCH(${directoryEntries.searchText}) AGAINST (${fulltextQuery} IN BOOLEAN MODE)`;
  return sql<number>`CASE
    WHEN LOWER(${directoryEntries.employeeCode}) = ${normalized} THEN 700
    WHEN LOWER(${directoryEntries.employeeCode}) LIKE CONCAT(${normalized}, '%') THEN 650
    WHEN EXISTS (
      SELECT 1 FROM directory_search_aliases AS directory_alias_exact
      WHERE directory_alias_exact.entry_id = ${directoryEntries.id}
        AND directory_alias_exact.normalized_value = ${normalized}
    ) THEN 600
    WHEN EXISTS (
      SELECT 1 FROM directory_search_aliases AS directory_alias_source_prefix
      WHERE directory_alias_source_prefix.entry_id = ${directoryEntries.id}
        AND directory_alias_source_prefix.type IN ('source', 'manual')
        AND directory_alias_source_prefix.normalized_value LIKE CONCAT(${normalized}, '%')
    ) THEN 550
    WHEN EXISTS (
      SELECT 1 FROM directory_search_aliases AS directory_alias_pinyin_prefix
      WHERE directory_alias_pinyin_prefix.entry_id = ${directoryEntries.id}
        AND directory_alias_pinyin_prefix.type IN ('pinyin_full', 'pinyin_compact', 'pinyin_initials')
        AND directory_alias_pinyin_prefix.normalized_value LIKE CONCAT(${normalized}, '%')
    ) THEN 525
    WHEN EXISTS (
      SELECT 1 FROM directory_search_aliases AS directory_alias_contains
      WHERE directory_alias_contains.entry_id = ${directoryEntries.id}
        AND INSTR(directory_alias_contains.normalized_value, ${normalized}) > 0
    ) THEN 450
    WHEN ${fulltextScore} > 0 THEN 100 + LEAST(99, ROUND(${fulltextScore} * 10))
    ELSE 0
  END`;
}

export function buildEmployeeCodeCandidates(digits: string): readonly string[] {
  if (digits.length < 3) return [];
  const numericVariants = [digits];
  let padded = digits;
  while (padded.length < 6) {
    padded = `0${padded}`;
    numericVariants.push(padded);
  }
  const candidates = new Set(numericVariants);
  for (const prefix of 'abcdefghijklmnopqrstuvwxyz') {
    for (const numeric of numericVariants) candidates.add(`${prefix}${numeric}`);
  }
  return [...candidates];
}

/** @internal Exported for strict legacy/candidate differential tests. */
export async function resolveEmployeeCodeEntryIds(
  transaction: DatabaseTransaction,
  batchId: string,
  value: string | undefined,
): Promise<readonly string[]> {
  if (value === undefined) return [];
  const normalized = normalizeDirectorySearch(value);
  if (!/^[\d\s()+\-.]+$/u.test(normalized)) return [];
  const digits = normalized.replaceAll(/\D/gu, '');
  const candidates = buildEmployeeCodeCandidates(digits);
  if (candidates.length === 0) return [];
  const aliasRows = await transaction
    .select({ id: directorySearchAliases.entryId })
    .from(directorySearchAliases)
    .innerJoin(directoryEntries, eq(directoryEntries.id, directorySearchAliases.entryId))
    .where(
      and(
        eq(directoryEntries.batchId, batchId),
        eq(directorySearchAliases.type, 'source'),
        inArray(directorySearchAliases.normalizedValue, [...candidates]),
        eq(directorySearchAliases.aliasValue, directoryEntries.employeeCode),
      ),
    );
  return [...new Set(aliasRows.map((row) => row.id))];
}

function buildCursorCondition(rank: SQL<number>, cursor: DirectoryCursor): SQL {
  return (
    or(
      lt(rank, cursor.rank),
      and(eq(rank, cursor.rank), gt(directoryCampuses.displayOrder, cursor.campusDisplayOrder)),
      and(
        eq(rank, cursor.rank),
        eq(directoryCampuses.displayOrder, cursor.campusDisplayOrder),
        gt(directoryEntries.displayOrder, cursor.entryDisplayOrder),
      ),
      and(
        eq(rank, cursor.rank),
        eq(directoryCampuses.displayOrder, cursor.campusDisplayOrder),
        eq(directoryEntries.displayOrder, cursor.entryDisplayOrder),
        gt(directoryEntries.id, cursor.id),
      ),
    ) ?? sql`1 = 0`
  );
}

async function loadContactMethods(
  transaction: DatabaseTransaction,
  entryIds: readonly string[],
): Promise<ReadonlyMap<string, readonly DirectoryContactMethod[]>> {
  if (entryIds.length === 0) return new Map();
  const rows = await transaction
    .select({
      displayOrder: directoryContactMethods.displayOrder,
      entryId: directoryContactMethods.entryId,
      fullNumber: directoryContactMethods.fullNumber,
      id: directoryContactMethods.id,
      internalExtension: directoryContactMethods.internalExtension,
      isPrimary: directoryContactMethods.isPrimary,
      label: directoryContactMethods.label,
      type: directoryContactMethods.type,
    })
    .from(directoryContactMethods)
    .where(inArray(directoryContactMethods.entryId, [...entryIds]))
    .orderBy(
      asc(directoryContactMethods.entryId),
      desc(directoryContactMethods.isPrimary),
      asc(directoryContactMethods.displayOrder),
      asc(directoryContactMethods.id),
    );
  const result = new Map<string, DirectoryContactMethod[]>();
  for (const row of rows) {
    const contact: DirectoryContactMethod = {
      displayOrder: row.displayOrder,
      ...(row.fullNumber === null ? {} : { fullNumber: row.fullNumber }),
      id: row.id,
      ...(row.internalExtension === null ? {} : { internalExtension: row.internalExtension }),
      isPrimary: row.isPrimary === 1,
      ...(row.label === null ? {} : { label: row.label }),
      type: row.type,
    };
    const current = result.get(row.entryId) ?? [];
    current.push(contact);
    result.set(row.entryId, current);
  }
  return result;
}

function toDirectoryEntry(
  row: {
    readonly building: string | null;
    readonly campusCode: string;
    readonly campusDialingNote: string | null;
    readonly campusName: string;
    readonly contactName: string | null;
    readonly jobTitle: string | null;
    readonly department: string | null;
    readonly displayOrder: number;
    readonly employeeCode: string | null;
    readonly entryKind: DirectoryEntryKind;
    readonly floor: string | null;
    readonly id: string;
    readonly notes: string | null;
    readonly room: string | null;
    readonly section: string | null;
    readonly subunit: string | null;
  },
  contacts: readonly DirectoryContactMethod[],
): DirectoryEntry {
  return {
    ...(row.building === null ? {} : { building: row.building }),
    campus: {
      code: row.campusCode,
      ...(row.campusDialingNote === null ? {} : { dialingNote: row.campusDialingNote }),
      name: row.campusName,
    },
    ...(row.contactName === null ? {} : { contactName: row.contactName }),
    ...(row.jobTitle === null ? {} : { jobTitle: row.jobTitle }),
    contacts,
    ...(row.department === null ? {} : { department: row.department }),
    displayOrder: row.displayOrder,
    ...(row.employeeCode === null ? {} : { employeeCode: row.employeeCode }),
    entryKind: row.entryKind,
    ...(row.floor === null ? {} : { floor: row.floor }),
    id: row.id,
    ...(row.notes === null ? {} : { notes: row.notes }),
    ...(row.room === null ? {} : { room: row.room }),
    ...(row.section === null ? {} : { section: row.section }),
    ...(row.subunit === null ? {} : { subunit: row.subunit }),
  };
}

async function getPublishedBatch(
  transaction: DatabaseTransaction,
  directoryKind: DirectoryKind,
): Promise<PublishedDirectoryBatch> {
  const [batch] = await transaction
    .select({
      effectiveOn: directoryImportBatches.effectiveOn,
      id: directoryImportBatches.id,
      importVersion: directoryImportBatches.importVersion,
    })
    .from(directoryImportBatches)
    .where(
      and(
        eq(directoryImportBatches.directoryKind, directoryKind),
        eq(directoryImportBatches.status, 'published'),
      ),
    )
    .limit(1);
  if (batch === undefined) {
    throw new ApiError({
      code: 'NOT_FOUND',
      statusCode: 404,
      userMessage: directoryKind === 'employee' ? '员工通讯录尚未发布。' : '院内通讯录尚未发布。',
    });
  }
  return batch;
}

function buildFacetSnapshot(
  batch: PublishedDirectoryBatch,
  rows: readonly DirectoryFacetRow[],
): DirectoryFacetSnapshot {
  const campusCounts = new Map<
    string,
    { count: number; displayOrder: number; label: string; value: string }
  >();
  for (const row of rows) {
    const current = campusCounts.get(row.campusCode);
    campusCounts.set(row.campusCode, {
      count: (current?.count ?? 0) + 1,
      displayOrder: row.campusDisplayOrder,
      label: row.campusName,
      value: row.campusCode,
    });
  }

  return {
    buildings: countTextFacets(rows.map((row) => row.building)),
    campuses: [...campusCounts.values()]
      .sort(
        (first, second) =>
          first.displayOrder - second.displayOrder || first.label.localeCompare(second.label),
      )
      .map(({ count, label, value }) => ({ count, label, value })),
    departments: countTextFacets(rows.map((row) => row.department)),
    entryKinds: entryKindOrder
      .map((entryKind) => ({
        count: rows.filter((row) => row.entryKind === entryKind).length,
        label: directoryEntryKindLabels[entryKind],
        value: entryKind,
      }))
      .filter((facet) => facet.count > 0),
    floors: countTextFacets(rows.map((row) => row.floor)),
    paths: buildFacetPaths(rows),
    publishedEffectiveOn: batch.effectiveOn,
    publishedImportVersion: batch.importVersion,
    sections: countTextFacets(rows.map((row) => row.section)),
    subunits: countTextFacets(rows.map((row) => row.subunit)),
    totalCount: rows.length,
  };
}

function buildFacetPaths(rows: readonly DirectoryFacetRow[]): readonly DirectoryFacetPath[] {
  const paths = new Map<string, DirectoryFacetPath>();
  for (const row of rows) {
    const path: DirectoryFacetPath = {
      ...(row.building === null ? {} : { building: row.building }),
      campusCode: row.campusCode,
      count: 1,
      ...(row.department === null ? {} : { department: row.department }),
      entryKind: row.entryKind,
      ...(row.floor === null ? {} : { floor: row.floor }),
      ...(row.section === null ? {} : { section: row.section }),
      ...(row.subunit === null ? {} : { subunit: row.subunit }),
    };
    const key = JSON.stringify([
      path.campusCode,
      path.section,
      path.building,
      path.floor,
      path.department,
      path.subunit,
      path.entryKind,
    ]);
    const current = paths.get(key);
    paths.set(key, current === undefined ? path : { ...current, count: current.count + 1 });
  }
  return [...paths.values()];
}

function countTextFacets(values: readonly (string | null)[]): readonly DirectoryFacetOption[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (value !== null) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([first], [second]) => first.localeCompare(second, 'zh-CN'))
    .map(([value, count]) => ({ count, label: value, value }));
}

export function normalizeDirectorySearch(value: string): string {
  return value.normalize('NFKC').trim().toLowerCase().replaceAll(/\s+/gu, ' ');
}

function toBooleanFulltextQuery(value: string): string {
  return value
    .replaceAll(/[+\-<>()~*@"\\]/gu, ' ')
    .replaceAll(/\s+/gu, ' ')
    .trim();
}

export function encodeDirectoryCursor(cursor: DirectoryCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeDirectoryCursor(value: string): DirectoryCursor {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    throw invalidCursorError();
  }
  if (parsed === null || typeof parsed !== 'object') throw invalidCursorError();
  const cursor = parsed as Partial<DirectoryCursor>;
  if (
    !Number.isInteger(cursor.rank) ||
    (cursor.rank ?? -1) < 0 ||
    !Number.isInteger(cursor.campusDisplayOrder) ||
    (cursor.campusDisplayOrder ?? -1) < 0 ||
    !Number.isInteger(cursor.entryDisplayOrder) ||
    (cursor.entryDisplayOrder ?? -1) < 0 ||
    typeof cursor.id !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(cursor.id)
  ) {
    throw invalidCursorError();
  }
  return cursor as DirectoryCursor;
}

function invalidCursorError(): ApiError {
  return new ApiError({
    code: 'VALIDATION_FAILED',
    statusCode: 400,
    userMessage: '通讯录翻页位置无效，请重新加载。',
  });
}
