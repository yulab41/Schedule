import { createHash, randomUUID } from 'node:crypto';
import { Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';

import {
  createTestDatabaseClient,
  directoryCampuses,
  directoryCandidateMigrationIdentity,
  directoryEntries,
  directoryImportBatches,
  migrateDatabase,
  withTransaction,
  type DatabaseClient,
  type DatabaseConnectionOptions,
} from '@schedule/database';
import { sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AuthPort } from '../../adapters/auth/auth-port.js';
import { createApp } from '../../app.js';
import {
  buildCandidateSearch,
  buildSearchRank,
  resolveEmployeeCodeEntryIds,
} from './directory-query.js';

const migrationsDirectory = fileURLToPath(new URL('../../../../../migrations', import.meta.url));
const databaseOptions = getTestDatabaseOptions();
const describeWithDatabase = databaseOptions === undefined ? describe.skip : describe;
const directoryAuthTokens = {
  'administrator-token': 'directory-administrator',
  'developer-token': 'directory-developer',
  'guest-token': 'directory-guest',
  'member-token': 'directory-member',
  'outsider-token': 'directory-outsider',
  'owner-token': 'directory-owner',
} as const;

describeWithDatabase('internal directory routes', () => {
  let app: ReturnType<typeof createApp>;
  let client: DatabaseClient;
  let groupId: string;

  beforeEach(async () => {
    client = createTestDatabaseClient(databaseOptions as DatabaseConnectionOptions);
    await resetDatabase(client);
    await migrateDatabase(client, migrationsDirectory);
    groupId = await seedDirectoryFixture(client);
    app = createApp({
      authPort: createFakeAuthPort(directoryAuthTokens),
      databaseClient: client,
      logger: false,
    });
  });

  afterEach(async () => {
    await app.close();
    await client.close();
  });

  it('allows active formal members and administrators while rejecting guest, outsider, and anonymous access', async () => {
    for (const token of ['member-token', 'administrator-token', 'developer-token']) {
      const response = await app.inject({
        headers: { authorization: `Bearer ${token}` },
        method: 'GET',
        url: `/groups/${groupId}/directory?pageSize=20`,
      });
      expect(response.statusCode, response.payload).toBe(200);
    }

    for (const token of ['guest-token', 'outsider-token']) {
      const response = await app.inject({
        headers: { authorization: `Bearer ${token}` },
        method: 'GET',
        url: `/groups/${groupId}/directory`,
      });
      expect(response.statusCode).toBe(403);
    }

    const anonymous = await app.inject({
      method: 'GET',
      url: `/groups/${groupId}/directory`,
    });
    const visitorKey = await app.inject({
      method: 'GET',
      url: `/guest/groups/${groupId}/directory?visitorKey=${'a'.repeat(32)}`,
    });
    expect(anonymous.statusCode).toBe(401);
    expect(visitorKey.statusCode).toBe(404);
  });

  it('searches Chinese, pinyin initials, employee codes, exact numbers, and number prefixes with stable cursor pages', async () => {
    const chinese = await getDirectory('member-token', 'q=%E6%80%A5%E8%AF%8A');
    expect(chinese.totalCount).toBe(2);

    const pinyin = await getDirectory('member-token', 'q=jzk');
    expect(pinyin.totalCount).toBe(2);

    for (const query of ['D0468', 'd0468']) {
      const employeeCode = await getDirectory('member-token', `q=${query}`);
      expect(employeeCode.entries.map((entry) => entry.contactName)).toEqual(['急诊分诊台']);
    }

    const withoutPrefix = await getDirectory('member-token', 'q=0468');
    expect(withoutPrefix.entries.slice(0, 2).map((entry) => entry.employeeCode)).toEqual([
      'D0468',
      'A0468',
    ]);

    const withoutPrefixOrZero = await getDirectory('member-token', 'q=468');
    expect(withoutPrefixOrZero.entries.slice(0, 2).map((entry) => entry.employeeCode)).toEqual([
      'D0468',
      'A0468',
    ]);
    expect(withoutPrefixOrZero.totalCount).toBe(3);

    const extension = await getDirectory('member-token', 'q=1234');
    expect(extension.entries.map((entry) => entry.contactName)).toEqual(['急诊分诊台']);

    const numberPrefix = await getDirectory('member-token', 'q=0000000&pageSize=1');
    expect(numberPrefix.entries).toHaveLength(1);
    expect(numberPrefix.nextCursor).toEqual(expect.any(String));
    const secondPage = await getDirectory(
      'member-token',
      `q=0000000&pageSize=1&cursor=${encodeURIComponent(numberPrefix.nextCursor ?? '')}`,
    );
    expect(secondPage.entries).toHaveLength(1);
    expect(secondPage.entries[0]?.id).not.toBe(numberPrefix.entries[0]?.id);
  });

  it('combines independently selected hierarchy filters without requiring parent levels', async () => {
    const floorOnly = await getDirectory('member-token', 'floor=2%E6%A5%BC');
    expect(floorOnly.entries.map((entry) => entry.department)).toEqual(['检验科']);

    const departmentAndKind = await getDirectory(
      'member-token',
      'department=%E6%80%A5%E8%AF%8A%E7%A7%91&entryKind=person',
    );
    expect(departmentAndKind.entries.map((entry) => entry.contactName)).toEqual(['值班医生']);

    const buildingOnly = await getDirectory('member-token', 'building=%E5%8C%BB%E6%8A%80%E6%A5%BC');
    expect(buildingOnly.totalCount).toBe(1);
  });

  it('returns role-safe filter facets and rejects malformed cursors', async () => {
    const memberFacets = await getFacets('member-token');
    const administratorFacets = await getFacets('administrator-token');

    expect(memberFacets.totalCount).toBe(3);
    expect(administratorFacets.totalCount).toBe(4);
    expect(memberFacets.campuses.map((facet) => facet.value)).toEqual(['central', 'north']);
    expect(memberFacets.floors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ count: 1, value: '2楼' }),
        expect.objectContaining({ count: 2, value: '3楼' }),
      ]),
    );
    expect(memberFacets.paths).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          building: '门诊楼',
          campusCode: 'central',
          count: 1,
          department: '急诊科',
          entryKind: 'service',
          floor: '3楼',
          section: '临床服务',
        }),
        expect.objectContaining({
          building: '医技楼',
          campusCode: 'north',
          count: 1,
          department: '检验科',
          floor: '2楼',
          section: '医技服务',
        }),
      ]),
    );
    expect(memberFacets.paths.some((path) => path.department === '保卫处')).toBe(false);
    expect(administratorFacets.paths.some((path) => path.department === '保卫处')).toBe(true);

    const invalidCursor = await app.inject({
      headers: { authorization: 'Bearer member-token' },
      method: 'GET',
      url: `/groups/${groupId}/directory?cursor=not-a-cursor`,
    });
    expect(invalidCursor.statusCode).toBe(400);
  });

  it('restores preferred entries by id without bypassing directory visibility', async () => {
    const administratorPage = await getDirectory('administrator-token', 'pageSize=20');
    const entryIds = administratorPage.entries.map((entry) => entry.id);
    const memberResponse = await app.inject({
      headers: { authorization: 'Bearer member-token' },
      method: 'POST',
      payload: { entryIds },
      url: `/groups/${groupId}/directory/lookup`,
    });
    expect(memberResponse.statusCode, memberResponse.payload).toBe(200);
    expect(memberResponse.json().entries).toHaveLength(3);
    expect(
      memberResponse
        .json()
        .entries.some((entry: { department?: string }) => entry.department === '保卫处'),
    ).toBe(false);

    const malformed = await app.inject({
      headers: { authorization: 'Bearer member-token' },
      method: 'POST',
      payload: { entryIds: [entryIds[0], entryIds[0]] },
      url: `/groups/${groupId}/directory/lookup`,
    });
    expect(malformed.statusCode).toBe(400);
  });

  it('keeps legacy and candidate results identical across routing, roles, and cursor handoffs', async () => {
    const candidateApp = createApp({
      authPort: createFakeAuthPort(directoryAuthTokens),
      databaseClient: client,
      directoryQueryPlan: 'candidate',
      logger: false,
    });
    try {
      const scenarios = [
        ['member-token', 'q=%E6%80%A5%E8%AF%8A'],
        ['member-token', 'q=jzk'],
        ['member-token', 'q=jizhenke'],
        ['member-token', 'q=D0468'],
        ['member-token', 'q=0468'],
        ['member-token', 'q=0000000001'],
        ['member-token', 'q=not-present'],
        ['member-token', 'q=j'],
        ['member-token', 'q=j&department=%E6%80%A5%E8%AF%8A%E7%A7%91'],
        ['member-token', 'pageSize=2'],
        ['owner-token', 'q=j'],
        ['administrator-token', 'q=j'],
        ['developer-token', 'q=j'],
        ['guest-token', 'q=j'],
        ['outsider-token', 'q=j'],
      ] as const;
      for (const [token, query] of scenarios) {
        const request = {
          headers: { authorization: `Bearer ${token}` },
          method: 'GET' as const,
          url: `/groups/${groupId}/directory?${query}`,
        };
        const [legacy, candidate] = await Promise.all([
          app.inject(request),
          candidateApp.inject(request),
        ]);
        expect(candidate.statusCode, `${token}:${query}`).toBe(legacy.statusCode);
        if (legacy.statusCode === 200) {
          expect(candidate.json(), `${token}:${query}`).toEqual(legacy.json());
        }
      }

      const canonical = await collectPageIds(app, app, 'member-token', 'q=j&pageSize=1');
      expect(await collectPageIds(app, candidateApp, 'member-token', 'q=j&pageSize=1')).toEqual(
        canonical,
      );
      expect(await collectPageIds(candidateApp, app, 'member-token', 'q=j&pageSize=1')).toEqual(
        canonical,
      );
      expect(new Set(canonical)).toHaveProperty('size', canonical.length);

      const candidateTiming = await candidateApp.inject({
        headers: {
          authorization: 'Bearer member-token',
          'x-schedule-client-platform': 'miniprogram',
          'x-schedule-directory-diagnostics': 'v1',
        },
        method: 'GET',
        url: `/groups/${groupId}/directory?q=jzk`,
      });
      const filteredTiming = await candidateApp.inject({
        headers: {
          authorization: 'Bearer member-token',
          'x-schedule-client-platform': 'miniprogram',
          'x-schedule-directory-diagnostics': 'v1',
        },
        method: 'GET',
        url: `/groups/${groupId}/directory?q=jzk&department=%E6%80%A5%E8%AF%8A%E7%A7%91`,
      });
      const singleCharacterTiming = await candidateApp.inject({
        headers: {
          authorization: 'Bearer member-token',
          'x-schedule-client-platform': 'miniprogram',
          'x-schedule-directory-diagnostics': 'v1',
        },
        method: 'GET',
        url: `/groups/${groupId}/directory?q=j`,
      });
      expect(candidateTiming.headers['server-timing']).toContain('directory_plan;desc="candidate"');
      expect(filteredTiming.headers['server-timing']).toContain('directory_plan;desc="legacy"');
      expect(singleCharacterTiming.headers['server-timing']).toContain(
        'directory_plan;desc="legacy"',
      );
    } finally {
      await candidateApp.close();
    }
  });

  it.each([17, 43, 89])(
    'keeps randomized semantic differences at zero for deterministic seed %i',
    async (seed) => {
      await replacePublishedDirectorySnapshot(client, seed);
      const candidateApp = createApp({
        authPort: createFakeAuthPort(directoryAuthTokens),
        databaseClient: client,
        directoryQueryPlan: 'candidate',
        logger: false,
      });
      try {
        for (const query of buildDifferentialQueries(seed)) {
          const [legacy, candidate] = await Promise.all([
            readAllDirectoryPages(app, groupId, 'member-token', query),
            readAllDirectoryPages(candidateApp, groupId, 'member-token', query),
          ]);
          expect(candidate, `seed=${seed};query=${query}`).toEqual(legacy);
          if (usesCandidateRankPath(query)) {
            const ranks = await readLegacyAndCandidateRanks(
              client,
              new URLSearchParams(query).get('q') ?? '',
            );
            expect(ranks.candidate, `seed=${seed};rank-query=${query}`).toEqual(ranks.legacy);
          }
        }

        const roleQuery = new URLSearchParams({
          pageSize: '1',
          q: `shared-${seed}`,
        }).toString();
        for (const token of ['member-token', 'owner-token', 'administrator-token', 'guest-token']) {
          const [legacy, candidate] = await Promise.all([
            readAllDirectoryPages(app, groupId, token, roleQuery),
            readAllDirectoryPages(candidateApp, groupId, token, roleQuery),
          ]);
          expect(candidate, `seed=${seed};role=${token}`).toEqual(legacy);
        }

        await client.database.execute(sql`
          UPDATE group_memberships AS membership
          INNER JOIN users AS account ON account.id = membership.user_id
          SET membership.role = 'administrator'
          WHERE membership.group_id = ${groupId}
            AND account.cloudbase_uid = 'directory-member'
        `);
        const [legacyAfterRoleChange, candidateAfterRoleChange] = await Promise.all([
          readAllDirectoryPages(app, groupId, 'member-token', roleQuery),
          readAllDirectoryPages(candidateApp, groupId, 'member-token', roleQuery),
        ]);
        expect(candidateAfterRoleChange).toEqual(legacyAfterRoleChange);
        expect(candidateAfterRoleChange.statusCode).toBe(200);
      } finally {
        await candidateApp.close();
      }
    },
  );

  it('keeps candidate disabled when the journal still has 53 rows but lacks exact migration 0053', async () => {
    const [[before]] = (await client.database.execute(sql`
      SELECT COUNT(*) AS count FROM __drizzle_migrations
    `)) as unknown as [[{ count: number | string }], unknown];
    expect(Number(before?.count)).toBe(53);
    await client.database.execute(sql`
      DELETE FROM __drizzle_migrations
      WHERE created_at = ${directoryCandidateMigrationIdentity.createdAt}
    `);
    await client.database.execute(sql`
      INSERT INTO __drizzle_migrations (hash, created_at)
      VALUES (${'f'.repeat(64)}, ${directoryCandidateMigrationIdentity.createdAt + 1})
    `);
    const [[after]] = (await client.database.execute(sql`
      SELECT COUNT(*) AS count FROM __drizzle_migrations
    `)) as unknown as [[{ count: number | string }], unknown];
    expect(Number(after?.count)).toBe(53);
    const logLines: string[] = [];
    const loggerStream = new Writable({
      write(chunk, _encoding, callback) {
        logLines.push(String(chunk));
        callback();
      },
    });
    const candidateApp = createApp({
      authPort: createFakeAuthPort(directoryAuthTokens),
      databaseClient: client,
      directoryQueryPlan: 'candidate',
      loggerStream,
    });
    try {
      const response = await candidateApp.inject({
        headers: {
          authorization: 'Bearer member-token',
          'x-schedule-client-platform': 'miniprogram',
          'x-schedule-directory-diagnostics': 'v1',
        },
        method: 'GET',
        url: `/groups/${groupId}/directory?q=jzk`,
      });
      expect(response.statusCode, response.payload).toBe(200);
      expect(response.headers['server-timing']).toContain('directory_plan;desc="legacy"');
      expect(
        logLines
          .map((line) => JSON.parse(line) as Record<string, unknown>)
          .filter((entry) => entry['event'] === 'directory_candidate_plan_unavailable'),
      ).toEqual([
        expect.objectContaining({
          directoryQueryPlan: 'legacy',
          reason: 'migration-index-inconsistent',
        }),
      ]);
    } finally {
      await candidateApp.close();
    }
  });

  it('falls back without a 500 when candidate is configured without its exact index', async () => {
    await client.database.execute(sql`
      ALTER TABLE directory_search_aliases
        DROP INDEX directory_search_aliases_entry_type_normalized_idx,
        ALGORITHM=INPLACE,
        LOCK=NONE
    `);
    const logLines: string[] = [];
    const loggerStream = new Writable({
      write(chunk, _encoding, callback) {
        logLines.push(String(chunk));
        callback();
      },
    });
    const candidateApp = createApp({
      authPort: createFakeAuthPort(directoryAuthTokens),
      databaseClient: client,
      directoryQueryPlan: 'candidate',
      loggerStream,
    });
    try {
      const response = await candidateApp.inject({
        headers: {
          authorization: 'Bearer member-token',
          'x-schedule-client-platform': 'miniprogram',
          'x-schedule-directory-diagnostics': 'v1',
        },
        method: 'GET',
        url: `/groups/${groupId}/directory?q=private-marker`,
      });
      expect(response.statusCode, response.payload).toBe(200);
      expect(response.headers['server-timing']).toContain('directory_plan;desc="legacy"');
      const forbidden = await candidateApp.inject({
        headers: { authorization: 'Bearer guest-token' },
        method: 'GET',
        url: `/groups/${groupId}/directory?q=private-marker`,
      });
      expect(forbidden.statusCode).toBe(403);
      const entries = logLines
        .map((line) => JSON.parse(line) as Record<string, unknown>)
        .filter((entry) => entry['event'] === 'directory_candidate_plan_unavailable');
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        directoryQueryPlan: 'legacy',
        reason: 'index-missing-or-invalid',
      });
      expect(JSON.stringify(entries[0])).not.toContain('private-marker');
      expect(JSON.stringify(entries[0])).not.toContain(groupId);
      const planEntries = logLines
        .map((line) => JSON.parse(line) as Record<string, unknown>)
        .filter((entry) => entry['event'] === 'directory_query_plan_selected');
      expect(planEntries).toHaveLength(2);
      for (const planEntry of planEntries) {
        expect(planEntry).toMatchObject({ directoryQueryPlan: 'legacy' });
        expect(JSON.stringify(planEntry)).not.toContain('private-marker');
        expect(JSON.stringify(planEntry)).not.toContain(groupId);
      }
    } finally {
      await candidateApp.close();
    }
  });

  it('rejects a same-name index with a different ordered definition', async () => {
    await client.database.execute(sql`
      ALTER TABLE directory_search_aliases
        DROP INDEX directory_search_aliases_entry_type_normalized_idx,
        ALGORITHM=INPLACE,
        LOCK=NONE
    `);
    await client.database.execute(sql`
      ALTER TABLE directory_search_aliases
        ADD INDEX directory_search_aliases_entry_type_normalized_idx
          (type, entry_id, normalized_value),
        ALGORITHM=INPLACE,
        LOCK=NONE
    `);
    const candidateApp = createApp({
      authPort: createFakeAuthPort(directoryAuthTokens),
      databaseClient: client,
      directoryQueryPlan: 'candidate',
      logger: false,
    });
    try {
      const response = await candidateApp.inject({
        headers: {
          authorization: 'Bearer member-token',
          'x-schedule-client-platform': 'miniprogram',
          'x-schedule-directory-diagnostics': 'v1',
        },
        method: 'GET',
        url: `/groups/${groupId}/directory?q=jzk`,
      });
      expect(response.statusCode, response.payload).toBe(200);
      expect(response.headers['server-timing']).toContain('directory_plan;desc="legacy"');
    } finally {
      await candidateApp.close();
    }
  });

  async function collectPageIds(
    firstApp: ReturnType<typeof createApp>,
    subsequentApp: ReturnType<typeof createApp>,
    token: string,
    initialQuery: string,
  ): Promise<readonly string[]> {
    const ids: string[] = [];
    let cursor: string | undefined;
    let pageIndex = 0;
    do {
      const response = await (pageIndex === 0 ? firstApp : subsequentApp).inject({
        headers: { authorization: `Bearer ${token}` },
        method: 'GET',
        url:
          `/groups/${groupId}/directory?${initialQuery}` +
          (cursor === undefined ? '' : `&cursor=${encodeURIComponent(cursor)}`),
      });
      expect(response.statusCode, response.payload).toBe(200);
      const page = response.json<{ entries: { id: string }[]; nextCursor?: string }>();
      ids.push(...page.entries.map((entry) => entry.id));
      cursor = page.nextCursor;
      pageIndex += 1;
      expect(pageIndex).toBeLessThan(20);
    } while (cursor !== undefined);
    return ids;
  }

  async function getDirectory(
    token: string,
    query: string,
  ): Promise<{
    entries: { contactName?: string; department?: string; employeeCode?: string; id: string }[];
    nextCursor?: string;
    totalCount: number;
  }> {
    const response = await app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: `/groups/${groupId}/directory?${query}`,
    });
    expect(response.statusCode).toBe(200);
    return response.json();
  }

  async function getFacets(token: string): Promise<{
    campuses: { value: string }[];
    floors: { count: number; value: string }[];
    paths: {
      building?: string;
      campusCode: string;
      count: number;
      department?: string;
      floor?: string;
      section?: string;
    }[];
    totalCount: number;
  }> {
    const response = await app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: `/groups/${groupId}/directory/facets`,
    });
    expect(response.statusCode).toBe(200);
    return response.json();
  }
});

