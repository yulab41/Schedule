import type { DatabaseClient } from '@schedule/database';
import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { describe, expect, it, vi } from 'vitest';

import { ExternalDutyService } from './external-duty-service.js';
import type { ExternalDutySource } from './external-duty-source.js';

const identity = { cloudbaseUid: 'admin' } as AuthenticatedIdentity;
const actionId = '00000000-0000-4000-8000-000000000001';
const fingerprint = 'a'.repeat(64);

function fixture(readbackMatches: boolean) {
  const action = {
    id: actionId,
    status: 'applied',
    side: 'external',
    businessDate: '2026-10-01',
    baselineName: '甲',
    groupId: 'group',
    schedulePeriodId: 'period',
    assignmentId: 'assignment',
  };
  let remoteName = '乙';
  const source = {
    read: vi.fn(async () => ({ duties: new Map([['2026-10-01', remoteName]]) })),
    write: vi.fn(async () => {
      if (readbackMatches) remoteName = '甲';
    }),
  };
  const client = {
    database: {
      select: () => ({
        from: () => ({
          where: () => ({ limit: async () => (action.status === 'applied' ? [action] : []) }),
        }),
      }),
      update: () => ({
        set: (value: { status: string }) => ({
          where: async () => {
            if (value.status === 'reverting' && action.status !== 'applied')
              return [{ affectedRows: 0 }];
            action.status = value.status;
            return [{ affectedRows: 1 }];
          },
        }),
      }),
    },
  } as unknown as DatabaseClient;
  const service = new ExternalDutyService(
    client,
    new Set(),
    source as unknown as ExternalDutySource,
  );
  vi.spyOn(service, 'previewUndo').mockResolvedValue({
    actionId,
    side: 'external',
    date: action.businessDate,
    currentName: '乙',
    baselineName: '甲',
    expectedFingerprint: fingerprint,
  });
  vi.spyOn(service, 'scan').mockResolvedValue({ checked: 1, newDifferences: 0 });
  return { action, source, service };
}

describe('external duty undo', () => {
  it('previews the latest published baseline after a new publication', async () => {
    const oldAction = {
      id: actionId,
      status: 'applied',
      side: 'external',
      businessDate: '2026-10-01',
      baselineName: '甲',
      groupId: 'group',
      schedulePeriodId: 'old-period',
      assignmentId: 'old-assignment',
    };
    const client = {
      database: {
        select: () => ({ from: () => ({ where: () => ({ limit: async () => [oldAction] }) }) }),
      },
    } as unknown as DatabaseClient;
    const source = {
      read: async () => ({ duties: new Map([['2026-10-01', '乙']]) }),
    } as unknown as ExternalDutySource;
    const service = new ExternalDutyService(client, new Set(), source);
    vi.spyOn(
      service as unknown as { authorize: () => Promise<string> },
      'authorize',
    ).mockResolvedValue('admin');
    vi.spyOn(
      service as unknown as { readLocalDate: () => Promise<unknown[]> },
      'readLocalDate',
    ).mockResolvedValue([
      { id: 'new-assignment', periodId: 'new-period', plannedName: '丙', name: '丙' },
    ]);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-28T04:00:00.000Z'));
    try {
      await expect(service.previewUndo(identity, actionId)).resolves.toMatchObject({
        baselineName: '丙',
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects stale confirmation before any write', async () => {
    const { service, source } = fixture(true);
    await expect(service.undo(identity, actionId, 'b'.repeat(64))).rejects.toThrow('过期');
    expect(source.write).not.toHaveBeenCalled();
  });

  it('restores the published baseline and rejects a second click', async () => {
    const { action, service, source } = fixture(true);
    await expect(service.undo(identity, actionId, fingerprint)).resolves.toEqual({
      verified: true,
    });
    expect(source.write).toHaveBeenCalledWith('2026-10-01', '甲');
    expect(action.status).toBe('reverted');
    await expect(service.undo(identity, actionId, fingerprint)).rejects.toThrow('已撤回');
    expect(source.write).toHaveBeenCalledOnce();
  });

  it('retains the action when external readback disagrees', async () => {
    const { action, service } = fixture(false);
    await expect(service.undo(identity, actionId, fingerprint)).rejects.toThrow('回读不一致');
    expect(action.status).toBe('applied');
  });
});
