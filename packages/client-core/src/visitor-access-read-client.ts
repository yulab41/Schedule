import type { VisitorAccessAggregatePage, VisitorAccessLogPage } from '@schedule/contracts';

import {
  visitorAccessAggregatePageJsonSchema,
  visitorAccessLogPageJsonSchema,
} from './generated/calendar-schemas.js';
import { defineClientEndpoint, type ClientTransport } from './endpoint.js';
import { createCompactDecoder } from './json-decoder.js';

export interface VisitorAccessPageInput {
  readonly cursor?: string;
  readonly groupId: string;
  readonly pageSize?: number;
}

export const visitorAccessLogPageDecoder = createCompactDecoder<VisitorAccessLogPage>(
  visitorAccessLogPageJsonSchema,
);
export const visitorAccessAggregatePageDecoder = createCompactDecoder<VisitorAccessAggregatePage>(
  visitorAccessAggregatePageJsonSchema,
);

export const visitorAccessReadEndpoints = {
  aggregates: defineClientEndpoint<VisitorAccessPageInput, VisitorAccessAggregatePage>({
    auth: 'bearer',
    decoder: visitorAccessAggregatePageDecoder,
    id: 'insights.visitor-access-aggregates',
    method: 'GET',
    path: visitorAccessPagePath('visitor-access-aggregates'),
  }),
  logs: defineClientEndpoint<VisitorAccessPageInput, VisitorAccessLogPage>({
    auth: 'bearer',
    decoder: visitorAccessLogPageDecoder,
    id: 'insights.visitor-access-logs',
    method: 'GET',
    path: visitorAccessPagePath('visitor-access-logs'),
  }),
} as const;

export interface VisitorAccessReadClient {
  listAggregates(
    groupId: string,
    options?: Omit<VisitorAccessPageInput, 'groupId'>,
  ): Promise<VisitorAccessAggregatePage>;
  listLogs(
    groupId: string,
    options?: Omit<VisitorAccessPageInput, 'groupId'>,
  ): Promise<VisitorAccessLogPage>;
}

export function createVisitorAccessReadClient(transport: ClientTransport): VisitorAccessReadClient {
  return {
    listAggregates(groupId, options = {}) {
      return transport.request(visitorAccessReadEndpoints.aggregates, { groupId, ...options });
    },
    listLogs(groupId, options = {}) {
      return transport.request(visitorAccessReadEndpoints.logs, { groupId, ...options });
    },
  };
}

function visitorAccessPagePath(
  resource: 'visitor-access-aggregates' | 'visitor-access-logs',
): (input: VisitorAccessPageInput) => string {
  return ({ groupId, cursor, pageSize }) => {
    const query = [
      cursor === undefined ? undefined : `cursor=${encodeURIComponent(cursor)}`,
      pageSize === undefined ? undefined : `pageSize=${encodeURIComponent(String(pageSize))}`,
    ].filter((value): value is string => value !== undefined);
    const suffix = query.length === 0 ? '' : `?${query.join('&')}`;
    return `/groups/${encodeURIComponent(groupId)}/${resource}${suffix}`;
  };
}