interface SeedUser {
  readonly id: string;
  readonly membershipRole?: 'administrator' | 'guest' | 'member' | 'owner';
  readonly uid: string;
}

async function readLegacyAndCandidateRanks(
  client: DatabaseClient,
  query: string,
): Promise<{
  candidate: readonly { id: string; rank: number }[];
  legacy: readonly { id: string; rank: number }[];
}> {
  const [batch] = await client.database
    .select({ id: directoryImportBatches.id })
    .from(directoryImportBatches)
    .where(
      sql`${directoryImportBatches.directoryKind} = 'internal'
      AND ${directoryImportBatches.status} = 'published'`,
    )
    .limit(1);
  if (batch === undefined) throw new Error('Published internal directory batch is missing.');
  return withTransaction(client, async (transaction) => {
    const employeeCodeEntryIds = await resolveEmployeeCodeEntryIds(transaction, batch.id, query);
    const legacyRank = buildSearchRank(query, employeeCodeEntryIds);
    const [legacyRows] = (await transaction.execute(sql`
      SELECT ${directoryEntries.id} AS id, ${legacyRank} AS searchRank
      FROM ${directoryEntries}
      INNER JOIN ${directoryCampuses}
        ON ${directoryCampuses.id} = ${directoryEntries.campusId}
      WHERE ${directoryEntries.batchId} = ${batch.id}
        AND ${directoryEntries.visibility} = 'member'
        AND ${legacyRank} > 0
      ORDER BY ${legacyRank} DESC,
               ${directoryCampuses.displayOrder} ASC,
               ${directoryEntries.displayOrder} ASC,
               ${directoryEntries.id} ASC
    `)) as unknown as [readonly { id: string; searchRank: number | string }[], unknown];
    const candidates = buildCandidateSearch(batch.id, query, false, employeeCodeEntryIds);
    const candidateRank = sql<number>`candidate_rank.search_rank`;
    const [candidateRows] = (await transaction.execute(sql`
      SELECT ${directoryEntries.id} AS id, ${candidateRank} AS searchRank
      FROM (${candidates}) AS candidate_rank
      INNER JOIN ${directoryEntries}
        ON ${directoryEntries.id} = candidate_rank.entry_id
      INNER JOIN ${directoryCampuses}
        ON ${directoryCampuses.id} = ${directoryEntries.campusId}
      WHERE ${directoryEntries.batchId} = ${batch.id}
        AND ${directoryEntries.visibility} = 'member'
        AND ${candidateRank} > 0
      ORDER BY ${candidateRank} DESC,
               ${directoryCampuses.displayOrder} ASC,
               ${directoryEntries.displayOrder} ASC,
               ${directoryEntries.id} ASC
    `)) as unknown as [readonly { id: string; searchRank: number | string }[], unknown];
    const normalize = (rows: readonly { id: string; searchRank: number | string }[]) =>
      rows.map((row) => ({ id: row.id, rank: Number(row.searchRank) }));
    return { candidate: normalize(candidateRows), legacy: normalize(legacyRows) };
  });
}

