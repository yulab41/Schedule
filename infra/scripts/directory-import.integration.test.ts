import { fileURLToPath } from 'node:url';

import {
  auditLogs,
  createTestDatabaseClient,
  directoryImportBatches,
  migrateDatabase,
  type DatabaseClient,
  type DatabaseConnectionOptions,
} from '@schedule/database';
import { eq, sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  activateDirectorySnapshot,
  previewDirectorySnapshot,
  publishDirectorySnapshot,
  validateDirectoryManifest,
} from './directory-import-core.js';

const migrationsDirectory = fileURLToPath(new URL('../../migrations', import.meta.url));
const databaseOptions = getTestDatabaseOptions();
const describeWithDatabase = databaseOptions === undefined ? describe.skip : describe;

describeWithDatabase('directory snapshot import', () => {
  let client: DatabaseClient;

  beforeEach(async () => {
    client = createTestDatabaseClient(databaseOptions as DatabaseConnectionOptions);
    await resetDatabase(client);
    await migrateDatabase(client, migrationsDirectory);
  });

  afterEach(async () => {
    await client.close();
  });

  it('publishes immutable snapshots, records safe audit metadata, and activates a rollback', async () => {
    const firstManifest = validateDirectoryManifest(createManifest('snapshot-1', '1000'));
    const first = await publishDirectorySnapshot(client, firstManifest, 'a'.repeat(64));

    expect(first.summary).toMatchObject({ added: 1, changed: 0, removed: 0 });
    await expectCounts(client, { batches: 1, contacts: 1, entries: 1 });
    const [preparedSearchRows] = await client.database.execute<{ matchKind: string }>(sql`
      SELECT 'number-prefix' AS matchKind
      FROM directory_contact_methods
      WHERE normalized_internal_extension LIKE '100%'
      UNION ALL
      SELECT 'pinyin-prefix' AS matchKind
      FROM directory_search_aliases
      WHERE normalized_value LIKE 'cszx%'
      UNION ALL
      SELECT 't9-prefix' AS matchKind
      FROM directory_search_aliases
      WHERE type = 't9' AND normalized_value LIKE '279%'
      UNION ALL
      SELECT 'chinese-ngram' AS matchKind
      FROM directory_entries
      WHERE MATCH(search_text) AGAINST ('测试' IN BOOLEAN MODE)
      UNION ALL
      SELECT 'employee-code' AS matchKind
      FROM directory_search_aliases
      WHERE normalized_value = 'd0001'
    `);
    expect(preparedSearchRows.map((row) => row.matchKind)).toEqual(
      expect.arrayContaining(['number-prefix', 'pinyin-prefix', 'chinese-ngram', 'employee-code']),
    );
    expect(preparedSearchRows.map((row) => row.matchKind)).not.toContain('t9-prefix');

    const secondManifest = validateDirectoryManifest(createManifest('snapshot-2', '1001'));
    const second = await publishDirectorySnapshot(client, secondManifest, 'b'.repeat(64));
    expect(second.summary).toMatchObject({ added: 0, changed: 1, removed: 0 });

    const batchesAfterSecond = await client.database
      .select({ id: directoryImportBatches.id, status: directoryImportBatches.status })
      .from(directoryImportBatches);
    expect(batchesAfterSecond).toEqual(
      expect.arrayContaining([
        { id: first.batchId, status: 'superseded' },
        { id: second.batchId, status: 'published' },
      ]),
    );

    const auditRows = await client.database
      .select({ action: auditLogs.action, metadata: auditLogs.metadata })
      .from(auditLogs)
      .where(eq(auditLogs.action, 'directory_snapshot_published'));
    expect(auditRows).toHaveLength(2);
    expect(JSON.stringify(auditRows)).not.toContain('0754');
    expect(JSON.stringify(auditRows)).not.toContain('1000');
    expect(JSON.stringify(auditRows)).not.toContain('1001');

    const activation = await activateDirectorySnapshot(client, first.batchId);
    expect(activation).toEqual({
      activatedBatchId: first.batchId,
      replacedBatchId: second.batchId,
    });

    const batchesAfterActivation = await client.database
      .select({ id: directoryImportBatches.id, status: directoryImportBatches.status })
      .from(directoryImportBatches);
    expect(batchesAfterActivation).toEqual(
      expect.arrayContaining([
        { id: first.batchId, status: 'published' },
        { id: second.batchId, status: 'superseded' },
      ]),
    );
  });

  it('keeps employee and hospital snapshots published independently', async () => {
    const hospital = await publishDirectorySnapshot(
      client,
      validateDirectoryManifest(createManifest('hospital-1', '1000')),
      'd'.repeat(64),
    );
    const employeeManifest = validateDirectoryManifest({
      ...createManifest('employee-1', '2000'),
      directoryKind: 'employee',
    });
    const employee = await publishDirectorySnapshot(client, employeeManifest, 'e'.repeat(64));

    expect(employee.replacedBatchId).toBeNull();
    const published = await client.database
      .select({ directoryKind: directoryImportBatches.directoryKind })
      .from(directoryImportBatches)
      .where(eq(directoryImportBatches.status, 'published'));
    expect(published.map((row) => row.directoryKind).sort()).toEqual(['employee', 'internal']);
    expect(hospital.batchId).not.toBe(employee.batchId);
  });

  it('publishes a searchable employee entry with no contact rows', async () => {
    const base = createManifest('employee-without-phone', '1000');
    const baseEntry = Array.isArray(base.entries) ? base.entries[0] : undefined;
    const manifest = validateDirectoryManifest({
      ...base,
      directoryKind: 'employee',
      entries: [
        {
          ...baseEntry,
          entryKind: 'person',
          contactName: '测试职工',
          department: '手术室',
          contacts: [],
        },
      ],
    });
    const result = await publishDirectorySnapshot(client, manifest, 'f'.repeat(64));

    expect(result.summary).toMatchObject({ added: 1, contacts: 0, entries: 1 });
    await expectCounts(client, { batches: 1, contacts: 0, entries: 1 });
    const [matches] = await client.database.execute<{ employeeCode: string }>(sql`
      SELECT entry.employee_code AS employeeCode
      FROM directory_entries AS entry
      JOIN directory_search_aliases AS alias ON alias.entry_id = entry.id
      WHERE alias.normalized_value = 'd0001' AND entry.department_name = '手术室'
    `);
    expect(matches).toEqual([{ employeeCode: 'd0001' }]);
  });

  it('appends without rewriting historical employee aliases or accepting edits', async () => {
    const oldRaw: Record<string, unknown> = {
      ...createManifest('employee-legacy', '1000'),
      directoryKind: 'employee',
    };
    const current = validateDirectoryManifest(oldRaw, { appendOnly: true });
    const originalEntry = current.entries[0];
    if (originalEntry?.legacyEmployeeAliases === undefined) {
      throw new Error('Missing legacy aliases in fixture.');
    }
    const historical = {
      ...current,
      entries: [{ ...originalEntry, ...originalEntry.legacyEmployeeAliases }],
    };
    const prior = await publishDirectorySnapshot(client, historical, '8'.repeat(64));
    const firstRaw = Array.isArray(oldRaw.entries) ? oldRaw.entries[0] : undefined;
    const added = {
      ...firstRaw,
      contactName: '无号测试职工',
      department: '手术室',
      entryKey: 'synthetic-campus:new-employee',
      entryKind: 'person',
      employeeCode: 'j0644',
      sourceLocator: 'table:r2:c1',
      contacts: [],
    };
    const nextRaw = { ...oldRaw, importVersion: 'employee-append', entries: [firstRaw, added] };
    const updated = validateDirectoryManifest(nextRaw, { appendOnly: true });
    const unsafe = validateDirectoryManifest(
      { ...nextRaw, entries: [{ ...firstRaw, department: '不可修改的旧科室' }, added] },
      { appendOnly: true },
    );
    await expect(
      publishDirectorySnapshot(client, unsafe, '9'.repeat(64), { appendOnly: true }),
    ).rejects.toThrow('Append-only');
    await expectCounts(client, { batches: 1, contacts: 1, entries: 1 });

    const preview = await previewDirectorySnapshot(client, updated, { appendOnly: true });
    expect(preview.summary).toMatchObject({ added: 1, changed: 0, removed: 0, unchanged: 1 });
    const published = await publishDirectorySnapshot(client, updated, '9'.repeat(64), {
      appendOnly: true,
    });
    expect(published.summary).toEqual(preview.summary);
    expect(published.replacedBatchId).toBe(prior.batchId);
    const [rows] = await client.database.execute<{ employeeCode: string; alias: string }>(sql`
      SELECT entry.employee_code AS employeeCode, alias.normalized_value AS alias
      FROM directory_entries AS entry
      JOIN directory_search_aliases AS alias ON alias.entry_id = entry.id
      WHERE entry.batch_id = ${published.batchId} AND alias.normalized_value IN ('1', '644')
    `);
    expect(rows).toEqual([{ employeeCode: 'j0644', alias: '644' }]);
  });

  it('rolls back every snapshot row when publication fails', async () => {
    const manifest = validateDirectoryManifest(createManifest('snapshot-failure', '1000'));

    await expect(
      publishDirectorySnapshot(client, manifest, 'c'.repeat(64), {
        beforeCommit: async () => {
          throw new Error('synthetic publication failure');
        },
      }),
    ).rejects.toThrow('synthetic publication failure');

    await expectCounts(client, { batches: 0, contacts: 0, entries: 0 });
  });
});

