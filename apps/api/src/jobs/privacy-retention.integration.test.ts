import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import {
  createTestDatabaseClient,
  migrateDatabase,
  type DatabaseClient,
  type DatabaseConnectionOptions,
} from '@schedule/database';
import { resetDatabase } from '@schedule/test-fixtures';
import { sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PrivacyRetentionJob } from './privacy-retention.js';

const migrationsDirectory = fileURLToPath(new URL('../../../../migrations', import.meta.url));
const databaseOptions = getTestDatabaseOptions();
const describeWithDatabase = databaseOptions === undefined ? describe.skip : describe;
const now = new Date('2026-05-01T16:00:00.000Z');
const cutoff = new Date('2026-01-31T16:00:00.000Z');

describeWithDatabase('privacy retention transaction', () => {
  let client: DatabaseClient;
  let firstGroupId: string;
  let secondGroupId: string;

  beforeEach(async () => {
    client = createTestDatabaseClient(databaseOptions as DatabaseConnectionOptions);
    await resetDatabase(client);
    await migrateDatabase(client, migrationsDirectory);
    firstGroupId = await createGroup(client, 'Retention A', '7101');
    secondGroupId = await createGroup(client, 'Retention B', '7102');
  });

  afterEach(async () => {
    await client.close();
  });

  it('aggregates only pre-cutoff rows in China months and is idempotent on rerun', async () => {
    const expiredIds = [randomUUID(), randomUUID(), randomUUID()];
    await insertAccess(client, {
      businessMonth: '2026-08',
      createdAt: new Date(cutoff.valueOf() - 1),
      groupId: firstGroupId,
      id: expiredIds[0] as string,
      ip: '203.0.113.7',
    });
    await insertAccess(client, {
      businessMonth: '2026-09',
      createdAt: new Date('2026-01-30T16:00:00.000Z'),
      groupId: firstGroupId,
      id: expiredIds[1] as string,
      ip: '2001:db8::1',
    });
    await insertAccess(client, {
      businessMonth: '2026-08',
      createdAt: new Date('2026-01-30T15:00:00.000Z'),
      groupId: secondGroupId,
      id: expiredIds[2] as string,
      ip: '198.51.100.2',
    });
    const boundaryId = randomUUID();
    await insertAccess(client, {
      businessMonth: '2026-08',
      createdAt: cutoff,
      groupId: firstGroupId,
      id: boundaryId,
      ip: '198.51.100.3',
    });

    const job = new PrivacyRetentionJob(client, { batchSize: 2 });
    const first = await job.run(now);
    expect(first).toMatchObject({
      aggregateBuckets: 3,
      batches: 2,
      deletedRows: 3,
      remainingRows: 0,
    });

    const [rawRows] = (await client.database.execute(sql`
      SELECT id FROM visitor_access_logs ORDER BY id
    `)) as unknown as [readonly { id: string }[], unknown];
    expect(rawRows).toEqual([{ id: boundaryId }]);

    const aggregates = await readAggregates(client);
    const expectedAggregates = [
      { accessCount: '1', accessMonth: '2026-01', businessMonth: '2026-08', groupId: firstGroupId },
      { accessCount: '1', accessMonth: '2026-01', businessMonth: '2026-09', groupId: firstGroupId },
      {
        accessCount: '1',
        accessMonth: '2026-01',
        businessMonth: '2026-08',
        groupId: secondGroupId,
      },
    ].sort((left, right) =>
      `${left.groupId}|${left.accessMonth}|${left.businessMonth}`.localeCompare(
        `${right.groupId}|${right.accessMonth}|${right.businessMonth}`,
      ),
    );
    expect(aggregates).toEqual(expectedAggregates);

    const [auditRows] = (await client.database.execute(sql`
      SELECT metadata FROM audit_logs
      WHERE action = 'visitor_access_retention'
      ORDER BY group_id, occurred_at
    `)) as unknown as [readonly { metadata: unknown }[], unknown];
    const auditJson = JSON.stringify(auditRows);
    expect(auditRows).toHaveLength(3);
    expect(auditJson).not.toMatch(/203\.0\.113|2001:db8|198\.51\.100|request/u);
    for (const id of expiredIds) expect(auditJson).not.toContain(id);

    await expect(job.run(now)).resolves.toMatchObject({ deletedRows: 0, remainingRows: 0 });
    expect(await readAggregates(client)).toEqual(aggregates);
  });

  it('rolls aggregate, delete, and audit back together when the audit append fails', async () => {
    const id = randomUUID();
    await insertAccess(client, {
      businessMonth: '2026-08',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      groupId: firstGroupId,
      id,
      ip: '203.0.113.10',
    });
    const job = new PrivacyRetentionJob(client, {
      auditWriter: {
        async append() {
          throw new Error('audit unavailable');
        },
      },
    });

    await expect(job.run(now)).rejects.toThrow('audit unavailable');
    expect(await countRows(client, 'visitor_access_logs')).toBe(1);
    expect(await countRows(client, 'visitor_access_monthly_aggregates')).toBe(0);
  });

  it('commits bounded progress, reports backlog, and resumes without double counting', async () => {
    for (let index = 0; index < 2; index += 1) {
      await insertAccess(client, {
        businessMonth: '2026-08',
        createdAt: new Date(`2026-01-0${index + 1}T00:00:00.000Z`),
        groupId: firstGroupId,
        id: randomUUID(),
        ip: '203.0.113.11',
      });
    }
    await expect(
      new PrivacyRetentionJob(client, { batchSize: 1, maxBatches: 1 }).run(now),
    ).rejects.toThrow('backlog remains: 1');
    expect(await countRows(client, 'visitor_access_logs')).toBe(1);

    await expect(new PrivacyRetentionJob(client).run(now)).resolves.toMatchObject({
      deletedRows: 1,
      remainingRows: 0,
    });
    expect(await readAggregates(client)).toEqual([
      { accessCount: '2', accessMonth: '2026-01', businessMonth: '2026-08', groupId: firstGroupId },
    ]);
  });

  it('allows concurrent workers without duplicating anonymous counts', async () => {
    for (let index = 0; index < 20; index += 1) {
      await insertAccess(client, {
        businessMonth: '2026-10',
        createdAt: new Date(1_767_225_600_000 + index),
        groupId: firstGroupId,
        id: randomUUID(),
        ip: '198.51.100.20',
      });
    }

    await Promise.allSettled([
      new PrivacyRetentionJob(client, { batchSize: 2 }).run(now),
      new PrivacyRetentionJob(client, { batchSize: 2 }).run(now),
    ]);
    expect(await countRows(client, 'visitor_access_logs')).toBe(0);
    expect(await readAggregates(client)).toEqual([
      {
        accessCount: '20',
        accessMonth: '2026-01',
        businessMonth: '2026-10',
        groupId: firstGroupId,
      },
    ]);
  });

  it('deletes only telemetry strictly older than 30 days in bounded batches', async () => {
    const telemetryCutoff = new Date(now.valueOf() - 30 * 24 * 60 * 60 * 1000);
    const expiredIds = [randomUUID(), randomUUID(), randomUUID()];
    for (const [index, id] of expiredIds.entries()) {
      await insertTelemetry(client, id, new Date(telemetryCutoff.valueOf() - index - 1));
    }
    const boundaryId = randomUUID();
    await insertTelemetry(client, boundaryId, telemetryCutoff);

    await expect(
      new PrivacyRetentionJob(client, { batchSize: 1, maxBatches: 2 }).run(now),
    ).rejects.toThrow('client telemetry retention backlog remains: 1');
    expect(await readTelemetryIds(client)).toEqual([expiredIds[0], boundaryId].sort());

    await expect(new PrivacyRetentionJob(client).run(now)).resolves.toMatchObject({
      telemetryDeletedRows: 1,
      telemetryRemainingRows: 0,
    });
    expect(await readTelemetryIds(client)).toEqual([boundaryId]);
  });

  it('allows concurrent telemetry workers without double deletion', async () => {
    const telemetryCutoff = new Date(now.valueOf() - 30 * 24 * 60 * 60 * 1000);
    for (let index = 0; index < 20; index += 1) {
      await insertTelemetry(client, randomUUID(), new Date(telemetryCutoff.valueOf() - index - 1));
    }

    const results = await Promise.all([
      new PrivacyRetentionJob(client, { batchSize: 2 }).run(now),
      new PrivacyRetentionJob(client, { batchSize: 2 }).run(now),
    ]);
    expect(results.reduce((sum, result) => sum + result.telemetryDeletedRows, 0)).toBe(20);
    expect(await readTelemetryIds(client)).toEqual([]);
  });
});