function usesCandidateRankPath(query: string): boolean {
  const parameters = new URLSearchParams(query);
  const search = parameters.get('q')?.trim();
  if (search === undefined || [...search].length <= 1) return false;
  return !['building', 'campusCode', 'department', 'entryKind', 'floor', 'section', 'subunit'].some(
    (key) => parameters.has(key),
  );
}

async function seedDirectoryFixture(client: DatabaseClient): Promise<string> {
  const groupId = randomUUID();
  const users: readonly SeedUser[] = [
    { id: randomUUID(), membershipRole: 'owner', uid: 'directory-owner' },
    { id: randomUUID(), membershipRole: 'member', uid: 'directory-member' },
    {
      id: randomUUID(),
      membershipRole: 'administrator',
      uid: 'directory-administrator',
    },
    { id: randomUUID(), membershipRole: 'guest', uid: 'directory-guest' },
    { id: randomUUID(), uid: 'directory-outsider' },
    {
      id: randomUUID(),
      membershipRole: 'administrator',
      uid: 'directory-developer',
    },
  ];

  for (const user of users) {
    await client.database.execute(sql`
      INSERT INTO users (id, cloudbase_uid, is_developer_admin)
      VALUES (${user.id}, ${user.uid}, ${user.uid === 'directory-developer' ? 1 : 0})
    `);
    await client.database.execute(sql`
      INSERT INTO user_profiles (user_id, real_name)
      VALUES (${user.id}, ${user.uid})
    `);
  }

  const owner = users[0]!;
  await client.database.execute(sql`
    INSERT INTO \`groups\` (id, name, group_code, owner_user_id, visitor_key)
    VALUES (${groupId}, 'Directory Group', '2468', ${owner.id}, ${'b'.repeat(32)})
  `);
  for (const user of users) {
    if (user.membershipRole === undefined) continue;
    await client.database.execute(sql`
      INSERT INTO group_memberships (id, group_id, user_id, role)
      VALUES (${randomUUID()}, ${groupId}, ${user.id}, ${user.membershipRole})
    `);
  }

  const centralCampusId = randomUUID();
  const northCampusId = randomUUID();
  const batchId = randomUUID();
  await client.database.execute(sql`
    INSERT INTO directory_campuses (id, code, name, display_order)
    VALUES
      (${centralCampusId}, 'central', '中心院区', 10),
      (${northCampusId}, 'north', '北院区', 20)
  `);
  await client.database.execute(sql`
    INSERT INTO directory_import_batches
      (id, import_version, schema_version, status, effective_on, manifest_sha256,
       source_document_count, entry_count, contact_method_count, warning_count,
       diff_summary, warning_summary, published_at)
    VALUES
      (${batchId}, 'directory-route-test', 1, 'published', '2026-05-12', ${'c'.repeat(64)},
       2, 4, 4, 0, JSON_OBJECT('added', 4), JSON_OBJECT(), CURRENT_TIMESTAMP(3))
  `);

  const centralDocumentId = randomUUID();
  const northDocumentId = randomUUID();
  await client.database.execute(sql`
    INSERT INTO directory_source_documents
      (id, batch_id, campus_id, document_key, title, source_sha256,
       effective_on, page_count, display_order)
    VALUES
      (${centralDocumentId}, ${batchId}, ${centralCampusId}, 'central-doc', '中心通讯录', ${'d'.repeat(64)}, '2026-05-12', 1, 10),
      (${northDocumentId}, ${batchId}, ${northCampusId}, 'north-doc', '北院通讯录', ${'e'.repeat(64)}, '2026-05-12', 1, 20)
  `);

  const entries = [
    {
      aliases: ['急诊科', '急诊分诊台', 'jizhenke', 'jzk'],
      building: '门诊楼',
      campusId: centralCampusId,
      contactName: '急诊分诊台',
      department: '急诊科',
      documentId: centralDocumentId,
      employeeCode: 'D0468',
      entryKind: 'service',
      extension: '1234',
      floor: '3楼',
      fullNumber: '0000-00000001',
      id: randomUUID(),
      order: 10,
      section: '临床服务',
      type: 'voice',
      visibility: 'member',
    },
    {
      aliases: ['急诊科', '值班医生', 'jizhenke', 'jzk'],
      building: '门诊楼',
      campusId: centralCampusId,
      contactName: '值班医生',
      department: '急诊科',
      documentId: centralDocumentId,
      employeeCode: 'A0468',
      entryKind: 'person',
      extension: '5678',
      floor: '3楼',
      fullNumber: '0000-00000002',
      id: randomUUID(),
      order: 20,
      section: '临床服务',
      type: 'mobile',
      visibility: 'member',
    },
    {
      aliases: ['检验科', 'jianyan', 'jyk'],
      building: '医技楼',
      campusId: northCampusId,
      contactName: '检验窗口',
      department: '检验科',
      documentId: northDocumentId,
      employeeCode: undefined,
      entryKind: 'department',
      extension: '468',
      floor: '2楼',
      fullNumber: '0000-00000003',
      id: randomUUID(),
      order: 30,
      section: '医技服务',
      type: 'voice',
      visibility: 'member',
    },
    {
      aliases: ['保卫处应急专线'],
      building: '行政楼',
      campusId: centralCampusId,
      contactName: '保卫处应急专线',
      department: '保卫处',
      documentId: centralDocumentId,
      employeeCode: undefined,
      entryKind: 'emergency',
      extension: '9999',
      floor: '1楼',
      fullNumber: '0000-00000004',
      id: randomUUID(),
      order: 40,
      section: '行政服务',
      type: 'emergency',
      visibility: 'administrator',
    },
  ] as const;

  for (const entry of entries) {
    await client.database.execute(sql`
      INSERT INTO directory_entries
        (id, batch_id, source_document_id, campus_id, entry_key, source_page,
         source_locator, section_name, department_name, contact_name, employee_code, building_name,
         floor_name, entry_kind, visibility, display_order, search_text, content_sha256)
      VALUES
        (${entry.id}, ${batchId}, ${entry.documentId}, ${entry.campusId}, ${`entry-${entry.order}`}, 1,
         ${`row-${entry.order}`}, ${entry.section}, ${entry.department}, ${entry.contactName},
         ${entry.employeeCode ?? null},
         ${entry.building}, ${entry.floor}, ${entry.entryKind}, ${entry.visibility}, ${entry.order},
         ${entry.aliases.slice(0, 2).join(' ')}, ${entry.order.toString().padStart(64, '0')})
    `);
    await client.database.execute(sql`
      INSERT INTO directory_contact_methods
        (id, entry_id, type, full_number, internal_extension, normalized_full_number,
         normalized_internal_extension, contact_sha256, is_primary, display_order)
      VALUES
        (${randomUUID()}, ${entry.id}, ${entry.type}, ${entry.fullNumber}, ${entry.extension},
         ${entry.fullNumber.replaceAll(/\D/gu, '')}, ${entry.extension},
         ${`contact-${entry.order}`.padEnd(64, '0')}, 1, 10)
    `);
    for (const [index, alias] of entry.aliases.entries()) {
      const type = index < 2 ? 'source' : alias.length <= 3 ? 'pinyin_initials' : 'pinyin_compact';
      await client.database.execute(sql`
        INSERT INTO directory_search_aliases
          (id, entry_id, type, alias_value, normalized_value, alias_sha256)
        VALUES
          (${randomUUID()}, ${entry.id}, ${type}, ${alias}, ${alias},
           ${`alias-${entry.order}-${index}`.padEnd(64, '0')})
      `);
    }
    if (entry.employeeCode !== undefined) {
      await client.database.execute(sql`
        INSERT INTO directory_search_aliases
          (id, entry_id, type, alias_value, normalized_value, alias_sha256)
        VALUES
          (${randomUUID()}, ${entry.id}, 'source', ${entry.employeeCode},
           ${entry.employeeCode.toLowerCase()},
           ${`employee-alias-${entry.order}`.padEnd(64, '0')})
      `);
    }
  }

  return groupId;
}

