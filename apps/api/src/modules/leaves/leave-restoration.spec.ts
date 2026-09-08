import { describe, expect, it } from 'vitest';
import { readClearedAssignmentSnapshots, restorationSkipReason } from './leave-restoration.js';

const snapshot = {
  id: 'shift',
  schedulePeriodId: 'period',
  plannedMembershipId: 'member',
  plannedMemberName: 'Doctor',
  actualMembershipId: null,
  actualMemberName: null,
  version: 3,
  clearedVersion: 4,
};
const vacancy = {
  id: 'shift',
  schedulePeriodId: 'period',
  plannedMembershipId: null,
  plannedMemberName: null,
  actualMembershipId: null,
  actualMemberName: null,
  version: 4,
  startsAt: new Date('2026-09-10T00:00:00Z'),
};
const period = { id: 'period', status: 'published', deletedAt: null };
const now = new Date('2026-09-09T23:59:59Z');

describe('conditional leave restoration', () => {
  it('restores only the unchanged vacancy left by this approval', () => {
    expect(restorationSkipReason(snapshot, vacancy, period, now)).toBeUndefined();
    expect(restorationSkipReason(snapshot, { ...vacancy, version: 6 }, period, now)).toBe(
      'assignment_changed',
    );
    expect(
      restorationSkipReason(
        snapshot,
        { ...vacancy, plannedMembershipId: 'replacement' },
        period,
        now,
      ),
    ).toBe('assignment_changed');
  });
  it('does not restore archived, missing or started assignments', () => {
    expect(restorationSkipReason(snapshot, vacancy, { ...period, status: 'replaced' }, now)).toBe(
      'period_changed',
    );
    expect(restorationSkipReason(snapshot, undefined, period, now)).toBe('assignment_missing');
    expect(restorationSkipReason(snapshot, vacancy, period, vacancy.startsAt)).toBe(
      'already_started',
    );
  });
  it('rejects missing, corrupt and conflicting event snapshots', () => {
    const before = { snapshotSchemaVersion: 1, assignments: [snapshot] };
    expect(readClearedAssignmentSnapshots(before, { clearedVersions: { shift: 4 } })).toHaveLength(
      1,
    );
    expect(readClearedAssignmentSnapshots(null, null)).toEqual([]);
    expect(
      readClearedAssignmentSnapshots(
        { assignments: [snapshot] },
        { clearedVersions: { shift: 4 } },
      ),
    ).toEqual([]);
    expect(
      readClearedAssignmentSnapshots(
        { ...before, snapshotSchemaVersion: 2 },
        { clearedVersions: { shift: 4 } },
      ),
    ).toEqual([]);
    expect(readClearedAssignmentSnapshots(before, { clearedVersions: { shift: 5 } })).toEqual([]);
    expect(
      readClearedAssignmentSnapshots(
        { snapshotSchemaVersion: 1, assignments: [snapshot, snapshot] },
        { clearedVersions: { shift: 4 } },
      ),
    ).toEqual([]);
    expect(
      readClearedAssignmentSnapshots(
        { snapshotSchemaVersion: 1, assignments: [{ ...snapshot, plannedMemberName: 42 }] },
        { clearedVersions: { shift: 4 } },
      ),
    ).toEqual([]);
  });
});
