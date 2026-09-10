import { describe, expect, it, vi } from 'vitest';
import type { DatabaseClient } from '@schedule/database';
import { MembershipService } from './membership-service.js';

describe('linked guest group summaries', () => {
  it('includes derived guests without inheriting platform administration or creating members', async () => {
    const select = vi.fn();
    const query = {
      from: select,
      innerJoin: select,
      where: select,
      orderBy: vi.fn().mockResolvedValue([]),
    };
    select.mockReturnValue(query);
    const execute = vi
      .fn()
      .mockResolvedValue([[{ id: 'linked', name: 'Linked group', version: 1 }], []]);
    const service = new MembershipService({
      database: { select, execute },
    } as unknown as DatabaseClient);
    expect(await service.listGroups({ cloudbaseUid: 'member' })).toEqual([
      { id: 'linked', name: 'Linked group', version: 1, role: 'guest' },
    ]);
  });
});
