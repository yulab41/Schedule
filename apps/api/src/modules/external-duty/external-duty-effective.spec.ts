import type { DatabaseClient } from '@schedule/database';
import { describe, expect, it } from 'vitest';

import { ExternalDutyService } from './external-duty-service.js';
import type { ExternalDutySource } from './external-duty-source.js';

describe('external duty effective published assignment', () => {
  it('uses the published person when no actual override exists, as the calendar does', async () => {
    const raw = [
      {
        id: 'assignment',
        name: null,
        membershipId: null,
        plannedName: '甲医生',
        plannedMembershipId: 'membership',
        version: 1,
        periodId: 'period',
      },
    ];
    const query = {
      from() {
        return this;
      },
      innerJoin() {
        return this;
      },
      where() {
        return Promise.resolve(raw);
      },
    };
    const client = { database: { select: () => query } } as unknown as DatabaseClient;
    const service = new ExternalDutyService(client, new Set(), {} as ExternalDutySource);
    const rows = await (
      service as unknown as {
        readLocalDate: (groupId: string, date: string) => Promise<typeof raw>;
      }
    ).readLocalDate('group', '2026-09-28');
    expect(rows).toMatchObject([{ name: '甲医生', membershipId: 'membership' }]);
  });

  it('keeps an applied swap value ahead of the published baseline', async () => {
    const raw = [
      {
        id: 'assignment',
        name: '乙医生',
        membershipId: 'actual-member',
        plannedName: '甲医生',
        plannedMembershipId: 'planned-member',
        version: 2,
        periodId: 'period',
      },
    ];
    const query = {
      from() {
        return this;
      },
      innerJoin() {
        return this;
      },
      where() {
        return Promise.resolve(raw);
      },
    };
    const client = { database: { select: () => query } } as unknown as DatabaseClient;
    const service = new ExternalDutyService(client, new Set(), {} as ExternalDutySource);
    const rows = await (
      service as unknown as {
        readLocalDate: (groupId: string, date: string) => Promise<typeof raw>;
      }
    ).readLocalDate('group', '2026-10-01');
    expect(rows).toMatchObject([
      { name: '乙医生', membershipId: 'actual-member', plannedName: '甲医生' },
    ]);
  });
});
