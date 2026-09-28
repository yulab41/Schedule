import type { DatabaseClient } from '@schedule/database';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { DutyAdjustmentService } from '../duty-adjustments/duty-adjustment-service.js';
import { SwapService } from '../swaps/swap-service.js';
import { ExternalDutyService } from './external-duty-service.js';
import type { ExternalDutySource } from './external-duty-source.js';

const date = '2026-10-12';
const fingerprint = 'a'.repeat(64);
const identity = { cloudbaseUid: 'admin' } as AuthenticatedIdentity;

function fixture(actual = false) {
  const row = {
    businessDate: date,
    groupId: 'group',
    schedulePeriodId: 'period',
    assignmentId: 'first',
    assignmentVersion: 1,
    baselineName: '甲',
    localName: '甲',
    remoteName: '乙',
    changeSource: 'remote',
    status: 'pending',
    isInScope: 1,
    blockReason: null,
    fingerprint,
  };
  const partner = {
    ...row,
    businessDate: '2026-10-13',
    assignmentId: 'second',
    baselineName: '乙',
    localName: '乙',
    remoteName: '甲',
  };
  const assignment = {
    id: 'first',
    periodId: 'period',
    version: 1,
    name: actual ? '甲' : null,
    membershipId: actual ? 'actual-member' : null,
    plannedName: '甲',
    plannedMembershipId: 'planned-member',
  };
  // Real public preview path: snapshot, effective assignment, remote member,
  // suggested action, period rows, then the legacy raw-override lookup.
  const results: unknown[][] = [
    [row],
    [assignment],
    [{ id: 'remote-member' }],
    [row],
    [row, partner],
    [{ membershipId: assignment.membershipId }],
  ];
  const update = vi.fn();
  const insert = vi.fn();
  const database = {
    update,
    insert,
    select: () => {
      const rows = results.shift();
      if (!rows) throw new Error('Unexpected query');
      const query = {
        from: () => query,
        innerJoin: () => query,
        where: () => query,
        limit: () => query,
        then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(rows).then(resolve),
      };
      return query;
    },
  };
  const source = {
    read: vi.fn(async () => ({ duties: new Map([[date, '乙']]), people: ['甲', '乙'] })),
    write: vi.fn(),
  };
  const service = new ExternalDutyService(
    { database } as unknown as DatabaseClient,
    new Set(),
    source as unknown as ExternalDutySource,
  );
  vi.spyOn(
    service as unknown as { authorize: () => Promise<string> },
    'authorize',
  ).mockResolvedValue('admin-user');
  return { service, row, partner, assignment, source, update, insert };
}

describe('external duty inbound preview', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-28T04:00:00Z'));
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it.each([false, true])(
    'previews unchanged two-day swap with actual override=%s',
    async (actual) => {
      const { service, source, update, insert } = fixture(actual);
      const preview = { conflicts: [], nextStatus: 'completed' } as never;
      const swap = vi.spyOn(SwapService.prototype, 'preview').mockResolvedValue(preview);
      await expect(
        service.previewInbound(identity, date, fingerprint, 'swap', 'second'),
      ).resolves.toBe(preview);
      expect(swap).toHaveBeenCalledWith(identity, 'group', {
        initiatorMembershipId: actual ? 'actual-member' : 'planned-member',
        initiatorAssignmentId: 'first',
        targetAssignmentId: 'second',
        targetMembershipId: 'remote-member',
      });
      expect(source.write).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
      expect(insert).not.toHaveBeenCalled();
    },
  );

  it('still rejects a changed version even if the effective name is unchanged', async () => {
    const { service, assignment } = fixture();
    assignment.version++;
    const swap = vi.spyOn(SwapService.prototype, 'preview');
    await expect(
      service.previewInbound(identity, date, fingerprint, 'swap', 'second'),
    ).rejects.toThrow('排班已变化');
    expect(swap).not.toHaveBeenCalled();
  });

  it('still rejects a webpage changed since the scan', async () => {
    const { service, source } = fixture();
    source.read.mockResolvedValue({ duties: new Map([[date, '甲']]), people: ['甲', '乙'] });
    const swap = vi.spyOn(SwapService.prototype, 'preview');
    await expect(
      service.previewInbound(identity, date, fingerprint, 'swap', 'second'),
    ).rejects.toThrow('排班已变化');
    expect(swap).not.toHaveBeenCalled();
  });

  it('keeps count changes on the original duty adjustment preview path', async () => {
    const { service, partner } = fixture();
    partner.remoteName = partner.localName;
    const preview = { conflicts: [], nextStatus: 'pending_approval' } as never;
    const duty = vi.spyOn(DutyAdjustmentService.prototype, 'preview').mockResolvedValue(preview);
    await expect(service.previewInbound(identity, date, fingerprint, 'duty')).resolves.toBe(
      preview,
    );
    expect(duty).toHaveBeenCalledWith(identity, 'group', {
      coveredAssignmentId: 'first',
      overtimeMembershipId: 'remote-member',
    });
  });
});
