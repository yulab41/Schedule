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

import type { AuthPort } from '../../adapters/auth/auth-port.js';
import { createApp } from '../../app.js';
import { ClientCapabilityPolicy } from '../client-capabilities/client-capability-policy.js';

const migrationsDirectory = fileURLToPath(new URL('../../../../../migrations', import.meta.url));
const databaseOptions = getTestDatabaseOptions();
const describeWithDatabase = databaseOptions === undefined ? describe.skip : describe;
const currentVersion = '0.1.0-p6.20260824.80';

describeWithDatabase('Mini-only client telemetry ingestion', () => {
  let app: ReturnType<typeof createApp>;
  let client: DatabaseClient;

  beforeEach(async () => {
    client = createTestDatabaseClient(databaseOptions as DatabaseConnectionOptions);
    await resetDatabase(client);
    await migrateDatabase(client, migrationsDirectory);
    app = createApp({
      authPort: createNoopAuthPort(),
      clientCapabilityPolicy: policy({ core: true, global: true }),
      databaseClient: client,
      logger: false,
    });
  });

  afterEach(async () => {
    await app.close();
    await client.close();
  });

  it('requires paired exact Mini headers and global plus core capability', async () => {
    const payload = validPayload();
    const missing = await app.inject({ method: 'POST', payload, url: '/client-telemetry' });
    expect(missing.statusCode).toBe(400);
    const partial = await app.inject({
      headers: { 'x-schedule-client-platform': 'miniprogram' },
      method: 'POST',
      payload,
      url: '/client-telemetry',
    });
    expect(partial.statusCode).toBe(400);
    const unknown = await app.inject({
      headers: telemetryHeaders('0.1.0-p6.20990101.1'),
      method: 'POST',
      payload,
      url: '/client-telemetry',
    });
    expect(unknown.statusCode).toBe(426);

    const disabledApp = createApp({
      authPort: createNoopAuthPort(),
      clientCapabilityPolicy: policy({ core: false, global: true }),
      databaseClient: client,
      logger: false,
    });
    const disabled = await disabledApp.inject({
      headers: telemetryHeaders(currentVersion),
      method: 'POST',
      payload,
      url: '/client-telemetry',
    });
    expect(disabled.statusCode).toBe(503);
    await disabledApp.close();
  });

  it('fails closed before schema 51 and atomically inserts header-derived versions afterward', async () => {
    const tableExists = await hasTelemetryTable(client);
    const response = await app.inject({
      headers: telemetryHeaders(currentVersion),
      method: 'POST',
      payload: validPayload(),
      url: '/client-telemetry',
    });
    if (!tableExists) {
      expect(response.statusCode).toBe(503);
      return;
    }
    expect(response.statusCode, response.body).toBe(204);
    const [rows] = (await client.database.execute(sql`
      SELECT client_version AS clientVersion, page, error_code AS errorCode,
             performance_metric AS performanceMetric
      FROM miniprogram_telemetry_events ORDER BY created_at, id
    `)) as unknown as [
      readonly {
        clientVersion: string;
        errorCode: string | null;
        page: string;
        performanceMetric: string | null;
      }[],
      unknown,
    ];
    expect(rows).toEqual([
      {
        clientVersion: currentVersion,
        errorCode: 'MINI_RUNTIME_ERROR',
        page: 'app',
        performanceMetric: null,
      },
      {
        clientVersion: currentVersion,
        errorCode: null,
        page: 'workbench',
        performanceMetric: 'core-ready',
      },
    ]);
  });

  it('rejects raw sensitive fields, oversized bodies, and every read route', async () => {
    const invalid = await app.inject({
      headers: telemetryHeaders(currentVersion),
      method: 'POST',
      payload: {
        events: [
          {
            deviceTier: 'unknown',
            errorCode: 'UNKNOWN',
            networkType: 'unknown',
            page: 'app',
            stack: 'raw stack',
          },
        ],
      },
      url: '/client-telemetry',
    });
    expect(invalid.statusCode).toBe(400);
    const oversized = await app.inject({
      headers: { ...telemetryHeaders(currentVersion), 'content-type': 'application/json' },
      method: 'POST',
      payload: JSON.stringify({ events: [], padding: 'x'.repeat(17 * 1024) }),
      url: '/client-telemetry',
    });
    expect(oversized.statusCode).toBe(413);
    const read = await app.inject({
      headers: telemetryHeaders(currentVersion),
      method: 'GET',
      url: '/client-telemetry',
    });
    expect(read.statusCode).toBe(404);
    if (await hasTelemetryTable(client)) {
      const [rows] = (await client.database.execute(
        sql`SELECT COUNT(*) AS count FROM miniprogram_telemetry_events`,
      )) as unknown as [readonly { count: number }[], unknown];
      expect(rows[0]?.count).toBe(0);
    }
  });
});

function validPayload() {
  return {
    events: [
      {
        deviceTier: 'medium',
        errorCode: 'MINI_RUNTIME_ERROR',
        networkType: 'wifi',
        page: 'app',
        stackFingerprint: 'a'.repeat(64),
      },
      {
        deviceTier: 'medium',
        networkType: '4g',
        page: 'workbench',
        performance: { durationMs: 420, metric: 'core-ready' },
      },
    ],
  };
}

function telemetryHeaders(version: string) {
  return {
    'x-schedule-client-platform': 'miniprogram',
    'x-schedule-client-version': version,
  };
}

function policy(flags: { readonly core: boolean; readonly global: boolean }) {
  return new ClientCapabilityPolicy({
    capabilities: {
      core: flags.core,
      externalMessages: false,
      global: flags.global,
      guest: false,
      insights: false,
      organization: false,
      workflows: false,
    },
    legacyVersion: currentVersion,
    supportedVersions: [currentVersion],
  });
}

function createNoopAuthPort(): AuthPort {
  return {
    async authenticate() {
      return undefined;
    },
  };
}

async function hasTelemetryTable(client: DatabaseClient): Promise<boolean> {
  const [rows] = (await client.database.execute(sql`
    SELECT COUNT(*) AS count
    FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'miniprogram_telemetry_events'
  `)) as unknown as [readonly { count: number }[], unknown];
  return (rows[0]?.count ?? 0) === 1;
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