async function replacePublishedDirectorySnapshot(
  client: DatabaseClient,
  seed: number,
): Promise<void> {
  const [campusRows] = (await client.database.execute(sql`
    SELECT id FROM directory_campuses WHERE code = 'central' LIMIT 1
  `)) as unknown as [readonly { id: string }[], unknown];
  const campusId = campusRows[0]?.id;
  if (campusId === undefined) throw new Error('Differential campus fixture is missing.');

  await client.database.execute(sql`
    UPDATE directory_import_batches
    SET status = 'superseded', superseded_at = CURRENT_TIMESTAMP(3)
    WHERE directory_kind = 'internal' AND status = 'published'
  `);
  const batchId = deterministicUuid(seed, 'batch', 0);
  const documentId = deterministicUuid(seed, 'document', 0);
  await client.database.execute(sql`
    INSERT INTO directory_import_batches
      (id, import_version, schema_version, status, effective_on, manifest_sha256,
       source_document_count, entry_count, contact_method_count, warning_count,
       diff_summary, warning_summary, published_at)
    VALUES
      (${batchId}, ${`directory-differential-${seed}`}, 1, 'published', '2026-09-02',
       ${sha256(`manifest:${seed}`)}, 1, 7, 7, 0,
       JSON_OBJECT('seed', ${seed}), JSON_OBJECT(), CURRENT_TIMESTAMP(3))
  `);
  await client.database.execute(sql`
    INSERT INTO directory_source_documents
      (id, batch_id, campus_id, document_key, title, source_sha256,
       effective_on, page_count, display_order)
    VALUES
      (${documentId}, ${batchId}, ${campusId}, ${`seed-${seed}`}, '差分通讯录',
       ${sha256(`document:${seed}`)}, '2026-09-02', 1, 10)
  `);

  const specialAliases = [
    `CASEALIAS-${seed}`,
    `混合Mixed-${seed}`,
    `ＡＢＣ-${seed}`,
    `space value ${seed}`,
    `literal%${seed}`,
    `literal_${seed}`,
    `slash\\${seed}`,
    `quote'${seed}`,
    `Å${seed}`,
    `İ${seed}`,
  ];
  for (let index = 0; index < 7; index += 1) {
    const entryId = deterministicUuid(seed, 'entry', index);
    const employeeCode = `D${String(seed).padStart(2, '0')}${String(index).padStart(3, '0')}`;
    const phone = differentialPhone(seed, index);
    const aliases: Array<{ normalized: string; type: string; value: string }> = [
      { normalized: normalizeFixtureAlias(`测试${seed}`), type: 'source', value: `测试${seed}` },
      {
        normalized: normalizeFixtureAlias(`shared-${seed}`),
        type: 'source',
        value: `shared-${seed}`,
      },
      {
        normalized: normalizeFixtureAlias(`seedfull${seed}${index}`),
        type: 'pinyin_full',
        value: `seedfull${seed}${index}`,
      },
      {
        normalized: normalizeFixtureAlias(`seedcompact${seed}${index}`),
        type: 'pinyin_compact',
        value: `seedcompact${seed}${index}`,
      },
      { normalized: normalizeFixtureAlias(`s${seed}`), type: 'pinyin_initials', value: `s${seed}` },
      { normalized: employeeCode.toLowerCase(), type: 'source', value: employeeCode },
    ];
    if (index < 5) {
      aliases.push({
        normalized: normalizeFixtureAlias(`exact-page-${seed}`),
        type: 'manual',
        value: `exact-page-${seed}`,
      });
    }
    if (index < 6) {
      aliases.push({
        normalized: normalizeFixtureAlias(`over-page-${seed}`),
        type: 'manual',
        value: `over-page-${seed}`,
      });
    }
    if (index === 0) {
      aliases.push(
        {
          normalized: normalizeFixtureAlias(`shared-${seed}`),
          type: 'manual',
          value: `shared-${seed}`,
        },
        ...specialAliases.map((value) => ({
          normalized: normalizeFixtureAlias(value),
          type: 'manual',
          value,
        })),
      );
    }

    await client.database.execute(sql`
      INSERT INTO directory_entries
        (id, batch_id, source_document_id, campus_id, entry_key, source_page,
         source_locator, section_name, department_name, contact_name, employee_code,
         entry_kind, visibility, display_order, search_text, content_sha256)
      VALUES
        (${entryId}, ${batchId}, ${documentId}, ${campusId}, ${`seed-${seed}-entry-${index}`}, 1,
         ${`row-${index}`}, '差分一级', '差分科室', ${`测试人员${seed}-${index}`},
         ${employeeCode}, 'person', ${index === 6 ? 'administrator' : 'member'},
         ${index < 3 ? 10 : index * 10}, ${aliases.map((alias) => alias.value).join(' ')},
         ${sha256(`entry:${seed}:${index}`)})
    `);
    await client.database.execute(sql`
      INSERT INTO directory_contact_methods
        (id, entry_id, type, full_number, normalized_full_number, contact_sha256,
         is_primary, display_order)
      VALUES
        (${deterministicUuid(seed, 'contact', index)}, ${entryId}, 'mobile', ${phone}, ${phone},
         ${sha256(`contact:${seed}:${index}`)}, 1, 10)
    `);
    for (const [aliasIndex, alias] of aliases.entries()) {
      await client.database.execute(sql`
        INSERT INTO directory_search_aliases
          (id, entry_id, type, alias_value, normalized_value, alias_sha256)
        VALUES
          (${deterministicUuid(seed, `alias-${index}`, aliasIndex)}, ${entryId},
           ${alias.type}, ${alias.value}, ${alias.normalized},
           ${sha256(`alias:${seed}:${index}:${aliasIndex}`)})
      `);
    }
  }
}

