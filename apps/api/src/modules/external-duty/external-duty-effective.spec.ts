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
        baselineAssignmentId: null,
        baselineName: null,
        plannedMembershipId: 'membership',
        version: 1,
        periodId: 'period',
      },
    ];
    const query = {
      leftJoin() {
        return this;
      },
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
        baselineAssignmentId: null,
        baselineName: null,
        plannedMembershipId: 'planned-member',
        version: 2,
        periodId: 'period',
      },
    ];
    const query = {
      leftJoin() {
        return this;
      },
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

  it('keeps the one-time baseline after later changes without changing calendar fallback', async () => {
    const raw = {
      id: 'assignment',
      periodId: 'period',
      name: null as string | null,
      membershipId: null,
      plannedName: '甲医生',
      plannedMembershipId: 'original-member',
      baselineAssignmentId: 'assignment',
      baselineName: '乙医生' as string | null,
      baselineInvalidated: 0,
      version: 3,
    };
    const query = {
      from() {
        return this;
      },
      innerJoin() {
        return this;
      },
      leftJoin() {
        return this;
      },
      where: async () => [raw],
    };
    const client = { database: { select: () => query } } as unknown as DatabaseClient;
    const service = new ExternalDutyService(client, new Set(), {} as ExternalDutySource);
    const read = () => service['readLocalDate']('group', '2026-10-22');
    expect(await read()).toMatchObject([
      { name: '甲医生', membershipId: 'original-member', baselineName: '乙医生' },
    ]);
    raw.name = '丙医生';
    raw.version++;
    expect(await read()).toMatchObject([{ name: '丙医生', baselineName: '乙医生' }]);
    raw.baselineInvalidated = 1;
    expect(await read()).toMatchObject([{ name: '丙医生', baselineName: '甲医生' }]);
    raw.baselineInvalidated = 0;
    raw.baselineName = null;
    expect(await read()).toMatchObject([{ name: '丙医生', baselineName: null }]);
  });

  it('uses the new publication baseline when no snapshot belongs to the current assignment', async () => {
    const raw = {
      id: 'new-assignment',
      name: '丙医生',
      membershipId: 'actual-member',
      plannedName: '丁医生',
      plannedMembershipId: 'new-member',
      baselineAssignmentId: null,
      baselineName: null,
      version: 1,
      periodId: 'new-period',
    };
    const query = {
      from() {
        return this;
      },
      innerJoin() {
        return this;
      },
      leftJoin() {
        return this;
      },
      where: async () => [raw],
    };
    const client = { database: { select: () => query } } as unknown as DatabaseClient;
    const service = new ExternalDutyService(client, new Set(), {} as ExternalDutySource);
    expect(await service['readLocalDate']('group', '2026-10-22')).toMatchObject([
      { name: '丙医生', baselineName: '丁医生' },
    ]);
  });
});
