import type { VisitorAccessAggregatePage, VisitorAccessLogPage } from '@schedule/contracts';

export const visitorAccessApiGoldenResponse = {
  logs: [
    {
      businessMonth: '2026-08',
      clientIp: '203.0.113.10',
      createdAt: '2026-08-25T10:00:00.000Z',
      groupId: 'group-1',
      id: 'log-1',
      requestId: 'request-1',
    },
  ],
  nextCursor: 'cursor-log-1',
} satisfies VisitorAccessLogPage;

export const visitorAccessAggregateGoldenResponse = {
  aggregates: [
    {
      accessCount: '12',
      accessMonth: '2026-08',
      businessMonth: '2026-08',
    },
  ],
  nextCursor: 'cursor-aggregate-1',
} satisfies VisitorAccessAggregatePage;