async function createGroup(
  client: DatabaseClient,
  name: string,
  groupCode: string,
): Promise<string> {
  const userId = randomUUID();
  const groupId = randomUUID();
  await client.database.execute(sql`INSERT INTO users (id) VALUES (${userId})`);
  await client.database.execute(sql`
    INSERT INTO \`groups\` (id, name, group_code, visitor_key, owner_user_id)
    VALUES (${groupId}, ${name}, ${groupCode}, ${randomUUID().replaceAll('-', '')}, ${userId})
  `);
  return groupId;
}

async function insertAccess(
  client: DatabaseClient,
  input: {
    readonly businessMonth: string;
    readonly createdAt: Date;
    readonly groupId: string;
    readonly id: string;
    readonly ip: string;
  },
): Promise<void> {
  await client.database.execute(sql`
    INSERT INTO visitor_access_logs
      (id, group_id, business_month, client_ip, request_id, created_at)
    VALUES (
      ${input.id}, ${input.groupId}, ${input.businessMonth}, ${input.ip},
      ${randomUUID()}, ${input.createdAt}
    )
  `);
}

async function insertTelemetry(client: DatabaseClient, id: string, createdAt: Date): Promise<void> {
  await client.database.execute(sql`
    INSERT INTO miniprogram_telemetry_events
      (id, client_version, page, device_tier, error_code, network_type, created_at)
    VALUES (${id}, '0.1.0-p6.20260824.80', 'app', 'unknown', 'UNKNOWN', 'unknown', ${createdAt})
  `);
}