function buildDifferentialQueries(seed: number): readonly string[] {
  const employeeCode = `D${String(seed).padStart(2, '0')}000`;
  const queryValues = [
    `测试${seed}`,
    `shared-${seed}`,
    `seedfull${seed}0`,
    `seedfu`,
    `s${seed}`,
    employeeCode,
    employeeCode.slice(1),
    differentialPhone(seed, 0),
    'not-present',
    's',
    `CASEALIAS-${seed}`,
    `混合Mixed-${seed}`,
    `ＡＢＣ-${seed}`,
    `  space   value  ${seed}  `,
    `literal%${seed}`,
    `literal_${seed}`,
    `slash\\${seed}`,
    `quote'${seed}`,
    `Å${seed}`,
    `İ${seed}`,
    'x'.repeat(100),
  ];
  return [
    ...queryValues.map((q) => new URLSearchParams({ pageSize: '1', q }).toString()),
    new URLSearchParams({ pageSize: '5', q: `exact-page-${seed}` }).toString(),
    new URLSearchParams({ pageSize: '5', q: `over-page-${seed}` }).toString(),
    new URLSearchParams({
      campusCode: 'central',
      entryKind: 'person',
      pageSize: '2',
      q: `shared-${seed}`,
    }).toString(),
    new URLSearchParams({ pageSize: '3' }).toString(),
    new URLSearchParams({ pageSize: '100', q: `shared-${seed}` }).toString(),
  ];
}