function createManifest(importVersion: string, extension: string): Record<string, unknown> {
  return {
    schemaVersion: 1,
    importVersion,
    effectiveOn: '2026-05-12',
    campuses: [{ code: 'synthetic-campus', name: '测试院区', displayOrder: 10 }],
    documents: [
      {
        documentKey: 'synthetic-directory',
        campusCode: 'synthetic-campus',
        title: '合成通讯录',
        sha256: 'd'.repeat(64),
        effectiveOn: '2026-05-12',
        pageCount: 1,
        displayOrder: 10,
      },
    ],
    entries: [
      {
        entryKey: 'synthetic-campus:test-center:switchboard',
        sourceDocumentKey: 'synthetic-directory',
        sourcePage: 1,
        sourceLocator: 'table:r1:c1',
        campusCode: 'synthetic-campus',
        department: '测试中心',
        contactName: '测试总机',
        employeeCode: 'd0001',
        entryKind: 'switchboard',
        visibility: 'member',
        verificationStatus: 'source_exact',
        displayOrder: 10,
        contacts: [
          {
            type: 'voice',
            fullNumber: '0754-00000000',
            internalExtension: extension,
            isPrimary: true,
            displayOrder: 10,
          },
        ],
      },
    ],
  };
}

async function expectCounts(
  client: DatabaseClient,
  expected: { readonly batches: number; readonly contacts: number; readonly entries: number },
): Promise<void> {
  const [rows] = await client.database.execute<{
    batches: number;
    contacts: number;
    entries: number;
  }>(sql`
    SELECT
      (SELECT COUNT(*) FROM directory_import_batches) AS batches,
      (SELECT COUNT(*) FROM directory_entries) AS entries,
      (SELECT COUNT(*) FROM directory_contact_methods) AS contacts
  `);
  expect(rows).toEqual([expected]);
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

function getTestDatabaseOptions(): DatabaseConnectionOptions | undefined {
  const user = process.env.TEST_MYSQL_USER;
  const password = process.env.TEST_MYSQL_PASSWORD;
  const database = process.env.TEST_MYSQL_DATABASE;
  const port = Number(process.env.TEST_MYSQL_PORT ?? '3306');
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
