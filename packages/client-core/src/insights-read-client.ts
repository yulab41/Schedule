import type {
  MonthStatisticsSnapshot,
  ScheduleEventDetail,
  ScheduleEventPage,
  YearStatistics,
} from '@schedule/contracts';

import {
  monthStatisticsSnapshotJsonSchema,
  scheduleEventDetailJsonSchema,
  scheduleEventPageJsonSchema,
  yearStatisticsJsonSchema,
} from './generated/calendar-schemas.js';
import { defineClientEndpoint, type ClientTransport } from './endpoint.js';
import { createCompactDecoder } from './json-decoder.js';

export interface InsightsEventQueryInput {
  readonly cursor?: string;
  readonly eventTypes?: readonly string[];
  readonly from?: string;
  readonly groupId: string;
  readonly membershipId?: string;
  readonly operatorUserId?: string;
  readonly pageSize?: number;
  readonly scheduleRoleId?: string;
  readonly shiftId?: string;
  readonly to?: string;
}

export interface InsightsEventDetailInput {
  readonly eventId: string;
  readonly groupId: string;
}

export interface InsightsMonthStatisticsInput {
  readonly businessMonth: string;
  readonly groupId: string;
}

export interface InsightsYearStatisticsInput {
  readonly groupId: string;
  readonly year: number;
}

export const scheduleEventPageDecoder = createCompactDecoder<ScheduleEventPage>(
  scheduleEventPageJsonSchema,
);
export const scheduleEventDetailDecoder = createCompactDecoder<ScheduleEventDetail>(
  scheduleEventDetailJsonSchema,
);
export const monthStatisticsSnapshotDecoder = createCompactDecoder<MonthStatisticsSnapshot>(
  monthStatisticsSnapshotJsonSchema,
);
export const yearStatisticsDecoder = createCompactDecoder<YearStatistics>(
  yearStatisticsJsonSchema,
);

export const insightsReadEndpoints = {
  events: defineClientEndpoint<InsightsEventQueryInput, ScheduleEventPage>({
    auth: 'bearer',
    decoder: scheduleEventPageDecoder,
    id: 'insights.events',
    method: 'GET',
    path: ({
      cursor,
      eventTypes,
      from,
      groupId,
      membershipId,
      operatorUserId,
      pageSize,
      scheduleRoleId,
      shiftId,
      to,
    }) =>
      appendQuery(`/groups/${encodeURIComponent(groupId)}/events`, [
        ['cursor', cursor],
        ['eventTypes', eventTypes === undefined ? undefined : eventTypes.join(',')],
        ['from', from],
        ['membershipId', membershipId],
        ['operatorUserId', operatorUserId],
        ['pageSize', pageSize === undefined ? undefined : String(pageSize)],
        ['scheduleRoleId', scheduleRoleId],
        ['shiftId', shiftId],
        ['to', to],
      ]),
  }),
  eventDetail: defineClientEndpoint<InsightsEventDetailInput, ScheduleEventDetail>({
    auth: 'bearer',
    decoder: scheduleEventDetailDecoder,
    id: 'insights.event-detail',
    method: 'GET',
    path: ({ eventId, groupId }) =>
      `/groups/${encodeURIComponent(groupId)}/events/${encodeURIComponent(eventId)}`,
  }),
  monthStatistics: defineClientEndpoint<InsightsMonthStatisticsInput, MonthStatisticsSnapshot>({
    auth: 'bearer',
    decoder: monthStatisticsSnapshotDecoder,
    id: 'insights.statistics-month',
    method: 'GET',
    path: ({ businessMonth, groupId }) =>
      `/groups/${encodeURIComponent(groupId)}/statistics?businessMonth=${encodeURIComponent(businessMonth)}`,
  }),
  yearStatistics: defineClientEndpoint<InsightsYearStatisticsInput, YearStatistics>({
    auth: 'bearer',
    decoder: yearStatisticsDecoder,
    id: 'insights.statistics-year',
    method: 'GET',
    path: ({ groupId, year }) =>
      `/groups/${encodeURIComponent(groupId)}/statistics/year?year=${encodeURIComponent(String(year))}`,
  }),
} as const;

export interface InsightsReadClient {
  getEventDetail(groupId: string, eventId: string): Promise<ScheduleEventDetail>;
  getMonthStatistics(groupId: string, businessMonth: string): Promise<MonthStatisticsSnapshot>;
  getYearStatistics(groupId: string, year: number): Promise<YearStatistics>;
  listEvents(
    groupId: string,
    options?: Omit<InsightsEventQueryInput, 'groupId'>,
  ): Promise<ScheduleEventPage>;
}

export function createInsightsReadClient(transport: ClientTransport): InsightsReadClient {
  return {
    getEventDetail(groupId, eventId) {
      return transport.request(insightsReadEndpoints.eventDetail, { eventId, groupId });
    },
    getMonthStatistics(groupId, businessMonth) {
      return transport.request(insightsReadEndpoints.monthStatistics, { businessMonth, groupId });
    },
    getYearStatistics(groupId, year) {
      return transport.request(insightsReadEndpoints.yearStatistics, { groupId, year });
    },
    listEvents(groupId, options = {}) {
      return transport.request(insightsReadEndpoints.events, { groupId, ...options });
    },
  };
}

function appendQuery(path: string, entries: readonly (readonly [string, string | undefined])[]): string {
  const query = entries
    .filter((entry): entry is readonly [string, string] => entry[1] !== undefined)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`);
  return query.length === 0 ? path : `${path}?${query.join('&')}`;
}
