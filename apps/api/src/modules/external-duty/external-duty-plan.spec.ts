import { randomUUID } from 'node:crypto';
import type { DatabaseClient } from '@schedule/database';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { SwapService } from '../swaps/swap-service.js';
import { ExternalDutyService } from './external-duty-service.js';
import type { ExternalDutySource } from './external-duty-source.js';

const dates = ['2026-10-01', '2026-10-02', '2026-10-03'] as const;
const baseline = ['甲', '乙', '丙'];
const target = ['乙', '丙', '甲'];

describe('multi-person external duty plan execution', () => {
  afterEach(() => vi.restoreAllMocks());

  it('executes every step after claiming the first date and verifies each new state', async () => {
    const names = [...baseline];
    const rows = dates.map((businessDate, index) => ({
      businessDate,
      groupId: 'group',
      schedulePeriodId: 'period',
      assignmentId: `assignment-${index}`,
      baselineName: baseline[index],
      localName: baseline[index],
      remoteName: target[index],
      changeSource: 'remote' as const,
      status: index === 0 ? ('processing' as const) : ('pending' as const),
      isInScope: 1,
    }));
    const inserts: unknown[] = [];
    const client = {
      database: {
        select: () => ({ from: () => ({ where: async () => rows }) }),
        insert: () => ({
          values: async (row: unknown) => {
            inserts.push(row);
          },
        }),
      },
    } as unknown as DatabaseClient;
    const source = {
      read: vi.fn(async () => ({ duties: new Map(dates.map((date, i) => [date, target[i]])) })),
    } as unknown as ExternalDutySource;
    const service = new ExternalDutyService(client, new Set(), source);
    const internal = service as unknown as {
      authorize: () => Promise<string>;
      readLocalDate: (group: string, date: string) => Promise<unknown[]>;
    };
    vi.spyOn(internal, 'authorize').mockResolvedValue('admin');
    vi.spyOn(internal, 'readLocalDate').mockImplementation(async (_group: string, date: string) => {
      const index = dates.indexOf(date as (typeof dates)[number]);
      return [
        {
          id: `assignment-${index}`,
          periodId: 'period',
          plannedName: baseline[index],
          name: names[index],
          membershipId: `membership-${names[index]}`,
        },
      ];
    });
    const preview = vi
      .spyOn(SwapService.prototype, 'preview')
      .mockResolvedValue({ conflicts: [] } as never);
    const create = vi
      .spyOn(SwapService.prototype, 'createDirect')
      .mockImplementation(async (_identity, _groupId, input) => {
        const a = Number(input.initiatorAssignmentId.split('-')[1]);
        const b = Number(input.targetAssignmentId.split('-')[1]);
        [names[a], names[b]] = [names[b]!, names[a]!];
        return { id: randomUUID() } as never;
      });
    const result = await (
      service as never as {
        applySwapPlan: (
          identity: AuthenticatedIdentity,
          date: string,
          period: string,
        ) => Promise<{ completedSteps: number }>;
      }
    ).applySwapPlan({ cloudbaseUid: 'admin' } as AuthenticatedIdentity, dates[0], 'period');
    expect(result.completedSteps).toBe(2);
    expect(names).toEqual(target);
    expect(preview).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenCalledTimes(2);
    expect(inserts).toHaveLength(2);
  });
});
