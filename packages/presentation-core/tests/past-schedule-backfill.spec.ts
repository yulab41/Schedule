import { describe, expect, it } from 'vitest';

import {
  createBackfillStageKey,
  createPastScheduleBackfillBatchSnapshot,
  filterPastScheduleBackfillStages,
  getPastScheduleBackfillBatchFingerprint,
  summarizePastScheduleBackfillStages,
  toggleBackfillSelection,
  toggleBackfillStage,
  type PastScheduleBackfillStageMap,
} from '../src/past-schedule-backfill.js';

const roleA = 'role-a';
const roleB = 'role-b';

describe('past schedule backfill presentation model', () => {
  it('cancels a palette selection when the active option is pressed again', () => {
    expect(toggleBackfillSelection('', 'shift-a')).toBe('shift-a');
    expect(toggleBackfillSelection('shift-a', 'shift-a')).toBe('');
    expect(toggleBackfillSelection('shift-a', 'shift-b')).toBe('shift-b');
  });

  it('binds a staged date to its role and removes the same role/date on a second press', () => {
    const added = toggleBackfillStage(
      new Map(),
      {
        actualMembershipId: 'member-a',
        businessDate: '2026-07-03',
        scheduleRoleId: roleA,
        shiftTypeId: 'shift-a',
      },
      { businessMonth: '2026-07', maximumItems: 31, today: '2026-08-24' },
    );

    expect(added.outcome).toBe('added');
    expect([...added.stages.values()]).toEqual([
      {
        actualMembershipId: 'member-a',
        businessDate: '2026-07-03',
        scheduleRoleId: roleA,
        shiftTypeId: 'shift-a',
      },
    ]);

    const anotherRole = toggleBackfillStage(
      added.stages,
      {
        actualMembershipId: 'member-b',
        businessDate: '2026-07-03',
        scheduleRoleId: roleB,
        shiftTypeId: 'shift-b',
      },
      { businessMonth: '2026-07', maximumItems: 31, today: '2026-08-24' },
    );
    expect(anotherRole.stages.size).toBe(2);

    const removed = toggleBackfillStage(
      anotherRole.stages,
      {
        actualMembershipId: '',
        businessDate: '2026-07-03',
        scheduleRoleId: roleA,
        shiftTypeId: '',
      },
      { businessMonth: '2026-07', maximumItems: 31, today: '2026-08-24' },
    );
    expect(removed.outcome).toBe('removed');
    expect([...removed.stages.values()]).toEqual([
      {
        actualMembershipId: 'member-b',
        businessDate: '2026-07-03',
        scheduleRoleId: roleB,
        shiftTypeId: 'shift-b',
      },
    ]);
  });

  it('fails closed for missing selections, invalid dates, today/future dates, and another month', () => {
    const item = {
      actualMembershipId: 'member-a',
      businessDate: '2026-07-03',
      scheduleRoleId: roleA,
      shiftTypeId: 'shift-a',
    } as const;
    const context = { businessMonth: '2026-07', maximumItems: 31, today: '2026-08-24' };

    expect(
      toggleBackfillStage(new Map(), { ...item, actualMembershipId: '' }, context).outcome,
    ).toBe('selection-required');
    expect(
      toggleBackfillStage(new Map(), { ...item, businessDate: '2026-02-30' }, context).outcome,
    ).toBe('invalid-date');
    expect(
      toggleBackfillStage(new Map(), { ...item, businessDate: '0999-12-31' }, context).outcome,
    ).toBe('invalid-date');
    expect(
      toggleBackfillStage(
        new Map(),
        { ...item, businessDate: '2026-08-24' },
        { ...context, businessMonth: '2026-08' },
      ).outcome,
    ).toBe('not-past');
    expect(
      toggleBackfillStage(
        new Map(),
        { ...item, businessDate: '2026-08-25' },
        { ...context, businessMonth: '2026-08' },
      ).outcome,
    ).toBe('not-past');
    expect(
      toggleBackfillStage(new Map(), { ...item, businessDate: '2026-06-30' }, context).outcome,
    ).toBe('outside-month');
  });

  it('accepts exactly 31 staged dates and rejects the next unique date', () => {
    let stages: PastScheduleBackfillStageMap = new Map();
    for (let day = 1; day <= 31; day += 1) {
      const result = toggleBackfillStage(
        stages,
        {
          actualMembershipId: 'member-a',
          businessDate: `2026-07-${String(day).padStart(2, '0')}`,
          scheduleRoleId: roleA,
          shiftTypeId: 'shift-a',
        },
        { businessMonth: '2026-07', today: '2026-08-24' },
      );
      expect(result.outcome).toBe('added');
      stages = result.stages;
    }

    const rejected = toggleBackfillStage(
      stages,
      {
        actualMembershipId: 'member-a',
        businessDate: '2026-06-30',
        scheduleRoleId: roleA,
        shiftTypeId: 'shift-a',
      },
      { businessMonth: '2026-06', today: '2026-08-24' },
    );
    expect(rejected.outcome).toBe('limit-reached');
    expect(rejected.stages).toBe(stages);
  });

  it('sorts summaries and filters stages to the active role and month', () => {
    const stages: PastScheduleBackfillStageMap = new Map([
      [
        createBackfillStageKey(roleA, '2026-07-12'),
        {
          actualMembershipId: 'member-b',
          businessDate: '2026-07-12',
          scheduleRoleId: roleA,
          shiftTypeId: 'shift-b',
        },
      ],
      [
        createBackfillStageKey(roleA, '2026-07-02'),
        {
          actualMembershipId: 'member-a',
          businessDate: '2026-07-02',
          scheduleRoleId: roleA,
          shiftTypeId: 'shift-a',
        },
      ],
      [
        createBackfillStageKey(roleB, '2026-07-01'),
        {
          actualMembershipId: 'member-a',
          businessDate: '2026-07-01',
          scheduleRoleId: roleB,
          shiftTypeId: 'shift-a',
        },
      ],
    ]);

    const filtered = filterPastScheduleBackfillStages(stages, {
      businessMonth: '2026-07',
      scheduleRoleId: roleA,
    });
    expect([...filtered.values()].map((stage) => stage.businessDate)).toEqual([
      '2026-07-12',
      '2026-07-02',
    ]);
    expect(
      summarizePastScheduleBackfillStages(filtered, {
        memberNames: new Map([
          ['member-a', '林医生'],
          ['member-b', '陈医生'],
        ]),
        shiftTypeNames: new Map([
          ['shift-a', '白班'],
          ['shift-b', '夜班'],
        ]),
      }),
    ).toEqual([
      {
        businessDate: '2026-07-02',
        memberName: '林医生',
        scheduleRoleId: roleA,
        shiftTypeName: '白班',
      },
      {
        businessDate: '2026-07-12',
        memberName: '陈医生',
        scheduleRoleId: roleA,
        shiftTypeName: '夜班',
      },
    ]);
  });

  it('creates a detached frozen snapshot and a stable payload fingerprint', () => {
    const source = new Map([
      [
        createBackfillStageKey(roleA, '2026-07-02'),
        {
          actualMembershipId: 'member-a',
          businessDate: '2026-07-02',
          scheduleRoleId: roleA,
          shiftTypeId: 'shift-a',
        },
      ],
    ]);
    const snapshot = createPastScheduleBackfillBatchSnapshot(
      source,
      '  实际值班人员更正  ',
      'operation-a',
    );

    source.clear();
    expect(snapshot).toEqual({
      items: [
        {
          actualMembershipId: 'member-a',
          businessDate: '2026-07-02',
          scheduleRoleId: roleA,
          shiftTypeId: 'shift-a',
        },
      ],
      operationId: 'operation-a',
      reason: '实际值班人员更正',
    });
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.items)).toBe(true);
    expect(Object.isFrozen(snapshot.items[0])).toBe(true);
    expect(getPastScheduleBackfillBatchFingerprint(snapshot.items, snapshot.reason)).toBe(
      getPastScheduleBackfillBatchFingerprint(snapshot.items, ' 实际值班人员更正 '),
    );
    expect(
      getPastScheduleBackfillBatchFingerprint([...snapshot.items].reverse(), snapshot.reason),
    ).toBe(getPastScheduleBackfillBatchFingerprint(snapshot.items, snapshot.reason));
    expect(getPastScheduleBackfillBatchFingerprint(snapshot.items, '另一原因')).not.toBe(
      getPastScheduleBackfillBatchFingerprint(snapshot.items, snapshot.reason),
    );
  });
});
