import { externalDutyActions, externalDutyChecks, type DatabaseClient } from '@schedule/database';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { ExternalDutyService } from './external-duty-service.js';
import type { ExternalDutySource, ExternalDutySnapshot } from './external-duty-source.js';

const date = '2026-10-01';
const fingerprint = 'a'.repeat(64);
const identity = { cloudbaseUid: 'admin' } as AuthenticatedIdentity;

function snapshot(name: string): ExternalDutySnapshot {
  return { duties: new Map([[date, name]]), people: ['甲', '乙'] };
}

function fixture() {
  const action = { status: '' };
  const row = {
    businessDate: date,
    fingerprint,
    status: 'pending',
    isInScope: 1,
    changeSource: 'local',
    baselineName: '乙',
    localName: '甲',
    remoteName: '乙',
    blockReason: null,
    assignmentId: 'assignment',
    assignmentVersion: 1,
    schedulePeriodId: 'period',
    groupId: 'group',
  };
  const limit = vi.fn(async () => [row]);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  const insert = vi.fn(() => ({
    values: vi.fn(async (values: { status: string }) => {
      action.status = values.status;
    }),
  }));
  const update = vi.fn((table: unknown) => ({
    set: (values: { status: string }) => ({
      where: async () => {
        if (
          table === externalDutyChecks &&
          values.status === 'processing' &&
          row.status !== 'pending'
        )
          return [{ affectedRows: 0 }];
        if (table === externalDutyActions) action.status = values.status;
        else row.status = values.status;
        return [{ affectedRows: 1 }];
      },
    }),
  }));
  const source = { read: vi.fn(async () => snapshot('乙')), write: vi.fn(async () => {}) };
  const service = new ExternalDutyService(
    { database: { select, update, insert } } as unknown as DatabaseClient,
    new Set(),
    source as unknown as ExternalDutySource,
  );
  vi.spyOn(
    service as unknown as { authorize: () => Promise<string> },
    'authorize',
  ).mockResolvedValue('admin-user');
  vi.spyOn(
    service as unknown as { readLocalDate: () => Promise<unknown[]> },
    'readLocalDate',
  ).mockResolvedValue([
    { id: 'assignment', name: '甲', plannedName: '乙', version: 1, periodId: 'period' },
  ]);
  vi.spyOn(service, 'scan').mockResolvedValue({ checked: 1, newDifferences: 0 });
  return { action, row, source, service };
}

describe('external duty outbound confirmation', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-28T04:00:00.000Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('rejects a stale preview before writing', async () => {
    const { service, source } = fixture();
    await expect(service.pushToExternal(identity, date, 'b'.repeat(64))).rejects.toThrow('刷新');
    expect(source.write).not.toHaveBeenCalled();
  });

  it('rejects a local assignment changed and then restored to the same name', async () => {
    const { service, source } = fixture();
    vi.mocked(service['readLocalDate'] as unknown as () => Promise<unknown[]>).mockResolvedValue([
      { id: 'assignment', name: '甲', plannedName: '乙', version: 3, periodId: 'period' },
    ]);
    await expect(service.pushToExternal(identity, date, fingerprint)).rejects.toThrow(
      '本系统排班已变化',
    );
    expect(source.write).not.toHaveBeenCalled();
  });

  it('rechecks both sides before writing and verifies the saved value', async () => {
    const { service, source } = fixture();
    source.read.mockResolvedValueOnce(snapshot('乙')).mockResolvedValueOnce(snapshot('甲'));
    await expect(service.pushToExternal(identity, date, fingerprint)).resolves.toEqual({
      verified: true,
    });
    expect(source.write).toHaveBeenCalledOnce();
    expect(source.write).toHaveBeenCalledWith(date, '甲');
    expect(service.scan).toHaveBeenCalledOnce();
  });

  it('leaves the discrepancy pending when readback disagrees', async () => {
    const { action, service, row } = fixture();
    await expect(service.pushToExternal(identity, date, fingerprint)).rejects.toThrow('回读不一致');
    expect(row.status).toBe('pending');
    expect(action.status).toBe('applying');
    expect(service.scan).not.toHaveBeenCalled();
  });

  it('rejects a repeated confirmation after the first scan changes its state', async () => {
    const { service, source, row } = fixture();
    source.read.mockResolvedValueOnce(snapshot('乙')).mockResolvedValueOnce(snapshot('甲'));
    vi.mocked(service.scan).mockImplementationOnce(async () => {
      row.status = 'aligned';
      return { checked: 1, newDifferences: 0 };
    });
    await service.pushToExternal(identity, date, fingerprint);
    await expect(service.pushToExternal(identity, date, fingerprint)).rejects.toThrow('刷新');
    expect(source.write).toHaveBeenCalledOnce();
  });
});
