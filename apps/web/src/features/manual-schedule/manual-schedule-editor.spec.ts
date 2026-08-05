import type {
  ManualScheduleTemplate,
  SchedulePeriodHistoryItem,
  ShiftType,
} from '@schedule/contracts';
import { describe, expect, it } from 'vitest';

import {
  applyShiftToCell,
  clearCell,
  clearColumn,
  clearRow,
  createTemplateUndoStack,
  findPublishedOverlapMonths,
  formatScheduleDraftCode,
  getNextAvailableStartDate,
  getTemplateCellShiftTypeId,
  getTemplateDateColumns,
  isShiftTypeFillable,
  templateToCellMap,
  type TemplateCellMap,
} from './manual-schedule-logic.js';

describe('manual schedule template editor logic', () => {
  it('generates one date column per cycle day with weekdays across month boundaries', () => {
    const sevenDays = getTemplateDateColumns('2026-08-01', 7);

    expect(sevenDays).toHaveLength(7);
    expect(sevenDays[0]).toEqual({ cycleDay: 1, date: '2026-08-01', weekday: '六' });
    expect(sevenDays[6]).toEqual({ cycleDay: 7, date: '2026-08-07', weekday: '五' });

    const thirtyDays = getTemplateDateColumns('2026-08-25', 30);
    expect(thirtyDays).toHaveLength(30);
    expect(thirtyDays.at(-1)).toEqual({ cycleDay: 30, date: '2026-09-23', weekday: '三' });

    expect(() => getTemplateDateColumns('2026-08-01', 32)).toThrow();
    expect(() => getTemplateDateColumns('2026-8-1', 7)).toThrow();
  });

  it('fills and clears only the targeted cell', () => {
    const cells: TemplateCellMap = new Map([
      ['1:member-1', 'shift-a'],
      ['2:member-1', 'shift-b'],
      ['1:member-2', 'shift-c'],
    ]);

    const filled = applyShiftToCell(cells, 1, 'member-2', 'shift-d');
    expect(getTemplateCellShiftTypeId(filled, 1, 'member-2')).toBe('shift-d');
    expect(getTemplateCellShiftTypeId(filled, 1, 'member-1')).toBe('shift-a');
    expect(filled.size).toBe(3);

    const cleared = clearCell(filled, 1, 'member-1');
    expect(getTemplateCellShiftTypeId(cleared, 1, 'member-1')).toBeUndefined();
    expect(getTemplateCellShiftTypeId(cleared, 2, 'member-1')).toBe('shift-b');
    expect(cleared.size).toBe(2);
  });

  it('computes the next available start date after the latest scheduled range', () => {
    const history = [
      {
        applyEndDate: '2026-10-31',
        businessMonth: '2026-10-01',
        id: 'period-1',
        scheduleRoleId: 'role-1',
        status: 'published',
      },
      {
        applyEndDate: '2027-03-08',
        businessMonth: '2027-03-01',
        id: 'period-archived',
        scheduleRoleId: 'role-1',
        status: 'replaced',
      },
      {
        applyEndDate: '2027-03-31',
        businessMonth: '2027-03-01',
        id: 'period-deleted',
        scheduleRoleId: 'role-1',
        status: 'withdrawn',
      },
      {
        applyEndDate: '2026-09-30',
        businessMonth: '2026-09-01',
        id: 'period-2',
        scheduleRoleId: 'role-2',
        status: 'draft',
      },
    ] as unknown as SchedulePeriodHistoryItem[];

    expect(getNextAvailableStartDate(history, 'role-1', '2026-08-01')).toBe('2026-11-01');
    expect(getNextAvailableStartDate(history, 'role-3', '2026-08-01')).toBe('2026-08-01');
  });

  it('clears a whole row or column without touching other ranges', () => {
    const cells: TemplateCellMap = new Map([
      ['1:member-1', 'shift-a'],
      ['2:member-1', 'shift-b'],
      ['3:member-1', 'shift-c'],
      ['1:member-2', 'shift-d'],
      ['2:member-2', 'shift-e'],
    ]);

    const rowCleared = clearRow(cells, 'member-1');
    expect([...rowCleared.keys()].sort()).toEqual(['1:member-2', '2:member-2']);

    const columnCleared = clearColumn(cells, 2);
    expect([...columnCleared.keys()].sort()).toEqual(['1:member-1', '1:member-2', '3:member-1']);
  });

  it('only allows enabled shift types to be filled', () => {
    expect(isShiftTypeFillable(shiftType({ isEnabled: true }))).toBe(true);
    expect(isShiftTypeFillable(shiftType({ isEnabled: false }))).toBe(false);
  });

  it('converts a saved template back into the editor cell map', () => {
    const template: ManualScheduleTemplate = {
      cells: [
        templateCell({ cycleDay: 1, membershipId: 'member-1', shiftTypeId: 'shift-a' }),
        templateCell({ cycleDay: 2, membershipId: 'member-1', shiftTypeId: 'shift-b' }),
      ],
      cycleDays: 7,
      groupId: 'group-1',
      id: 'template-1',
      members: [],
      scheduleRoleId: 'role-1',
      scheduleRoleName: '一线',
      startDate: '2026-08-01',
      version: 1,
    };

    expect(templateToCellMap(template)).toEqual(
      new Map([
        ['1:member-1', 'shift-a'],
        ['2:member-1', 'shift-b'],
      ]),
    );
  });

  it('restores the pre-clear snapshot from the undo stack', () => {
    const undo = createTemplateUndoStack();
    const cells = new Map<string, string>([['1:member-1', 'shift-a']]);
    undo.push(cells);
    cells.set('2:member-1', 'shift-b');

    expect(undo.canUndo()).toBe(true);
    const restored = undo.pop();
    expect(restored).toEqual(new Map([['1:member-1', 'shift-a']]));
    expect(undo.canUndo()).toBe(false);
    expect(undo.pop()).toBeUndefined();
  });

  it('clears the undo history when opening another template', () => {
    const undo = createTemplateUndoStack();
    undo.push(new Map([['1:member-1', 'shift-a']]));
    undo.clear();

    expect(undo.canUndo()).toBe(false);
  });

  it('formats draft codes from the precise China business time', () => {
    expect(formatScheduleDraftCode('2026-08-03T06:07:08.123Z')).toBe('D20260803-140708');
    expect(formatScheduleDraftCode('invalid')).toBe('D时间未知');
  });

  it('lists every published month overlapping the same scheduling role', () => {
    const drafts = [
      historyItem({ businessMonth: '2026-08', id: 'draft-august', status: 'draft' }),
      historyItem({ businessMonth: '2026-09', id: 'draft-september', status: 'draft' }),
      historyItem({ businessMonth: '2026-10', id: 'draft-october', status: 'draft' }),
    ];
    const history = [
      historyItem({ businessMonth: '2026-09-01', id: 'published-september', status: 'published' }),
      historyItem({ businessMonth: '2026-08', id: 'published-august', status: 'published' }),
      historyItem({
        businessMonth: '2026-10',
        id: 'other-role-october',
        scheduleRoleId: 'role-2',
        status: 'published',
      }),
      historyItem({ businessMonth: '2026-10', id: 'replaced-october', status: 'replaced' }),
    ];

    expect(findPublishedOverlapMonths(drafts, history)).toEqual(['2026-08', '2026-09']);
  });
});