interface DirectoryReadSnapshot {
  readonly code?: string | undefined;
  readonly pages?: readonly unknown[] | undefined;
  readonly statusCode: number;
}

async function readAllDirectoryPages(
  targetApp: ReturnType<typeof createApp>,
  targetGroupId: string,
  token: string,
  query: string,
): Promise<DirectoryReadSnapshot> {
  const pages: unknown[] = [];
  let cursor: string | undefined;
  for (let pageIndex = 0; pageIndex < 50; pageIndex += 1) {
    const response = await targetApp.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url:
        `/groups/${targetGroupId}/directory?${query}` +
        (cursor === undefined ? '' : `&cursor=${encodeURIComponent(cursor)}`),
    });
    if (response.statusCode !== 200) {
      const error = response.json<{ code?: string }>();
      return { code: error.code, statusCode: response.statusCode };
    }
    const page = response.json<{ nextCursor?: string }>();
    pages.push(page);
    cursor = page.nextCursor;
    if (cursor === undefined) return { pages, statusCode: 200 };
  }
  throw new Error('Differential pagination did not terminate.');
}

function differentialPhone(seed: number, index: number): string {
  return `70${String(seed).padStart(3, '0')}${String(index).padStart(6, '0')}`;
}

function normalizeFixtureAlias(value: string): string {
  return value.normalize('NFKC').trim().toLowerCase().replaceAll(/\s+/gu, ' ');
}

