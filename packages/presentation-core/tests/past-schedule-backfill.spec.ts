import { describe, expect, it } from 'vitest';

import {
  createBackfillStageKey,
  createPastScheduleBackfillBatchSnapshot,
  filterPastScheduleBackfillStages,
  getPastScheduleBackfillBatchFingerprint,
  isAssignmentStagedForRemoval,
  listBackfillStagesForDate,
  summarizePastScheduleBackfillStages,
  toggleBackfillSelection,
  toggleBackfillStage,
  type PastScheduleBackfillStage,
  type PastScheduleBackfillStageMap,
} from '../src/index.js';

const roleA = 'role-a';
const roleB = 'role-b';
const memberA = 'member-a';
const memberB = 'member-b';
const assignmentA = 'assignment-a';
const shiftA = 'shift-a';
const shiftB = 'shift-b';
const context = { businessMonth: '2026-07', today: '2026-08-26' };

const addStage = (overrides: Partial<PastScheduleBackfillStage> = {}): PastScheduleBackfillStage => ({
  actualMembershipId: memberA,
  assignmentId: '',
  businessDate: '2026-07-01',
  kind: 'add',
  scheduleRoleId: roleA,
  shiftTypeId: shiftA,
  ...overrides,
});

const removeStage = (
  overrides: Partial<PastScheduleBackfillStage> = {},
): PastScheduleBackfillStage => ({
  actualMembershipId: '',
  assignmentId: assignmentA,
  businessDate: '2026-07-01',
  kind: 'remove',
  scheduleRoleId: roleA,
  shiftTypeId: shiftA,
  ...overrides,
});

