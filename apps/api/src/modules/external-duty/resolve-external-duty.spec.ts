import type { DatabaseClient } from '@schedule/database';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { DutyAdjustmentService } from '../duty-adjustments/duty-adjustment-service.js';
import { SwapService } from '../swaps/swap-service.js';
import { ExternalDutyResolver } from './resolve-external-duty.js';

const identity = { cloudbaseUid: 'admin' } as AuthenticatedIdentity;
const dates = ['2026-10-22', '2026-10-23', '2026-10-24'];
function fixture(target = ['乙', '甲']) {
  const names = ['甲', '乙', '丙'];
  const rows = target.map((remoteName, i) => ({
    businessDate: dates[i]!,
    groupId: 'group',
    schedulePeriodId: 'period',
    assignmentId: `a${i}`,
    assignmentVersion: 1,
    localName: names[i]!,
    remoteName,
    baselineName: names[i]!,
    changeSource: i ? 'remote' : 'both',
    status: 'pending',
    isInScope: 1,
    blockReason: null,
    fingerprint: String(i).repeat(64),
  }));
  const locals = rows.map((row) => ({
    id: row.assignmentId,
    version: 1,
    periodId: 'period',
    name: row.localName,
    membershipId: `member-${row.localName}`,
    baselineName: row.baselineName,
  }));
  const duties = new Map(rows.map((row) => [row.businessDate, row.remoteName]));
  const query = {
    from: () => query,
    where: () => query,
    orderBy: async () => rows,
    limit: async () => [rows[0]],
    for: async () => [],
  };
  const update = vi.fn(() => ({ set: () => ({ where: async () => [{ affectedRows: 1 }] }) }));
  const audit = vi.fn(async () => undefined);
  const database = {
    select: () => query,
    update,
    insert: () => ({ values: audit }),
    transaction: async (run: (tx: unknown) => unknown) => run(database),
  };
  const ports = {
    authorize: vi.fn(async () => 'actor'),
    readLocal: vi.fn(async (_group: string, date: string) => [{ ...locals[dates.indexOf(date)]! }]),
    readRemote: vi.fn(async () => ({ duties, people: names })),
    member: vi.fn(async (_group: string, _date: string, name: string) => `member-${name}`),
    push: vi.fn(async () => ({ verified: true })),
    scan: vi.fn(async () => undefined),
  };
  const swapPreview = vi
    .spyOn(SwapService.prototype, 'preview')
    .mockResolvedValue({ conflicts: [] } as never);
  const swap = vi
    .spyOn(SwapService.prototype, 'createDirect')
    .mockImplementation(async (_i, _g, input) => {
      const a = locals.find((row) => row.id === input.initiatorAssignmentId)!;
      const b = locals.find((row) => row.id === input.targetAssignmentId)!;
      [a.name, b.name] = [b.name, a.name];
      [a.membershipId, b.membershipId] = [b.membershipId, a.membershipId];
      a.version++;
      b.version++;
      return { id: input.operationId, status: 'completed' } as never;
    });
  vi.spyOn(DutyAdjustmentService.prototype, 'preview').mockResolvedValue({
    conflicts: [],
  } as never);
  const duty = vi
    .spyOn(DutyAdjustmentService.prototype, 'createDirect')
    .mockImplementation(async (_i, _g, input) => {
      const a = locals.find((row) => row.id === input.coveredAssignmentId)!;
      a.membershipId = input.overtimeMembershipId;
      a.name = input.overtimeMembershipId.replace('member-', '');
      a.version++;
      return { id: input.operationId, status: 'completed' } as never;
    });
  const resolver = new ExternalDutyResolver({ database } as unknown as DatabaseClient, ports);
  const input = {
    date: dates[0]!,
    expectedFingerprint: rows[0]!.fingerprint,
    direction: 'to_local' as const,
  };
  return { resolver, input, rows, locals, duties, ports, update, audit, swap, duty, swapPreview };
}
describe('explicit external duty direction', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-22T01:00:00Z'));
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('previews the complete repeated swap without writing', async () => {
    const f = fixture();
    const preview = await f.resolver.preview(identity, f.input);
    expect(preview).toMatchObject({
      kind: 'swap',
      conflicts: [],
      changes: [
        { date: dates[0], before: '甲', after: '乙' },
        { date: dates[1], before: '乙', after: '甲' },
      ],
    });
    expect(preview.steps).toHaveLength(1);
    expect(f.update).not.toHaveBeenCalled();
    expect(f.audit).not.toHaveBeenCalled();
    expect(f.swap).not.toHaveBeenCalled();
    expect(f.ports.push).not.toHaveBeenCalled();
  });
  it('executes both changed dates through a guarded original workflow', async () => {
    const f = fixture();
    const preview = await f.resolver.preview(identity, f.input);
    await expect(
      f.resolver.apply(identity, { ...f.input, planFingerprint: preview.planFingerprint }),
    ).resolves.toEqual({ completedSteps: 1, verified: true });
    expect(f.locals.map((row) => row.name)).toEqual(['乙', '甲']);
    expect(f.swap.mock.calls[0]![3]).toEqual([
      { id: 'a0', version: 1 },
      { id: 'a1', version: 1 },
    ]);
    expect(f.audit).toHaveBeenCalledTimes(1);
    expect(f.ports.scan).toHaveBeenCalledTimes(1);
  });
  it.each(['version', 'remote', 'baseline', 'member'])(
    'rejects a changed %s before claiming any date',
    async (change) => {
      const f = fixture();
      const preview = await f.resolver.preview(identity, f.input);
      if (change === 'version') f.locals[1]!.version++;
      if (change === 'remote') f.duties.set(dates[1]!, '丙');
      if (change === 'baseline') f.locals[1]!.baselineName = '丙';
      if (change === 'member') f.ports.member.mockResolvedValue('different-member');
      await expect(
        f.resolver.apply(identity, { ...f.input, planFingerprint: preview.planFingerprint }),
      ).rejects.toThrow();
      expect(f.swap).not.toHaveBeenCalled();
      expect(f.update).not.toHaveBeenCalled();
    },
  );
  it('includes a newly connected date and refuses its stale scan', async () => {
    const f = fixture(['乙', '甲', '丙']);
    const preview = await f.resolver.preview(identity, f.input);
    f.duties.set(dates[2]!, '乙');
    await expect(
      f.resolver.apply(identity, { ...f.input, planFingerprint: preview.planFingerprint }),
    ).rejects.toThrow('重新检测');
    expect(f.swap).not.toHaveBeenCalled();
  });
  it.each(['blocked', 'processing'])('preserves %s safeguards', async (status) => {
    const f = fixture();
    f.rows[1]!.status = status;
    await expect(f.resolver.preview(identity, f.input)).rejects.toThrow();
    expect(f.swap).not.toHaveBeenCalled();
  });
  it('checks platform authorization before reading business data', async () => {
    const f = fixture();
    f.ports.authorize.mockRejectedValue(new Error('forbidden'));
    await expect(f.resolver.preview(identity, f.input)).rejects.toThrow('forbidden');
    expect(f.ports.readRemote).not.toHaveBeenCalled();
  });
  it('previews and confirms only the selected outbound date even when both sides changed', async () => {
    const f = fixture();
    const input = { ...f.input, direction: 'to_external' as const };
    const preview = await f.resolver.preview(identity, input);
    expect(preview.changes).toEqual([{ date: dates[0], before: '乙', after: '甲' }]);
    await f.resolver.apply(identity, { ...input, planFingerprint: preview.planFingerprint });
    expect(f.ports.push).toHaveBeenCalledWith(identity, input.date, input.expectedFingerprint);
    expect(f.swap).not.toHaveBeenCalled();
  });
  it('creates every related duty adjustment when counts change', async () => {
    const f = fixture(['乙', '丙']);
    const preview = await f.resolver.preview(identity, f.input);
    expect(preview.kind).toBe('duty');
    expect(preview.changes).toHaveLength(2);
    await f.resolver.apply(identity, { ...f.input, planFingerprint: preview.planFingerprint });
    expect(f.duty).toHaveBeenCalledTimes(2);
    expect(f.locals.map((row) => row.name)).toEqual(['乙', '丙']);
  });
  it('records completed steps and reports partial completion if the next step conflicts', async () => {
    const f = fixture(['乙', '丙', '甲']);
    const preview = await f.resolver.preview(identity, f.input);
    f.swapPreview
      .mockResolvedValueOnce({ conflicts: [] } as never)
      .mockResolvedValueOnce({ conflicts: [{ message: '班次冲突' }] } as never);
    await expect(
      f.resolver.apply(identity, { ...f.input, planFingerprint: preview.planFingerprint }),
    ).rejects.toThrow('已提交 1 步');
    expect(f.swap).toHaveBeenCalledTimes(1);
    expect(f.audit).toHaveBeenCalledTimes(1);
    expect(f.ports.scan).toHaveBeenCalled();
  });
  it('retains the submitted-step count when the final scan fails', async () => {
    const f = fixture();
    const preview = await f.resolver.preview(identity, f.input);
    f.ports.scan.mockRejectedValue(new Error('scan unavailable'));
    await expect(
      f.resolver.apply(identity, { ...f.input, planFingerprint: preview.planFingerprint }),
    ).rejects.toThrow('已提交 1 步，校对状态刷新未完成');
    expect(f.locals.map((row) => row.name)).toEqual(['乙', '甲']);
    expect(f.audit).toHaveBeenCalledTimes(1);
  });
  it('does not replace a partial-step error when cleanup scanning also fails', async () => {
    const f = fixture(['乙', '丙', '甲']);
    const preview = await f.resolver.preview(identity, f.input);
    f.swapPreview
      .mockResolvedValueOnce({ conflicts: [] } as never)
      .mockResolvedValueOnce({ conflicts: [{ message: '班次冲突' }] } as never);
    f.ports.scan.mockRejectedValue(new Error('scan unavailable'));
    await expect(
      f.resolver.apply(identity, { ...f.input, planFingerprint: preview.planFingerprint }),
    ).rejects.toThrow('已提交 1 步，后续未完成');
  });
});