function deterministicUuid(seed: number, namespace: string, index: number): string {
  const hex = sha256(`${seed}:${namespace}:${index}`).slice(0, 32).split('');
  hex[12] = '4';
  hex[16] = '8';
  const value = hex.join('');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

async function resetDatabase(client: DatabaseClient): Promise<void> {
  await client.database.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
  const [tables] = (await client.database.execute(
    sql`SELECT TABLE_NAME AS tableName FROM information_schema.tables WHERE table_schema = DATABASE()`,
  )) as unknown as [readonly { tableName: string }[], unknown];
  for (const row of tables) {
    await client.database.execute(
      sql.raw(`DROP TABLE IF EXISTS \`${row.tableName.replaceAll('`', '``')}\``),
    );
  }
  await client.database.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
}

function createFakeAuthPort(tokens: Readonly<Record<string, string>>): AuthPort {
  return {
    authenticate: async ({ authorization }) => {
      const token = authorization?.replace(/^Bearer\s+/iu, '');
      const cloudbaseUid = token === undefined ? undefined : tokens[token];
      return cloudbaseUid === undefined ? undefined : { cloudbaseUid };
    },
  };
}

function getTestDatabaseOptions(): DatabaseConnectionOptions | undefined {
  if (process.env.NODE_ENV !== 'test') return undefined;
  const user = process.env.TEST_MYSQL_USER;
  const password = process.env.TEST_MYSQL_PASSWORD;
  const database = process.env.TEST_MYSQL_DATABASE;
  const port = Number(process.env.TEST_MYSQL_PORT ?? '3307');
  if (
    user === undefined ||
    password === undefined ||
    database === undefined ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65_535
  ) {
    return undefined;
  }
  return {
    database,
    host: process.env.TEST_MYSQL_HOST ?? '127.0.0.1',
    password,
    port,
    user,
  };
}