function historyItem(
  overrides: Partial<SchedulePeriodHistoryItem> & Pick<SchedulePeriodHistoryItem, 'id' | 'status'>,
): SchedulePeriodHistoryItem {
  return {
    businessMonth: '2026-08',
    createdAt: '2026-08-03T06:07:08.123Z',
    revision: 1,
    scheduleRoleId: 'role-1',
    scheduleRoleName: '一线',
    version: 1,
    ...overrides,
  };
}

function shiftType(overrides: Partial<ShiftType>): ShiftType {
  return {
    abbreviation: '全',
    color: '#1F5AA6',
    configurationVersion: 1,
    countsTowardStatistics: true,
    crossesMidnight: true,
    displayOrder: 1,
    endTime: '08:00',
    id: 'shift-1',
    isAllDay: true,
    isBuiltIn: true,
    isEnabled: false,
    name: '全天班',
    startTime: '08:00',
    textColor: '#FFFFFF',
    version: 1,
    ...overrides,
  };
}

function templateCell(overrides: {
  readonly cycleDay: number;
  readonly membershipId: string;
  readonly shiftTypeId: string;
}): ManualScheduleTemplate['cells'][number] {
  return {
    currentShiftTypeConfigurationVersion: 1,
    cycleDay: overrides.cycleDay,
    isShiftTypeEnabled: true,
    isStale: false,
    membershipId: overrides.membershipId,
    shiftTypeAbbreviation: '全',
    shiftTypeColor: '#1F5AA6',
    shiftTypeConfigurationVersion: 1,
    shiftTypeId: overrides.shiftTypeId,
    shiftTypeName: '全天班',
    shiftTypeTextColor: '#FFFFFF',
  };
}
