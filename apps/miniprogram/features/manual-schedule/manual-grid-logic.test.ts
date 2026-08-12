import { describe, expect, it } from 'vitest';

import {
  applySelectedShift,
  createManualScheduleDraft,
  getCycleDateColumns,
  isManualGridLongPress,
  selectManualCell,
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
});