describe('past schedule backfill staging', () => {
  it('keeps several staged changes on the same date when the target differs', () => {
    let stages: PastScheduleBackfillStageMap = new Map();
    const first = toggleBackfillStage(stages, addStage(), context);
    expect(first.outcome).toBe('added');
    stages = first.stages;

    // A second member on the same role/date/shift must not wipe the first change.
    const second = toggleBackfillStage(stages, addStage({ actualMembershipId: memberB }), context);
    expect(second.outcome).toBe('added');
    stages = second.stages;

    const removal = toggleBackfillStage(stages, removeStage(), context);
    expect(removal.outcome).toBe('added');
    stages = removal.stages;

    expect(stages.size).toBe(3);
    expect(listBackfillStagesForDate(stages, { businessDate: '2026-07-01', scheduleRoleId: roleA }))
      .toHaveLength(3);
    expect(
      isAssignmentStagedForRemoval(stages, {
        assignmentId: assignmentA,
        businessDate: '2026-07-01',
        scheduleRoleId: roleA,
      }),
    ).toBe(true);
    expect(
      isAssignmentStagedForRemoval(stages, {
        assignmentId: 'assignment-other',
        businessDate: '2026-07-01',
        scheduleRoleId: roleA,
      }),
    ).toBe(false);
  });

  it('toggles the same target off again', () => {
    const added = toggleBackfillStage(new Map(), removeStage(), context);
    expect(added.outcome).toBe('added');
    const removed = toggleBackfillStage(added.stages, removeStage(), context);
    expect(removed.outcome).toBe('removed');
    expect(removed.stages.size).toBe(0);
  });

  it('requires a target for each kind and keeps the stage key distinct per kind', () => {
    expect(toggleBackfillStage(new Map(), addStage({ actualMembershipId: '' }), context).outcome).toBe(
      'selection-required',
    );
    expect(toggleBackfillStage(new Map(), removeStage({ assignmentId: '' }), context).outcome).toBe(
      'selection-required',
    );
    expect(createBackfillStageKey(addStage())).not.toBe(createBackfillStageKey(removeStage()));
  });

  it('rejects invalid, future, out-of-month and over-limit stages', () => {
    expect(
      toggleBackfillStage(new Map(), addStage({ businessDate: '2026-02-30' }), context).outcome,
    ).toBe('invalid-date');
    expect(
      toggleBackfillStage(new Map(), addStage({ businessDate: '0999-12-31' }), context).outcome,
    ).toBe('invalid-date');
    expect(
      toggleBackfillStage(new Map(), addStage({ businessDate: '2026-08-26' }), {
        businessMonth: '2026-08',
        today: '2026-08-26',
      }).outcome,
    ).toBe('not-past');
    expect(
      toggleBackfillStage(new Map(), addStage({ businessDate: '2026-06-30' }), context).outcome,
    ).toBe('outside-month');

    let stages: PastScheduleBackfillStageMap = new Map();
    for (let day = 1; day <= 3; day += 1) {
      const result = toggleBackfillStage(
        stages,
        addStage({ businessDate: `2026-07-0${day}`, actualMembershipId: `member-${day}` }),
        { ...context, maximumItems: 2 },
      );
      stages = result.stages;
      expect(result.outcome).toBe(day <= 2 ? 'added' : 'limit-reached');
    }
    expect(stages.size).toBe(2);
  });

  it('splits additions and removals in the snapshot and hashes both', () => {
    let stages: PastScheduleBackfillStageMap = new Map();
    stages = toggleBackfillStage(stages, addStage(), context).stages;
    stages = toggleBackfillStage(stages, removeStage(), context).stages;
    expect(stages.size).toBe(2);
    const snapshot = createPastScheduleBackfillBatchSnapshot(stages, ' 实际值班人员更正 ', 'op-1');
    expect(snapshot.items.map((item) => item.kind)).toEqual(['add']);
    expect(snapshot.removals.map((item) => item.kind)).toEqual(['remove']);
    expect(snapshot.reason).toBe('实际值班人员更正');
    const fingerprint = getPastScheduleBackfillBatchFingerprint(
      snapshot.items,
      snapshot.removals,
      snapshot.reason,
    );
    expect(
      getPastScheduleBackfillBatchFingerprint(
        [...snapshot.items].reverse(),
        [...snapshot.removals].reverse(),
        ' 实际值班人员更正 ',
      ),
    ).toBe(fingerprint);
    expect(
      getPastScheduleBackfillBatchFingerprint(snapshot.items, [], snapshot.reason),
    ).not.toBe(fingerprint);
  });

  it('filters by role and month and summarises names per kind', () => {
    let stages: PastScheduleBackfillStageMap = new Map();
    stages = toggleBackfillStage(stages, addStage(), context).stages;
    stages = toggleBackfillStage(
      stages,
      addStage({ businessDate: '2026-07-12', actualMembershipId: memberB, shiftTypeId: shiftB }),
      context,
    ).stages;
    stages = toggleBackfillStage(
      stages,
      addStage({ businessDate: '2026-08-02', actualMembershipId: memberB }),
      context,
    ).stages;
    stages = toggleBackfillStage(
      stages,
      addStage({ scheduleRoleId: roleB, actualMembershipId: memberB }),
      context,
    ).stages;

    const filtered = filterPastScheduleBackfillStages(stages, {
      businessMonth: '2026-07',
      scheduleRoleId: roleA,
    });
    expect(filtered.size).toBe(2);
    const summaries = summarizePastScheduleBackfillStages(filtered, {
      memberNames: new Map([
        [memberA, '张三'],
        [memberB, '李四'],
      ]),
      shiftTypeNames: new Map([
        [shiftA, 'A班'],
        [shiftB, 'B班'],
      ]),
    });
    expect(summaries).toEqual([
      { businessDate: '2026-07-01', kind: 'add', memberName: '张三', scheduleRoleId: roleA, shiftTypeName: 'A班' },
      { businessDate: '2026-07-12', kind: 'add', memberName: '李四', scheduleRoleId: roleA, shiftTypeName: 'B班' },
    ]);
  });

  it('toggles the shift and member selection', () => {
    expect(toggleBackfillSelection('', 'x')).toBe('x');
    expect(toggleBackfillSelection('x', 'x')).toBe('');
    expect(toggleBackfillSelection('x', 'y')).toBe('y');
  });
});
