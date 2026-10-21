import {
  externalDutyChecks,
  groupMemberships,
  scheduleRoles,
  shiftAssignments,
  shiftTypes,
  type DatabaseClient,
} from '@schedule/database';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ExternalDutyService } from './external-duty-service.js';
import type { ExternalDutySource } from './external-duty-source.js';

describe('one-time external duty baseline', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('scans against the frozen effective roster and detects later changes on either side', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-21T04:00:00Z'));
    const date = '2026-10-22';
    let remoteName = '甲';
    const assignment = {
      id: 'assignment',
      date,
      periodId: 'period',
      version: 2,
      plannedName: '甲',
      plannedMembershipId: 'original-member',
      name: '乙',
      membershipId: 'current-member',
      baselineAssignmentId: 'assignment',
      baselineName: '乙',
    };
    let persisted: Record<string, unknown> | undefined;
    const rows = (table: unknown): unknown[] => {
      if (table === scheduleRoles) return [{ id: 'role' }];
      if (table === shiftTypes) return [{ id: 'shift' }];
      if (table === shiftAssignments) return [assignment];
      if (table === groupMemberships)
        return ['甲', '乙', '丙'].map((name) => ({ name, from: null, to: null }));
      if (table === externalDutyChecks) return persisted ? [persisted] : [];
      return [];
    };
    const select = () => {
      let table: unknown;
      const query = {
        from(value: unknown) {
          table = value;
          return this;
        },
        innerJoin() {
          return this;
        },
        leftJoin() {
          return this;
        },
        where() {
          return this;
        },
        for() {
          return this;
        },
        then(resolve: (value: unknown[]) => unknown) {
          return Promise.resolve(rows(table)).then(resolve);
        },
      };
      return query;
    };
    const database = {
      select,
      transaction: async (operation: (tx: unknown) => Promise<unknown>) => operation(database),
      insert: () => ({
        values: async (values: Record<string, unknown>) => {
          persisted = values;
        },
      }),
      update: () => ({
        set: (values: Record<string, unknown>) => ({
          where: async () => {
            persisted = { ...persisted, ...values };
          },
        }),
      }),
    };
    const source = {
      read: async () => ({ duties: new Map([[date, remoteName]]), people: ['甲', '乙', '丙'] }),
    };
    const service = new ExternalDutyService(
      { database } as unknown as DatabaseClient,
      new Set(),
      source as unknown as ExternalDutySource,
    );
    vi.spyOn(
      service as unknown as { findGroup: () => Promise<string> },
      'findGroup',
    ).mockResolvedValue('group');

    await service.scan();
    expect(persisted).toMatchObject({
      baselineName: '乙',
      localName: '乙',
      changeSource: 'remote',
      status: 'pending',
    });
    remoteName = '乙';
    await service.scan();
    expect(persisted).toMatchObject({ baselineName: '乙', status: 'aligned' });
    assignment.name = '丙';
    assignment.version++;
    await service.scan();
    expect(persisted).toMatchObject({
      baselineName: '乙',
      localName: '丙',
      changeSource: 'local',
      status: 'pending',
    });
    await service.scan();
    expect(persisted).toMatchObject({ baselineName: '乙', changeSource: 'local' });
  });
});
