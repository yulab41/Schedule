import {
  monthStatisticsSnapshotSchema,
  scheduleEventDetailSchema,
  scheduleEventPageSchema,
  yearStatisticsSchema,
} from '@schedule/contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  createInsightsReadClient,
  insightsReadEndpoints,
  monthStatisticsSnapshotDecoder,
  scheduleEventDetailDecoder,
  scheduleEventPageDecoder,
  yearStatisticsDecoder,
} from './insights-read-client.js';
import {
  insightsEventDetailGoldenResponse,
  insightsEventGoldenResponse,
  insightsMonthStatisticsGoldenResponse,
  insightsYearStatisticsGoldenResponse,
} from './testing/insights-api-golden.js';
import type { ClientTransport } from './endpoint.js';

describe('insights read client', () => {
  it('encodes event list/detail and statistics paths with bearer GET endpoints', () => {
    expect(
      insightsReadEndpoints.events.path({
        groupId: 'group /一',
        cursor: 'cursor /一',
        eventTypes: ['schedule_published', 'leave'],
        pageSize: 50,
      }),
    ).toBe(
      '/groups/group%20%2F%E4%B8%80/events?cursor=cursor%20%2F%E4%B8%80&eventTypes=schedule_published%2Cleave&pageSize=50',
    );
    expect(
      insightsReadEndpoints.eventDetail.path({ groupId: 'group /一', eventId: 'event /一' }),
    ).toBe('/groups/group%20%2F%E4%B8%80/events/event%20%2F%E4%B8%80');
    expect(
      insightsReadEndpoints.monthStatistics.path({ groupId: 'group-1', businessMonth: '2026-08' }),
    ).toBe('/groups/group-1/statistics?businessMonth=2026-08');
    expect(insightsReadEndpoints.yearStatistics.path({ groupId: 'group-1', year: 2026 })).toBe(
      '/groups/group-1/statistics/year?year=2026',
    );
    for (const endpoint of Object.values(insightsReadEndpoints)) {
      expect(endpoint.auth).toBe('bearer');
      expect(endpoint.method).toBe('GET');
    }
  });

  it('decodes strict event and statistics golden payloads', () => {
    expect(scheduleEventPageDecoder.safeDecode(insightsEventGoldenResponse).success).toBe(true);
    expect(scheduleEventDetailDecoder.safeDecode(insightsEventDetailGoldenResponse).success).toBe(
      true,
    );
    expect(
      monthStatisticsSnapshotDecoder.safeDecode(insightsMonthStatisticsGoldenResponse).success,
    ).toBe(true);
    expect(yearStatisticsDecoder.safeDecode(insightsYearStatisticsGoldenResponse).success).toBe(
      true,
    );
    expect(scheduleEventPageSchema.safeParse({ ...insightsEventGoldenResponse, extra: true }).success).toBe(false);
    expect(monthStatisticsSnapshotSchema.safeParse({ ...insightsMonthStatisticsGoldenResponse, extra: true }).success).toBe(false);
    expect(scheduleEventDetailSchema.safeParse({ ...insightsEventDetailGoldenResponse, extra: true }).success).toBe(false);
    expect(yearStatisticsSchema.safeParse({ ...insightsYearStatisticsGoldenResponse, extra: true }).success).toBe(false);
  });

  it('delegates list/detail/month/year reads once through the shared transport', async () => {
    const request = vi.fn(async (endpoint, input) => {
      switch (endpoint.id) {
        case 'insights.events':
          return insightsEventGoldenResponse;
        case 'insights.event-detail':
          return insightsEventDetailGoldenResponse;
        case 'insights.statistics-month':
          return insightsMonthStatisticsGoldenResponse;
        case 'insights.statistics-year':
          return insightsYearStatisticsGoldenResponse;
        default:
          throw new Error(`unexpected endpoint ${endpoint.id} ${JSON.stringify(input)}`);
      }
    });
    const client = createInsightsReadClient({ request } as unknown as ClientTransport);

    await expect(client.listEvents('group-1', { pageSize: 50 })).resolves.toEqual(
      insightsEventGoldenResponse,
    );
    await expect(client.getEventDetail('group-1', 'event-1')).resolves.toEqual(
      insightsEventDetailGoldenResponse,
    );
    await expect(client.getMonthStatistics('group-1', '2026-08')).resolves.toEqual(
      insightsMonthStatisticsGoldenResponse,
    );
    await expect(client.getYearStatistics('group-1', 2026)).resolves.toEqual(
      insightsYearStatisticsGoldenResponse,
    );
    expect(request).toHaveBeenCalledTimes(4);
  });
});
