import { describe, expect, it } from 'vitest';

import {
  applySelectedShift,
  applyLockedShift,
  changeManualScheduleRole,
  clearManualCell,
  createManualScheduleDraft,
  getNextAvailableManualStartDate,
  getCycleDateColumns,
  isManualTemplateCellSnapshotCurrent,
  isManualGridLongPress,
  selectManualCell,
  lockManualShift,
  setManualCycleDays,
  setManualMembershipIds,
  setManualStartDate,
  unlockManualShift,
  undoManualDraft,
} from './manual-grid-logic.js';

describe('manual grid draft', () => {
  it('starts empty and uses a cell-first toggle with isolated undo snapshots', () => {
    let draft = createManualScheduleDraft({
      cycleDays: 7,
      membershipIds: ['member-1'],
      scheduleRoleId: 'role-1',
      startDate: '2026-08-31',
    });
    expect(getCycleDateColumns(draft.startDate, draft.cycleDays).map(({ date }) => date)).toEqual([
      '2026-08-31',
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
      '2026-09-04',
      '2026-09-05',
      '2026-09-06',
    ]);
    expect(applySelectedShift(draft, { id: 'day', isEnabled: true })).toBe(draft);

    draft = selectManualCell(draft, { cycleDay: 1, membershipId: 'member-1' });
    const filled = applySelectedShift(draft, { id: 'day', isEnabled: true });
    expect(filled.cells['1:member-1']).toMatchObject({ shiftTypeId: 'day' });
    const cleared = applySelectedShift(filled, { id: 'day', isEnabled: true });
    expect(cleared.cells['1:member-1']).toBeUndefined();
    expect(undoManualDraft(cleared).cells['1:member-1']).toMatchObject({ shiftTypeId: 'day' });
  });

  it('rejects disabled shifts and only recognises a stable 500ms / 12px long press', () => {
    const draft = selectManualCell(
      createManualScheduleDraft({
        cycleDays: 30,
        membershipIds: ['member-1'],
        scheduleRoleId: 'role-1',
        startDate: '2026-01-01',
      }),
      { cycleDay: 30, membershipId: 'member-1' },
    );
    expect(applySelectedShift(draft, { id: 'disabled', isEnabled: false })).toBe(draft);
    expect(isManualGridLongPress({ durationMs: 500, horizontalDistancePx: 11.9 })).toBe(true);
    expect(isManualGridLongPress({ durationMs: 499, horizontalDistancePx: 0 })).toBe(false);
    expect(isManualGridLongPress({ durationMs: 500, horizontalDistancePx: 12 })).toBe(false);
  });

  it('shares the draft and undo stack with an explicit locked shift mode', () => {
    const draft = createManualScheduleDraft({
      cycleDays: 7,
      membershipIds: ['member-1'],
      scheduleRoleId: 'role-1',
      startDate: '2026-01-01',
    });
    const locked = lockManualShift(draft, { id: 'night', isEnabled: true });
    const filled = applyLockedShift(locked, { cycleDay: 1, membershipId: 'member-1' });
    const cleared = applyLockedShift(filled, { cycleDay: 1, membershipId: 'member-1' });
    expect(filled.cells['1:member-1']?.shiftTypeId).toBe('night');
    expect(cleared.cells['1:member-1']).toBeUndefined();
    expect(cleared.undo).toHaveLength(2);
    expect(unlockManualShift(cleared).lockedShiftTypeId).toBeUndefined();
  });

  it('reconfigures the Web-equivalent role, members, date, and cycle without losing valid cells', () => {
    let draft = createManualScheduleDraft({
      cycleDays: 7,
      membershipIds: ['member-1', 'member-2'],
      scheduleRoleId: 'role-1',
      startDate: '2026-08-31',
    });
    draft = applySelectedShift(selectManualCell(draft, { cycleDay: 1, membershipId: 'member-1' }), {
      id: 'day',
      isEnabled: true,
    });
    draft = applySelectedShift(selectManualCell(draft, { cycleDay: 7, membershipId: 'member-2' }), {
      id: 'night',
      isEnabled: true,
    });

    const dated = setManualStartDate(draft, '2026-12-20');
    expect(dated.cells).toEqual(draft.cells);
    expect(dated.startDate).toBe('2026-12-20');

    const oneMember = setManualMembershipIds(dated, ['member-1']);
    expect(oneMember.membershipIds).toEqual(['member-1']);
    expect(oneMember.cells['1:member-1']?.shiftTypeId).toBe('day');
    expect(oneMember.cells['7:member-2']).toBeUndefined();
    expect(undoManualDraft(oneMember).cells['7:member-2']).toBeUndefined();
    expect(undoManualDraft(oneMember).cells['1:member-1']).toBeUndefined();

    const shortened = setManualCycleDays(draft, 1);
    expect(shortened.cycleDays).toBe(1);
    expect(shortened.cells['1:member-1']?.shiftTypeId).toBe('day');
    expect(shortened.cells['7:member-2']).toBeUndefined();
    expect(undoManualDraft(shortened).cells['7:member-2']).toBeUndefined();
    expect(undoManualDraft(shortened).cells['1:member-1']).toBeUndefined();
    expect(() => setManualCycleDays(draft, 32)).toThrow('周期天数必须在 1 到 31 天之间。');

    const changedRole = changeManualScheduleRole(draft, 'role-2');
    expect(changedRole).toMatchObject({
      cells: {},
      membershipIds: [],
      scheduleRoleId: 'role-2',
      startDate: '2026-08-31',
      undo: [],
    });
  });

  it('does not revive a cleared stale template cell through its saved display snapshot', () => {
    let draft = createManualScheduleDraft({
      cycleDays: 7,
      membershipIds: ['member-1'],
      scheduleRoleId: 'role-1',
      startDate: '2026-08-31',
    });
    draft = applySelectedShift(selectManualCell(draft, { cycleDay: 1, membershipId: 'member-1' }), {
      id: 'deleted-shift',
      isEnabled: true,
    });
    const savedCell = { shiftTypeId: 'deleted-shift' };

    expect(isManualTemplateCellSnapshotCurrent(draft.cells['1:member-1'], savedCell)).toBe(true);
    draft = clearManualCell(draft, { cycleDay: 1, membershipId: 'member-1' });
    expect(isManualTemplateCellSnapshotCurrent(draft.cells['1:member-1'], savedCell)).toBe(false);
  });

  it('ports the Web published-only next-available start-date rule', () => {
    expect(
      getNextAvailableManualStartDate(
        [
          {
            applyEndDate: '2026-10-31',
            businessMonth: '2026-10-01',
            scheduleRoleId: 'role-1',
            status: 'published',
          },
          {
            applyEndDate: '2027-03-31',
            businessMonth: '2027-03-01',
            scheduleRoleId: 'role-1',
            status: 'withdrawn',
          },
          {
            applyEndDate: '2026-12-31',
            businessMonth: '2026-12-01',
            scheduleRoleId: 'role-2',
            status: 'published',
          },
        ],
        'role-1',
        '2026-08-01',
      ),
    ).toBe('2026-11-01');
  });
});
