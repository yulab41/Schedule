import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { groups, visitorAccessLogs, visitorAccessMonthlyAggregates } from '../src/index.js';
import { getTableConfig } from 'drizzle-orm/mysql-core';
import { describe, expect, it } from 'vitest';

const migrationUrl = new URL(
  '../../../migrations/0050_visitor_access_retention.sql',
  import.meta.url,
);
const journalUrl = new URL('../../../migrations/meta/_journal.json', import.meta.url);
const schemaUrl = new URL('../src/schema/index.ts', import.meta.url);

describe('visitor access retention schema', () => {
  it('adds the anonymous monthly aggregate, global expiry index, and migration journal entry', async () => {
    const [migration, journal, schema] = await Promise.all([
      readFile(fileURLToPath(migrationUrl), 'utf8'),
      readFile(fileURLToPath(journalUrl), 'utf8'),
      readFile(fileURLToPath(schemaUrl), 'utf8'),
    ]);

    expect(journal).toContain('0050_visitor_access_retention');
    expect(migration).toContain('CREATE TABLE `visitor_access_monthly_aggregates`');
    expect(migration).toContain('visitor_access_logs_created_idx');
    expect(migration).toContain('PRIMARY KEY (`group_id`, `access_month`, `business_month`)');
    expect(migration).toContain('BIGINT UNSIGNED NOT NULL');
    expect(migration).not.toMatch(/client_ip|request_id|first_access|last_access/iu);
    expect(schema).toContain('.references(() => groups.id)');
  });

  it('models both visitor tables as group children and the raw expiry index in Drizzle', () => {
    const raw = getTableConfig(visitorAccessLogs);
    const aggregate = getTableConfig(visitorAccessMonthlyAggregates);
    const groupTableName = getTableConfig(groups).name;

    expect(raw.foreignKeys.map((key) => getTableConfig(key.reference().foreignTable).name)).toEqual(
      [groupTableName],
    );
    expect(raw.indexes.map((index) => index.config.name)).toContain(
      'visitor_access_logs_created_idx',
    );
    expect(
      aggregate.foreignKeys.map((key) => getTableConfig(key.reference().foreignTable).name),
    ).toEqual([groupTableName]);
    expect(aggregate.primaryKeys).toHaveLength(1);
  });
});