async function readTelemetryIds(client: DatabaseClient): Promise<readonly string[]> {
  const [rows] = (await client.database.execute(sql`
    SELECT id FROM miniprogram_telemetry_events ORDER BY id
  `)) as unknown as [readonly { id: string }[], unknown];
  return rows.map((row) => row.id);
}

async function readAggregates(client: DatabaseClient): Promise<
  readonly {
    accessCount: string;
    accessMonth: string;
    businessMonth: string;
    groupId: string;
  }[]
> {
  const [rows] = (await client.database.execute(sql`
    SELECT
      CAST(access_count AS CHAR) AS accessCount,
      access_month AS accessMonth,
      business_month AS businessMonth,
      group_id AS groupId
    FROM visitor_access_monthly_aggregates
    ORDER BY group_id, access_month, business_month
  `)) as unknown as [
    readonly {
      accessCount: string;
      accessMonth: string;
      businessMonth: string;
      groupId: string;
    }[],
    unknown,
  ];
  return rows;
}

async function countRows(client: DatabaseClient, tableName: string): Promise<number> {
  if (tableName !== 'visitor_access_logs' && tableName !== 'visitor_access_monthly_aggregates') {
    throw new Error('unexpected table');
  }
  const [rows] = (await client.database.execute(
    sql.raw(`SELECT COUNT(*) AS count FROM \`${tableName}\``),
  )) as unknown as [readonly { count: number }[], unknown];
  return rows[0]?.count ?? 0;
}

function getTestDatabaseOptions(): DatabaseConnectionOptions | undefined {
  if (process.env.NODE_ENV !== 'test') return undefined;
  const port = Number(process.env.TEST_MYSQL_PORT ?? '3307');
  if (
    process.env.TEST_MYSQL_DATABASE === undefined ||
    process.env.TEST_MYSQL_PASSWORD === undefined ||
    process.env.TEST_MYSQL_USER === undefined ||
    !Number.isInteger(port)
  ) {
    return undefined;
  }
  return {
    database: process.env.TEST_MYSQL_DATABASE,
    host: process.env.TEST_MYSQL_HOST ?? '127.0.0.1',
    password: process.env.TEST_MYSQL_PASSWORD,
    port,
    user: process.env.TEST_MYSQL_USER,
  };
}
