import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import {
  createTestDatabaseClient,
  migrateDatabase,
  type DatabaseClient,
  type DatabaseConnectionOptions,
} from '@schedule/database';
import { sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AuthPort } from '../../adapters/auth/auth-port.js';
import { createApp } from '../../app.js';

const migrationsDirectory = fileURLToPath(new URL('../../../../../migrations', import.meta.url));
const databaseOptions = getTestDatabaseOptions();
const describeWithDatabase = databaseOptions === undefined ? describe.skip : describe;

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
      authPort: createFakeAuthPort({
        'administrator-token': 'directory-administrator',
        'developer-token': 'directory-developer',
        'guest-token': 'directory-guest',
        'member-token': 'directory-member',
        'outsider-token': 'directory-outsider',
      }),
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

  it('searches Chinese, pinyin initials, exact numbers, and number prefixes with stable cursor pages', async () => {
    const chinese = await getDirectory('member-token', 'q=%E6%80%A5%E8%AF%8A');
    expect(chinese.totalCount).toBe(2);

    const pinyin = await getDirectory('member-token', 'q=jzk');
    expect(pinyin.totalCount).toBe(2);

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

  async function getDirectory(
    token: string,
    query: string,
  ): Promise<{
    entries: { contactName?: string; department?: string; id: string }[];
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
      entryKind: 'department',
      extension: '2468',
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
         source_locator, section_name, department_name, contact_name, building_name,
         floor_name, entry_kind, visibility, display_order, search_text, content_sha256)
      VALUES
        (${entry.id}, ${batchId}, ${entry.documentId}, ${entry.campusId}, ${`entry-${entry.order}`}, 1,
         ${`row-${entry.order}`}, ${entry.section}, ${entry.department}, ${entry.contactName},
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
  }

  return groupId;
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
