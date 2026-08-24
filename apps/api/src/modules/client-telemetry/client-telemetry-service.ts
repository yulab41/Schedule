import { randomUUID } from 'node:crypto';

import type { ClientTelemetryRequest, ClientVersion } from '@schedule/contracts';
import {
  type DatabaseClient,
  miniprogramTelemetryEvents,
  withTransaction,
} from '@schedule/database';
import { sql } from 'drizzle-orm';

import { ApiError } from '../../plugins/error-handler.js';

export interface ClientTelemetryBudgetOptions {
  readonly maxEventsPerMinute?: number;
}

export class ClientTelemetryBudget {
  private count = 0;
  private readonly maxEventsPerMinute: number;
  private windowStartedAt = 0;

  public constructor(options: ClientTelemetryBudgetOptions = {}) {
    this.maxEventsPerMinute = options.maxEventsPerMinute ?? 3000;
  }

  public consume(eventCount: number, now = new Date()): void {
    if (now.valueOf() - this.windowStartedAt >= 60_000) {
      this.count = 0;
      this.windowStartedAt = now.valueOf();
    }
    if (eventCount < 1 || this.count + eventCount > this.maxEventsPerMinute) {
      throw new ApiError({
        code: 'RATE_LIMITED',
        statusCode: 429,
        userMessage: 'Telemetry events are too frequent.',
      });
    }
    this.count += eventCount;
  }
}

export class ClientTelemetryService {
  public constructor(
    private readonly databaseClient: DatabaseClient,
    private readonly budget = new ClientTelemetryBudget(),
  ) {}

  public async ingest(version: ClientVersion, input: ClientTelemetryRequest): Promise<void> {
    await withTransaction(this.databaseClient, async (transaction) => {
      const [schemaRows] = (await transaction.execute(sql`
        SELECT COUNT(*) AS count
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
          AND table_name = 'miniprogram_telemetry_events'
      `)) as unknown as [readonly { count: number }[], unknown];
      if ((schemaRows[0]?.count ?? 0) !== 1) {
        throw new ApiError({
          code: 'SERVICE_UNAVAILABLE',
          statusCode: 503,
          userMessage: '客户端遥测暂不可用。',
        });
      }

      this.budget.consume(input.events.length);
      await transaction.insert(miniprogramTelemetryEvents).values(
        input.events.map((event) => ({
          clientVersion: version,
          deviceTier: event.deviceTier,
          errorCode: event.errorCode ?? null,
          id: randomUUID(),
          networkType: event.networkType,
          page: event.page,
          performanceDurationMs: event.performance?.durationMs ?? null,
          performanceMetric: event.performance?.metric ?? null,
          stackFingerprint: event.stackFingerprint ?? null,
        })),
      );
    });
  }
}
